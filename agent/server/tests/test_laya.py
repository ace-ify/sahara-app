# -*- coding: utf-8 -*-
import pytest
from laya import classify_intent, extract_vitals_from_text, is_vitals_critical, build_card_for_tool


def test_classify_acute_emergency_chest_pain():
    res = classify_intent("मुझे छाती में बहुत तेज़ दर्द हो रहा है और घबराहट हो रही है")
    assert res.is_emergency is True
    assert res.intent == "emergency"
    assert res.severity == "critical"
    assert res.pushed_card is not None
    assert res.pushed_card["type"] == "emergency"
    assert "DO NOT tell the patient to hang up" in res.prompt_injection


def test_classify_acute_emergency_fall():
    res = classify_intent("अरे मैं बाथरूम में गिर गया हूँ, उठ नहीं पा रहा हूँ")
    assert res.is_emergency is True
    assert res.intent == "emergency"
    assert "गिर गया" in res.reason


def test_classify_acute_emergency_breathlessness():
    res = classify_intent("सांस नहीं आ रही है बहुत घबराहट हो रही है")
    assert res.is_emergency is True
    assert res.intent == "emergency"


def test_vitals_normal_extraction_and_classification():
    text = "आज सुबह मेरा बीपी 125/82 आया था"
    v = extract_vitals_from_text(text)
    assert v == ("bp", "125/82", "mmHg")

    crit, _ = is_vitals_critical(v[0], v[1])
    assert crit is False

    res = classify_intent(text)
    assert res.is_emergency is False
    assert res.intent == "vitals"
    assert res.tool_name == "log_vitals"
    assert res.tool_args["value"] == "125/82"


def test_vitals_critical_hypertensive_crisis():
    text = "मेरा बीपी मशीन पर 190/115 दिखा रहा है"
    res = classify_intent(text)
    assert res.is_emergency is True
    assert res.intent == "emergency"
    assert res.severity == "critical"
    assert "Hypertensive Crisis" in res.reason or "उच्च रक्तचाप" in res.reason
    assert res.pushed_card is not None
    assert res.pushed_card["type"] == "emergency"


def test_classify_medication_inquiry():
    res = classify_intent("मेरी आज की दवाएं क्या हैं?")
    assert res.is_emergency is False
    assert res.intent == "medications"
    assert res.tool_name == "get_medications"


def test_classify_medication_logged():
    res = classify_intent("मैंने सुबह की एम्लोडिपिन दवा ले ली है")
    assert res.is_emergency is False
    assert res.intent == "medications"
    assert res.tool_name == "log_medication_taken"
    assert res.tool_args["name"] == "Amlodipine"


def test_classify_generic_savings():
    res = classify_intent("एम्लोडिपिन बहुत महंगी है, सस्ती जन औषधि वाली बताओ")
    assert res.is_emergency is False
    assert res.intent == "savings"
    assert res.tool_name == "get_medicine_price"
    assert res.tool_args["name"] == "amlodipine"


def test_classify_find_facility():
    res = classify_intent("पास में सबसे नज़दीक क्लिनिक या पीएचसी कहाँ है?")
    assert res.is_emergency is False
    assert res.intent == "facility"
    assert res.tool_name == "find_facility"


def test_classify_explain_scheme():
    res = classify_intent("आयुष्मान भारत योजना में क्या फायदा मिलता है?")
    assert res.is_emergency is False
    assert res.intent == "scheme"
    assert res.tool_name == "explain_scheme"


def test_classify_caregiver_escalation():
    res = classify_intent("मेरे बेटे रमेश को बुला दो, मुझे मदद चाहिए")
    assert res.is_emergency is False
    assert res.intent == "caregiver"
    assert res.tool_name == "escalate_to_caregiver"


def test_classify_general_conversation():
    res = classify_intent("नमस्ते साथी, आप कैसे हैं?")
    assert res.is_emergency is False
    assert res.intent == "general"
    assert res.tool_name is None


def test_build_card_for_tool():
    card = build_card_for_tool("get_medications", {
        "pending_count": 2,
        "taken_count": 1,
        "medications": [{"name": "Amlodipine 5mg"}],
    })
    assert card is not None
    assert card["type"] == "medicine"
    assert "2 दवाएं बाकी" in card["subtitle"]


def test_classify_vitals_history():
    res = classify_intent("पिछला बीपी रिकॉर्ड कैसा रहा?")
    assert res.is_emergency is False
    assert res.intent == "vitals"
    assert res.tool_name == "get_vitals_history"


def test_classify_set_reminder():
    res = classify_intent("दोपहर 2 बजे दवा की याद दिला देना")
    assert res.is_emergency is False
    assert res.intent == "reminders"
    assert res.tool_name == "set_reminder"


def test_classify_get_reminders():
    res = classify_intent("मेरे आज के कौनसे रिमाइंडर हैं बताओ")
    assert res.is_emergency is False
    assert res.intent == "reminders"
    assert res.tool_name == "get_reminders"


def test_calculate_news2_single_param_red_sbp_high():
    from laya import calculate_news2_score
    score, band, reasons = calculate_news2_score({"bp": "190/115"})
    assert band == "RED"
    assert any("SBP 190" in r for r in reasons)


def test_calculate_news2_single_param_red_sbp_low():
    from laya import calculate_news2_score
    score, band, reasons = calculate_news2_score({"bp": "80/50"})
    assert band == "RED"
    assert any("SBP 80" in r for r in reasons)


def test_calculate_news2_single_param_red_spo2():
    from laya import calculate_news2_score
    score, band, reasons = calculate_news2_score({"spo2": "82"})
    assert band == "RED"
    assert any("SpO2 82%" in r for r in reasons)


def test_calculate_news2_orange_medium_risk():
    from laya import calculate_news2_score
    score, band, reasons = calculate_news2_score({"bp": "165/95", "pulse": "115", "spo2": "93"})
    assert band == "ORANGE"
    assert score == 5


def test_calculate_news2_green_stable():
    from laya import calculate_news2_score
    score, band, reasons = calculate_news2_score({"bp": "120/80", "pulse": "72", "spo2": "98"})
    assert band == "GREEN"
    assert score == 0


def test_build_sbar_brief_structure():
    from laya import build_sbar_brief
    sbar = build_sbar_brief(reason="सीने में गंभीर दर्द", severity="critical", vital_type="bp", vital_val="190/115")
    assert sbar["band"] == "RED"
    assert "situation" in sbar
    assert "background" in sbar
    assert "assessment" in sbar
    assert "recommendation" in sbar
    assert "verbal_handoff" in sbar
    assert "SBAR Brief" in sbar["verbal_handoff"]


def test_classify_attaches_sbar_to_emergency():
    res = classify_intent("मुझे दिल का दौरा पड़ रहा है")
    assert res.is_emergency is True
    assert res.news2_band == "RED"
    assert res.sbar_brief is not None
    assert "verbal_handoff" in res.sbar_brief
    assert res.pushed_card["data"]["sbar"] is not None


