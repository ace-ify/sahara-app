# Stitch prompt — Sahārā (structure & content only)

> Paste into Stitch. Attach your design screenshots as the visual reference.
> **Do NOT invent a visual theme, colors, gradients, or branding** — I will supply the look via reference images. Your job is **information architecture, content, element placement, and states** for each screen.

---

**App:** Sahārā — a Hindi-first, voice-first health companion for **elderly / low-literacy rural Indian users** on cheap Android phones. The core interaction is **talking to an AI**, and in an emergency the app pulls a family caregiver and a responder onto one live voice call. Everything must work for someone who cannot read well: large type, big tap targets, an icon + word + "read aloud" on every action, Hindi (Devanagari) primary with English secondary.

Design these screens. For each: respect the stated purpose, who it's for, the content blocks, the key interactive elements, and the required states.

**PATIENT APP**

1. **Onboarding + Language** — Purpose: pick Hindi/English and grant mic/location/notification permissions. Elements: two large language choices (script sample + a speaker/listen icon), a one-line plain explanation of why each permission is needed, big "Start" button. Voice-guided.

2. **Caregiver pairing** — Purpose: link one family caregiver. Elements: a QR code to show, a "Scan" option, a short numeric code, status ("Linked ✓"). One primary action.

3. **Home / Talk (MOST IMPORTANT)** — Purpose: the always-on voice screen. Elements: a large central **live audio waveform** (reacts to the mic — NOT a static orb), a conversation-state label (Idle "Tap to talk" / Listening / Thinking / Speaking), a **large streaming transcript** area (both sides, big text), an inline **info card** slot (e.g. a clinic card: name, distance, map thumbnail, big Call button), a **persistent SOS button** and a **persistent 108 button** always visible. States: idle, listening, thinking, speaking, offline banner, error.

4. **Emergency active (HERO SCREEN)** — Purpose: shown the moment SOS triggers; must feel calm and in-control. Elements: big reassuring headline ("Madad aa rahi hai"), a row of **participant avatars** (You, AI, Caregiver, Responder) with join status, a **dispatch status line** ("Facility ko call kiya… 2/5"), a **step timeline** (triggered → caregiver joined → dispatching → responder joined), a big **108 call** button, a big **"I'm safe / resolve"** button, and the live transcript. States: assembling, waiting for human, responder-joined (multi-party), resolved, offline-fallback (shows SMS-sent + 108).

5. **Meds** — Purpose: today's medicines. Elements: a list of meds with large status chips (Due now / Taken / Missed), an adherence ring, "mark taken" (and "logged by voice" confirmation), read-aloud. Empty state included.

6. **Vitals** — Purpose: log/track BP + heart rate. Elements: big "log by voice" action, latest readings as large numbers, a simple 7-day trend, a subtle warning style when a reading is high. Empty state.

7. **Profile / Settings** — Purpose: personalize + safety. Elements: font-size control, language toggle, linked caregiver, SOS trigger toggles (shake / fall-detect / volume), emergency contacts, "Forget me" (prominent, not buried).

**CAREGIVER APP**

8. **Linked-patient home** — Purpose: at-a-glance patient status. Elements: patient card (name, last check-in, OK/attention state), quick "Call patient", recent activity. Empty state (no patient linked).

9. **Live SOS join (MOST IMPORTANT)** — Purpose: incoming emergency. Elements: a loud attention banner + alert state, patient name + what triggered it, the live transcript and latest vitals, a big **"Join call"** button (enters the patient's live channel), a **"Resolve"** action, and the same dispatch timeline. States: incoming (ringing), in-call (multi-party), resolved.

**RESPONDER (demo only)**

10. **Dispatch inbox** — Purpose: a facility/ambulance operator view. Elements: a list of incoming dispatch requests (patient, location, severity, time), each with **"Accept → join"**. Minimal.

---

**Global requirements for every screen:** one primary action per screen; icon + word + optional "read aloud" on key actions; very large touch targets; works in Hindi and English; include empty / loading / offline / error states where relevant. Keep layouts simple and uncluttered — density only where it helps the user (real clinic names, real numbers), never decorative filler.
