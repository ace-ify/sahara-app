# Sahārā (सहारा): Multilingual Voice AI Healthcare Companion & Emergency Lifeline

> **"पहला सहारा, जो पहले पहुंचे"** — The Support That Reaches You First.  
> Built with Agora Conversational AI Engine, Deepgram Nova-3, Murf AI, Groq Llama 3.3, and clinical NEWS2 emergency triage.

---

## 🎯 Overview

**Sahārā** is a voice-first, full-duplex conversational healthcare companion tailored for elderly chronic-care patients in multi-generational Indian households. On normal days, Sahārā acts as an empathetic daily health assistant—tracking symptoms, reminding medications, logging vitals, and chatting in Hindi, Hinglish, or English.

The moment vital thresholds or severe distress symptoms breach safety limits, Sahārā autonomously activates its **NEWS2 (National Early Warning Score 2)** emergency pipeline:
- Calculates emergency severity score (0–20 scale).
- Dispatches emergency WhatsApp notifications and location via OpenWA.
- Dials emergency contacts via Twilio voice calling.
- Transmits clinical handoff summaries with live audio links over Agora RTM 2.x to the family and responder dashboard.
- Maintains a continuous zero-disconnection Agora voice channel with the patient until help arrives.

---

## 🏗️ Architecture

```
                                      ┌──────────────────────┐
                                      │   Elderly Patient    │
                                      │   (Mobile Client)    │
                                      └──────────┬───────────┘
                                                 │ Agora RTC Audio Stream
                                                 ▼
                                      ┌──────────────────────┐
                                      │ Agora Conversational │
                                      │      AI Engine       │
                                      └──────────┬───────────┘
                                                 │
                   ┌─────────────────────────────┼─────────────────────────────┐
                   │                             │                             │
                   ▼                             ▼                             ▼
       ┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
       │   Deepgram Nova-3    │      │  Custom LLM Gateway  │      │       Murf AI        │
       │   Multilingual STT   │      │  FastAPI + Groq LPU  │      │  Natural Indian TTS  │
       │   (en-IN, hi, mr)    │      │ (Llama 3.3 70B Vers) │      │  (Warm Hindi/Eng)    │
       └──────────────────────┘      └──────────┬───────────┘      └──────────────────────┘
                                                 │
                                     ┌───────────┴───────────┐
                                     │ Tool Execution Suite  │
                                     │   (10 Clinical Tools) │
                                     └───────────┬───────────┘
                                                 │
                         ┌───────────────────────┼───────────────────────┐
                         ▼                       ▼                       ▼
              ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
              │    NEWS2 Triage     │ │  Emergency Actions  │ │   Family Dashboard  │
              │  Clinical Protocol  │ │ Twilio / OpenWA API │ │    Agora RTM 2.x    │
              └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

---

## 🌟 Key Features

1. **Full-Duplex Agora Conversational Voice**: Sub-second voice latency with natural turn-taking, barge-in / interruption handling, and ambient noise robustness.
2. **Clinical Safety Protocol (NEWS2)**: Real-time calculation of clinical deterioration risk (Respiration, SpO2, Systolic BP, Pulse, Consciousness, Temperature).
3. **10 Specialized Voice Companion Tools**:
   - `calculate_news2_score`: Clinical risk grading and trigger protocols.
   - `trigger_emergency_protocol`: Automated multi-channel SOS escalation.
   - `check_drug_interaction`: Safety checks between ongoing regimens and new drugs.
   - `log_vital_sign`: Structured vital signs recording (BP, Pulse, Blood Sugar, SpO2).
   - `send_emergency_whatsapp`: Instant alert payload with GPS & vitals via OpenWA.
   - `dial_emergency_phone`: Automated voice call dispatch via Twilio.
   - `broadcast_rtm_alert`: Real-time telemetry to hospital / family web dashboard.
   - `log_medication_taken`: Adherence tracking and missed-dose alerts.
   - `get_patient_summary`: Concise clinical profile for doctors and caregivers.
   - `switch_language`: Dynamic mid-call switching between Hindi, Hinglish, and English.
4. **Cross-Platform Mobile App**: Built with React Native & Expo SDK 57, featuring high-contrast elderly UI, haptic feedback, and one-tap SOS.

---

## 📋 Prerequisites

Before running the project, ensure you have:

- **Python 3.11+** installed
- **Node.js 18+** & **npm** / **yarn**
- **Agora Developer Account** with:
  - App ID and App Certificate
  - Conversational AI Engine enabled
- **LLM / Speech Credentials**:
  - Groq API Key (`llama-3.3-70b-versatile`)
  - Deepgram API Key (Nova-3 STT)
  - Murf AI or ElevenLabs API Key (TTS)
- *(Optional)* Twilio Account SID & Token for emergency phone dialing
- *(Optional)* WhatsApp session setup for OpenWA emergency messaging

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```bash
# Agora Credentials
AGORA_APP_ID="your_agora_app_id"
AGORA_APP_CERTIFICATE="your_agora_app_certificate"
AGORA_CHANNEL_NAME="sahara_health_channel"

# AI Models & Gateways
GROQ_API_KEY="gsk_your_groq_api_key"
DEEPGRAM_API_KEY="your_deepgram_api_key"
MURF_API_KEY="your_murf_api_key"

# Emergency Dispatch (Optional)
TWILIO_ACCOUNT_SID="your_twilio_sid"
TWILIO_AUTH_TOKEN="your_twilio_token"
TWILIO_FROM_NUMBER="+1234567890"
EMERGENCY_CONTACT_PHONE="+919876543210"

# Server Port
PORT=8000
```

---

## 🚀 Step-by-Step Setup & Execution

### 1. Clone the Repository

```bash
git clone https://github.com/ace-ify/sahara-app.git
cd sahara-app
```

### 2. Set Up the Python Backend & Custom LLM Gateway

The backend provides the Agora Custom LLM Gateway (`/llm/chat/completions`) and the tool-calling execution engine.

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt  # Or pip install fastapi uvicorn httpx pydantic

# Start the server
uvicorn agent.server:app --host 0.0.0.0 --port 8000 --reload
```

Verify the server is healthy:
```bash
curl http://localhost:8000/health
```

### 3. Start the Mobile Client

The mobile app connects to the Agora channel and launches the hands-free voice experience.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code using Expo Go on Android or iOS to experience the voice companion.

---

## 🔍 Agora Conversational AI Integration Details

Sahārā connects into the **Agora Conversational AI Engine** by supplying a custom OpenAI-compatible endpoint.

### Custom LLM Endpoint Configuration:
- **Base URL**: `https://<your-deployed-domain>/llm`
- **Model**: `llama-3.3-70b-versatile`
- **System Prompt**: Incorporates clinical safety boundaries, compassionate elderly bedside manners, and strict NEWS2 escalation rules.
- **Streaming**: Server-Sent Events (SSE) token streaming for ultra-low latency response start.
- **Tool Protocol**: When the user utters vitals or emergency phrases (e.g. *"mere seene me dard ho raha hai"*), the LLM invokes the corresponding function tool and streams both compassionate speech and simultaneous backend telemetry.

---

## 📚 References & Resources

- [Sahārā GitHub Repository](https://github.com/ace-ify/sahara-app)
- [Agora Conversational AI Documentation](https://docs.agora.io/en/conversational-ai/overview/product-overview)
- [Agora RTC & RTM SDKs](https://docs.agora.io/)
- [NEWS2 Clinical Protocol (Royal College of Physicians)](https://www.rcplondon.ac.uk/projects/outputs/national-early-warning-score-news-2)
