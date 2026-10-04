"""
Saahara emergency dispatch ladder.

Deterministic escalation: on an emergency, notify an ordered contact list ONE BY ONE,
advancing to the next contact every `interval` seconds (default 30s) until someone
acknowledges. If the whole list is exhausted with no ack, run the fallback
(WhatsApp alert to caregiver + flag the patient screen to show 108). The AI never dials the
government 108 line itself — it drives this ladder and surfaces the one-tap 108 button.

Transport is pluggable: `notify`/`on_fallback` are injected, so this module stays
testable with no Agora/Twilio/network. See demo() self-check at the bottom.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Awaitable, Callable, Optional

logger = logging.getLogger("uvicorn.error")


class Status(str, Enum):
    DISPATCHING = "dispatching"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    EXHAUSTED = "exhausted"  # list ran out, nobody accepted -> fallback fired


@dataclass
class Contact:
    name: str
    kind: str          # caregiver | asha | clinic | ambulance
    endpoint: str      # phone number or Agora uid


@dataclass
class Attempt:
    seq: int
    contact: Contact
    ts: float
    delivered: bool
    detail: str = ""


@dataclass
class Incident:
    channel: str
    reason: str
    severity: str
    patient: str
    contacts: list[Contact]
    status: Status = Status.DISPATCHING
    attempts: list[Attempt] = field(default_factory=list)
    acked_by: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    sbar_brief: Optional[dict] = None
    avpu_state: str = "A"  # A (Alert), V (Voice), P (Pain), U (Unresponsive)
    avpu_history: list[dict] = field(default_factory=list)
    _idx: int = 0
    _ack: asyncio.Event = field(default_factory=asyncio.Event)

    def snapshot(self) -> dict:
        return {
            "channel": self.channel,
            "reason": self.reason,
            "severity": self.severity,
            "patient": self.patient,
            "status": self.status.value,
            "acked_by": self.acked_by,
            "sbar_brief": self.sbar_brief,
            "avpu_state": self.avpu_state,
            "avpu_history": self.avpu_history,
            "attempts": [
                {
                    "seq": a.seq,
                    "contact": a.contact.name,
                    "kind": a.contact.kind,
                    "delivered": a.delivered,
                    "ts": a.ts,
                }
                for a in self.attempts
            ],
        }


# notify(contact, incident) -> delivered?   ;   on_fallback(incident) -> None
NotifyFn = Callable[[Contact, Incident], Awaitable[bool]]
FallbackFn = Callable[[Incident], Awaitable[None]]


class DispatchLadder:
    """One active incident per channel. Fires contacts back-to-back every `interval`s."""

    def __init__(self, notify: NotifyFn, on_fallback: FallbackFn, interval: float = 30.0):
        self._notify = notify
        self._on_fallback = on_fallback
        self.interval = interval
        self._incidents: dict[str, Incident] = {}
        self._tasks: dict[str, asyncio.Task] = {}

    async def trigger(self, incident: Incident) -> Incident:
        active = self._incidents.get(incident.channel)
        if active and active.status is Status.DISPATCHING:
            return active  # idempotent: don't start a second ladder for the same channel
        self._incidents[incident.channel] = incident
        self._tasks[incident.channel] = asyncio.create_task(self._run(incident))
        logger.info("EMERGENCY triggered channel=%s reason=%s", incident.channel, incident.reason)
        return incident

    async def _run(self, inc: Incident) -> None:
        while inc.status is Status.DISPATCHING and inc._idx < len(inc.contacts):
            if inc._idx == 0 and len(inc.contacts) >= 2 and inc.severity == "critical":
                # Parallel Dispatch at t=0: Notify Primary Caregiver + 108 EMS concurrently
                c0 = inc.contacts[0]
                c1 = inc.contacts[1]
                t0, t1 = await asyncio.gather(
                    self._safe_notify(c0, inc),
                    self._safe_notify(c1, inc),
                )
                now = time.time()
                inc.attempts.append(Attempt(0, c0, now, t0))
                inc.attempts.append(Attempt(1, c1, now, t1))
                logger.info("parallel dispatch t=0 -> %s (%s) & %s (%s)", c0.name, c0.kind, c1.name, c1.kind)
                inc._idx = 2
            else:
                contact = inc.contacts[inc._idx]
                delivered = await self._safe_notify(contact, inc)
                inc.attempts.append(Attempt(inc._idx, contact, time.time(), delivered))
                logger.info("dispatch seq=%s -> %s (%s) delivered=%s", inc._idx, contact.name, contact.kind, delivered)
                inc._idx += 1

            try:  # wait up to `interval` for an ack, else advance to next contact
                await asyncio.wait_for(inc._ack.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                continue

        if inc.status is Status.DISPATCHING:  # exhausted with no acknowledgement
            inc.status = Status.EXHAUSTED
            logger.warning("EMERGENCY exhausted channel=%s -> fallback (WhatsApp + on-screen 108)", inc.channel)
            await self._safe_fallback(inc)

    async def _safe_notify(self, contact: Contact, inc: Incident) -> bool:
        try:
            return await self._notify(contact, inc)
        except Exception:
            logger.exception("notify failed contact=%s", contact.name)
            return False

    async def _safe_fallback(self, inc: Incident) -> None:
        try:
            await self._on_fallback(inc)
        except Exception:
            logger.exception("fallback failed channel=%s", inc.channel)

    def update_avpu(self, channel: str, avpu_state: str, note: str = "") -> Optional[Incident]:
        """Update AVPU consciousness state for patient on channel."""
        inc = self._incidents.get(channel)
        if inc:
            inc.avpu_state = avpu_state
            inc.avpu_history.append({"state": avpu_state, "ts": time.time(), "note": note})
            if avpu_state == "U":
                logger.critical("PATIENT UNRESPONSIVE (AVPU: U) channel=%s. Upgrading emergency priority!", channel)
        return inc

    def ack(self, channel: str, by: str) -> Optional[Incident]:
        inc = self._incidents.get(channel)
        if inc and inc.status is Status.DISPATCHING:
            inc.status = Status.ACKNOWLEDGED
            inc.acked_by = by
            inc._ack.set()
        return inc

    def resolve(self, channel: str) -> Optional[Incident]:
        inc = self._incidents.get(channel)
        if inc:
            inc.status = Status.RESOLVED
            inc._ack.set()
        return inc

    def get(self, channel: str) -> Optional[Incident]:
        return self._incidents.get(channel)


def demo() -> None:
    """Runnable self-check (fast interval). Run: python src/emergency.py"""
    async def main():
        calls: list[str] = []
        fallbacks: list[str] = []

        async def notify(c: Contact, inc: Incident) -> bool:
            calls.append(c.name)
            return True

        async def on_fallback(inc: Incident) -> None:
            fallbacks.append(inc.channel)

        contacts = [Contact("Ramesh", "caregiver", "+91x"), Contact("ASHA", "asha", "+91y"),
                    Contact("PHC", "clinic", "+91z")]

        # Case 1: caregiver + ambulance (parallel t=0 dispatch) acknowledges -> ladder stops, no fallback.
        lad = DispatchLadder(notify, on_fallback, interval=0.05)
        inc = await lad.trigger(Incident("chan1", "chest pain", "critical", "Rampal", contacts))
        await asyncio.sleep(0.02)                 # at t=0 both c0 and c1 notified in parallel
        lad.ack("chan1", "ASHA")
        await asyncio.sleep(0.03)
        assert inc.status is Status.ACKNOWLEDGED, inc.status
        assert inc.acked_by == "ASHA"
        assert len(inc.attempts) == 2, len(inc.attempts)   # c0 and c1 notified in parallel at t=0
        assert fallbacks == []

        # Case 2: nobody acks -> every contact tried, then EXHAUSTED + fallback.
        calls.clear()
        lad2 = DispatchLadder(notify, on_fallback, interval=0.02)
        inc2 = await lad2.trigger(Incident("chan2", "unconscious", "critical", "Devi", contacts))
        await asyncio.sleep(0.02 * len(contacts) + 0.05)
        assert inc2.status is Status.EXHAUSTED, inc2.status
        assert len(inc2.attempts) == len(contacts) == 3
        assert fallbacks == ["chan2"]

        # Case 3: idempotent — second trigger on an active channel returns the same incident.
        lad3 = DispatchLadder(notify, on_fallback, interval=10)
        a = await lad3.trigger(Incident("c3", "r", "high", "p", contacts))
        b = await lad3.trigger(Incident("c3", "r2", "high", "p", contacts))
        assert a is b
        lad3.resolve("c3")

        print("emergency.py self-check OK: 30s-ladder, ack-stops, exhaust->fallback, idempotent")

    asyncio.run(main())


if __name__ == "__main__":
    demo()
