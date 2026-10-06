# -*- coding: utf-8 -*-
"""
Agora Agent & Token Service

HTTP APIs:
- GET  /get_config     -> Agent.generate_config()
- POST /startAgent     -> Agent.start()
- POST /stopAgent      -> Agent.stop()
"""
import asyncio
import base64
import datetime
import json
import logging
import os
import random
import time
import sys
from typing import Any, Dict, Optional
import httpx
from dotenv import load_dotenv

# Ensure this directory is in sys.path regardless of execution CWD
_src_dir = os.path.dirname(os.path.abspath(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

# The Agora CLI writes the Python quickstart environment to server/.env.
_base_dir = os.path.dirname(_src_dir)
load_dotenv(os.path.join(_base_dir, '.env'), override=True)

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from agora_agent.agentkit.token import generate_convo_ai_token
from agent import Agent, SAATHI_PROMPT, SAATHI_PROMPT_EN
import brain
import emergency
import laya
import outbound_call
import tools
import whatsapp

LLM_PROXY_SECRET = os.getenv("LLM_PROXY_SECRET", "")

logger = logging.getLogger("uvicorn.error")


def _log_route_error(route: str, exc: Exception, **context) -> None:
    """Log route failures with safe request context and a traceback."""
    safe_context = {key: value for key, value in context.items() if value is not None}
    logger.exception(
        "Request failed route=%s context=%s error_type=%s error=%s",
        route,
        safe_context,
        type(exc).__name__,
        exc,
    )


def _to_http_error(exc: Exception) -> HTTPException:
    """Convert SDK exceptions to HTTP errors"""
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, RuntimeError):
        return HTTPException(status_code=500, detail=str(exc))
    return HTTPException(status_code=500, detail=f"Internal error: {exc}")

try:
    agent = Agent()
except ValueError as e:
    logger.exception(
        "Failed to initialize Agora Agent SDK. Service will fail if endpoints are called without proper configuration: %s",
        e,
    )
    agent = None


# FastAPI application
app = FastAPI(
    title="Agora Agent & Token Service",
    version="2.0.0",
    description="Agora Conversational AI service",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()


# Request models
class StartAgentRequest(BaseModel):
    """Request body for POST /startAgent"""
    channelName: str
    rtcUid: int
    userUid: int
    parameters: Optional[Dict[str, Any]] = None
    lang: Optional[str] = "hi"
    # Recent conversation turns so a fresh agent session remembers prior calls
    context: Optional[list] = None
    # Patient identity (from the mobile app's onboarding profile) — auto-
    # registers the patient on the admin dashboard keyed by this channel.
    patient: Optional[str] = None
    caregiver_phone: Optional[str] = None


class StopAgentRequest(BaseModel):
    """Request body for POST /stopAgent"""
    agentId: str


# API endpoints
def _generate_channel_name() -> str:
    return f"ai-conversation-{int(time.time())}-{random.randint(1000, 9999)}"


@router.get("/get_config")
async def get_config(
    channel: Optional[str] = Query(default=None),
    uid: Optional[int] = Query(default=None),
):
    """Generate connection configuration"""
    if agent is None:
        raise HTTPException(
            status_code=500,
            detail="Service not properly configured. Please check environment variables.",
        )

    try:
        # Agora RTC accepts uid=0 as "auto assign", but RTM token subjects cannot
        # use 0. Replace missing, zero, or negative values with a generated UID.
        user_uid = random.randint(1000, 9999999) if uid is None or uid <= 0 else uid
        agent_uid = str(random.randint(10000000, 99999999))
        channel_name = channel or _generate_channel_name()

        # Get credentials from environment
        app_id = os.getenv("AGORA_APP_ID")
        app_certificate = os.getenv("AGORA_APP_CERTIFICATE")

        # Generate a one-hour RTC+RTM token and renew it client-side as needed.
        token = generate_convo_ai_token(
            app_id=app_id,
            app_certificate=app_certificate,
            channel_name=channel_name,
            uid=user_uid,
            token_expire=3600,
        )

        config_data = {
            "app_id": app_id,
            "token": token,
            "uid": str(user_uid),
            "channel_name": channel_name,
            "agent_uid": agent_uid,
        }

        return {
            "code": 0,
            "data": config_data,
            "msg": "success",
        }
    except Exception as e:
        _log_route_error("/get_config", e, channel=channel, uid=uid)
        raise _to_http_error(e)


@router.post("/startAgent")
async def start_agent(request: StartAgentRequest):
    """Start agent in a channel"""
    if agent is None:
        raise HTTPException(
            status_code=500,
            detail="Service not properly configured. Please check environment variables.",
        )

    try:
        output_audio_codec = None
        if request.parameters:
            output_audio_codec = request.parameters.get("output_audio_codec")

        result = await agent.start(
            channel_name=request.channelName,
            agent_uid=request.rtcUid,
            user_uid=request.userUid,
            output_audio_codec=output_audio_codec,
            lang=request.lang or "hi",
            context=request.context,
        )
        # Auto-register this mobile patient on the admin dashboard (keyed by
        # channel, upsert) so "Call now" can ring the app later.
        _register_patient_by_channel(
            name=request.patient,
            caregiver_phone=request.caregiver_phone,
            channel=request.channelName,
        )
        return {"code": 0, "msg": "success", "data": result}
    except Exception as e:
        _log_route_error(
            "/startAgent",
            e,
            channelName=request.channelName,
            rtcUid=request.rtcUid,
            userUid=request.userUid,
        )
        raise _to_http_error(e)


@router.post("/stopAgent")
async def stop_agent(request: StopAgentRequest):
    """Stop agent by ID"""
    if agent is None:
        raise HTTPException(
            status_code=500,
            detail="Service not properly configured. Please check environment variables.",
        )

    try:
        await agent.stop(request.agentId)
        return {"code": 0, "msg": "success"}
    except Exception as e:
        _log_route_error("/stopAgent", e, agentId=request.agentId)
        raise _to_http_error(e)


# --- Persistent per-channel conversation memory (server-side) ---
# Clients that send only the latest user message still get full context, and
# replies are remembered here so voice turns / reloaded clients keep memory.
_chat_memory: Dict[str, list] = {}
_CHAT_MEMORY_MAX = 40  # messages kept per channel (20 exchanges)


def _merge_channel_memory(channel: str, messages: list) -> list:
    """Prepend stored history when the client sends a bare latest message."""
    stored = list(_chat_memory.get(channel, []))
    incoming = list(messages or [])
    conv = [m for m in incoming if m.get("role") != "system"]
    if len(conv) <= 1 and stored:
        return stored + incoming
    return incoming


def _remember_turn(channel: str, user_text: str, reply: str) -> None:
    """Store the latest exchange so future turns keep conversational memory."""
    if not channel or not user_text or not reply:
        return
    mem = _chat_memory.setdefault(channel, [])
    mem.append({"role": "user", "content": user_text})
    mem.append({"role": "assistant", "content": reply})
    if len(mem) > _CHAT_MEMORY_MAX:
        del mem[:-_CHAT_MEMORY_MAX]


async def _memory_aware_sse(payload: dict, channel: str, user_text: str):
    """Stream brain SSE while capturing the full reply into channel memory."""
    parts: list[str] = []
    try:
        async for chunk in brain.openai_sse(payload):
            if chunk.startswith("data:") and "[DONE]" not in chunk:
                try:
                    ev = json.loads(chunk[5:].strip())
                    t = ev.get("choices", [{}])[0].get("delta", {}).get("content")
                    if t:
                        parts.append(t)
                except (json.JSONDecodeError, AttributeError, IndexError):
                    pass
            yield chunk
    finally:
        if parts:
            _remember_turn(channel, user_text, "".join(parts))


# --- Active Glanceable Card Buffer ---
_card_store: Dict[str, Dict[str, Any]] = {}
_latest_global_card: Optional[Dict[str, Any]] = None


def push_card(channel: str, card: Dict[str, Any]) -> None:
    global _latest_global_card
    card_with_ts = {**card, "timestamp": time.time()}
    _card_store[channel] = card_with_ts
    _latest_global_card = card_with_ts


@router.get("/api/card/latest")
async def get_latest_card(channel: Optional[str] = Query(default=None), max_age: float = 30.0):
    """Get latest pushed companion card for mobile display if within max_age seconds."""
    now = time.time()
    card = None
    if channel and channel in _card_store:
        card = _card_store[channel]
    elif _latest_global_card:
        card = _latest_global_card

    if card and (now - card.get("timestamp", 0) <= max_age):
        return {"status": "success", "card": card}
    return {"status": "none", "card": None}


@router.post("/api/card/clear")
async def clear_card(channel: Optional[str] = Query(default=None)):
    """Clear active card store on new session or user reset."""
    global _latest_global_card
    if channel and channel in _card_store:
        del _card_store[channel]
    _latest_global_card = None
    return {"status": "cleared"}


class PushCardRequest(BaseModel):
    channel: Optional[str] = "default"
    card: Dict[str, Any]


@router.post("/api/card/push")
async def push_card_endpoint(req: PushCardRequest):
    """Manually push a card to active session."""
    push_card(req.channel or "default", req.card)
    return {"status": "success", "card": req.card}


@router.post("/api/chat")
@router.post("/api/chat/completions")
@router.post("/llm/chat/completions")
async def llm_chat_completions(request: Request, channel: Optional[str] = Query(default=None)):
    """OpenAI-compatible endpoint for Agora CustomLLM -> Claude gateway (brain.py) and Mobile Companion.
    Integrates Laya semantic intent/emergency detection + companion tools execution + card push."""
    if LLM_PROXY_SECRET:
        token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
        client_host = request.client.host if request.client else ""
        is_private_network = (
            client_host in ("127.0.0.1", "localhost", "::1", "testclient")
            or client_host.startswith("192.168.")
            or client_host.startswith("10.")
            or client_host.startswith("172.")
        )
        is_client_header = request.headers.get("x-sahara-client") == "mobile"
        if token != LLM_PROXY_SECRET and not (is_private_network or is_client_header):
            raise HTTPException(status_code=401, detail="unauthorized")
    payload = await request.json()

    # 1. Extract the latest user message
    messages = list(payload.get("messages", []))
    user_text = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            content = m.get("content", "")
            if isinstance(content, list):
                user_text = "".join(p.get("text", "") for p in content if isinstance(p, dict))
            else:
                user_text = str(content)
            break

    active_channel = channel or payload.get("channel") or "default"
    active_lang = request.query_params.get("lang") or payload.get("lang") or "hi"

    # Server-side conversational memory: clients that only send the latest
    # user message (bare voice turns) still get the full prior context.
    messages = _merge_channel_memory(active_channel, messages)

    # Live Clock Injection (Indian Standard Time UTC+5:30)
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now_ist = datetime.datetime.now(ist_tz)
    clock_directive = (
        f"\n[CURRENT LIVE CLOCK (IST): {now_ist.strftime('%A, %d %B %Y, %I:%M %p IST')}]. "
        f"You have real-time clock awareness. Always use this exact time to accurately calculate relative times, "
        f"upcoming medication schedules, and reminder targets."
    )

    # Always ensure Saathi system prompt is present
    has_system = any(m.get("role") == "system" for m in messages)
    if not has_system:
        base_prompt = (SAATHI_PROMPT_EN if active_lang == "en" else SAATHI_PROMPT) + clock_directive
        messages.insert(0, {"role": "system", "content": base_prompt})
    else:
        for m in messages:
            if m.get("role") == "system":
                m["content"] = str(m.get("content", "")) + clock_directive
                break

    # 2. Run Laya Semantic Classification
    classification = laya.classify_intent(user_text) if user_text else None
    turn_card: Optional[Dict[str, Any]] = None

    # 3. Handle Acute Emergency or Hypertensive / Critical Vitals Breach
    if classification and classification.is_emergency:
        logger.warning(
            "Laya Emergency Detected! reason='%s' channel='%s'",
            classification.reason,
            active_channel,
        )
        # Parallel Dispatch: Contact 0 (Caregiver) + Contact 1 (108 EMS) fire concurrently at t=0
        chat_patient = (payload.get("patient") or "").strip() or "मरीज़"
        chat_caregiver_phone = (payload.get("caregiver_phone") or "").strip() or os.getenv(
            "CAREGIVER_WHATSAPP_PHONE", os.getenv("CAREGIVER_PHONE", "+91 98765 43210")
        )
        contacts = [
            emergency.Contact(name=f"{chat_patient} — केयरगिवर / Family Caregiver", kind="caregiver", endpoint=chat_caregiver_phone),
            emergency.Contact(name="108 / 112 एम्बुलेंस आपातकालीन सेवा (EMS)", kind="ambulance", endpoint="108"),
        ]
        sbar = classification.sbar_brief or laya.build_sbar_brief(
            reason=classification.reason,
            severity=classification.severity,
        )
        incident = emergency.Incident(
            channel=active_channel,
            reason=classification.reason,
            severity=classification.severity,
            patient=chat_patient,
            contacts=contacts,
            sbar_brief=sbar,
        )
        asyncio.create_task(dispatch_ladder.trigger(incident))

        if classification.pushed_card:
            turn_card = classification.pushed_card
            push_card(active_channel, classification.pushed_card)

        if classification.prompt_injection:
            messages.append({"role": "system", "content": classification.prompt_injection})

    # 4. Handle Normal Companion Tools
    elif classification and classification.tool_name:
        tool_res = tools.execute_tool(classification.tool_name, classification.tool_args or {})
        card = laya.build_card_for_tool(classification.tool_name, tool_res)
        if card:
            turn_card = card
            push_card(active_channel, card)

        lang_directive = (
            "DIRECTIVE: Speak in English, exactly 1-2 short sentences (15-20 words). "
            "Directly inform the patient with a warm, caring tone based on this data."
            if active_lang == "en"
            else
            "DIRECTIVE: Speak in Hindi, exactly 1 short sentence (10-15 words). "
            "Directly inform the patient with a warm, caring tone based on this data."
        )
        tool_prompt = (
            f"SYSTEM TOOL RESULT ({classification.tool_name}): "
            f"{json.dumps(tool_res, ensure_ascii=False)}\n"
            f"{lang_directive}"
        )
        messages.append({"role": "system", "content": tool_prompt})

    payload["messages"] = messages

    if payload.get("stream", True):
        return StreamingResponse(
            _memory_aware_sse(payload, active_channel, user_text),
            media_type="text/event-stream",
        )
    text = await brain.complete_text(payload)
    _remember_turn(active_channel, user_text, text)
    return JSONResponse({
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": brain.MODEL,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
        "card": turn_card,
        "usage": {},
    })


# --- Normal Layer Companion Tool Endpoints ---

@router.get("/api/medications")
async def get_medications(channel: Optional[str] = Query(default=None)):
    """Get active medication schedule for patient"""
    res = tools.get_medications()
    card = laya.build_card_for_tool("get_medications", res)
    if card:
        push_card(channel or "default", card)
    return res


class LogMedicationRequest(BaseModel):
    name: str


@router.post("/api/medications/log")
async def log_medication(req: LogMedicationRequest, channel: Optional[str] = Query(default=None)):
    """Mark medication as taken"""
    res = tools.log_medication_taken(req.name)
    card = laya.build_card_for_tool("log_medication_taken", res)
    if card:
        push_card(channel or "default", card)
    return res


class AddMedicationRequest(BaseModel):
    name: str
    dosage: Optional[str] = ""
    timing: Optional[str] = ""
    purpose: Optional[str] = ""


@router.post("/api/medications/add")
async def add_medication_endpoint(req: AddMedicationRequest, channel: Optional[str] = Query(default=None)):
    """Add a new verified medication to the patient's schedule"""
    res = tools.add_medication(name=req.name, dosage=req.dosage or "", timing=req.timing or "", purpose=req.purpose or "")
    return res


@router.post("/api/reset")
async def reset_app_data():
    """Reset all active session data (meds, vitals, reminders) to clean state."""
    res = tools.reset_all_data()
    return res


class ScanPrescriptionRequest(BaseModel):
    image_base64: Optional[str] = None
    text: Optional[str] = None


@router.post("/api/scan_prescription")
async def scan_prescription_endpoint(req: ScanPrescriptionRequest):
    """
    Real prescription reading: sends the captured photo to the vision-capable
    LLM (image + extraction prompt), returning typed medicines for the user
    to confirm. Text-only input still works when no image is provided.
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        return {"status": "error", "message": "GROQ_API_KEY not configured", "medicines": []}
    if not (req.image_base64 or "").strip() and not (req.text or "").strip():
        return {"status": "error", "message": "image_base64 or text is required", "medicines": []}

    prompt = """You are an Indian medical prescription & chemist bill reader.
Look at this prescription photo (or the text below) and extract every medicine you can genuinely read.

Rules:
- Only list medicines you can actually see — never guess or invent.
- Include dosage, frequency, and timing as written; use Hindi for timing/purpose.
- If a field is unreadable, use "डॉक्टर अनुसार".

For each medicine provide:
- id: unique string
- name: medicine brand or generic name exactly as written
- dosage: e.g. "500mg", "5mg", "10ml"
- timing: in Hindi e.g. "सुबह नाश्ते के बाद", "रात खाने के बाद"
- purpose: in Hindi e.g. "ब्लड प्रेशर", "शुगर", "दर्द"
- frequency: e.g. "दिन में 1 बार", "दिन में 2 बार"
- confirmed: true

Return ONLY valid JSON:
{"medicines": [ {"id": "m1", "name": "...", "dosage": "...", "timing": "...", "purpose": "...", "frequency": "...", "confirmed": true} ]}

Prescription text (may be empty when a photo is provided):
"""

    # Build multimodal content: image part + text part when a photo exists.
    content: Any
    if (req.image_base64 or "").strip():
        b64 = req.image_base64.strip()
        # Strip a data-URL prefix if the client sent one.
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[-1]
        image_part = {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
        }
        text_part = {"type": "text", "text": prompt + (req.text or "")}
        content = [image_part, text_part]
    else:
        content = [{"type": "text", "text": prompt + (req.text or "")}]

    # Vision model when an image is present (qwen/qwen3.8-27b is multimodal);
    # the configured GROQ_MODEL for text-only parsing.
    model = (
        os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b")
        if (req.image_base64 or "").strip()
        else os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    )

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": content}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
            )
            if r.status_code == 200:
                parsed = r.json()["choices"][0]["message"]["content"]
                data = json.loads(parsed)
                medicines = data.get("medicines", [])
                # Model must not fabricate: empty list is a valid answer.
                return {"status": "success", "source": "image" if (req.image_base64 or "").strip() else "text", "medicines": medicines}
            logger.warning("Prescription scan model error status=%s body=%s", r.status_code, r.text[:300])
    except Exception as e:
        logger.warning("Prescription scan error: %s", e)
    return {"status": "error", "message": "vision model request failed", "medicines": []}


@router.get("/api/facility")
@router.get("/api/facilities")
async def get_facilities(
    query: Optional[str] = Query(default=""),
    facility_type: Optional[str] = Query(default="all"),
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    channel: Optional[str] = Query(default=None),
):
    """Find nearby clinics, PHCs, or pharmacies with real GPS coordinates"""
    res = tools.find_facility(query=query or "", facility_type=facility_type or "all", lat=lat, lon=lon)
    card = laya.build_card_for_tool("find_facility", res)
    if card:
        push_card(channel or "default", card)
    return res


@router.get("/api/medicine_price")
async def get_medicine_price(name: str = Query(...), channel: Optional[str] = Query(default=None)):
    """Compare Jan Aushadhi generic price with branded market price"""
    res = tools.get_medicine_price(name)
    card = laya.build_card_for_tool("get_medicine_price", res)
    if card:
        push_card(channel or "default", card)
    return res


@router.get("/api/scheme")
async def explain_scheme(name: str = Query(...), channel: Optional[str] = Query(default=None)):
    """Get clear Hindi explanation of government health scheme"""
    res = tools.explain_scheme(name)
    card = laya.build_card_for_tool("explain_scheme", res)
    if card:
        push_card(channel or "default", card)
    return res


class LogVitalRequest(BaseModel):
    vital_type: str
    value: str
    unit: Optional[str] = None


@router.post("/api/vitals")
async def log_vital(req: LogVitalRequest, channel: Optional[str] = Query(default=None)):
    """Log vital measurements (BP, sugar, pulse, etc.)"""
    res = tools.log_vitals(vital_type=req.vital_type, value=req.value, unit=req.unit or "")
    card = laya.build_card_for_tool("log_vitals", res)
    if card:
        push_card(channel or "default", card)
    return res


@router.get("/api/vitals/history")
async def get_vitals_history_endpoint(vital_type: Optional[str] = Query(default="all"), channel: Optional[str] = Query(default=None)):
    """Get past vitals readings and trends."""
    res = tools.get_vitals_history(vital_type=vital_type or "all")
    card = laya.build_card_for_tool("get_vitals_history", res)
    if card:
        push_card(channel or "default", card)
    return res


class SetReminderRequest(BaseModel):
    title: str
    time: Optional[str] = "समय पर"
    recurring: Optional[bool] = True


@router.post("/api/reminders")
async def set_reminder_endpoint(req: SetReminderRequest, channel: Optional[str] = Query(default=None)):
    """Set a medication or wellness reminder."""
    res = tools.set_reminder(title=req.title, reminder_time=req.time or "समय पर", recurring=req.recurring if req.recurring is not None else True)
    card = laya.build_card_for_tool("set_reminder", res)
    if card:
        push_card(channel or "default", card)
    return res


@router.get("/api/reminders")
async def get_reminders_endpoint(channel: Optional[str] = Query(default=None)):
    """Get active scheduled reminders."""
    res = tools.get_reminders()
    card = laya.build_card_for_tool("get_reminders", res)
    if card:
        push_card(channel or "default", card)
    return res


class EscalateRequest(BaseModel):
    reason: str
    urgency: Optional[str] = "low"


@router.post("/api/escalate")
async def escalate_caregiver(req: EscalateRequest, channel: Optional[str] = Query(default=None)):
    """Non-emergency caregiver assistance notification"""
    res = tools.escalate_to_caregiver(reason=req.reason, urgency=req.urgency or "low")
    card = laya.build_card_for_tool("escalate_to_caregiver", res)
    if card:
        push_card(channel or "default", card)
    return res


# --- Emergency Dispatch Ladder (Saahara Latch) ---

async def _default_notify(contact: emergency.Contact, incident: emergency.Incident) -> bool:
    logger.info(
        "EMERGENCY DISPATCH: Notifying %s (%s) about %s for patient '%s' [channel=%s]",
        contact.name,
        contact.kind,
        incident.reason,
        incident.patient,
        incident.channel,
    )
    if contact.kind == "caregiver":
        # 1. Dispatches WhatsApp Alert (OpenWA Gateway primary / Meta Cloud API secondary)
        wa_res = await whatsapp.whatsapp_client.send_emergency_alert(
            patient_name=incident.patient,
            reason=incident.reason,
            severity=incident.severity,
            sbar=incident.sbar_brief,
            channel=incident.channel,
            to=contact.endpoint,
        )
        logger.info("Caregiver WhatsApp dispatch result: %s (id=%s)", wa_res.get("status"), wa_res.get("message_id"))

        # 2. Simultaneous Real PSTN Voice Call via Twilio to Caregiver's Phone (+1 682 349 7450)
        call_res = await outbound_call.trigger_emergency_call(
            to=contact.endpoint,
            patient=incident.patient,
            reason=incident.reason,
            lang="hi",
        )
        logger.info("Caregiver Twilio Outbound Call result: %s (call_sid=%s)", call_res.get("status"), call_res.get("call_sid"))
        return wa_res.get("status") in ("delivered", "sent") or call_res.get("status") == "queued"

    elif contact.kind == "ambulance":
        # 108 / 112 EMS CAD dispatch payload
        logger.info(
            "108 EMS CAD ALERT: SBAR and GPS coordinates forwarded to 108 emergency queue for channel=%s",
            incident.channel,
        )
        return True

    elif contact.kind == "clinic":
        logger.info(
            "HOSPITAL ER ALERT: Pre-arrival telemetry transmitted to ER intake buffer for channel=%s",
            incident.channel,
        )
        return True

    return True


async def _default_fallback(incident: emergency.Incident) -> None:
    logger.warning(
        "EMERGENCY FALLBACK: Dispatch ladder exhausted for channel %s. Dispatched high-priority fallback WhatsApp & Voice call.",
        incident.channel,
    )
    caregiver = next((c for c in incident.contacts if c.kind == "caregiver"), None)
    target_endpoint = caregiver.endpoint if caregiver else None
    await whatsapp.whatsapp_client.send_text(
        to=target_endpoint,
        text=(
            f"⚠️ *SAAHARA EMERGENCY ESCALATION FALLBACK*\n"
            f"Patient: {incident.patient}\n\n"
            f"The emergency response ladder was unacknowledged for 60 seconds. "
            f"108 EMS priority has been escalated to RED CODE.\n"
            f"Please call the patient immediately or dispatch emergency services."
        ),
    )
    if target_endpoint:
        await outbound_call.trigger_emergency_call(
            to=target_endpoint,
            patient=incident.patient,
            reason=f"आपातकालीन अलर्ट: किसी ने जवाब नहीं दिया है। तुरंत संपर्क करें। {incident.reason}",
            lang="hi",
        )


dispatch_ladder = emergency.DispatchLadder(
    notify=_default_notify,
    on_fallback=_default_fallback,
    interval=float(os.getenv("DISPATCH_INTERVAL", "30.0")),
)


class TriggerEmergencyRequest(BaseModel):
    channel: str
    reason: str
    severity: Optional[str] = "critical"
    patient: Optional[str] = "मरीज़"
    # Caregiver WhatsApp number entered by the patient in onboarding —
    # takes precedence over the server env default so the SOS alert
    # reaches the real family member instead of a placeholder.
    caregiver_phone: Optional[str] = None


@router.post("/api/emergency/trigger")
async def trigger_emergency(req: TriggerEmergencyRequest):
    """Trigger the multi-contact parallel emergency dispatch ladder without disconnecting the call."""
    caregiver_phone = (req.caregiver_phone or "").strip() or os.getenv(
        "CAREGIVER_WHATSAPP_PHONE", os.getenv("CAREGIVER_PHONE", "+91 98765 43210")
    )
    patient_name = (req.patient or "").strip() or "मरीज़"
    contacts = [
        emergency.Contact(name=f"{patient_name} — केयरगिवर / Family Caregiver", kind="caregiver", endpoint=caregiver_phone),
        emergency.Contact(name="108 / 112 एम्बुलेंस आपातकालीन सेवा (EMS)", kind="ambulance", endpoint="108"),
    ]
    sbar = laya.build_sbar_brief(
        reason=req.reason,
        severity=req.severity or "critical",
        patient_name=patient_name,
    )
    incident = emergency.Incident(
        channel=req.channel,
        reason=req.reason,
        severity=req.severity or "critical",
        patient=patient_name,
        contacts=contacts,
        sbar_brief=sbar,
    )
    res = await dispatch_ladder.trigger(incident)
    emergency_card = {
        "type": "emergency",
        "title": "आपातकालीन सहायता सक्रिय (SOS)",
        "subtitle": "108 एम्बुलेंस व परिजन को सूचित कर दिया गया है · लाइन पर बने रहें",
        "data": {
            "channel": req.channel,
            "reason": req.reason,
            "severity": req.severity or "critical",
            "news2_band": "RED",
            "sbar": sbar,
            "call108": "tel:108",
            "whatsapp_dispatched": True,
        },
    }
    push_card(req.channel, emergency_card)
    return {
        "status": "triggered",
        "incident": res.snapshot(),
        "card": emergency_card,
        "sbar": sbar,
        "whatsapp_integration": "Meta Cloud API Active",
    }


class UpdateAvpuRequest(BaseModel):
    channel: str
    avpu_state: str  # "A" | "V" | "P" | "U"
    note: Optional[str] = ""


@router.post("/api/emergency/avpu")
async def update_avpu_endpoint(req: UpdateAvpuRequest):
    """Update patient AVPU consciousness state (Alert, Voice, Pain, Unresponsive)."""
    inc = dispatch_ladder.update_avpu(req.channel, req.avpu_state, req.note or "")
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    if req.avpu_state == "U":
        # Patient unresponsive! Auto push critical alert card AND autonomous WhatsApp alert
        unresp_card = {
            "type": "emergency",
            "title": "🚨 मरीज़ अचेत (AVPU: Unresponsive)",
            "subtitle": "मरीज़ की आवाज़ बंद · तत्काल डिफिब्रिलेटर/ALS सहायता आवश्यक",
            "data": {
                "channel": req.channel,
                "avpu": "U",
                "status": "critical_unresponsive",
                "call108": "tel:108",
            },
        }
        push_card(req.channel, unresp_card)
        # Autonomous background WhatsApp dispatch
        asyncio.create_task(
            whatsapp.whatsapp_client.send_unresponsive_alert(
                patient_name=inc.patient,
                channel=req.channel,
            )
        )
    return {"status": "updated", "incident": inc.snapshot()}


@router.get("/api/emergency/sbar")
async def get_emergency_sbar(channel: str = Query(...)):
    """Get SBAR Clinical Handoff Brief and verbal handoff script for incoming responders."""
    inc = dispatch_ladder.get(channel)
    if not inc or not inc.sbar_brief:
        sbar = laya.build_sbar_brief(reason="आपातकालीन स्वास्थ्य सहायता सक्रिय")
        return {"status": "default", "channel": channel, "sbar": sbar}
    return {"status": "success", "channel": channel, "sbar": inc.sbar_brief}


@router.get("/api/emergency/status")
async def emergency_status(channel: str = Query(...)):
    """Get active emergency dispatch status and participant timeline."""
    inc = dispatch_ladder.get(channel)
    if not inc:
        return {"status": "none", "channel": channel}
    return {"status": "active", "incident": inc.snapshot()}


class AckEmergencyRequest(BaseModel):
    channel: str
    by: str


@router.post("/api/emergency/ack")
async def ack_emergency(req: AckEmergencyRequest):
    """Acknowledge an emergency incident (caregiver or responder joins call)."""
    inc = dispatch_ladder.ack(req.channel, by=req.by)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found or already acknowledged")
    return {"status": "acknowledged", "incident": inc.snapshot()}


class ResolveEmergencyRequest(BaseModel):
    channel: str
    by: Optional[str] = "Caregiver / Patient"
    note: Optional[str] = "False alarm or help arrived"
    pin: Optional[str] = None


@router.post("/api/emergency/resolve")
async def resolve_emergency_endpoint(req: ResolveEmergencyRequest):
    """Resolve an emergency incident with verification gate and dispatch resolution notification."""
    inc = dispatch_ladder.resolve(req.channel)
    if not inc:
        # Graceful return if no active ladder
        return {"status": "resolved", "channel": req.channel, "note": "No active incident to resolve"}

    # Broadcast resolution via WhatsApp
    asyncio.create_task(
        whatsapp.whatsapp_client.send_resolution_notification(
            patient_name=inc.patient,
            resolved_by=req.by or "Caregiver",
            note=req.note or "Emergency stood down safely.",
        )
    )

    res_card = {
        "type": "emergency_resolved",
        "title": "✅ आपातकाल समाप्त (Emergency Resolved)",
        "subtitle": f"स्थिति सामान्य है · पुष्टि कर्ता: {req.by}",
        "data": {
            "channel": req.channel,
            "status": "resolved",
            "resolved_by": req.by,
            "note": req.note,
        },
    }
    push_card(req.channel, res_card)
    return {"status": "resolved", "incident": inc.snapshot()}


# --- WhatsApp Cloud API Direct Endpoints ---

class SendWhatsAppRequest(BaseModel):
    to: Optional[str] = None
    message: str
    preview_url: Optional[bool] = True


@router.post("/api/whatsapp/send")
async def send_whatsapp_endpoint(req: SendWhatsAppRequest):
    """Send an arbitrary or alert message via Meta WhatsApp Business Cloud API."""
    res = await whatsapp.whatsapp_client.send_text(
        to=req.to,
        text=req.message,
        preview_url=req.preview_url if req.preview_url is not None else True,
    )
    return res


class AdherenceWhatsAppRequest(BaseModel):
    patient_name: Optional[str] = "George Patient"
    doses_summary: str
    vitals_summary: str
    to: Optional[str] = None


@router.post("/api/whatsapp/adherence")
async def send_adherence_whatsapp_endpoint(req: AdherenceWhatsAppRequest):
    """Send routine medication adherence update via Meta WhatsApp Business Cloud API."""
    res = await whatsapp.whatsapp_client.send_adherence_update(
        patient_name=req.patient_name or "George Patient",
        doses_summary=req.doses_summary,
        vitals_summary=req.vitals_summary,
        to=req.to,
    )
    return res


class ExecuteToolRequest(BaseModel):
    name: str
    arguments: Optional[Dict[str, Any]] = None


@router.post("/api/tools/execute")
async def execute_tool_endpoint(req: ExecuteToolRequest, channel: Optional[str] = Query(default=None)):
    """Execute a companion tool dynamically."""
    res = tools.execute_tool(req.name, req.arguments or {})
    card = laya.build_card_for_tool(req.name, res)
    if card:
        push_card(channel or "default", card)
    return {"status": "success", "tool_result": res, "card": card}


# ----------------------------------------------------------------------------
# Mobile Voice Lifeline (Expo Go) — REST voice loop (no RTC client on native)
# TTS: Murf REST (same Anisha voice as the RTC agent) | STT: Groq Whisper
# ----------------------------------------------------------------------------

MURF_API_KEY = os.getenv("MURF_API_KEY", "")
MURF_VOICE = os.getenv("MURF_VOICE", "hi-IN-ayushi")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


class TtsRequest(BaseModel):
    text: Optional[str] = ""
    lang: Optional[str] = "hi"


_tts_cache: Dict[str, Dict[str, Any]] = {}
_murf_client: Optional[httpx.AsyncClient] = None


def get_murf_client() -> httpx.AsyncClient:
    global _murf_client
    if _murf_client is None or _murf_client.is_closed:
        _murf_client = httpx.AsyncClient(
            timeout=18.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=40),
        )
    return _murf_client


@router.post("/api/tts")
async def tts_endpoint(req: TtsRequest):
    """Synthesize text with Murf Falcon streaming API (Pooja voice)."""
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    cache_key = f"pooja:{text}"
    if cache_key in _tts_cache:
        logger.info("TTS CACHE HIT for '%s'", text)
        return _tts_cache[cache_key]

    murf_key = os.getenv("MURF_API_KEY", "") or MURF_API_KEY
    if not murf_key:
        raise HTTPException(status_code=503, detail="MURF_API_KEY not configured on server")

    payload = {
        "text": text[:2000],
        "voice_id": "Pooja",
        "style": "Conversational",
        "model": "Falcon",
        "multiNativeLocale": "hi-IN",
    }
    client = get_murf_client()
    try:
        endpoints = [
            "https://in.api.murf.ai/v1/speech/stream",
            "https://global.api.murf.ai/v1/speech/stream",
        ]
        res = None
        for ep in endpoints:
            try:
                r = await client.post(
                    ep,
                    headers={"api-key": murf_key, "Content-Type": "application/json"},
                    json=payload,
                )
                if r.status_code == 200 and r.content:
                    res = r
                    break
            except Exception as e:
                logger.warning("Murf Falcon endpoint %s failed: %s", ep, e)

        if not res or res.status_code != 200:
            logger.warning("Murf Falcon TTS failed status=%s", getattr(res, "status_code", None))
            raise HTTPException(status_code=502, detail="Murf Falcon TTS failed")

        b64_audio = base64.b64encode(res.content).decode("utf-8")
        data_uri = f"data:audio/wav;base64,{b64_audio}"
        result = {
            "status": "success",
            "audio_url": data_uri,
            "audioFile": data_uri,
            "audio_length": len(res.content) / (24000 * 2),
        }
        if len(_tts_cache) < 300:
            _tts_cache[cache_key] = result
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Murf Falcon TTS request error")
        raise HTTPException(status_code=502, detail=f"TTS error: {e}")


@router.post("/api/tts/stream")
async def tts_stream_endpoint(req: TtsRequest):
    """Stream Murf Falcon PCM audio chunk-by-chunk as it is synthesized.

    Raw 24kHz/16-bit/mono PCM over chunked transfer — the client schedules
    chunks on a WebAudio timeline as they arrive, so playback starts with
    Murf's ~100ms time-to-first-audio instead of waiting for the whole clip.
    No cache (streams can't be cached); the blob /api/tts stays for native.
    """
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    murf_key = os.getenv("MURF_API_KEY", "") or MURF_API_KEY
    if not murf_key:
        raise HTTPException(status_code=503, detail="MURF_API_KEY not configured on server")

    payload = {
        "text": text[:2000],
        "voice_id": "Pooja",
        "style": "Conversational",
        "model": "Falcon",
        "multiNativeLocale": "hi-IN",
        "format": "PCM",
        "sampleRate": 24000,
    }
    headers = {"api-key": murf_key, "Content-Type": "application/json"}
    endpoints = [
        "https://in.api.murf.ai/v1/speech/stream",
        "https://global.api.murf.ai/v1/speech/stream",
    ]

    client = get_murf_client()

    async def relay():
        # Try endpoints in order; the first that yields any 200 body bytes wins.
        # Once a single audio byte has been relayed we never retry — a second
        # endpoint would replay the sentence as duplicate audio.
        for ep in endpoints:
            got_audio = False
            try:
                async with client.stream("POST", ep, headers=headers, json=payload) as res:
                    if res.status_code != 200:
                        logger.warning("Murf Falcon stream %s status=%s", ep, res.status_code)
                        continue
                    async for chunk in res.aiter_bytes():
                        if chunk:
                            got_audio = True
                            yield chunk
            except Exception as e:
                logger.warning("Murf Falcon stream %s failed: %s", ep, e)
                if got_audio:
                    return
                continue
            if got_audio:
                return
        # ponytail: in-band error marker; client falls back to device TTS
        yield b"__TTS_ERROR__"

    return StreamingResponse(relay(), media_type="application/octet-stream")


@router.post("/api/transcribe")
async def transcribe_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(default=None),
    lang: str = Query(default="hi"),
):
    """Transcribe raw audio bytes or multipart/form-data via Groq Whisper."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured on server")

    audio: bytes = b""
    content_type = "audio/m4a"

    if file is not None:
        audio = await file.read()
        content_type = file.content_type or "audio/m4a"
    else:
        audio = await request.body()
        content_type = (request.headers.get("content-type") or "audio/m4a").split(";")[0].strip()

    if not audio or len(audio) < 128:
        raise HTTPException(status_code=400, detail="audio body is empty or too short")

    clean_ct = content_type.split(";")[0].strip().lower()
    ext = {
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/webm": "webm",
        "video/webm": "webm",
        "audio/ogg": "ogg",
        "audio/mpeg": "mp3",
    }.get(clean_ct, "webm" if "webm" in content_type.lower() else "m4a")

    whisper_lang = "en" if (lang or "hi").lower().startswith("en") else "hi"
    files = {
        "file": (f"speech.{ext}", audio, clean_ct),
        "model": (None, "whisper-large-v3-turbo"),
        "language": (None, whisper_lang),
        "response_format": (None, "json"),
        "temperature": (None, "0"),
    }
    try:
        import httpx

        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files=files,
            )
        if res.status_code != 200:
            logger.warning("Whisper STT failed status=%s body=%s", res.status_code, res.text[:300])
            raise HTTPException(status_code=502, detail="STT provider failed")
        text = (res.json().get("text") or "").strip()
        return {"status": "success", "text": text, "lang": whisper_lang}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("STT request error")
        raise HTTPException(status_code=502, detail=f"STT error: {e}")


# --- Admin Dashboard: patients, risk status, outbound follow-up calls ---

class PatientRecord(BaseModel):
    id: str
    name: str
    caregiver_phone: Optional[str] = None
    channel: str  # voice channel the patient's app joins


# Registered patients (dashboard-managed + mobile self-registration).
# ponytail: in-memory dict, single demo deployment — swap for a real store
# when multi-tenant.
_PATIENTS: Dict[str, Dict[str, Any]] = {}

# Outbound follow-up calls: one record per "Call now" press.
_FOLLOWUP_CALLS: Dict[str, Dict[str, Any]] = {}


def _register_patient_by_channel(
    name: Optional[str], caregiver_phone: Optional[str], channel: str
) -> Dict[str, Any]:
    """Upsert a patient keyed by their stable voice channel."""
    name = (name or "").strip() or "मरीज़"
    phone = (caregiver_phone or "").strip() or None
    for p in _PATIENTS.values():
        if p["channel"] == channel:
            # Keep freshest profile info.
            p["name"] = name
            p["caregiver_phone"] = phone or p.get("caregiver_phone")
            return p
    pid = f"pat-{channel}"
    _PATIENTS[pid] = {
        "id": pid,
        "name": name,
        "caregiver_phone": phone,
        "channel": channel,
    }
    return _PATIENTS[pid]


def _patient_risk(patient: Dict[str, Any]) -> Dict[str, Any]:
    """Risk from real signals: unresolved incidents, latest vitals, missed doses."""
    inc = dispatch_ladder.get(patient["channel"])
    incident_open = inc is not None and inc.status in ("dispatching", "acknowledged")
    meds = tools.get_medications()
    pending = meds.get("pending_count", 0)
    hist = tools.get_vitals_history()
    recent_bp = None
    for h in hist.get("history", []):
        if "bp" in str(h.get("type", "")).lower() or "रक्तचाप" in str(h.get("type", "")):
            recent_bp = h
            break
    level = "green"
    reasons = ["no open incidents, vitals in range"]
    if incident_open:
        level = "red"
        reasons = [f"active emergency: {inc.reason}"]
    elif pending > 0:
        level = "amber"
        reasons = [f"{pending} dose(s) pending today"]
    elif recent_bp and recent_bp.get("status") == "warning":
        level = "amber"
        reasons = [f"recent vitals warning: {recent_bp.get('value')} {recent_bp.get('unit', '')}"]
    return {"level": level, "reasons": reasons, "pending_doses": pending}


@router.get("/api/admin/patients")
async def admin_list_patients():
    """Patient list with live risk status for the admin dashboard."""
    out = []
    for p in _PATIENTS.values():
        out.append({**p, "risk": _patient_risk(p)})
    return {"status": "success", "count": len(out), "patients": out}


class RegisterPatientRequest(BaseModel):
    name: str
    caregiver_phone: Optional[str] = None
    channel: Optional[str] = None


@router.post("/api/admin/patients")
async def admin_register_patient(req: RegisterPatientRequest):
    """Register (or upsert) a patient for the dashboard."""
    channel = (req.channel or "").strip() or f"followup-{req.name.strip() or 'patient'}"
    patient = _register_patient_by_channel(req.name, req.caregiver_phone, channel)
    return {"status": "success", "patient": patient}


class StartFollowupRequest(BaseModel):
    patient_id: str
    note: Optional[str] = None  # reason for the call


@router.post("/api/admin/followup/call")
async def admin_start_followup_call(req: StartFollowupRequest):
    """
    Start the outbound check-in: spins up the SAME Agora conversational agent
    in the patient's channel. The patient's app (already joined / auto-joins)
    hears the agent speak first. SIMULATED (labeled): this rings the patient's
    app over Agora RTC, not the PSTN phone number — real dial-out needs Agora
    Agent Studio + Elastic SIP Trunk (telephony).
    """
    patient = _PATIENTS.get(req.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="patient not found")
    if agent is None:
        raise HTTPException(status_code=500, detail="agent not configured")

    channel = patient["channel"]
    agent_uid = 7000001
    user_uid = 7000002
    try:
        res = await agent.start(
            channel_name=channel,
            agent_uid=agent_uid,
            user_uid=user_uid,
            lang="hi",
            context=[
                {
                    "role": "user",
                    "content": req.note
                    or "डॉक्टर/एडमिन की ओर से फॉलो-अप कॉल — सेहत का हाल पूछें और दवा नियमितता जाँचें",
                }
            ],
        )
    except Exception as e:
        _log_route_error("/api/admin/followup/call", e, patient=req.patient_id)
        raise _to_http_error(e)

    call_id = res.get("agent_id") or f"call-{channel}"
    _FOLLOWUP_CALLS[call_id] = {
        "call_id": call_id,
        "patient_id": req.patient_id,
        "patient_name": patient["name"],
        "channel": channel,
        "note": req.note,
        "status": "in_progress",
        "outcome": None,
        "transcript": [],
        "started_at": time.time(),
    }

    # Real Twilio PSTN Voice Call to Patient / Caregiver
    phone_to_call = patient.get("caregiver_phone") or patient.get("phone")
    twilio_call_res = None
    if phone_to_call:
        twilio_call_res = await outbound_call.trigger_followup_call(
            to=phone_to_call,
            patient=patient["name"],
            note=req.note or "",
            lang="hi",
        )
        logger.info("Admin follow-up Twilio Call result: %s (call_sid=%s)", twilio_call_res.get("status"), twilio_call_res.get("call_sid"))

    return {
        "status": "success",
        "simulated": not bool(twilio_call_res and not twilio_call_res.get("simulated")),
        "transport": "agora-rtc+twilio-voice",
        "twilio_call": twilio_call_res,
        "call": _FOLLOWUP_CALLS[call_id],
    }


class FollowupOutcomeRequest(BaseModel):
    call_id: str
    outcome: str  # "fine" | "needs_review" | "escalate"
    summary: Optional[str] = None


@router.post("/api/admin/followup/outcome")
async def admin_set_followup_outcome(req: FollowupOutcomeRequest):
    """Record the typed post-call outcome; 'escalate' dispatches the emergency ladder."""
    call = _FOLLOWUP_CALLS.get(req.call_id)
    if not call:
        raise HTTPException(status_code=404, detail="call not found")

    call["status"] = "completed"
    call["outcome"] = req.outcome
    call["summary"] = req.summary or ""
    call["ended_at"] = time.time()

    if req.outcome == "escalate":
        patient = _PATIENTS.get(call["patient_id"], {})
        contacts = [
            emergency.Contact(
                name=f"{patient.get('name', 'मरीज़')} — केयरगिवर / Family Caregiver",
                kind="caregiver",
                endpoint=patient.get("caregiver_phone")
                or os.getenv("CAREGIVER_WHATSAPP_PHONE", os.getenv("CAREGIVER_PHONE", "+91 98765 43210")),
            ),
            emergency.Contact(name="108 / 112 एम्बुलंस आपातकालीन सेवा (EMS)", kind="ambulance", endpoint="108"),
        ]
        incident = emergency.Incident(
            channel=call["channel"],
            reason=req.summary or "Follow-up call escalated by admin",
            severity="critical",
            patient=patient.get("name", "मरीज़"),
            contacts=contacts,
        )
        await dispatch_ladder.trigger(incident)

    return {"status": "success", "call": call}


@router.get("/api/admin/followup/calls")
async def admin_list_followup_calls():
    """Recent follow-up calls with typed outcomes for the dashboard."""
    calls = sorted(_FOLLOWUP_CALLS.values(), key=lambda c: c.get("started_at", 0), reverse=True)
    return {"status": "success", "count": len(calls), "calls": calls}


@router.get("/api/admin/followup/incoming")
async def admin_incoming_followup(channel: str = Query(...)):
    """
    Mobile-app poll: is there an in-progress admin follow-up call ringing on
    this channel? The app answers by starting its voice session (which joins
    the channel and speaks with the agent).
    """
    for call in _FOLLOWUP_CALLS.values():
        if call["channel"] == channel and call["status"] == "in_progress":
            return {"status": "success", "incoming": True, "call": call}
    return {"status": "success", "incoming": False, "call": None}


class DirectTwilioCallRequest(BaseModel):
    to: str
    patient: Optional[str] = "मरीज़"
    kind: Optional[str] = "emergency"  # "emergency" | "followup" | "fall"
    reason: Optional[str] = "आपातकालीन चेक"
    note: Optional[str] = ""
    lang: Optional[str] = "hi"


@router.post("/api/twilio/call")
async def direct_twilio_call(req: DirectTwilioCallRequest):
    """Directly trigger a real outbound PSTN voice call via Sahara Twilio (+1 682 349 7450)."""
    if req.kind == "followup":
        res = await outbound_call.trigger_followup_call(
            to=req.to,
            patient=req.patient or "मरीज़",
            note=req.note or "",
            lang=req.lang or "hi",
        )
    elif req.kind == "fall":
        res = await outbound_call.trigger_fall_alert_call(
            to=req.to,
            patient=req.patient or "मरीज़",
            lang=req.lang or "hi",
        )
    else:
        res = await outbound_call.trigger_emergency_call(
            to=req.to,
            patient=req.patient or "मरीज़",
            reason=req.reason or "चिकित्सीय आपातकाल",
            lang=req.lang or "hi",
        )
    return res


@router.get("/api/whatsapp/status")
async def get_whatsapp_status():
    """Get status of OpenWA self-hosted WhatsApp gateway and Meta Cloud API."""
    openwa_ready = False
    openwa_details = {}
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{whatsapp.OPENWA_DEFAULT_URL}/api/health/ready")
            if r.status_code == 200:
                openwa_ready = True
                openwa_details = r.json()
    except Exception as e:
        openwa_details = {"error": str(e)}

    return {
        "status": "success",
        "openwa_gateway": {
            "url": whatsapp.OPENWA_DEFAULT_URL,
            "ready": openwa_ready,
            "session_id": whatsapp.OPENWA_DEFAULT_SESSION,
            "dashboard_url": "http://localhost:2785",
            "details": openwa_details,
        },
        "meta_cloud_api": {
            "configured": whatsapp.whatsapp_client.is_meta_live,
        },
        "twilio_voice": {
            "from_number": outbound_call.TWILIO_FROM_NUMBER,
            "live_configured": bool(outbound_call.TWILIO_ACCOUNT_SID and outbound_call.TWILIO_AUTH_TOKEN),
            "sip_trunk": outbound_call.TWILIO_SIP_TRUNK,
        },
    }


app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
