"""Agent env validation + managed-OpenAI wiring (SDK session monkeypatched)."""
import asyncio
import sys

import pytest


def _fresh_agent_module():
    sys.modules.pop("agent", None)
    import agent

    return agent


@pytest.mark.parametrize("missing", ["AGORA_APP_ID", "AGORA_APP_CERTIFICATE"])
def test_agent_requires_env(fake_env, monkeypatch, missing):
    monkeypatch.delenv(missing, raising=False)
    agent = _fresh_agent_module()
    with pytest.raises(ValueError):
        agent.Agent()


def test_agent_constructs_with_full_env(fake_env):
    agent = _fresh_agent_module()
    instance = agent.Agent()
    assert instance.app_id == "0123456789abcdef0123456789abcdef"
    assert instance.client is not None


def test_start_wires_managed_openai_and_returns_shape(fake_env, monkeypatch):
    agent = _fresh_agent_module()
    captured = {}

    class FakeSession:
        async def start(self):
            return "test-agent-id"

        async def stop(self):
            captured["stopped"] = True

    def fake_create_async_session(self, **kwargs):
        captured["llm"] = self.llm
        captured["channel"] = kwargs.get("channel")
        captured["remote_uids"] = kwargs.get("remote_uids")
        return FakeSession()

    from agora_agent.agentkit import Agent as AgoraAgent

    monkeypatch.setattr(AgoraAgent, "create_async_session", fake_create_async_session)

    instance = agent.Agent()
    result = asyncio.run(instance.start(channel_name="ch", agent_uid=111, user_uid=222))

    assert result == {
        "agent_id": "test-agent-id",
        "channel_name": "ch",
        "status": "started",
    }
    # The LLM stage is the managed OpenAI vendor (gpt-4o-mini), NOT CustomLLM.
    assert captured["llm"]["url"] == "https://api.openai.com/v1/chat/completions"
    assert captured["llm"]["params"]["model"] == "gpt-4o-mini"
    assert captured["llm"]["style"] == "openai"
    assert "vendor" not in captured["llm"]  # managed OpenAI has no custom vendor key
    assert captured["channel"] == "ch"
    assert captured["remote_uids"] == ["222"]


def test_start_wires_groq_when_groq_key_set(fake_env, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_mock_test_key")
    agent = _fresh_agent_module()
    captured = {}

    class FakeSession:
        async def start(self):
            return "test-groq-agent-id"

    def fake_create_async_session(self, **kwargs):
        captured["llm"] = self.llm
        return FakeSession()

    from agora_agent.agentkit import Agent as AgoraAgent
    monkeypatch.setattr(AgoraAgent, "create_async_session", fake_create_async_session)

    instance = agent.Agent()
    result = asyncio.run(instance.start(channel_name="ch", agent_uid=111, user_uid=222))

    assert result["status"] == "started"
    assert captured["llm"]["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert captured["llm"]["params"]["model"] == "llama-3.3-70b-versatile"
    assert captured["llm"]["api_key"] == "gsk_mock_test_key"


def test_start_wires_proxy_when_forced_or_fallback(fake_env, monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "proxy")
    monkeypatch.setenv("LLM_PROXY_URL", "https://proxy.example.com/llm")
    agent = _fresh_agent_module()
    captured = {}

    class FakeSession:
        async def start(self):
            return "test-proxy-agent-id"

    def fake_create_async_session(self, **kwargs):
        captured["llm"] = self.llm
        return FakeSession()

    from agora_agent.agentkit import Agent as AgoraAgent
    monkeypatch.setattr(AgoraAgent, "create_async_session", fake_create_async_session)

    instance = agent.Agent()
    result = asyncio.run(instance.start(channel_name="ch", agent_uid=111, user_uid=222))

    assert result["status"] == "started"
    assert captured["llm"]["url"] == "https://proxy.example.com/llm"


def test_start_falls_back_from_groq_to_managed_on_failure(fake_env, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_mock_key")
    agent = _fresh_agent_module()
    attempts = []

    class FakeSession:
        def __init__(self, llm_config):
            self.llm_config = llm_config

        async def start(self):
            if "groq" in self.llm_config.get("url", ""):
                raise RuntimeError("Groq connection rejected")
            return "managed-agent-id"

    def fake_create_async_session(self, **kwargs):
        attempts.append(self.llm)
        return FakeSession(self.llm)

    from agora_agent.agentkit import Agent as AgoraAgent
    monkeypatch.setattr(AgoraAgent, "create_async_session", fake_create_async_session)

    instance = agent.Agent()
    result = asyncio.run(instance.start(channel_name="ch", agent_uid=111, user_uid=222))

    assert result["status"] == "started"
    assert result["agent_id"] == "managed-agent-id"
    # First attempt was Groq, second attempt was Agora Managed gpt-4o-mini
    assert len(attempts) == 2
    assert "groq" in attempts[0]["url"]
    assert attempts[1]["params"]["model"] == "gpt-4o-mini"



def test_start_validates_arguments(fake_env, monkeypatch):
    agent = _fresh_agent_module()
    from agora_agent.agentkit import Agent as AgoraAgent

    monkeypatch.setattr(AgoraAgent, "create_async_session", lambda self, **k: None)
    instance = agent.Agent()
    with pytest.raises(ValueError):
        asyncio.run(instance.start(channel_name="", agent_uid=1, user_uid=2))
    with pytest.raises(ValueError):
        asyncio.run(instance.start(channel_name="c", agent_uid=0, user_uid=2))


def test_stop_uses_active_session_then_falls_back(fake_env, monkeypatch):
    agent = _fresh_agent_module()

    class FakeSession:
        def __init__(self):
            self.stopped = False

        async def start(self):
            return "agent-xyz"

        async def stop(self):
            self.stopped = True

    session = FakeSession()
    from agora_agent.agentkit import Agent as AgoraAgent

    monkeypatch.setattr(AgoraAgent, "create_async_session", lambda self, **k: session)
    instance = agent.Agent()

    fallback_calls = []

    async def fake_stop_agent(agent_id):
        fallback_calls.append(agent_id)

    monkeypatch.setattr(instance.client, "stop_agent", fake_stop_agent)

    asyncio.run(instance.start(channel_name="ch", agent_uid=111, user_uid=222))
    asyncio.run(instance.stop("agent-xyz"))
    assert session.stopped is True
    assert fallback_calls == []

    asyncio.run(instance.stop("unknown-id"))
    assert fallback_calls == ["unknown-id"]
