# Sahārā (सहारा) — The Support That Reaches You First
> **पहला सहारा, जो पहले पहुंचे**  
> *Agora Voice AI Hackathon 2026 · Track A (Agora Convo AI Voice Agent) & Track B (Mobile App Experience)*

[![Tests](https://img.shields.io/badge/pytest-60%2F60%20passed-brightgreen)](#)
[![TypeScript](https://img.shields.io/badge/typescript-0%20errors-brightgreen)](#)
[![Agora RTC](https://img.shields.io/badge/Agora-Conversational%20AI-blue)](#)
[![Clinical Triage](https://img.shields.io/badge/NEWS2-Adult%20Clinical%20Protocol-red)](#)

---

## 🌟 Overview & Problem Statement

In India, millions of elderly chronic-care patients (hypertension, diabetes, cardiovascular disease) live alone or spend hours without immediate family supervision. When acute cardiac arrest, stroke, or severe falls occur, the **Golden Hour** is routinely lost because:
1. **Physical Incapacity**: Patients in acute distress cannot navigate touchscreens, unlock phones, or type.
2. **Sequential Dispatch Delays**: Traditional emergency workflows alert family first, who panic and try calling local ambulances 20 minutes later.
3. **Information Blindness**: 108/112 EMS and ER doctors arrive with zero history, spending 15 minutes asking questions rather than administering thrombolytics or defibrillation.

**Sahārā** transforms the smartphone into a natural, Hindi-first Conversational Health Companion. The moment an acute symptom or critical vital spike occurs, it **transforms into an active emergency lifeline**:
- **Zero-Disconnection Rule**: Never drops the live audio call until verified physical responder arrival.
- **Parallel Dispatch at $t=0$**: Alerts 108/112 EMS and family caregivers concurrently via `asyncio.gather`.
- **Adult NEWS2 Clinical Triage**: Single-parameter red overrides (SBP $\ge 180$, SpO₂ $\le 85\%$, acute retrosternal chest pain, FAST stroke).
- **Automated SBAR Clinical Handoff Brief**: Pre-compiles Situation, Background, Assessment, and Recommendation into a 15-second verbal handoff script for responders.
- **Dynamic Voice AVPU Consciousness Heartbeat**: Conducts a 60-second conversational pulse check to detect unresponsiveness before the fleet arrives.
- **10-Tool Companion Suite**: Daily medication adherence, natural voice reminders, vitals history, Jan Aushadhi generic price comparison (83% savings), nearby PHC/clinics, and Ayushman Bharat explanations.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Patient Bare React Native Mobile App                 │
│  - Agora RTC Audio Stream (Full-Duplex, Noise Cancellation, VAD)       │
│  - Live Audio Level Waveform & Visual StateBadge                       │
│  - Dynamic Glanceable Cards Sync (Pushed from Backend Buffer)          │
│  - High-Contrast One-Tap SOS & Native 108 Fallback                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebRTC Full Duplex Audio
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Agora Conversational AI Cloud Gateway                │
│  - STT: Deepgram Nova-3 (Hindi/Hinglish/English Multilingual)          │
│  - CustomLLM Vendor: Routed to Sahārā Python Brain                     │
│  - TTS: Murf / Cartesia / ElevenLabs (Warm, Calm Indian Voice)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /llm/chat/completions
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Sahārā Python Backend Brain (FastAPI)                    │
│  ├─ Laya Semantic Classifier & Intent Engine (10 Companion Tools)      │
│  ├─ Clinical Triage Engine (Adult NEWS2 + Single-Param Red Trigger)    │
│  ├─ Parallel Dispatch Ladder (108/112 EMS + Caregiver at t=0)          │
│  ├─ Dynamic AVPU Voice Consciousness Monitor (/api/emergency/avpu)     │
│  ├─ SBAR Clinical Handoff Brief Generator (/api/emergency/sbar)        │
│  └─ Active Glanceable Card Buffer (/api/card/latest & /api/card/push)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🩺 The 4-Band NEWS2 Clinical Triage Protocol

Adapted from the Royal College of Physicians (RCP) National Early Warning Score (NEWS2):

| Band | Triggers | Immediate Autonomous Actions |
|---|---|---|
| 🔴 **RED PATH** | SBP $\ge 180$ or $\le 90$ mmHg, SpO₂ $\le 85\%$, acute chest pain, FAST stroke, fall/syncope, or NEWS2 $\ge 7$ | **Parallel Dispatch ($t=0$)**: 108 EMS + Caregiver simultaneously; push SBAR brief; initiate 60s Voice AVPU heartbeat; pre-arrival 45° Fowler's position coaching. |
| 🟠 **ORANGE PATH** | Aggregate NEWS2 **5–6** or severe vital deviation without immediate collapse | Urgent doctor review $\le 60$ mins; hourly voice/vital check-in scheduled; orange warning card to caregiver. |
| 🟡 **YELLOW PATH** | Aggregate NEWS2 **1–4** (mild BP rise 140/90, skipped dose) | Clinician/family alert $\le 30$ mins; 104 Tele-consultation suggestion; 4–6 hr check-in frequency. |
| 🟢 **GREEN PATH** | Aggregate NEWS2 **0** (all vitals optimal, no red flags) | Positive verbal reinforcement (*"बाबूजी, आपकी सेहत बिल्कुल स्थिर है"*); continue routine 12-hr check-in. |

---

## 🧰 The 10-Tool Companion Suite

1. **`get_medications`**: Active prescription schedule (Amlodipine, Metformin, Atorvastatin) and daily taken status.
2. **`log_medication_taken`**: Marks dose as taken with timestamp to prevent accidental double-dosing.
3. **`set_reminder`**: Natural language voice alarms (*"शाम 8 बजे दवा की याद दिलाना"*).
4. **`get_reminders`**: Complete list of scheduled patient medication and wellness reminders.
5. **`log_vitals`**: Logs BP, sugar, pulse with immediate clinical threshold gates.
6. **`get_vitals_history`**: Historical readings, timestamps, and multi-day trend trajectories.
7. **`find_facility`**: Geolocation discovery of nearest PHC, CHC, hospital, or Jan Aushadhi Kendra.
8. **`get_medicine_price`**: Compares Jan Aushadhi generic MRP vs branded prices (demonstrating 83% savings).
9. **`explain_scheme`**: Plain-Hindi explanations of Ayushman Bharat (PM-JAY) ₹5 Lakh free coverage.
10. **`escalate_to_caregiver`**: Non-emergency family assistance notification without ambulance dispatch.

---

## ⚡ Quick Start & Verification

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Agora App ID & Certificate (configured in `agent/server/.env`)

### 2. Backend Server
```bash
# Navigate to backend directory
cd agent/server

# Activate virtual environment
./venv/Scripts/activate

# Run test suite (60/60 tests)
pytest -v

# Start FastAPI server on port 8000
python -m uvicorn src.server:app --host 0.0.0.0 --port 8000
```

### 3. Mobile App (Web & Expo)
```bash
# Navigate to mobile directory
cd mobile

# Type check
npx tsc --noEmit

# Export web bundle (680 modules, 0 errors)
npx expo export -p web

# Serve web build on port 3000
python -m http.server 3000 --directory dist
```

---

## 🎬 Live Hackathon Demo Walkthrough

### Scenario 1: Everyday Health Companion
- **Patient**: *"मेरी आज की दवाएं बताओ"* (Tell me today's medicines)
- **Saathi AI**: Retrieves schedule via `get_medications`, speaks natural Hindi response, and pushes a glanceable medicine card with morning/night doses.
- **Patient**: *"जन औषधि पर एम्लोडिपिन कितनी सस्ती है?"*
- **Saathi AI**: Executes `get_medicine_price`, explaining ₹48 branded vs ₹8 generic (83% savings).

### Scenario 2: Acute Emergency (RED PATH)
- **Patient**: *"सीने में बहुत तेज दर्द हो रहा है, सांस फूल रही है"* (Severe chest pain and breathlessness)
- **Laya Engine**: Flags **RED PATH** acute cardiac distress.
- **Parallel Dispatch ($t=0$)**: Simultaneous dispatch to 108 EMS and Son Ramesh.
- **Pre-Arrival Coaching**: *"घबराइए मत, मैं आपके साथ हूँ। 45 डिग्री पर सीधे बैठ जाइए, धीरे-धीरे गहरी साँस लीजिए। 108 एम्बुलेंस और आपके बेटे रमेश को सूचित कर दिया गया है।"*
- **SBAR Brief**: Generated and sent to hospital ER.
- **Consciousness Heartbeat**: 60-second AVPU voice query activates with *"मैं ठीक हूँ"* screen fallback.

### Scenario 3: Caregiver Live Join & ER Handover
- Caregiver joins live 3-way Agora RTC audio room from Caregiver screen.
- Saathi delivers a 15-second verbal clinical brief:
  > *"SBAR Brief: 72-year-old male, known hypertensive on medication. Sudden onset severe substernal chest pain. Last recorded BP 190/115 mmHg. Patient is conscious and seated in Fowler's position. 108 EMS alerted."*
- AI steps into background notetaker mode until physical handover is confirmed.

---

## ⚖️ Medico-Legal Defensibility & Safety
- **Zero Hallucination Triage**: Clinical triage is governed by deterministic NEWS2 threshold gates, not unbounded LLM generation.
- **Fail-Safe Up-Scoring**: Ambiguous speech or degraded audio always coerces severity **UP**, never down.
- **Full Audit Trail**: Every triage transition, SBAR brief, vital entry, and dispatch attempt is logged with ISO epoch timestamps.

---

## 🏆 Agora Voice AI Hackathon Alignment
- **Track A (Convo AI Voice Agent)**: Full CustomLLM integration with Deepgram STT, Murf Hindi TTS, and low-latency Agora RTC streaming.
- **Track B (Mobile Experience)**: High-contrast 56dp touch targets, Noto Devanagari typography, real-time waveform visualization, and dynamic companion card push.
