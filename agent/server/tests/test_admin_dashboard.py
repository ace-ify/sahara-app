"""Admin dashboard endpoints: patient registry, risk, follow-up calls, outcomes."""


def test_register_and_list_patient(client):
    res = client.post("/api/admin/patients", json={"name": "Ramprasad", "caregiver_phone": "9876543210"})
    assert res.status_code == 200
    assert res.json()["patient"]["name"] == "Ramprasad"

    res = client.get("/api/admin/patients")
    assert res.status_code == 200
    patients = res.json()["patients"]
    assert any(p["name"] == "Ramprasad" for p in patients)
    p = patients[0]
    assert p["risk"]["level"] in ("green", "amber", "red")
    assert isinstance(p["risk"]["reasons"], list)


def test_followup_call_lifecycle(client):
    reg = client.post("/api/admin/patients", json={"name": "Sita"}).json()["patient"]
    res = client.post("/api/admin/followup/call", json={"patient_id": reg["id"]})
    assert res.status_code == 200
    body = res.json()
    # Labeled simulated transport (rings the app, not PSTN).
    assert body["simulated"] is True
    call_id = body["call"]["call_id"]

    # Patient-side poll sees the incoming call on that channel.
    res = client.get(f"/api/admin/followup/incoming?channel={reg['channel']}")
    assert res.json()["incoming"] is True

    # Typed outcome recorded.
    res = client.post(
        "/api/admin/followup/outcome",
        json={"call_id": call_id, "outcome": "fine", "summary": "all good"},
    )
    assert res.status_code == 200
    assert res.json()["call"]["outcome"] == "fine"

    # No longer incoming once completed.
    res = client.get(f"/api/admin/followup/incoming?channel={reg['channel']}")
    assert res.json()["incoming"] is False


def test_outcome_escalate_triggers_incident(client, server_module):
    reg = client.post("/api/admin/patients", json={"name": "Gopal"}).json()["patient"]
    call_id = client.post("/api/admin/followup/call", json={"patient_id": reg["id"]}).json()["call"]["call_id"]

    res = client.post("/api/admin/followup/outcome", json={"call_id": call_id, "outcome": "escalate"})
    assert res.status_code == 200
    # Emergency ladder has an open incident on that channel.
    inc = server_module.dispatch_ladder.get(reg["channel"])
    assert inc is not None


def test_start_agent_self_registers_patient(client):
    """Mobile /startAgent with profile → patient auto-registered by channel."""
    res = client.post(
        "/startAgent",
        json={
            "channelName": "sahara-room-selfreg",
            "rtcUid": 7000001,
            "userUid": 7000002,
            "patient": "Ramprasad",
            "caregiver_phone": "9876543210",
        },
    )
    assert res.status_code == 200
    patients = client.get("/api/admin/patients").json()["patients"]
    match = [p for p in patients if p["channel"] == "sahara-room-selfreg"]
    assert match and match[0]["name"] == "Ramprasad"
    assert match[0]["caregiver_phone"] == "9876543210"
