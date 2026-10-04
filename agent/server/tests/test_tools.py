# -*- coding: utf-8 -*-
"""
test_tools.py — Unit tests for Sahaara companion tools (Track A).
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import tools


def test_get_medications():
    res = tools.get_medications()
    assert res["status"] == "success"
    assert res["total_medications"] >= 3
    assert len(res["medications"]) == res["total_medications"]
    assert "दवाएं" in res["message_hi"]


def test_log_medication_taken():
    res = tools.log_medication_taken("amlodipine")
    assert res["status"] == "success"
    assert res["taken_today"] is True
    assert "दवा ले ली गई है" in res["message_hi"] or "नोट कर लिया" in res["message_hi"]


def test_find_facility_default():
    res = tools.find_facility()
    assert res["status"] == "success"
    assert res["count"] >= 1
    assert res["nearest"] is not None
    assert "किमी दूर" in res["message_hi"]


def test_find_facility_type_filter():
    res = tools.find_facility(facility_type="pharmacy")
    assert res["status"] == "success"
    for fac in res["facilities"]:
        assert fac["type"] == "pharmacy"


def test_get_medicine_price():
    res = tools.get_medicine_price("paracetamol")
    assert res["status"] == "success"
    assert "Jan Aushadhi" in res["generic_price"]
    assert "बचत" in res["message_hi"]


def test_explain_scheme():
    res = tools.explain_scheme("ayushman")
    assert res["status"] == "success"
    assert "आयुष्मान" in res["scheme"]
    assert "14555" in res["helpline"]


def test_log_vitals_bp_normal():
    res = tools.log_vitals(vital_type="bp", value="120/80")
    assert res["status"] == "success"
    assert "सामान्य" in res["message_hi"]


def test_log_vitals_bp_high():
    res = tools.log_vitals(vital_type="bp", value="150/95")
    assert res["status"] == "success"
    assert "बढ़ा हुआ" in res["message_hi"]


def test_log_vitals_sugar():
    res = tools.log_vitals(vital_type="sugar", value="110")
    assert res["status"] == "success"
    assert "सामान्य स्तर" in res["message_hi"]


def test_escalate_to_caregiver():
    res = tools.escalate_to_caregiver(reason="दवा का समय समझ नहीं आ रहा", urgency="low")
    assert res["status"] == "success"
    assert "रमेश" in res["caregiver"]
    assert "संदेश भेज दिया है" in res["message_hi"]


def test_execute_tool_registry():
    res = tools.execute_tool("get_medicine_price", {"medicine_name": "metformin"})
    assert res["status"] == "success"
    assert "Metformin" in res["medicine"]

    res_err = tools.execute_tool("unknown_tool", {})
    assert res_err["status"] == "error"


def test_get_vitals_history():
    # Log a fresh reading first
    tools.log_vitals("bp", "130/85", "mmHg")
    history = tools.get_vitals_history("bp")
    assert history["status"] == "success"
    assert history["total_records"] >= 1
    assert "BP" in history["message_hi"]
    assert history["latest"]["value"] == "130/85"


def test_set_and_get_reminders():
    res = tools.set_reminder("Amlodipine 5mg", "दोपहर 2:00 बजे")
    assert res["status"] == "success"
    assert "Amlodipine" in res["reminder"]["title"]

    all_rem = tools.get_reminders()
    assert all_rem["status"] == "success"
    assert all_rem["count"] >= 1
    assert any("Amlodipine" in r["title"] for r in all_rem["reminders"])

