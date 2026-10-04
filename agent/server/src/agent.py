"""
Agent

High-level API for managing Agora Conversational AI Agents.
"""
import logging
import os
import time
from typing import Any, Dict, Optional

from agora_agent import Area, AsyncAgora
from agora_agent.agentkit import Agent as AgoraAgent
from agora_agent.agentkit.vendors import CustomLLM, DeepgramSTT, Groq, MiniMaxTTS, MurfTTS, OpenAI

logger = logging.getLogger("uvicorn.error")

SAATHI_PROMPT = """आप "सहारा" (Sahara) हैं — ग्रामीण और बुज़ुर्ग भारत के लिए एक सच्चा, गर्मजोशी भरा, आवाज़-आधारित स्वास्थ्य साथी। आप सरल, रोज़मर्रा की हिंदी और हिंग्लिश में बात करते हैं।

मुख्य नियम:
- भाषा: उपयोगकर्ता जिस भाषा में बात करे, उसी भाषा में स्वाभाविक रूप से जवाब दें — हिंदी में हिंदी, अंग्रेज़ी में अंग्रेज़ी, हिंग्लिश में हिंग्लिश।
- संक्षिप्तता: जवाब छोटे और स्पष्ट रखें — एक या दो वाक्य, एक बार में एक ही बात या सवाल। फिर सुनने के लिए रुकें।
- सुरक्षा व सीमा: आप साथी हैं, डॉक्टर नहीं — बिना डॉक्टर के पर्चे के कोई नई दवा या बीमारी का खुद से निदान न दें। हमेशा डॉक्टर या क्लिनिक जाने की सलाह दें।
- वास्तविक डेटा (Zero Assumptions): मरीज़ की दवाएं, वाइटल्स या केयरगिवर के बारे में पहले से कोई मनगढ़ंत धारणा न बनाएं। केवल वही जानकारी बताएं जो सिस्टम टूल्स (get_medications, get_vitals_history) या उपयोगकर्ता बातचीत में स्पष्ट रूप से बताए। अगर कोई दवा दर्ज नहीं है तो प्यार से पूछें।

आपके स्वास्थ्य साथी उपकरण:
1. दवाएं (Medications): सिस्टम से जुड़ी असली दवाएं बताएं (get_medications)। जब मरीज़ कहे कि दवा ले ली, तो उत्साह से सराहना करें।
2. नज़दीकी स्वास्थ्य केंद्र (Facilities): उपयोगकर्ता की लोकेशन के आधार पर असली प्राथमिक स्वास्थ्य केंद्र, अस्पताल या जन औषधि केंद्र ढूंढें (find_facility)।
3. जन औषधि जेनेरिक दवा बचत: ब्रांडेड दवाओं के मुकाबले सस्ती जेनेरिक दवाओं की बचत बताएं (get_medicine_price)।
4. सरकारी स्वास्थ्य योजनाएं: आयुष्मान भारत (₹5 लाख मुफ्त इलाज, 14555), जननी सुरक्षा, वयोश्री योजना आदि की जानकारी दें (explain_scheme)।
5. सेहत के आंकड़े (Vitals): BP, शुगर, पल्स आदि नाप नोट करें (log_vitals) और इतिहास बताएं।

आपातकाल (Emergency — जीवन रक्षा नियम):
- अगर उपयोगकर्ता सीने में दर्द, साँस फूलने, चक्कर/बेहोशी, लकवा/स्ट्रोक, बहुत तेज़ खून बहने, या गिरने की बात करे:
  1. पहली बात स्पष्ट रूप से बोलें: "अभी 108 पर कॉल करें। घबराइए मत, मैं आपके साथ हूँ और मदद बुलाई जा रही है।"
  2. कॉल कभी भी डिस्कनेक्ट न करें! जब तक मदद न पहुँचे, मरीज़ के साथ लगातार बने रहें, उन्हें आश्वस्त करें और बातचीत जारी रखें।

लहजा: अपनेपन से भरा, धैर्यवान, और सम्मानजनक — जैसे परिवार का कोई समझदार सदस्य।"""

DEFAULT_GREETING = "नमस्ते! मैं सहारा हूँ, आपका स्वास्थ्य साथी। बताइए, आज मैं आपकी क्या मदद करूँ?"
DEFAULT_GREETING_HI = DEFAULT_GREETING
DEFAULT_GREETING_EN = "Hello! I am Sahara, your health companion. How can I help you today?"

SAATHI_PROMPT_EN = """You are "Sahara" — a warm, genuine voice-based health companion for seniors and rural families in India. You speak simple, friendly English and Hinglish.

Key rules:
- Language: Respond in clear, natural English or Hinglish matching the user.
- Brevity: Keep answers short and clear — 1 or 2 sentences at a time, then listen.
- Medical safety: You are a companion, not a doctor. Never diagnose new diseases or prescribe new medicines. Always advise consulting a doctor or visiting a clinic.
- Zero Fake Assumptions: Never assume pre-existing medications, vitals, or family members. Only reference actual patient data returned by system tools (get_medications, get_vitals_history) or explicitly stated by the user. If no medications are recorded, guide the patient warmly to scan their prescription or log them.

Capabilities:
1. Medications: Fetch real patient medication schedule via tools. Warmly praise when medication is confirmed taken.
2. Facilities: Discover real nearby PHCs, clinics, and Jan Aushadhi Kendras dynamically using the patient's live coordinates.
3. Jan Aushadhi Savings: Calculate verified price differences between expensive branded drugs and affordable generic equivalents.
4. Government Schemes: Explain Ayushman Bharat (₹5 Lakh free treatment, 14555), JSY, and senior assistance schemes clearly.
5. Vitals Telemetry: Log patient BP, glucose, and pulse readings accurately.

Emergency (Life safety):
- If patient mentions chest pain, severe breathlessness, fainting, paralysis/stroke, severe bleeding, or a heavy fall:
  1. Immediately say: "Please call 108 emergency right now. Do not worry, I am with you and help is being alerted."
  2. Never hang up. Stay with them until help arrives.

Tone: Respectful, caring, patient — like a trusted family member."""

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_medications",
            "description": "मरीज़ की आज की दवाओं की सूची और स्थिति प्राप्त करें।",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_medication_taken",
            "description": "दवा लेने की पुष्टि दर्ज करें।",
            "parameters": {
                "type": "object",
                "properties": {
                    "med_name": {"type": "string", "description": "दवा का नाम जैसे Amlodipine"},
                },
                "required": ["med_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_facility",
            "description": "नज़दीकी अस्पताल, पीएचसी, या जन औषधि केंद्र खोजें।",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "खोजने का शब्द"},
                    "facility_type": {"type": "string", "enum": ["all", "phc", "pharmacy", "hospital"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_medicine_price",
            "description": "ब्रांडेड दवा बनाम जन औषधि जेनेरिक दवा की कीमत और बचत देखें।",
            "parameters": {
                "type": "object",
                "properties": {
                    "medicine_name": {"type": "string", "description": "दवा का नाम"},
                },
                "required": ["medicine_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "explain_scheme",
            "description": "सरकारी स्वास्थ्य योजना (आयुष्मान भारत, जननी सुरक्षा, वयोश्री) की जानकारी दें।",
            "parameters": {
                "type": "object",
                "properties": {
                    "scheme_name": {"type": "string", "description": "योजना का नाम"},
                },
                "required": ["scheme_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_vitals",
            "description": "रक्तचाप (BP), शुगर या धड़कन दर्ज करें।",
            "parameters": {
                "type": "object",
                "properties": {
                    "vital_type": {"type": "string", "description": "bp, sugar, pulse"},
                    "value": {"type": "string", "description": "रीडिंग जैसे 120/80"},
                    "unit": {"type": "string", "description": "इकाई जैसे mmHg"},
                },
                "required": ["vital_type", "value"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_caregiver",
            "description": "परिवार के सदस्य (बेटा रमेश) को मदद का संदेश भेजें।",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "मदद की वजह"},
                    "urgency": {"type": "string", "description": "low, medium"},
                },
                "required": ["reason"],
            },
        },
    },
]


class Agent:
    """
    High-level wrapper for Agora Conversational AI Agent operations.
    
    Uses AgentSession for full lifecycle management (start/stop),
    which handles Token007 authentication automatically.
    """
    
    def __init__(self):
        self.app_id = os.getenv("AGORA_APP_ID")
        self.app_certificate = os.getenv("AGORA_APP_CERTIFICATE")
        self.greeting = DEFAULT_GREETING

        if not self.app_id or not self.app_certificate:
            raise ValueError("AGORA_APP_ID and AGORA_APP_CERTIFICATE are required")

        self.client = AsyncAgora(
            area=Area.US,
            app_id=self.app_id,
            app_certificate=self.app_certificate,
        )

        # Track active sessions by agent_id
        self._sessions: Dict[str, Any] = {}

    def _get_groq_vendor(self) -> Optional[Groq]:
        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        if not groq_key:
            return None
        return Groq(
            api_key=groq_key,
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            base_url="https://api.groq.com/openai/v1/chat/completions",
            greeting_message=self.greeting,
            failure_message="एक पल दीजिए…",
            max_history=15,
            max_tokens=1024,
            temperature=0.6,
        )

    def _get_managed_openai_vendor(self) -> OpenAI:
        return OpenAI(
            model="gpt-4o-mini",
            greeting_message=self.greeting,
            failure_message="एक पल दीजिए…",
            max_history=15,
            max_tokens=1024,
            temperature=0.6,
            top_p=0.95,
        )

    def _get_proxy_vendor(self) -> Optional[CustomLLM]:
        proxy_url = os.getenv("LLM_PROXY_URL", "").strip().strip("'\"")
        if not proxy_url:
            return None
        return CustomLLM(
            base_url=proxy_url,
            api_key=os.getenv("LLM_PROXY_SECRET", "x"),
            model=os.getenv("LLM_MODEL", "claude-opus-4-8"),
            max_tokens=1024,
            temperature=0.6,
        )

    def _build_llm_candidates(self) -> list[tuple[str, Any]]:
        """
        Build prioritized LLM candidates:
        1. Groq (primary - low latency voice)
        2. Agora Managed gpt-4o-mini (secondary - zero-config Agora cloud OpenAI)
        3. Existing CustomLLM proxy (finally - Claude brain gateway)
        """
        provider_pref = os.getenv("LLM_PROVIDER", "").strip().lower()

        groq_v = self._get_groq_vendor()
        managed_v = self._get_managed_openai_vendor()
        proxy_v = self._get_proxy_vendor()

        if provider_pref == "groq":
            order = [("Groq", groq_v), ("Agora Managed (gpt-4o-mini)", managed_v), ("Existing Proxy (CustomLLM)", proxy_v)]
        elif provider_pref in ("managed", "openai"):
            order = [("Agora Managed (gpt-4o-mini)", managed_v), ("Groq", groq_v), ("Existing Proxy (CustomLLM)", proxy_v)]
        elif provider_pref in ("proxy", "custom", "claude"):
            order = [("Existing Proxy (CustomLLM)", proxy_v), ("Groq", groq_v), ("Agora Managed (gpt-4o-mini)", managed_v)]
        else:
            # Default order: Groq (primary) -> Agora Managed (secondary) -> Existing Proxy (finally)
            order = [
                ("Groq", groq_v),
                ("Agora Managed (gpt-4o-mini)", managed_v),
                ("Existing Proxy (CustomLLM)", proxy_v),
            ]

        candidates = [(name, v) for name, v in order if v is not None]
        if not candidates:
            candidates = [("Agora Managed (gpt-4o-mini)", managed_v)]
        return candidates

    async def start(
        self,
        channel_name: str,
        agent_uid: int,
        user_uid: int,
        output_audio_codec: Optional[str] = None,
        lang: str = "hi",
        context: Optional[list] = None,
    ) -> Dict[str, Any]:
        """Start agent with prioritized LLM chain: Groq -> Agora Managed (gpt-4o-mini) -> Proxy."""
        if not channel_name or not str(channel_name).strip():
            raise ValueError("channel_name is required and cannot be empty")
        if agent_uid <= 0:
            raise ValueError("agent_uid is required and cannot be empty")
        if user_uid <= 0:
            raise ValueError("user_uid is required and cannot be empty")

        is_en = (lang or "").lower() == "en"
        instructions = SAATHI_PROMPT_EN if is_en else SAATHI_PROMPT
        greeting = DEFAULT_GREETING_EN if is_en else DEFAULT_GREETING_HI
        failure_msg = "Just a moment..." if is_en else "एक पल दीजिए…"
        murf_locale = "en-IN" if is_en else "hi-IN"

        # Cross-call conversational memory: fold recent turns into the system
        # instructions so a fresh agent session continues where the last left
        # off instead of starting amnesiac every call.
        if context:
            try:
                lines = []
                for m in list(context)[-10:]:
                    role = m.get("role", "user")
                    content = str(m.get("content", "")).strip()
                    if not content:
                        continue
                    who = "Patient (user)" if role == "user" else "You (Sahara)"
                    lines.append(f"{who}: {content}")
                if lines:
                    memory_block = (
                        "\n\n[PRIOR CONVERSATION MEMORY — you remember this exchange "
                        "with the patient from earlier. Continue naturally from it; "
                        "do not ask again what is already answered here]:\n"
                        + "\n".join(lines)
                    )
                    instructions = instructions + memory_block
                    logger.info("Agent context injected: %d prior turns", len(lines))
            except Exception:
                logger.warning("Failed to inject conversation context into instructions", exc_info=True)

        # STT: Deepgram multilingual so Hindi + Hinglish are recognized.
        stt = DeepgramSTT(model="nova-3", language="multi")

        # TTS: Murf (Hindi/English multilingual) when MURF_API_KEY is set; else managed MiniMax fallback.
        murf_key = os.getenv("MURF_API_KEY")
        if murf_key:
            tts = MurfTTS(
                key=murf_key,
                voice_id=os.getenv("MURF_VOICE", "hi-IN-shweta"),
                locale=murf_locale,
            )
            logger.info("TTS: Murf %s (voice=%s)", murf_locale, os.getenv("MURF_VOICE", "hi-IN-shweta"))
        else:
            tts = MiniMaxTTS(model="speech_2_6_turbo", voice_id="English_captivating_female1")
            logger.info("TTS: MiniMax fallback — set MURF_API_KEY in server/.env for the Hindi Murf voice")

        parameters = {
            "audio_scenario": "chorus",  # web client → ultra-low-latency chorus profile
            "data_channel": "datastream",
            "enable_error_message": True,
            "enable_metrics": True,
        }
        if isinstance(output_audio_codec, str) and output_audio_codec.strip():
            parameters["output_audio_codec"] = output_audio_codec.strip()

        llm_candidates = self._build_llm_candidates()
        last_error = None

        for vendor_name, llm in llm_candidates:
            agora_agent = AgoraAgent(
                client=self.client,
                instructions=instructions,
                greeting=greeting,
                failure_message=failure_msg,
                max_history=50,
                turn_detection={
                    "config": {
                        "speech_threshold": 0.5,
                        "start_of_speech": {
                            "mode": "vad",
                            "vad_config": {
                                "interrupt_duration_ms": 160,
                                "prefix_padding_ms": 300,
                            },
                        },
                        "end_of_speech": {
                            "mode": "vad",
                            "vad_config": {
                                "silence_duration_ms": 480,
                            },
                        },
                    },
                },
                advanced_features={"enable_rtm": True, "enable_tools": True},
                parameters=parameters,
            )

            agora_agent = (
                agora_agent
                .with_stt(stt)
                .with_llm(llm)
                .with_tts(tts)
            )

            session = agora_agent.create_async_session(
                channel=channel_name,
                agent_uid=str(agent_uid),
                remote_uids=[str(user_uid)],
                enable_string_uid=False,
                idle_timeout=30,
                expires_in=3600,
            )

            logger.info(
                "Starting Agora agent channel=%s agent_uid=%s user_uid=%s [llm=%s]",
                channel_name,
                agent_uid,
                user_uid,
                vendor_name,
            )

            try:
                agent_id = await session.start()
                self._sessions[agent_id] = session
                logger.info(
                    "Started Agora agent agent_id=%s channel=%s agent_uid=%s user_uid=%s [llm=%s]",
                    agent_id,
                    channel_name,
                    agent_uid,
                    user_uid,
                    vendor_name,
                )
                return {
                    "agent_id": agent_id,
                    "channel_name": channel_name,
                    "status": "started",
                }
            except Exception as e:
                logger.warning(
                    "Failed to start Agora agent with LLM [%s]: %s. Trying next candidate...",
                    vendor_name,
                    e,
                )
                last_error = e

        if last_error:
            logger.exception(
                "All LLM candidates failed to start Agora agent channel=%s agent_uid=%s user_uid=%s",
                channel_name,
                agent_uid,
                user_uid,
            )
            raise last_error

        raise RuntimeError("No suitable LLM candidate available to start Agora agent")

    async def stop(self, agent_id: str) -> None:
        """Stop a running agent. Falls back to the stateless client path."""
        if not agent_id or not str(agent_id).strip():
            raise ValueError("agent_id is required and cannot be empty")

        session = self._sessions.pop(agent_id, None)
        if session:
            try:
                await session.stop()
                logger.info("Stopped Agora agent from active session agent_id=%s", agent_id)
                return
            except Exception:
                # Fall back to the stateless SDK path if the in-memory session is stale.
                logger.warning(
                    "Failed to stop Agora agent from active session; falling back to client.stop_agent agent_id=%s",
                    agent_id,
                    exc_info=True,
                )

        logger.info("Stopping Agora agent through client.stop_agent agent_id=%s", agent_id)
        await self.client.stop_agent(agent_id)
