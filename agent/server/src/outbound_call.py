"""
outbound_call.py — Real PSTN Outbound Voice Calling via Twilio.

Integrates with Sahara's Twilio Number (+1 682 349 7450) and SIP Trunk infrastructure
to make real voice calls to caregivers, patients, and emergency contacts for:
1. Acute Clinical Emergency / Red-Path dispatch
2. Unacknowledged Fall Detection escalation
3. Admin Doctor / Caregiver Follow-Up calls
4. Scheduled medication / vital check-in reminders

Uses Twilio Programmable Voice REST API with Polly.Aditi (Hindi/English native voice).
When TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are present in .env, calls are placed
directly over real cellular/PSTN networks. In development or test, operates in
high-fidelity simulation mode with full call SID tracing.
"""
from __future__ import annotations

import logging
import os
import uuid
import time
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger("uvicorn.error")

# Twilio Configuration
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "+16823497450")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_SIP_TRUNK = os.getenv("TWILIO_SIP_TRUNK", "swadhikaarr.pstn.twilio.com:5060")


def clean_phone_number(phone: str) -> str:
    """Normalize phone number to international E.164 format."""
    raw = (phone or "").strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not raw:
        return ""
    if raw.startswith("+"):
        return raw
    # If 10-digit Indian number without country code
    if len(raw) == 10 and raw.isdigit():
        return f"+91{raw}"
    return f"+{raw}"


def build_emergency_twiml(patient: str, reason: str, lang: str = "hi") -> str:
    """Build bilingual emergency announcement for Polly.Aditi."""
    safe_patient = patient or "मरीज़"
    safe_reason = reason or "आपातकालीन स्थिति"
    
    if lang == "en":
        announcement = (
            f"Urgent emergency alert from Sahara Health Companion. "
            f"Patient {safe_patient} requires immediate medical assistance. "
            f"Reason: {safe_reason}. "
            f"Please check on them immediately or dispatch an ambulance."
        )
        return (
            f'<?xml version="1.0" encoding="UTF-8"?>'
            f'<Response>'
            f'<Pause length="1"/>'
            f'<Say voice="Polly.Aditi" language="en-IN">{announcement}</Say>'
            f'<Pause length="2"/>'
            f'<Say voice="Polly.Aditi" language="en-IN">{announcement}</Say>'
            f'</Response>'
        )

    hi_text = (
        f"सहारा स्वास्थ्य साथी से अति-महत्वपूर्ण आपातकालीन सूचना। "
        f"मरीज़ {safe_patient} को तुरंत चिकित्सा सहायता की आवश्यकता है। "
        f"कारण: {safe_reason}। "
        f"कृपया तुरंत मरीज़ से संपर्क करें या 108 एम्बुलेंस को कॉल करें।"
    )
    en_text = (
        f"Emergency alert from Sahara. Patient {safe_patient} requires urgent help due to {safe_reason}. "
        f"Please check on them immediately."
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<Response>'
        f'<Pause length="1"/>'
        f'<Say voice="Polly.Aditi" language="hi-IN">{hi_text}</Say>'
        f'<Pause length="1"/>'
        f'<Say voice="Polly.Aditi" language="en-IN">{en_text}</Say>'
        f'<Pause length="2"/>'
        f'<Say voice="Polly.Aditi" language="hi-IN">{hi_text}</Say>'
        f'</Response>'
    )


def build_followup_twiml(patient: str, note: str = "", lang: str = "hi") -> str:
    """Build doctor follow-up call announcement spoken by Sahara AI."""
    safe_patient = patient or "नमस्ते"
    safe_note = f" डॉक्टर का संदेश है: {note}।" if note else ""

    if lang == "en":
        announcement = (
            f"Hello {safe_patient}. This is your Sahara AI health companion calling on behalf of your clinic. "
            f"{safe_note} Please remember to take your scheduled medications and stay hydrated. "
            f"If you need any medical assistance, open your Sahara app to talk to me directly. Thank you and take care."
        )
        return (
            f'<?xml version="1.0" encoding="UTF-8"?>'
            f'<Response>'
            f'<Pause length="1"/>'
            f'<Say voice="Polly.Aditi" language="en-IN">{announcement}</Say>'
            f'</Response>'
        )

    hi_text = (
        f"नमस्ते {safe_patient} जी! मैं आपकी स्वास्थ्य साथी सहारा एआई बोल रही हूँ। "
        f"डॉक्टर साहब के कहने पर मैंने आपकी सेहत और दवा की पुष्टि के लिए आपको कॉल किया है।{safe_note} "
        f"कृपया अपनी निर्धारित दवा समय पर लें। यदि कोई भी परेशानी महसूस हो, तो सहारा ऐप खोलकर मुझसे तुरंत बात कर सकते हैं। "
        f"अपना ध्यान रखें, धन्यवाद।"
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<Response>'
        f'<Pause length="1"/>'
        f'<Say voice="Polly.Aditi" language="hi-IN">{hi_text}</Say>'
        f'</Response>'
    )


def build_fall_twiml(patient: str, lang: str = "hi") -> str:
    """Build fall detection alert announcement."""
    safe_patient = patient or "मरीज़"
    hi_text = (
        f"सावधान! सहारा स्वास्थ्य सुरक्षा से सूचना। "
        f"मरीज़ {safe_patient} के गिरने का संकेत मिला है और उनकी तरफ से कोई उत्तर नहीं आया है। "
        f"कृपया तुरंत उनसे संपर्क करें और स्थिति की पुष्टि करें।"
    )
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<Response>'
        f'<Pause length="1"/>'
        f'<Say voice="Polly.Aditi" language="hi-IN">{hi_text}</Say>'
        f'<Pause length="2"/>'
        f'<Say voice="Polly.Aditi" language="hi-IN">{hi_text}</Say>'
        f'</Response>'
    )


async def dial_phone_call(to: str, twiml: str, custom_from: Optional[str] = None) -> Dict[str, Any]:
    """
    Execute real PSTN voice call via Twilio.
    Falls back to high-fidelity simulated response if Twilio credentials are not set.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "") or TWILIO_ACCOUNT_SID
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "") or TWILIO_AUTH_TOKEN
    from_number = custom_from or os.getenv("TWILIO_FROM_NUMBER", "") or TWILIO_FROM_NUMBER
    
    clean_to = clean_phone_number(to)
    if not clean_to:
        logger.warning("[Twilio Call] Invalid recipient phone number: '%s'", to)
        return {"status": "error", "error": "Invalid phone number"}

    is_live = bool(account_sid and auth_token)
    
    if not is_live:
        mock_call_sid = f"CA{uuid.uuid4().hex[:32]}"
        logger.info(
            "[Twilio Voice SIMULATION] Call initiated from %s to %s | CallSid: %s\nTwiML: %s",
            from_number,
            clean_to,
            mock_call_sid,
            twiml[:150],
        )
        return {
            "status": "queued",
            "simulated": True,
            "call_sid": mock_call_sid,
            "to": clean_to,
            "from": from_number,
            "timestamp": time.time(),
            "sip_trunk": TWILIO_SIP_TRUNK,
        }

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json"
    data = {
        "To": clean_to,
        "From": from_number,
        "Twiml": twiml,
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(url, auth=(account_sid, auth_token), data=data)
            if resp.status_code in (200, 201):
                res_data = resp.json()
                call_sid = res_data.get("sid", "")
                logger.info("[Twilio Voice LIVE] Successfully placed call to %s. Call SID: %s", clean_to, call_sid)
                return {
                    "status": "queued",
                    "simulated": False,
                    "call_sid": call_sid,
                    "to": clean_to,
                    "from": from_number,
                    "timestamp": time.time(),
                }
            else:
                logger.error("[Twilio Voice FAILED] status=%s body=%s", resp.status_code, resp.text)
                return {
                    "status": "error",
                    "status_code": resp.status_code,
                    "detail": resp.text,
                    "to": clean_to,
                }
    except Exception as e:
        logger.exception("[Twilio Voice EXCEPTION] Error calling %s: %s", clean_to, e)
        return {"status": "error", "detail": str(e), "to": clean_to}


async def trigger_emergency_call(to: str, patient: str, reason: str, lang: str = "hi") -> Dict[str, Any]:
    """Place emergency alert call to primary caregiver or EMS."""
    twiml = build_emergency_twiml(patient, reason, lang)
    return await dial_phone_call(to, twiml)


async def trigger_followup_call(to: str, patient: str, note: str = "", lang: str = "hi") -> Dict[str, Any]:
    """Place follow-up clinic check-in call."""
    twiml = build_followup_twiml(patient, note, lang)
    return await dial_phone_call(to, twiml)


async def trigger_fall_alert_call(to: str, patient: str, lang: str = "hi") -> Dict[str, Any]:
    """Place urgent fall notification call."""
    twiml = build_fall_twiml(patient, lang)
    return await dial_phone_call(to, twiml)
