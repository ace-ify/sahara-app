# -*- coding: utf-8 -*-
"""
laya.py — Laya Semantic Intent & Emergency Classifier for Sahaara.

Responsibility:
1. Fast semantic parsing of incoming Hindi/English user utterances.
2. Emergency & acute distress detection (chest pain, severe fall, breathlessness, stroke).
3. Critical vitals threshold monitoring (e.g. BP sys >= 180 or dia >= 110).
4. Deterministic mapping to Companion Tools (medications, clinics, generic savings, vitals, schemes, caregiver).
5. Seamless card construction for immediate visual dispatch to mobile.
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("uvicorn.error")


@dataclass
class ClassificationResult:
    is_emergency: bool
    intent: str  # "emergency" | "medications" | "facility" | "savings" | "scheme" | "vitals" | "caregiver" | "general"
    reason: str
    severity: str = "normal"  # "critical" | "warning" | "normal"
    news2_band: str = "GREEN"  # "RED" | "ORANGE" | "YELLOW" | "GREEN"
    tool_name: Optional[str] = None
    tool_args: Optional[Dict[str, Any]] = None
    pushed_card: Optional[Dict[str, Any]] = None
    prompt_injection: Optional[str] = None
    sbar_brief: Optional[Dict[str, Any]] = None


# --- Semantic Keyword / Phrase Dictionaries ---

# Acute emergency indicators (Hindi Devanagari + Transliterated + English)
_EMERGENCY_PATTERNS = [
    # Chest / Heart
    r"छाती\s*(?:में)?\s*(?:बहुत\s*)?(?:तेज़\s*)?दर्द",
    r"सीने\s*(?:में)?\s*(?:बहुत\s*)?(?:तेज़\s*)?दर्द",
    r"दिल\s*(?:का\s*दौरा|में\s*दर्द)",
    r"heart\s*attack",
    r"chest\s*pain",
    # Fall / Trauma
    r"गिर\s*(?:गया|गई|पड़ा|पड़ी)\s*(?:हूँ|है)?\s*(?:उठ\s*नहीं\s*पा\s*रहा|उठ\s*नहीं\s*सकता)?",
    r"चक्कर\s*(?:आ\s*गया|आ\s*रहे|खाकर\s*गिर)",
    r"fell\s*down",
    r"cannot\s*(?:get\s*up|stand|walk)",
    r"can\'?t\s*(?:get\s*up|stand)",
    # Breathlessness
    r"सांस\s*(?:नहीं\s*आ\s*रही|फूल\s*रही|घुट\s*रहा|लेने\s*में\s*दिक्कत)",
    r"दम\s*घुट",
    r"can\'?t\s*breathe",
    r"shortness\s*of\s*breath",
    r"difficulty\s*breathing",
    # Consciousness / Stroke
    r"बेहोश",
    r"unconscious",
    r"मुंह\s*टेढ़ा",
    r"लकवा",
    r"stroke",
    r"paralysis",
    # Severe Bleeding
    r"खून\s*बह\s*रहा",
    r"bleeding\s*heavily",
    # Explicit SOS / 108
    r"(?:आपातकाल|इमरजेंसी|जान\s*बचाओ|एम्बुलेंस|108\s*(?:बुलाओ|भेजो))",
    r"\bsos\b",
    r"\bemergency\b",
    r"\bambulance\b",
]

_EMERGENCY_RE = re.compile("|".join(f"(?:{p})" for p in _EMERGENCY_PATTERNS), re.IGNORECASE)

# Vitals Regex Extractors
_BP_RE = re.compile(r"(\d{2,3})\s*[/]\s*(\d{2,3})")
_SUGAR_RE = re.compile(r"(?:sugar|शुगर|glucose|ग्लूकोज)?\s*[:=]?\s*(\d{2,3})\s*(?:mg/dl|mg|के\s*आसपास)?", re.IGNORECASE)
_PULSE_RE = re.compile(r"(?:pulse|पल्स|धड़कन|heart\s*rate)?\s*[:=]?\s*(\d{2,3})\s*(?:bpm)?", re.IGNORECASE)
_SPO2_RE = re.compile(r"(?:spo2|ऑक्सीजन|oxygen)?\s*[:=]?\s*(\d{2,3})\s*(?:%|प्रतिशत)?", re.IGNORECASE)


def extract_vitals_from_text(text: str) -> Optional[Tuple[str, str, str]]:
    """
    Extract (vital_type, value, unit) from natural speech.
    Returns None if no clear vital reading is found.
    """
    bp_match = _BP_RE.search(text)
    if bp_match:
        sys_val, dia_val = bp_match.group(1), bp_match.group(2)
        return ("bp", f"{sys_val}/{dia_val}", "mmHg")

    # Check for SpO2 / Oxygen
    if any(k in text.lower() for k in ["spo2", "ऑक्सीजन", "oxygen"]):
        num_matches = re.findall(r"\b\d{2,3}\b", text)
        if num_matches:
            return ("spo2", num_matches[0], "%")

    # Check for blood sugar
    if any(k in text.lower() for k in ["sugar", "शुगर", "ग्लूकोज", "glucose"]):
        num_matches = re.findall(r"\b\d{2,3}\b", text)
        if num_matches:
            return ("sugar", num_matches[0], "mg/dL")

    # Check for pulse
    if any(k in text.lower() for k in ["pulse", "पल्स", "धड़कन"]):
        num_matches = re.findall(r"\b\d{2,3}\b", text)
        if num_matches:
            return ("pulse", num_matches[0], "bpm")

    return None


def calculate_news2_score(
    vitals: Dict[str, Any],
    symptoms_text: str = "",
) -> Tuple[int, str, list[str]]:
    """
    Adult NEWS2 (National Early Warning Score) calculation tailored for ambulatory home monitoring.
    Returns (score, band, trigger_reasons).
    Bands:
      - RED: Aggregate score >= 7 OR any Single-Parameter Red Trigger (score 3)
      - ORANGE: Aggregate score 5-6 (Medium Risk / Urgent review <= 60 min)
      - YELLOW: Aggregate score 1-4 (Low Risk / Subacute)
      - GREEN: Aggregate score 0 (Stable)
    """
    score = 0
    reasons = []
    has_single_param_red = False

    # 1. Systolic Blood Pressure
    bp = vitals.get("bp") or vitals.get("BP")
    if bp:
        m = _BP_RE.search(str(bp))
        if m:
            sys_val = int(m.group(1))
            dia_val = int(m.group(2))
            if sys_val >= 180 or dia_val >= 110:
                score += 3
                has_single_param_red = True
                reasons.append(f"अत्यधिक उच्च रक्तचाप (SBP {sys_val} mmHg >= 180)")
            elif sys_val <= 90:
                score += 3
                has_single_param_red = True
                reasons.append(f"गंभीर निम्न रक्तचाप/शॉक (SBP {sys_val} mmHg <= 90)")
            elif 91 <= sys_val <= 100:
                score += 2
                reasons.append(f"निम्न रक्तचाप (SBP {sys_val} mmHg)")
            elif 101 <= sys_val <= 110:
                score += 1
                reasons.append(f"हल्का निम्न रक्तचाप (SBP {sys_val} mmHg)")
            elif 160 <= sys_val <= 179:
                score += 2
                reasons.append(f"उच्च रक्तचाप स्टेज 2 (SBP {sys_val} mmHg)")

    # 2. Pulse / Heart Rate
    pulse = vitals.get("pulse") or vitals.get("heart_rate")
    if pulse:
        try:
            p_val = int("".join(filter(str.isdigit, str(pulse))))
            if p_val >= 131 or p_val <= 40:
                score += 3
                has_single_param_red = True
                reasons.append(f"अत्यधिक गंभीर नाड़ी गति ({p_val} bpm)")
            elif 111 <= p_val <= 130:
                score += 2
                reasons.append(f"तीव्र हृदय गति (Tachycardia: {p_val} bpm)")
            elif 41 <= p_val <= 50:
                score += 1
                reasons.append(f"धीमी हृदय गति (Bradycardia: {p_val} bpm)")
            elif 91 <= p_val <= 110:
                score += 1
                reasons.append(f"हल्की बढ़ी हुई धड़कन ({p_val} bpm)")
        except Exception:
            pass

    # 3. SpO2 (Oxygen Saturation)
    spo2 = vitals.get("spo2") or vitals.get("SpO2")
    if spo2:
        try:
            s_val = int("".join(filter(str.isdigit, str(spo2))))
            if s_val <= 85:
                score += 3
                has_single_param_red = True
                reasons.append(f"गंभीर ऑक्सीजन कमी (SpO2 {s_val}% <= 85%)")
            elif 86 <= s_val <= 91:
                score += 2
                reasons.append(f"ऑक्सीजन का स्तर कम (SpO2 {s_val}%)")
            elif 92 <= s_val <= 93:
                score += 1
                reasons.append(f"हल्की ऑक्सीजन कमी (SpO2 {s_val}%)")
        except Exception:
            pass

    # 4. Blood Sugar Context
    sugar = vitals.get("sugar") or vitals.get("glucose")
    if sugar:
        try:
            sug_val = int("".join(filter(str.isdigit, str(sugar))))
            if sug_val >= 400 or sug_val <= 50:
                score += 3
                has_single_param_red = True
                reasons.append(f"खतरनाक शुगर स्तर ({sug_val} mg/dL)")
            elif sug_val >= 250:
                score += 2
                reasons.append(f"उच्च शुगर (Hyperglycemia: {sug_val} mg/dL)")
        except Exception:
            pass

    # 5. Acute Symptoms Red Flag Check
    clean_sym = symptoms_text.strip().lower()
    if clean_sym and _EMERGENCY_RE.search(clean_sym):
        score += 3
        has_single_param_red = True
        reasons.append("तीव्र लक्षण (सीने में दर्द / सांस की तकलीफ / पक्षाघात / गिरना)")

    # Determine Clinical Band
    if score >= 7 or has_single_param_red:
        band = "RED"
    elif score >= 5:
        band = "ORANGE"
    elif score >= 1:
        band = "YELLOW"
    else:
        band = "GREEN"

    return (score, band, reasons)


def build_sbar_brief(
    reason: str,
    severity: str = "critical",
    vital_type: Optional[str] = None,
    vital_val: Optional[str] = None,
    patient_name: str = "मरीज़",
    age_gender: str = "72 वर्ष (पुरुष)",
) -> Dict[str, Any]:
    """
    Build standardized SBAR (Situation, Background, Assessment, Recommendation)
    brief for digital card and verbal handover when responders enter the Agora RTC call.
    """
    vital_str = f"{vital_type.upper() if vital_type else 'BP'}: {vital_val}" if vital_val else "हालिया बीपी 190/115 mmHg"
    band = "RED" if severity == "critical" else "ORANGE"

    situation = f"{age_gender} {patient_name} - {reason}"
    background = "हाइपरटेंशन व मधुमेह का इतिहास, नियमित दवा: Amlodipine 5mg, Metformin 500mg"
    assessment = f"NEWS2 क्रिटिकल बैंड ({band} PATH) · {vital_str} · संभावित एक्यूट कार्डियक / हाइपरटेंसिव क्राइसिस"
    recommendation = "108 ALS एम्बुलेंस द्वारा तत्काल अस्पताल परिवहन, टेलीमेट्री मॉनिटरिंग, डॉक्टर अलर्ट"

    verbal_handoff = (
        f"SBAR Brief: {age_gender}, known hypertensive on medication. "
        f"Sudden onset: {reason}. "
        f"Last recorded reading: {vital_str}. "
        f"Patient is conscious and seated in Fowler's position. 108 EMS and caregiver alerted."
    )

    return {
        "situation": situation,
        "background": background,
        "assessment": assessment,
        "recommendation": recommendation,
        "verbal_handoff": verbal_handoff,
        "band": band,
    }


def get_avpu_verbal_prompt(consecutive_silence: int = 0) -> str:
    """Conversational AVPU consciousness pulse check prompt in gentle Hindi."""
    if consecutive_silence == 0:
        return "बाबूजी, क्या आप मुझे सुन पा रहे हैं? बस एक बार 'हाँ' बोल दीजिए।"
    elif consecutive_silence == 1:
        return "बाबूजी, क्या आप जाग रहे हैं? मुझे आपकी आवाज़ नहीं आई, कृपया हाथ हिलाएं या बोलें।"
    return "सतर्कता अलर्ट: मरीज़ की आवाज़ नहीं आ रही है।"


def get_pre_arrival_coaching_prompt() -> str:
    """Pre-arrival guidance for patient and bystanders during ambulance transit."""
    return (
        "बाबूजी, बिल्कुल सीधे मत लेटिए, पीठ के सहारे 45 डिग्री पर आराम से बैठिए। "
        "गले के कपड़े ढीले कर लीजिए और लंबी-धीमी सांसें लीजिए। घर का मुख्य दरवाजा खोलकर रखें "
        "ताकि सहायता दल तुरंत अंदर आ सके।"
    )


def is_vitals_critical(vital_type: str, value: str) -> Tuple[bool, str]:
    """Check clinical threshold rules for acute vitals breach (Single-Parameter Red Triggers)."""
    if vital_type == "bp":
        match = _BP_RE.search(value)
        if match:
            sys_val = int(match.group(1))
            dia_val = int(match.group(2))
            if sys_val >= 180 or dia_val >= 110:
                return (
                    True,
                    f"अत्यधिक उच्च रक्तचाप संकट (Hypertensive Crisis: BP {sys_val}/{dia_val} mmHg)",
                )
            elif sys_val <= 90:
                return (
                    True,
                    f"गंभीर निम्न रक्तचाप/शॉक संकट (Hypotensive Shock: BP {sys_val}/{dia_val} mmHg)",
                )
    elif vital_type == "spo2":
        try:
            s_val = int("".join(filter(str.isdigit, value)))
            if s_val <= 85:
                return (
                    True,
                    f"गंभीर हाइपोक्सिया संकट (Severe Hypoxia: SpO2 {s_val}%)",
                )
        except Exception:
            pass
    elif vital_type == "pulse":
        try:
            pulse_val = int("".join(filter(str.isdigit, value)))
            if pulse_val >= 131 or pulse_val <= 40:
                return (
                    True,
                    f"असामान्य हृदय गति संकट (Critical Pulse: {pulse_val} bpm)",
                )
        except Exception:
            pass
    elif vital_type == "sugar":
        try:
            sugar_val = int("".join(filter(str.isdigit, value)))
            if sugar_val >= 400 or sugar_val <= 50:
                return (
                    True,
                    f"अत्यधिक खतरनाक शुगर स्तर (Critical Blood Sugar: {sugar_val} mg/dL)",
                )
        except Exception:
            pass
    return (False, "")


def extract_medicine_query(text: str) -> str:
    """Extract medicine name or salt query from Hindi/Hinglish/English user utterance."""
    lower = text.lower()
    known_meds = [
        "paracetamol", "dolo", "crocin", "calpol", "augmentin", "amoxicillin",
        "pan d", "pan-d", "pantocid", "pantoprazole", "metformin", "glycomet",
        "amlodipine", "amlong", "telmisartan", "telma", "atorvastatin", "atorva",
        "rosuvastatin", "rosuvas", "azithral", "azithromycin", "thyronorm",
        "levothyroxine", "shelcal", "calcium", "montair fx", "montair-lc",
        "allegra", "fexofenadine", "vildagliptin", "galvus", "clopidogrel",
        "deplatt", "ecosprin", "aspirin", "losartan", "losacar", "glimepiride",
        "amaryl", "ciprofloxacin", "ciplox", "cefixime", "zifi", "ondansetron",
        "emset", "omeprazole", "omez", "rabeprazole", "rabekind", "cetirizine",
        "okacet", "ibuprofen", "combiflam", "diclofenac", "voveran", "ranitidine",
        "पैरासिटामोल", "डोलो", "क्रोसिन", "अटोर्वास्टेटिन", "मेटफ़ॉर्मिन", "एम्लोडिपिन"
    ]
    for med in known_meds:
        if med in lower:
            return med

    cleaned = re.sub(
        r"\b(दवा|दवाई|दवाएं|गोली|कीमत|दाम|बचत|सस्ती|सस्ता|कितने|का|की|के|है|बताना|बताओ|जन|औषधि|केंद्र|price|cost|rate|cheap|cheaper|medicine|tablet|pill|how|much|is|for|give|me)\b",
        " ",
        text,
        flags=re.IGNORECASE,
    ).strip()
    words = [w for w in cleaned.split() if len(w) > 2]
    return " ".join(words[:3]) if words else "amlodipine"


def extract_facility_query(text: str) -> str:
    """Extract city or facility locality from user utterance."""
    lower = text.lower()
    cities = [
        "delhi", "meerut", "lucknow", "rampur", "indore", "bhopal", "mumbai", "pune",
        "jaipur", "patna", "kanpur", "agra", "varanasi", "noida", "ghaziabad", "gurgaon",
        "दिल्ली", "मेरठ", "लखनऊ", "रामपुर", "इंदौर", "भोपाल", "मुंबई", "पुणे", "जयपुर", "पटना", "कानपुर", "आगरा", "वाराणसी", "नोएडा"
    ]
    for c in cities:
        if c in lower:
            return c

    cleaned = re.sub(
        r"\b(अस्पताल|हॉस्पिटल|क्लिनिक|दवाखाना|phc|chc|hospital|clinic|doctor|डॉक्टर|नज़दीक|पास|बताओ|कहाँ|है|near|me|nearby|find|kahan|hai|batao|search)\b",
        " ",
        text,
        flags=re.IGNORECASE,
    ).strip()
    words = [w for w in cleaned.split() if len(w) > 2]
    return " ".join(words[:2]) if words else ""


def extract_scheme_query(text: str) -> str:
    """Extract government scheme name or keyword from user utterance."""
    lower = text.lower()
    scheme_triggers = [
        "vayoshri", "वयोश्री", "wheelchair", "छड़ी", "hearing aid",
        "chiranjeevi", "चिरंजीवी", "dialysis", "डायलिसिस", "tb", "टीबी", "nikshay", "निक्षय",
        "delhi", "दिल्ली", "mohalla", "मोहल्ला", "mahatma phule", "mjpjay",
        "janani", "जननी", "jssk", "jsy", "pmsma", "indradhanush", "इंद्रधनुष",
        "golden card", "गोल्डन कार्ड", "ayushman", "आयुष्मान", "pmjay"
    ]
    for s in scheme_triggers:
        if s in lower:
            return s

    cleaned = re.sub(
        r"\b(योजना|सरकारी|कार्ड|स्कीम|के|बारे|में|बताओ|क्या|है|scheme|yojana|yojna|explain|about|details)\b",
        " ",
        text,
        flags=re.IGNORECASE,
    ).strip()
    words = [w for w in cleaned.split() if len(w) > 2]
    return " ".join(words[:3]) if words else "ayushman"


def extract_reminder_details(text: str) -> Tuple[str, str]:
    """Extract clean title and target time from user's reminder utterance."""
    lower = text.lower()
    time_str = "समय पर"

    # Relative minutes & hours
    if "आधे घंटे" in lower or "half an hour" in lower:
        time_str = "30 मिनट में"
    elif "15 मिनट" in lower or "15 mins" in lower:
        time_str = "15 मिनट में"
    elif "10 मिनट" in lower or "10 mins" in lower:
        time_str = "10 मिनट में"
    elif "घंटे" in lower or "hour" in lower:
        h_match = re.search(r"(\d+)\s*(?:घंटे|hour|hr)", lower)
        if h_match:
            time_str = f"{h_match.group(1)} घंटे में"
    elif "मिनट" in lower or "min" in lower:
        m_match = re.search(r"(\d+)\s*(?:मिनट|minute|min)", lower)
        if m_match:
            time_str = f"{m_match.group(1)} मिनट में"
    elif "8 बजे" in lower or "8 baje" in lower or "8 pm" in lower or "8 am" in lower:
        time_str = "रात 8:00 बजे" if ("रात" in lower or "pm" in lower or "shaam" in lower or "शाम" in lower) else "सुबह 8:00 बजे"
    elif "2 बजे" in lower or "2 baje" in lower or "2 pm" in lower:
        time_str = "दोपहर 2:00 बजे"
    elif "सुबह" in lower or "morning" in lower:
        time_str = "सुबह 8:00 बजे"
    elif "शाम" in lower or "evening" in lower:
        time_str = "शाम 6:00 बजे"
    elif "रात" in lower or "night" in lower:
        time_str = "रात 9:00 बजे"

    # Clean title by removing boilerplate reminder phrases
    remove_phrases = [
        "याद दिला देना", "याद दिलाओ", "याद दिलाना", "याद दिला", "की याद", "का याद",
        "रिमाइंडर लगा दो", "रिमाइंडर सेट करो", "रिमाइंडर लगाओ", "रिमाइंडर", "अलार्म लगाओ", "अलार्म लगा दो", "अलार्म",
        "set reminder for", "remind me to", "remind me about", "remind me", "reminder", "alarm",
        "लगा दो", "सेट करो", "लगाओ", "देना", "कृपया", "please",
        "सुबह", "शाम", "दोपहर", "रात", "बजे", "morning", "evening", "night",
    ]
    cleaned = text
    for phrase in remove_phrases:
        cleaned = re.sub(re.escape(phrase), " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\d+\s*(?:मिनट|minute|min|घंटे|hour|hr|baje)?", " ", cleaned, flags=re.IGNORECASE)

    stop_tokens = {"मुझे", "को", "का", "की", "के", "में", "पर", "तो", "भी", "ना", "है", "in", "at", "for", "to", "on"}
    words = [w for w in cleaned.split() if w.lower() not in stop_tokens and len(w) > 1 and not w.isdigit()]
    final_title = " ".join(words) if words else "दवा की खुराक"
    return final_title, time_str


def classify_intent(text: str) -> ClassificationResult:
    """
    Semantic Intent Classification for voice health companion.
    Prioritizes:
    1. Acute Physical Emergency or Distress (Single-Param Red Trigger)
    2. Critical Vitals Breach (e.g. BP 190/110 or SpO2 <= 85%)
    3. Everyday Companion Tools (Meds, Reminders, Facilities, Generic Savings, Scheme, Vitals, Caregiver)
    4. General Conversation
    """
    clean_text = text.strip()
    lower_text = clean_text.lower()

    # 1. Check for Acute Physical Emergency (Red Path)
    if _EMERGENCY_RE.search(clean_text):
        reason = "मरीज़ को गंभीर शारीरिक तकलीफ़ या आपातकाल के लक्षण हैं।"
        if "छाती" in clean_text or "सीने" in clean_text or "chest" in lower_text:
            reason = "मरीज़ को छाती/सीने में तेज़ दर्द की शिकायत है (संभावित हृदय आपातकाल)।"
        elif "गिर" in clean_text or "fell" in lower_text:
            reason = "मरीज़ गिर गया है और उठने में असमर्थ है।"
        elif "सांस" in clean_text or "breathe" in lower_text:
            reason = "मरीज़ को गंभीर सांस लेने में कठिनाई हो रही है।"
        elif "चक्कर" in clean_text or "बेहोश" in clean_text:
            reason = "मरीज़ को गंभीर चक्कर या बेहोशी के लक्षण हैं।"

        sbar = build_sbar_brief(reason=reason, severity="critical")

        return ClassificationResult(
            is_emergency=True,
            intent="emergency",
            reason=reason,
            severity="critical",
            news2_band="RED",
            sbar_brief=sbar,
            pushed_card={
                "type": "emergency",
                "title": "आपातकालीन सहायता सक्रिय (SOS)",
                "subtitle": "108 एम्बुलेंस व परिजन को सूचित कर दिया गया है · लाइन पर बने रहें",
                "data": {
                    "reason": reason,
                    "severity": "critical",
                    "news2_band": "RED",
                    "sbar": sbar,
                    "call108": "tel:108",
                },
            },
            prompt_injection=(
                "CRITICAL SYSTEM DIRECTIVE: The patient is experiencing an acute medical emergency. "
                "The emergency dispatch ladder (108 EMS + Caregiver) has ALREADY been activated in parallel. "
                "DO NOT tell the patient to hang up or dial 108 themselves. "
                "Stay on the call. Reassure them with calm, soothing, gentle Hindi (10-15 words). "
                "Instruct them to sit upright at 45 degrees, breathe slowly, and reassure them that "
                "108 ambulance and their son Ramesh have been alerted and are on their way."
            ),
        )

    # 2. Check for Vitals (and Vitals Threshold Breaches)
    vital_extracted = extract_vitals_from_text(clean_text)
    if vital_extracted:
        v_type, v_val, v_unit = vital_extracted
        is_crit, crit_reason = is_vitals_critical(v_type, v_val)
        if is_crit:
            sbar = build_sbar_brief(reason=crit_reason, severity="critical", vital_type=v_type, vital_val=v_val)
            return ClassificationResult(
                is_emergency=True,
                intent="emergency",
                reason=crit_reason,
                severity="critical",
                news2_band="RED",
                tool_name="log_vitals",
                tool_args={"vital_type": v_type, "value": v_val, "unit": v_unit},
                sbar_brief=sbar,
                pushed_card={
                    "type": "emergency",
                    "title": "गंभीर जांच रीडिंग चेतावनी (Critical Vitals)",
                    "subtitle": f"{crit_reason} · आपातकालीन सहायता सक्रिय",
                    "data": {
                        "vital_type": v_type,
                        "value": v_val,
                        "unit": v_unit,
                        "reason": crit_reason,
                        "news2_band": "RED",
                        "sbar": sbar,
                        "call108": "tel:108",
                    },
                },
                prompt_injection=(
                    f"CRITICAL SYSTEM DIRECTIVE: The patient's vital reading ({v_val} {v_unit}) is critically abnormal ({crit_reason}). "
                    "The emergency dispatch ladder (108 EMS + Caregiver) has ALREADY been activated in parallel. "
                    "DO NOT hang up the call. In calm, warm Hindi (1-2 sentences), tell the patient to sit quietly without panicking, "
                    "breathe slowly at 45 degrees, and reassure them that their family and ambulance have been informed."
                ),
            )
        else:
            # Check for Orange Band (Medium Risk, e.g. SBP 160-179)
            news2_val, news2_band, _ = calculate_news2_score({v_type: v_val})
            severity_str = "warning" if news2_band == "ORANGE" else "normal"
            return ClassificationResult(
                is_emergency=False,
                intent="vitals",
                reason=f"Patient reported vital reading ({news2_band} Path)",
                severity=severity_str,
                news2_band=news2_band,
                tool_name="log_vitals",
                tool_args={"vital_type": v_type, "value": v_val, "unit": v_unit},
            )

    # 3. Companion Tools: Reminders & Alarms (Check before generic meds inquiry)
    if any(k in lower_text for k in ["रिमाइंडर", "याद दिला", "अलार्म", "remind", "reminder", "alarm"]):
        if any(w in lower_text for w in ["क्या", "कौनसे", "list", "show", "active", "बताओ"]):
            return ClassificationResult(
                is_emergency=False,
                intent="reminders",
                reason="List active reminders",
                tool_name="get_reminders",
                tool_args={},
            )
        rem_title, rem_time = extract_reminder_details(clean_text)

        return ClassificationResult(
            is_emergency=False,
            intent="reminders",
            reason="Set voice reminder",
            tool_name="set_reminder",
            tool_args={"title": rem_title, "reminder_time": rem_time},
        )

    # 4. Companion Tools: Medications
    if any(k in lower_text for k in ["दवा ले ली", "दवा खाई", "दवा खा ली", "गोली ले ली", "took medicine", "taken medicine", "logged med", "dawa le li", "dawai le li", "dawa kha li", "goli le li"]):
        # Extract med name if mentioned
        target_med = "Amlodipine"
        if "मेटफ़ॉर्मिन" in clean_text or "metformin" in lower_text:
            target_med = "Metformin"
        elif "अटोर्वा" in clean_text or "atorvastatin" in lower_text:
            target_med = "Atorvastatin"

        return ClassificationResult(
            is_emergency=False,
            intent="medications",
            reason="Log medication taken",
            tool_name="log_medication_taken",
            tool_args={"name": target_med},
        )

    med_indicators = [
        "दवा", "दवाई", "दवाएं", "गोली", "खुराक", "medicine", "medication", "pill", "tablet", "prescription", "dawa", "dawai", "dawaein", "dawayen", "goli",
        "paracetamol", "dolo", "crocin", "calpol", "augmentin", "pan d", "pantocid", "metformin", "glycomet",
        "amlodipine", "telmisartan", "telma", "atorvastatin", "shelcal", "montair", "allegra", "aspirin", "ecosprin"
    ]
    if any(k in lower_text for k in med_indicators):
        # Check if generic price comparison is the real intent
        if any(k in lower_text for k in ["सस्ती", "दाम", "कीमत", "बचत", "जन औषधि", "generic", "price", "cost", "cheap", "jan aushadhi", "sasti", "sasta", "daam", "keemat", "bachat"]):
            med_name = extract_medicine_query(clean_text)
            return ClassificationResult(
                is_emergency=False,
                intent="savings",
                reason="Generic price comparison",
                tool_name="get_medicine_price",
                tool_args={"name": med_name},
            )

        # Check if user wants to ADD a medicine or set a reminder
        if any(k in lower_text for k in ["जोड़", "जोड़", "ऐड", "add", "डाल", "लगा", "शेड्यूल", "schedule", "याद दिलाना", "reminder", "remind", "शामिल", "लिख"]):
            med_name = extract_medicine_query(clean_text)
            if not med_name or med_name in ["amlodipine"] or any(g in med_name.lower() for g in ["add", "schedule", "medicine", "dawa", "dawai", "गोली", "दवा"]):
                cleaned_name = re.sub(
                    r"\b(add|a|to|my|schedule|medicine|medication|dawa|dawai|jod|do|daal|karo|remind|reminder|me|please|set|aur|bhi|ek|naye|nayi|new|for|daily)\b",
                    " ",
                    clean_text,
                    flags=re.IGNORECASE,
                ).strip()
                if cleaned_name and len(cleaned_name) > 2 and not any(g in cleaned_name.lower() for g in ["schedule", "medicine", "dawa"]):
                    med_name = cleaned_name.title()
                else:
                    med_name = "Telma 40"
            else:
                med_name = med_name.title()
            dosage = "1 गोली"
            for d in ["40mg", "20mg", "10mg", "5mg", "500mg", "250mg", "650mg", "40 mg", "500 mg", "10 mg", "5 mg"]:
                if d in lower_text:
                    dosage = d
                    break
            timing = "सुबह नाश्ते के बाद"
            if any(w in lower_text for w in ["रात", "night", "शाम", "evening", "dinner"]):
                timing = "रात खाने के बाद"
            elif any(w in lower_text for w in ["दोपहर", "afternoon", "lunch"]):
                timing = "दोपहर खाने के बाद"
            return ClassificationResult(
                is_emergency=False,
                intent="add_medication",
                reason="Add medication to schedule",
                tool_name="add_medication",
                tool_args={"name": med_name, "dosage": dosage, "timing": timing, "purpose": "स्वास्थ्य सुरक्षा"},
            )

        return ClassificationResult(
            is_emergency=False,
            intent="medications",
            reason="Medication schedule inquiry",
            tool_name="get_medications",
            tool_args={},
        )

    # 4. Companion Tools: Generic Savings / Jan Aushadhi
    if any(k in lower_text for k in ["सस्ती", "दाम", "कीमत", "बचत", "जन औषधि", "जनऔषधि", "generic", "savings", "discount", "sasti", "sasta", "bachat", "daam", "keemat", "jan aushadhi"]):
        med_name = extract_medicine_query(clean_text)
        return ClassificationResult(
            is_emergency=False,
            intent="savings",
            reason="Jan Aushadhi generic price lookup",
            tool_name="get_medicine_price",
            tool_args={"name": med_name},
        )

    # 5. Companion Tools: Nearby Facility / Clinic / Doctor
    if any(k in lower_text for k in ["क्लिनिक", "अस्पताल", "डॉक्टर", "दवाखाना", "phc", "chc", "clinic", "hospital", "doctor", "dispensary", "aspatal", "dawakhana"]):
        facility_type = "all"
        if "दवा" in clean_text or "pharmacy" in lower_text or "जन औषधि" in clean_text or "medical store" in lower_text:
            facility_type = "pharmacy"
        elif "phc" in lower_text or "प्राथमिक" in clean_text:
            facility_type = "phc"
        fac_query = extract_facility_query(clean_text)
        return ClassificationResult(
            is_emergency=False,
            intent="facility",
            reason="Find nearby medical facility",
            tool_name="find_facility",
            tool_args={"query": fac_query, "facility_type": facility_type},
        )

    # 6. Companion Tools: Government Scheme (Ayushman Bharat, Vayoshri, etc.)
    if any(k in lower_text for k in ["आयुष्मान", "योजना", "सरकारी योजना", "हेल्थ कार्ड", "कार्ड", "scheme", "ayushman", "pmjay", "yojana", "yojna", "वयश्री", "वयोश्री", "vayoshri", "चिरंजीवी", "chiranjeevi", "डायलिसिस", "dialysis", "निक्षय", "nikshay", "टीबी"]):
        scheme_name = extract_scheme_query(clean_text)
        return ClassificationResult(
            is_emergency=False,
            intent="scheme",
            reason="Explain government health scheme",
            tool_name="explain_scheme",
            tool_args={"name": scheme_name},
        )

    # 7. Companion Tools: Caregiver Escalation (Non-emergency assistance)
    if any(k in lower_text for k in ["बेटा", "रमेश", "घर पर कोई नहीं", "मदद चाहिए", "सहायता", "caregiver", "call son", "family", "beta", "madad"]):
        return ClassificationResult(
            is_emergency=False,
            intent="caregiver",
            reason="Caregiver assistance requested",
            tool_name="escalate_to_caregiver",
            tool_args={"reason": clean_text, "urgency": "low"},
        )

    # 8. Companion Tools: Vitals History & Trends
    if any(k in lower_text for k in ["पिछला", "पुराना", "पहले का", "रिकॉर्ड", "history", "trend", "कैसा रहा", "कैसी रही"]) and any(w in lower_text for w in ["बीपी", "bp", "शुगर", "sugar", "जांच", "vital", "रीडिंग"]):
        v_type = "bp" if any(w in lower_text for w in ["बीपी", "bp"]) else "sugar" if any(w in lower_text for w in ["शुगर", "sugar"]) else "all"
        return ClassificationResult(
            is_emergency=False,
            intent="vitals",
            reason="Vitals history inquiry",
            tool_name="get_vitals_history",
            tool_args={"vital_type": v_type, "limit": 5},
        )

    # 9. Companion Tools: Vitals Inquiry without numeric values
    if any(k in lower_text for k in ["बीपी", "ब्लड प्रेशर", "शुगर", "धड़कन", "पल्स", "bp", "blood pressure", "pulse"]):
        return ClassificationResult(
            is_emergency=False,
            intent="vitals",
            reason="Vitals conversation",
            tool_name="log_vitals",
            tool_args={"vital_type": "bp", "value": "120/80", "unit": "mmHg"},
        )

    # 11. General Conversation
    return ClassificationResult(
        is_emergency=False,
        intent="general",
        reason="General conversational turn",
    )


def build_card_for_tool(tool_name: str, tool_result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Build a glanceable card schema ready for mobile UI display from tool output."""
    if tool_name == "get_medications":
        pending_cnt = tool_result.get("pending_count", 0)
        taken_cnt = tool_result.get("taken_count", 0)
        return {
            "type": "medicine",
            "title": "आज की दवाएं (Medications)",
            "subtitle": f"{pending_cnt} दवाएं बाकी · {taken_cnt} ली गईं",
            "data": tool_result.get("medications", []),
        }

    if tool_name == "add_medication":
        med = tool_result.get("medication", {})
        name = med.get("name", "दवा")
        timing = med.get("timing", "समय पर")
        dosage = med.get("dosage", "डॉक्टर अनुसार")
        return {
            "type": "medicine",
            "title": f"दवा जोड़ी गई: {name} ✓",
            "subtitle": f"{dosage} · {timing} · रिमाइंडर सक्रिय",
            "data": [med],
        }

    if tool_name == "log_medication_taken":
        med_name = tool_result.get("medication", "दवा")
        return {
            "type": "medicine",
            "title": "दवा ली गई ✓",
            "subtitle": f"{med_name} दर्ज कर ली गई है",
            "data": tool_result,
        }

    if tool_name == "find_facility":
        nearest = tool_result.get("nearest", {})
        name = nearest.get("name", "प्राथमिक स्वास्थ्य केंद्र")
        dist = nearest.get("distance_km", 2.1)
        travel_time = nearest.get("travel_time", "5-10 मिनट")
        is_open = nearest.get("open_now", True)
        return {
            "type": "facility",
            "title": name,
            "subtitle": f"{dist} किमी · {travel_time} · {'खुला है ✓' if is_open else 'आपातकालीन खुला'}",
            "data": nearest,
        }

    if tool_name == "get_medicine_price":
        med = tool_result.get("medicine", "दवा")
        brand = tool_result.get("branded_price", "₹48")
        gen = tool_result.get("generic_price", "₹9")
        sav = tool_result.get("savings_percentage", "81%")
        return {
            "type": "savings",
            "title": f"{med} - जन औषधि बचत",
            "subtitle": f"ब्रांडेड {brand} बनाम जन औषधि {gen} ({sav} बचत)",
            "data": tool_result,
        }

    if tool_name == "explain_scheme":
        scheme = tool_result.get("scheme", "आयुष्मान भारत")
        summary = tool_result.get("summary", "₹5 लाख तक मुफ्त इलाज")
        cov = tool_result.get("coverage_amount", "₹5 लाख")
        return {
            "type": "scheme",
            "title": scheme,
            "subtitle": f"कवरेज: {cov} · {summary}",
            "data": tool_result,
        }

    if tool_name == "log_vitals":
        v_type = tool_result.get("vital_type", "BP").upper()
        v_val = tool_result.get("value", "")
        return {
            "type": "vitals",
            "title": f"स्वास्थ्य रीडिंग दर्ज ({v_type})",
            "subtitle": f"{v_type}: {v_val} · सुरक्षित रूप से नोट की गई",
            "data": tool_result,
        }

    if tool_name == "escalate_to_caregiver":
        caregiver = tool_result.get("caregiver", "रमेश (बेटा / Caregiver)")
        return {
            "type": "caregiver",
            "title": f"{caregiver} - सहायता अलर्ट",
            "subtitle": "वॉट्सऐप सूचना व सीधे कॉल लिंक सक्रिय · SMS मुक्त",
            "data": tool_result,
        }

    if tool_name == "get_vitals_history":
        latest = tool_result.get("latest") or {}
        val = latest.get("value", "125/82")
        v_type = latest.get("vital_type", "BP").upper()
        return {
            "type": "vitals",
            "title": "पिछला स्वास्थ्य रिकॉर्ड (History)",
            "subtitle": f"नवीनतम {v_type}: {val} · पूर्व जांच सामान्य",
            "data": tool_result,
        }

    if tool_name == "set_reminder":
        rem = tool_result.get("reminder", {})
        fmt_time = rem.get("formatted_time", rem.get("time", "समय पर"))
        return {
            "type": "reminder",
            "title": f"रिमाइंडर सेट ✓ ({fmt_time})",
            "subtitle": f"{rem.get('title', 'दवा की खुराक')} · फोन पर अलार्म सक्रिय",
            "data": rem,
        }

    if tool_name == "get_reminders":
        cnt = tool_result.get("count", 0)
        return {
            "type": "reminder",
            "title": f"सक्रिय रिमाइंडर ({cnt}) ⏰",
            "subtitle": f"{cnt} रिमाइंडर फोन में सक्रिय हैं",
            "data": tool_result.get("reminders", []),
        }

    return None
