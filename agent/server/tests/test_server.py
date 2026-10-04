"""FastAPI route tests via TestClient + FakeAgent (no Agora cloud)."""


def test_get_config_returns_envelope_and_token(client):
    response = client.get("/get_config")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    assert body["msg"] == "success"
    data = body["data"]
    assert data["app_id"] == "0123456789abcdef0123456789abcdef"
    assert isinstance(data["token"], str) and len(data["token"]) > 0
    assert data["uid"] and data["uid"] != "0"
    assert data["channel_name"].startswith("ai-conversation-")
    assert data["agent_uid"]


def test_get_config_remaps_zero_uid_and_honors_channel(client):
    response = client.get("/get_config", params={"uid": 0, "channel": "test-channel"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["uid"] != "0"
    assert data["channel_name"] == "test-channel"


def test_start_agent_calls_agent_and_returns_shape(client):
    response = client.post(
        "/startAgent",
        json={"channelName": "ch", "rtcUid": 111, "userUid": 222},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    assert body["data"] == {
        "agent_id": "fake-agent-111",
        "channel_name": "ch",
        "status": "started",
    }
    assert client.fake_agent.started == [("ch", 111, 222, None)]


def test_start_agent_forwards_output_audio_codec(client):
    client.post(
        "/startAgent",
        json={
            "channelName": "ch",
            "rtcUid": 111,
            "userUid": 222,
            "parameters": {"output_audio_codec": "opus"},
        },
    )
    assert client.fake_agent.started[-1] == ("ch", 111, 222, "opus")


def test_stop_agent(client):
    response = client.post("/stopAgent", json={"agentId": "fake-agent-111"})
    assert response.status_code == 200
    assert response.json()["code"] == 0
    assert client.fake_agent.stopped == ["fake-agent-111"]


def test_value_error_maps_to_400(client, server_module):
    class BadAgent:
        async def start(self, **kwargs):
            raise ValueError("bad input")

        async def stop(self, *args):
            pass

    server_module.agent = BadAgent()
    response = client.post(
        "/startAgent", json={"channelName": "c", "rtcUid": 1, "userUid": 2}
    )
    assert response.status_code == 400
    assert "bad input" in response.json()["detail"]


def test_runtime_error_maps_to_500(client, server_module):
    class BoomAgent:
        async def start(self, **kwargs):
            raise RuntimeError("explode")

        async def stop(self, *args):
            pass

    server_module.agent = BoomAgent()
    response = client.post(
        "/startAgent", json={"channelName": "c", "rtcUid": 1, "userUid": 2}
    )
    assert response.status_code == 500


def test_misconfigured_agent_returns_500(client, server_module):
    server_module.agent = None
    assert client.get("/get_config").status_code == 500
    assert (
        client.post(
            "/startAgent", json={"channelName": "c", "rtcUid": 1, "userUid": 2}
        ).status_code
        == 500
    )
    assert client.post("/stopAgent", json={"agentId": "x"}).status_code == 500


def test_llm_chat_completions_mocked(client, monkeypatch):
    import brain

    async def fake_complete(payload):
        return "नमस्ते"

    monkeypatch.setattr(brain, "complete_text", fake_complete)
    resp = client.post("/llm/chat/completions", json={"messages": [{"role": "user", "content": "hi"}], "stream": False})
    assert resp.status_code == 200
    data = resp.json()
    assert data["choices"][0]["message"]["content"] == "नमस्ते"


def test_llm_chat_completions_companion_tool_and_card(client, monkeypatch):
    import brain

    captured_payload = {}

    async def fake_complete(payload):
        captured_payload.update(payload)
        return "आपकी एम्लोडिपिन दवा बाकी है।"

    monkeypatch.setattr(brain, "complete_text", fake_complete)

    resp = client.post(
        "/llm/chat/completions?channel=test-ch",
        json={"messages": [{"role": "user", "content": "मेरी आज की दवाएं क्या हैं?"}], "stream": False},
    )
    assert resp.status_code == 200

    # Verify tool result was injected into messages
    sys_msgs = [m for m in captured_payload.get("messages", []) if m.get("role") == "system"]
    assert any("SYSTEM TOOL RESULT (get_medications)" in m.get("content", "") for m in sys_msgs)

    # Verify card was pushed to active card store
    card_resp = client.get("/api/card/latest?channel=test-ch")
    assert card_resp.status_code == 200
    card_data = card_resp.json()
    assert card_data["status"] == "success"
    assert card_data["card"]["type"] == "medicine"
    assert "दवाएं" in card_data["card"]["title"]


def test_llm_chat_completions_emergency_latching(client, monkeypatch, server_module):
    import brain

    captured_payload = {}

    async def fake_complete(payload):
        captured_payload.update(payload)
        return "आप शांत रहें, रमेश को सूचित कर दिया है।"

    monkeypatch.setattr(brain, "complete_text", fake_complete)

    resp = client.post(
        "/llm/chat/completions?channel=sos-ch",
        json={"messages": [{"role": "user", "content": "मुझे छाती में बहुत तेज़ दर्द हो रहा है"}], "stream": False},
    )
    assert resp.status_code == 200

    # Verify emergency system directive was injected
    sys_msgs = [m for m in captured_payload.get("messages", []) if m.get("role") == "system"]
    assert any("CRITICAL SYSTEM DIRECTIVE" in m.get("content", "") for m in sys_msgs)
    assert any("DO NOT tell the patient to hang up" in m.get("content", "") for m in sys_msgs)

    # Verify dispatch ladder was triggered for channel
    inc = server_module.dispatch_ladder.get("sos-ch")
    assert inc is not None
    assert inc.channel == "sos-ch"
    assert "छाती" in inc.reason

    # Verify emergency card was pushed
    card_resp = client.get("/api/card/latest?channel=sos-ch")
    assert card_resp.status_code == 200
    card_data = card_resp.json()
    assert card_data["card"]["type"] == "emergency"


def test_card_endpoints(client):
    # Push card manually
    push_res = client.post(
        "/api/card/push",
        json={
            "channel": "ch-manual",
            "card": {"type": "facility", "title": "PHC रामपुर", "subtitle": "2.1 किमी"},
        },
    )
    assert push_res.status_code == 200

    # Get by channel
    get_res = client.get("/api/card/latest?channel=ch-manual")
    assert get_res.status_code == 200
    assert get_res.json()["card"]["title"] == "PHC रामपुर"

    # Get latest global
    get_glob = client.get("/api/card/latest")
    assert get_glob.status_code == 200
    assert get_glob.json()["card"]["title"] == "PHC रामपुर"


def test_emergency_trigger_parallel_and_sbar(client, server_module):
    resp = client.post(
        "/api/emergency/trigger",
        json={"channel": "sos-parallel-ch", "reason": "अत्यधिक सीने में दर्द", "severity": "critical"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "triggered"
    assert data["sbar"] is not None
    assert "SBAR Brief" in data["sbar"]["verbal_handoff"]

    # Check incident attempts in parallel (Caregiver and Ambulance both at t=0)
    inc = server_module.dispatch_ladder.get("sos-parallel-ch")
    assert inc is not None
    assert len(inc.attempts) >= 2
    assert inc.attempts[0].contact.kind == "caregiver"
    assert inc.attempts[1].contact.kind == "ambulance"


def test_emergency_avpu_endpoint(client, server_module):
    # Trigger first
    client.post(
        "/api/emergency/trigger",
        json={"channel": "avpu-ch", "reason": "चक्कर खाकर गिर पड़े"},
    )

    # Update AVPU to Voice
    v_resp = client.post("/api/emergency/avpu", json={"channel": "avpu-ch", "avpu_state": "V", "note": "Patient spoke"})
    assert v_resp.status_code == 200
    assert v_resp.json()["incident"]["avpu_state"] == "V"

    # Update AVPU to Unresponsive
    u_resp = client.post("/api/emergency/avpu", json={"channel": "avpu-ch", "avpu_state": "U", "note": "No response for 60s"})
    assert u_resp.status_code == 200
    assert u_resp.json()["incident"]["avpu_state"] == "U"

    # Verify critical unresponsive card was pushed
    card_resp = client.get("/api/card/latest?channel=avpu-ch")
    assert card_resp.status_code == 200
    assert "अचेत" in card_resp.json()["card"]["title"]


def test_emergency_sbar_endpoint(client):
    client.post(
        "/api/emergency/trigger",
        json={"channel": "sbar-ch", "reason": "बीपी 195/120 संकट"},
    )
    sbar_resp = client.get("/api/emergency/sbar?channel=sbar-ch")
    assert sbar_resp.status_code == 200
    sbar_data = sbar_resp.json()
    assert sbar_data["status"] == "success"
    assert "verbal_handoff" in sbar_data["sbar"]



