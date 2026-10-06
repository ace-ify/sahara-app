"""
brain.py — LLM adapter for Sahaara's CustomLLM path.

Agora ConvoAI's CustomLLM speaks OpenAI chat-completions (style="openai").
Our gateway (ANTHROPIC_BASE_URL) speaks Anthropic /v1/messages only.
This module translates: OpenAI request -> Claude (gateway) stream -> text deltas,
with a Groq (OpenAI-compatible) fallback. The /llm endpoint wraps these deltas
back into OpenAI SSE. Detection (Laya) + tools hook in the endpoint, not here.
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import AsyncGenerator

from dotenv import load_dotenv
import httpx

_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_base_dir, '.env'), override=True)

logger = logging.getLogger("uvicorn.error")

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_BASE = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
MODEL = os.getenv("LLM_MODEL", "claude-opus-4-8")
GROQ_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")


def _split(messages: list[dict]) -> tuple[str, list[dict]]:
    """OpenAI messages -> (anthropic system string, conversation messages)."""
    system_parts, conv = [], []
    for m in messages:
        role, content = m.get("role"), m.get("content", "")
        if isinstance(content, list):  # multimodal -> join text parts
            content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
        if role == "system":
            system_parts.append(content)
        else:
            conv.append({"role": "assistant" if role == "assistant" else "user", "content": content})
    return "\n\n".join(system_parts), conv


async def _claude_deltas(payload: dict) -> AsyncGenerator[str, None]:
    system, msgs = _split(payload.get("messages", []))
    body = {
        "model": MODEL,
        "system": system,
        "messages": msgs,
        "max_tokens": payload.get("max_tokens", 1024),
        "temperature": payload.get("temperature", 0.6),
        "stream": True,
    }
    headers = {"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    
    received_any = False
    async with httpx.AsyncClient(timeout=60) as c:
        try:
            async with c.stream("POST", f"{ANTHROPIC_BASE}/v1/messages", json=body, headers=headers) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data in ("", "[DONE]"):
                        continue
                    try:
                        ev = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if ev.get("type") == "content_block_delta":
                        t = ev.get("delta", {}).get("text")
                        if t:
                            received_any = True
                            yield t
        except Exception as e:
            logger.warning("Claude gateway streaming error: %s", e)

        # If gateway drops SSE text chunks (common with certain proxies), fall back to non-streaming POST
        if not received_any:
            logger.info("Claude gateway returned empty stream; synthesizing from non-streaming upstream")
            body["stream"] = False
            r = await c.post(f"{ANTHROPIC_BASE}/v1/messages", json=body, headers=headers)
            r.raise_for_status()
            res_obj = r.json()
            for block in res_obj.get("content", []):
                if block.get("type") == "text":
                    text_chunk = block.get("text", "")
                    if text_chunk:
                        yield text_chunk



async def _groq_deltas(payload: dict) -> AsyncGenerator[str, None]:
    clean_body = {
        "model": GROQ_MODEL,
        "messages": payload.get("messages", []),
        "stream": True,
        "temperature": payload.get("temperature", 0.6),
        "max_tokens": payload.get("max_tokens", 300),
    }
    headers = {"Authorization": f"Bearer {GROQ_KEY}", "content-type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        async with c.stream("POST", "https://api.groq.com/openai/v1/chat/completions", json=clean_body, headers=headers) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data in ("", "[DONE]"):
                    continue
                try:
                    ev = json.loads(data)
                except json.JSONDecodeError:
                    continue
                t = ev.get("choices", [{}])[0].get("delta", {}).get("content")
                if t:
                    yield t


async def _openai_deltas(payload: dict) -> AsyncGenerator[str, None]:
    clean_body = {
        "model": OPENAI_MODEL,
        "messages": payload.get("messages", []),
        "stream": True,
        "temperature": payload.get("temperature", 0.6),
        "max_tokens": payload.get("max_tokens", 300),
    }
    headers = {"Authorization": f"Bearer {OPENAI_KEY}", "content-type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        async with c.stream("POST", f"{OPENAI_BASE}/chat/completions", json=clean_body, headers=headers) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data in ("", "[DONE]"):
                    continue
                try:
                    ev = json.loads(data)
                except json.JSONDecodeError:
                    continue
                t = ev.get("choices", [{}])[0].get("delta", {}).get("content")
                if t:
                    yield t


async def deltas(payload: dict) -> AsyncGenerator[str, None]:
    """
    LLM delta pipeline:
    1. Groq (primary - low latency)
    2. OpenAI gpt-4o-mini (secondary - if OPENAI_API_KEY is available)
    3. Existing Claude gateway proxy (tertiary / fallback)

    Output passes through the tool-call sanitizer so raw tool syntax the
    model may imitate from the prompt's tool descriptions never reaches
    the patient-facing speech/chat stream.
    """
    async for t in _sanitize_stream(_raw_deltas(payload)):
        yield t


async def _raw_deltas(payload: dict) -> AsyncGenerator[str, None]:
    emitted = False

    # 1. Primary: Groq
    if GROQ_KEY:
        try:
            logger.info("brain: using Groq %s (primary)", GROQ_MODEL)
            async for t in _groq_deltas(payload):
                emitted = True
                yield t
            return
        except Exception as e:
            logger.warning("Groq failed (%s); emitted=%s", e, emitted)
            if emitted:
                return

    # 2. Secondary: OpenAI (gpt-4o-mini)
    if OPENAI_KEY:
        try:
            logger.info("brain: using OpenAI %s (secondary)", OPENAI_MODEL)
            async for t in _openai_deltas(payload):
                emitted = True
                yield t
            return
        except Exception as e:
            logger.warning("OpenAI failed (%s); emitted=%s", e, emitted)
            if emitted:
                return

    # 3. Tertiary: Existing Claude gateway proxy
    if ANTHROPIC_KEY:
        try:
            logger.info("brain: using existing Claude gateway proxy %s (tertiary)", MODEL)
            async for t in _claude_deltas(payload):
                emitted = True
                yield t
            return
        except Exception as e:
            logger.warning("Claude gateway proxy failed (%s); emitted=%s", e, emitted)
            if emitted:
                return

    yield "माफ़ कीजिए, अभी जवाब देने में थोड़ी दिक्कत है। एक पल में फिर कोशिश करें।"


# ---------------------------------------------------------------------------
# Tool-call sanitizer — keeps raw tool syntax out of patient-facing speech.
# The prompt describes tools in prose; LLMs sometimes *imitate* tool-call
# syntax ({"name": "...", "arguments": {...}} / <|tool▁calls▁begin|> etc.) in
# their answer. That text was being spoken and shown verbatim. Stripping it
# here, on the shared delta path, covers all three LLM backends at once.
# ponytail: single buffer-and-flush state machine; if a sanitizer is ever
# needed per-backend, move it then — one consumer today.
# ---------------------------------------------------------------------------
import re as _re

_HOLD_CAP = 400  # ponytail: hard cap — prose containing '{' or '<' flushes raw


def _sanitize_text_once(text: str) -> str:
    """Strip complete tool-call syntax blocks from a text chunk."""
    # Remove proprietary tool-call blocks (Hermes/Qwen style), dot-tolerant.
    text = _re.sub(r"<\|tool▁calls▁begin\|>.*?<\|tool▁calls▁end\|>", "", text, flags=_re.S)
    text = _re.sub(r"<\|tool▁call▁begin\|>.*?<\|tool▁call▁end\|>", "", text, flags=_re.S)
    # Remove a JSON-looking tool call (one nesting level for arguments).
    def _json_tool(match: "_re.Match[str]") -> str:
        body = match.group(0)
        if '"name"' in body and ('"arguments"' in body or '"parameters"' in body):
            return ""
        return body
    text = _re.sub(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", _json_tool, text)
    return text


def _safe_cut(hold: str) -> int:
    """Longest prefix of `hold` that is safe to emit: all braces closed and
    no '<' (a possible tool-block marker, complete or still forming)."""
    depth = 0
    cut = 0
    for i, c in enumerate(hold):
        if c == '{':
            depth += 1
        elif c == '}':
            if depth > 0:
                depth -= 1
                if depth == 0:
                    cut = i + 1
        elif c == '<':
            return cut
    if depth == 0:
        cut = len(hold)
    return cut


async def _sanitize_stream(src: AsyncGenerator[str, None]) -> AsyncGenerator[str, None]:
    """Buffer deltas so tool-call syntax split across chunks is still caught;
    emit only clean text. Never emits past an unclosed '{' or a '<'."""
    hold = ""
    async for delta in src:
        hold += delta
        while hold:
            if len(hold) > _HOLD_CAP:
                emit, hold = hold, ""
            else:
                cut = _safe_cut(hold)
                if cut == 0:
                    break
                emit, hold = hold[:cut], hold[cut:]
            cleaned = _sanitize_text_once(emit)
            if cleaned:
                yield cleaned
    # Final flush at end-of-stream (nothing can straddle anymore).
    cleaned = _sanitize_text_once(hold)
    if cleaned:
        yield cleaned


def _chunk(content: str | None = None, finish: str | None = None, model: str | None = None) -> str:
    delta = {"content": content} if content is not None else {}
    body = {"id": "chatcmpl-" + uuid.uuid4().hex[:12], "object": "chat.completion.chunk",
            "created": int(time.time()), "model": model or MODEL,
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
    return "data: " + json.dumps(body, ensure_ascii=False) + "\n\n"


async def openai_sse(payload: dict) -> AsyncGenerator[str, None]:
    """Yield OpenAI-compatible SSE for Agora CustomLLM."""
    async for t in deltas(payload):
        yield _chunk(content=t)
    yield _chunk(finish="stop")
    yield "data: [DONE]\n\n"


async def complete_text(payload: dict) -> str:
    return "".join([t async for t in deltas(payload)])


if __name__ == "__main__":
    import asyncio
    import sys

    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except AttributeError:
            pass

    async def _ping():
        txt = await complete_text({"messages": [
            {"role": "system", "content": "You are Sahara. Reply in Hindi, one short line."},
            {"role": "user", "content": "namaste, kaun ho tum?"}]})
        print("brain.py live round-trip OK ->", txt[:200])
        assert txt.strip(), "empty completion"

    asyncio.run(_ping())
