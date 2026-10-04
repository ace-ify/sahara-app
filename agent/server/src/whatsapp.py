# -*- coding: utf-8 -*-
"""
whatsapp.py — Server-Side WhatsApp Business Cloud API (Meta Graph API) Integration.

Enables autonomous server-side dispatch for:
1. Emergency Red-Path alerts (SBAR Clinical Summary + Live Agora link)
2. AVPU: Unresponsive (U) cardiac collapse escalation
3. Emergency resolution and false-alarm clearance
4. Routine medication adherence & daily telemetry updates

Supports both:
- Live Meta Cloud API mode (when WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are configured)
- High-fidelity Simulation mode (for offline grading, testing, and live hackathon demos)
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger("uvicorn.error")

META_WA_BASE_URL = "https://graph.facebook.com"


class WhatsAppClient:
    def __init__(
        self,
        token: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        api_version: str = "v19.0",
        default_recipient: str = "+919876543210",
    ):
        self.token = token or os.getenv("WHATSAPP_TOKEN") or os.getenv("META_WA_TOKEN") or ""
        self.phone_number_id = (
            phone_number_id
            or os.getenv("WHATSAPP_PHONE_NUMBER_ID")
            or os.getenv("META_WA_PHONE_NUMBER_ID")
            or ""
        )
        self.api_version = os.getenv("META_WA_VERSION", api_version)
        self.default_recipient = (
            os.getenv("CAREGIVER_WHATSAPP_PHONE")
            or os.getenv("CAREGIVER_PHONE")
            or default_recipient
        )
        self.is_live = bool(self.token and self.phone_number_id)
        if self.is_live:
            logger.info("WhatsApp Cloud API initialized in LIVE mode (PhoneID: %s)", self.phone_number_id)
        else:
            logger.info("WhatsApp Cloud API initialized in SIMULATION/DEMO mode (no credentials provided)")

    @property
    def endpoint_url(self) -> str:
        return f"{META_WA_BASE_URL}/{self.api_version}/{self.phone_number_id}/messages"

    async def send_text(
        self,
        to: Optional[str],
        text: str,
        preview_url: bool = True,
    ) -> Dict[str, Any]:
        """Send a free-form WhatsApp text message via Meta Cloud API."""
        recipient = (to or self.default_recipient).replace(" ", "").replace("-", "")
        if not recipient.startswith("+"):
            recipient = f"+{recipient}"

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": text,
            },
        }

        ts = time.time()
        if not self.is_live:
            # Deterministic simulation with standard Meta WAMID format
            mock_wamid = f"wamid.HBgL{uuid.uuid4().hex[:18].upper()}"
            logger.info(
                "[WhatsApp SIMULATION] Message to %s delivered. WAMID: %s\nContent:\n%s",
                recipient,
                mock_wamid,
                text,
            )
            return {
                "status": "delivered",
                "simulated": True,
                "recipient": recipient,
                "message_id": mock_wamid,
                "timestamp": ts,
                "payload": payload,
            }

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(self.endpoint_url, headers=headers, json=payload)
                if res.status_code in (200, 201):
                    data = res.json()
                    wamid = data.get("messages", [{}])[0].get("id", f"wamid.{uuid.uuid4().hex}")
                    logger.info("Live WhatsApp message dispatched to %s. WAMID: %s", recipient, wamid)
                    return {
                        "status": "delivered",
                        "simulated": False,
                        "recipient": recipient,
                        "message_id": wamid,
                        "timestamp": ts,
                        "response": data,
                    }
                else:
                    logger.error(
                        "WhatsApp API error %s: %s",
                        res.status_code,
                        res.text,
                    )
                    return {
                        "status": "failed",
                        "simulated": False,
                        "error": res.text,
                        "status_code": res.status_code,
                    }
        except Exception as e:
            logger.exception("Failed to connect to Meta WhatsApp Cloud API: %s", e)
            return {
                "status": "error",
                "simulated": False,
                "error": str(e),
            }

    async def send_emergency_alert(
        self,
        patient_name: str,
        reason: str,
        severity: str,
        sbar: Optional[Dict[str, Any]] = None,
        channel: Optional[str] = None,
        to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dispatch a high-priority emergency SBAR brief via WhatsApp."""
        sit = sbar.get("situation", reason) if sbar else reason
        bg = sbar.get("background", "Known senior patient") if sbar else "Known senior patient"
        ass = sbar.get("assessment", f"NEWS2 Critical Band ({severity.upper()})") if sbar else f"Critical ({severity})"
        rec = sbar.get("recommendation", "Immediate 108 ambulance transport & caregiver presence") if sbar else "Immediate presence needed"
        handover = sbar.get("verbal_handoff", "") if sbar else ""

        body = (
            f"🚨 *SAAHARA EMERGENCY ALERT: {patient_name.upper()}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ *Severity*: {severity.upper()} (NEWS2 RED PATH)\n"
            f"🕒 *Time*: {time.strftime('%I:%M %p, %d %b %Y')}\n\n"
            f"📋 *SBAR Clinical Summary*:\n"
            f"• *Situation*: {sit}\n"
            f"• *Background*: {bg}\n"
            f"• *Assessment*: {ass}\n"
            f"• *Recommendation*: {rec}\n\n"
            f"🚑 *Action Taken*:\n"
            f"✓ 108 EMS ambulance alert primed\n"
            f"✓ Pre-arrival coaching active (Fowler's position)\n"
            f"✓ Continuous voice lifeline never disconnects\n\n"
            f"👉 *Immediate Family Actions*:\n"
            f"1. Call 108 to confirm physical entry.\n"
            f"2. Unlock front door for paramedics.\n"
            f"3. Join senior's live Agora call: https://agoracare.vercel.app or Saahara Mobile."
        )

        return await self.send_text(to=to, text=body)

    async def send_unresponsive_alert(
        self,
        patient_name: str,
        channel: Optional[str] = None,
        to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Triggered autonomously when patient AVPU drops to U (Unresponsive)."""
        body = (
            f"🛑 *CRITICAL ALERT: {patient_name.upper()} IS UNRESPONSIVE*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ *AVPU State*: 'U' (Unresponsive / Silent)\n"
            f"🕒 *Time*: {time.strftime('%I:%M %p')}\n\n"
            f"The patient has stopped speaking or answering 60s voice heartbeats. "
            f"Possible syncope, cardiac arrest, or loss of consciousness.\n\n"
            f"🚨 *DISPATCH PROTOCOL UPGRADED*:\n"
            f"• 108 ALS Resuscitation & Defibrillator priority flagged\n"
            f"• Contact neighbors/apartment security IMMEDIATELY to enter home!\n"
            f"• Ensure front door is accessible for EMT crew."
        )
        return await self.send_text(to=to, text=body)

    async def send_resolution_notification(
        self,
        patient_name: str,
        resolved_by: str,
        note: str,
        to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Triggered when an emergency is safely resolved or confirmed false alarm."""
        body = (
            f"✅ *SAAHARA EMERGENCY RESOLVED*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Patient: {patient_name}\n"
            f"Resolved by: {resolved_by}\n"
            f"Notes: {note}\n"
            f"Time: {time.strftime('%I:%M %p')}\n\n"
            f"The emergency ladder has stood down. Patient vitals and status returned to normal monitoring."
        )
        return await self.send_text(to=to, text=body)

    async def send_adherence_update(
        self,
        patient_name: str,
        doses_summary: str,
        vitals_summary: str,
        to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Daily 2-way medication adherence status dispatch."""
        body = (
            f"🌿 *Saahara Daily Care Update: {patient_name}*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"💊 *Medications*: {doses_summary}\n"
            f"📊 *Vitals*: {vitals_summary}\n"
            f"🕒 *Status*: All normal · On-device encrypted sync active."
        )
        return await self.send_text(to=to, text=body)


# Singleton instance
whatsapp_client = WhatsAppClient()
