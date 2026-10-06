import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { getItem, setItem, removeItem } from '../services/storage';

export type Language = 'hi' | 'en';
export type TextSizeLevel = 0 | 1 | 2; // 0: Normal, 1: Large (A+), 2: Largest (A++)

const LANG_KEY = 'sahara.lang';
const LANG_CHOSEN_KEY = 'sahara.langChosen';
const CONSENT_CAREGIVER_KEY = 'sahara.consentCaregiver';
const CONSENT_EMERGENCY_KEY = 'sahara.consentEmergency';
const CONSENT_DOCTOR_KEY = 'sahara.consentDoctor';
const USER_NAME_KEY = 'sahara.userName';
const CAREGIVER_PHONE_KEY = 'sahara.caregiverPhone';

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  languageChosen: boolean;
  ready: boolean;
  /** Switch + persist language WITHOUT marking the first-launch choice as done (used for onboarding preview). */
  previewLang: (lang: Language) => void;
  chooseLanguage: (lang: Language) => void;
  textSize: TextSizeLevel;
  setTextSize: (size: TextSizeLevel) => void;
  fontScale: number;
  consentCaregiverSync: boolean;
  setConsentCaregiverSync: (val: boolean) => void;
  consentEmergencyBreakGlass: boolean;
  setConsentEmergencyBreakGlass: (val: boolean) => void;
  consentDoctorShare: boolean;
  setConsentDoctorShare: (val: boolean) => void;
  /** User's saved name (from onboarding) — powers the personalised greeting. */
  userName: string;
  setUserName: (name: string) => void;
  /** Family caregiver's WhatsApp number (from onboarding) — used for SOS alerts. */
  caregiverPhone: string;
  setCaregiverPhone: (phone: string) => void;
  /** Clears the saved name + caregiver contact from state and storage. */
  resetUserProfile: () => void;
  t: (key: string) => string;
  /** Same as t(), but replaces {tokens} with values, e.g. tf('meds_progress', { taken: 1, total: 3 }) */
  tf: (key: string, vars: Record<string, string | number>) => string;
}

// Every user-facing string lives here in exactly one language per entry.
// Rule: NEVER mix Devanagari and English inside one value.
const TRANSLATIONS: Record<Language, Record<string, string>> = {
  hi: {
    // ---- Onboarding ----
    onb_greet: 'नमस्ते! 🙏',
    onb_tagline: 'मैं सहारा — आपका स्वास्थ्य साथी।',
    onb_choose_lang: 'भाषा चुनें',
    onb_lang_hi_sub: 'बोलकर बात करें',
    onb_lang_en_sub: 'बोलें या लिखें',
    onb_listen: '🔊 सुनें',
    onb_perms_title: 'अनुमतियाँ · 100% सुरक्षित',
    onb_perm_mic: 'माइक्रोफ़ोन',
    onb_perm_mic_sub: 'ताकि आप बोलकर बात कर सकें',
    onb_perm_loc: 'लोकेशन',
    onb_perm_loc_sub: 'ताकि आपात में मदद आप तक पहुँचे',
    onb_perm_notif: 'सूचनाएँ',
    onb_perm_notif_sub: 'दवा व जाँच की याद के लिए',
    onb_start: 'शुरू करें',
    onb_helpline: 'मुफ़्त हेल्पलाइन · 1800-SAHARA',
    onb_s1_title: 'नमस्ते! मैं सहारा हूँ 🙏',
    onb_s1_body: 'बुज़ुर्गों और परिवारों के लिए आसान आवाज़ साथी — बस बोलकर बात करें, बिना टाइपिंग के।',
    onb_s1_voice_now: '🔊 सहारा बोल रहा है...',
    onb_s2_title: 'सहारा आपके लिए क्या करता है',
    onb_s2_body: 'दो वादे, सरल शब्दों में — ताकि आप बिना झंझट, स्वस्थ रहें।',
    onb_s2_p1_title: 'रोज़ की सेहत का साथ',
    onb_s2_p1_body: 'बीपी, शुगर और दवा की याद — सब बोलकर। हर दिन नियमित रखें, बिना कुछ भूले।',
    onb_s2_p2_title: '24 घंटे आपात सेवा',
    onb_s2_p2_body: 'गिरने या तबियत बिगड़ने पर 108 एम्बुलेंस और परिवार दोनों को तुरंत खबर।',
    onb_s3_title: 'आइए, आपकी जानकारी से शुरू करें',
    onb_s3_body: 'नीचे की जानकारी आपके फ़ोन में ही सुरक्षित रहती है। यह सिर्फ मदद पहुँचाने के लिए है।',
    onb_s3_name_label: 'आपका नाम (वैकल्पिक)',
    onb_s3_name_hint: 'जैसे: रामप्रसाद',
    onb_s3_caregiver_label: 'परिवार के सदस्य का WhatsApp नंबर',
    onb_s3_caregiver_hint: 'बेटे/बेटी का नंबर · जैसे: 9876543210',
    onb_s3_caregiver_sub: 'आपातकाल में SOS अलर्ट इसी नंबर पर भेजा जाएगा। इसे बाद में भी जोड़ सकते हैं।',
    onb_s3_perm_title: 'आवाज़ व लोकेशन की अनुमति दें',
    onb_s3_perm_sub: 'माइक्रोफ़ोन से बोलकर बात करने और आपात में एम्बुलेंस को घर तक पहुँचाने के लिए।',
    onb_s3_perm_granted: '✓ अनुमति मिल गई',
    onb_s3_perm_retry: 'Settings में जाकर अनुमति दें →',
    onb_s3_enable: 'अनुमतियाँ दें और शुरू करें',
    onb_s3_finish: 'शुरू करें →',
    onb_back: '← पीछे',
    onb_skip: 'छोड़ें',

    // ---- Talk ----
    frame_title: 'सहारा · लाइव प्रीव्यू',
    talk_title: 'सहारा · हेल्थ AI',
    talk_state_idle: 'बातचीत शुरू करने के लिए टैप करें',
    talk_state_connecting: 'जुड़ रहा है…',
    talk_state_listening: 'सहारा सुन रहा है… (बोलें)',
    talk_state_thinking: 'सहारा सोच रहा है…',
    talk_state_speaking: 'सहारा बोल रहा है… (टोकने के लिए टैप करें)',
    talk_mic_start: 'बोलना शुरू करें',
    talk_mic_muted: 'माइक बंद करें',
    talk_mic_unmute: 'माइक चालू करें',
    talk_mic_connecting: 'जुड़ रहा है…',
    talk_hint_idle: 'आपका स्वास्थ्य साथी · हमेशा आपके साथ',
    talk_hint_active: 'आवाज़ से या नीचे लिखकर कभी भी पूछें',
    talk_quick_title: 'त्वरित सुझाव',
    talk_input_placeholder: 'सहारा से कुछ भी पूछें या बोलें…',
    talk_copy: 'कॉपी',
    talk_speak: 'सुनें',
    talk_good: 'अच्छा जवाब',
    talk_bad: 'सुधार चाहिए',
    talk_new_chat: 'नई बातचीत',
    chat_home_welcome: 'नमस्ते {name} जी! 🙏',
    chat_home_welcome_noname: 'नमस्ते! मैं सहारा हूँ, आज आपकी सेहत कैसी है? 🙏',
    chat_sugg_1: '📄 मेरी आज की दवाएँ',
    chat_sugg_2: '📍 नज़दीकी अस्पताल',
    chat_sugg_3: '💊 जन औषधि की बचत',
    a11y_menu: 'मेनू खोलें',
    a11y_settings: 'सेटिंग्स',
    // quick prompts
    qp_meds_label: 'मेरी सुबह की दवा क्या है?',
    qp_meds_query: 'मेरी सुबह की दवा क्या है और मुझे कब लेनी है?',
    qp_clinic_label: 'नज़दीकी सरकारी अस्पताल',
    qp_clinic_query: 'नज़दीक में प्राथमिक स्वास्थ्य केंद्र कहाँ है?',
    qp_savings_label: 'जन औषधि पर 83% सस्ती',
    qp_savings_query: 'जन औषधि केंद्र पर एम्लोडिपिन की क्या कीमत है?',
    qp_vitals_label: 'मेरा बीपी 125/82 नोट करो',
    qp_vitals_query: 'मेरा ब्लड प्रेशर 125/82 है, इसे नोट कर लो।',

    // ---- Chat drawer ----
    drawer_search: 'खोजें या कुछ पूछें…',
    drawer_features: 'स्वास्थ्य सुविधाएँ',
    drawer_recent: 'हाल की बातचीत',
    drawer_see_all: 'सभी देखें…',
    drawer_user_status: 'सहारा केयर सक्रिय',
    feat_ai: 'सहारा वॉइस AI',
    feat_ai_sub: 'लाइव स्वास्थ्य साथी',
    feat_meds: 'दवाइयाँ व जन औषधि',
    feat_meds_sub: 'प्रिस्क्रिप्शन व 83% बचत',
    feat_scanner: 'पर्चा व बिल स्कैनर',
    feat_scanner_sub: 'मल्टी-सोर्स मिलान व बचत',
    feat_vitals: 'सेहत के आंकड़े',
    feat_vitals_sub: 'बीपी, शुगर, पल्स ट्रैकर',
    feat_emergency: 'आपातकालीन सहायता SOS',
    feat_emergency_sub: '108 व परिवार अलर्ट',
    feat_caregiver: 'परिवार व केयरगिवर',
    feat_caregiver_sub: 'लाइव मॉनिटरिंग लिंक',
    rc1_title: 'सुबह की बीपी जांच (125/82)',
    rc1_time: 'आज सुबह 8:15',
    rc1_query: 'मेरा ब्लड प्रेशर 125/82 सामान्य है ना?',
    rc2_title: 'रामपुर PHC ओपीडी समय व डॉक्टर',
    rc2_time: 'कल शाम 4:30',
    rc2_query: 'नज़दीक में सरकारी अस्पताल PHC कहाँ है?',
    rc3_title: 'एम्लोडिपिन जन औषधि बचत ₹40',
    rc3_time: '30 सितंबर',
    rc3_query: 'एम्लोडिपिन 5mg जन औषधि केंद्र पर कितने की मिलती है?',
    rc4_title: 'हल्का सिरदर्द — घरेलू उपाय',
    rc4_time: '28 सितंबर',
    rc4_query: 'सिरदर्द के लिए क्या करना चाहिए?',

    // ---- Meds ----
    meds_title: 'आज की दवाएँ',
    meds_subtitle: 'समय पर दवा लें · जन औषधि से 83% बचत',
    meds_taken_badge: 'ले ली ✓',
    meds_pending_badge: 'अभी बाकी',
    meds_mark_taken: 'ले ली — दर्ज करें',
    meds_success_msg: 'बहुत बढ़िया! आपकी दवा दर्ज कर ली गई है।',
    meds_adherence: 'आज का नियम पालन',
    meds_progress: '{taken} में से {total} दवाएँ ली गईं ({pct}%)',
    meds_generic_available: 'जन औषधि विकल्प उपलब्ध',
    med_amlo_name: 'एम्लोडिपिन 5mg',
    med_amlo_time: 'सुबह 8:00 (नाश्ते के बाद)',
    med_amlo_purpose: 'ब्लड प्रेशर',
    med_met_name: 'मेटफ़ॉर्मिन 500mg',
    med_met_time: 'रात 8:30 (खाने के बाद)',
    med_met_purpose: 'शुगर नियंत्रण',
    med_ato_name: 'अटोर्वास्टेटिन 10mg',
    med_ato_time: 'रात सोते समय',
    med_ato_purpose: 'कोलेस्ट्रॉल व दिल',

    // ---- Vitals ----
    vitals_title: 'सेहत के आंकड़े',
    vitals_subtitle: 'आवाज़ से या टैप करके दर्ज करें',
    vital_bp: 'रक्तचाप',
    vital_pulse: 'धड़कन',
    vital_sugar: 'ब्लड शुगर',
    vital_spo2: 'ऑक्सीजन (SpO2)',
    vitals_normal: 'सामान्य',
    vitals_elevated: 'थोड़ा बढ़ा हुआ',
    vitals_check: 'चेक करें',
    vitals_normal_range: 'सामान्य सीमा',
    vitals_quick_title: 'त्वरित टेस्ट रीडिंग दर्ज करें',
    vitals_bp_normal: 'BP: 120/80 (सामान्य)',
    vitals_bp_high: 'BP: 152/96 (हाई अलर्ट)',
    vitals_voice_btn: 'बोलकर दर्ज करें',
    vitals_voice_sub: "बोलें: 'मेरा बीपी 120/80 है'",

    // ---- Settings / Profile ----
    settings_title: 'सेटिंग्स',
    settings_subtitle: 'बुजुर्ग अनुकूल सेटिंग्स व भाषा',
    settings_text_size: 'अक्षर का आकार',
    settings_language: 'भाषा',
    settings_auto_sos: 'आपातकालीन सेंसर',
    settings_fall_detect: 'गिरना पहचानना — चालू',
    settings_shake_sos: 'फ़ोन हिलाना — SOS चालू',
    settings_forget_me: 'मुझे भूल जाएँ',
    settings_demo_screens: 'सभी स्क्रीन देखें',
    size_normal: 'साधारण',
    size_large: 'बड़ा (A+)',
    size_xl: 'सबसे बड़ा (A++)',
    demo_onboarding: 'ऑनबोर्डिंग',
    demo_onboarding_sub: 'भाषा चयन',
    demo_caregiver: 'केयरगिवर जोड़ें (QR)',
    demo_caregiver_sub: 'परिवार से जोड़ें',
    demo_history: 'स्वास्थ्य इतिहास',
    demo_history_sub: 'सेहत का रिकॉर्ड',
    demo_emergency: 'आपातकालीन स्क्रीन',
    demo_emergency_sub: 'आपतकालीन कक्ष',
    demo_caregiver_sos: 'केयरगिवर लाइव-SOS',
    demo_caregiver_sos_sub: 'केयरगिवर व्यू',

    // ---- Privacy & Consent Vault ----
    consent_title: 'डेटा गोपनीयता व सहमति (Privacy Vault)',
    consent_subtitle: 'स्थानीय फोन में सुरक्षित डेटा · सहमति-आधारित शेयरिंग',
    consent_caregiver: 'देखभालकर्ता ऑटो-सिंक (रमेश)',
    consent_caregiver_sub: 'दवा व महत्वपूर्ण स्थिति का परिवार को तुरंत अपडेट',
    consent_emergency: '108 आपातकालीन ब्रेक-ग्लास एक्सेस',
    consent_emergency_sub: 'केवल क्रिटिकल रेड-पाथ आपातकाल में 108 EMS को SBAR भेजना',
    consent_doctor: 'डॉक्टर व अस्पताल टेली-कंसल्ट शेयरिंग',
    consent_doctor_sub: 'क्लिनिक/अस्पताल के साथ स्वास्थ्य रिकॉर्ड साझा करना (वैकल्पिक)',
    consent_local_only: 'स्थानीय डेटा सुरक्षा सक्रिय · बिना आपकी अनुमति डेटा बाहर नहीं जाता',
    consent_on: 'सक्रिय ✓',
    consent_off: 'बंद',

    // ---- Care history ----
    history_title: 'स्वास्थ्य इतिहास',
    history_subtitle: 'दवा, बीपी और लक्षणों का रिकॉर्ड',
    history_hero_title: 'यह सिर्फ रिकॉर्ड नहीं है',
    history_hero_body: 'यह आपकी स्वास्थ्य कहानी है।',
    history_changes_title: 'मुख्य बदलाव',
    history_change_1: 'रक्तचाप सामान्य हुआ',
    history_change_2: 'मेटफ़ॉर्मिन समय पर ली गई',
    history_change_3: 'कल हल्का चक्कर आया',
    history_recent: 'हालिया जांच रिकॉर्ड',
    history_tab_all: 'सभी',
    history_tab_symptoms: 'लक्षण',
    history_tab_doctors: 'डॉक्टर',
    history_entry1_time: '23 सितंबर 2026 · सुबह 10:15',
    history_entry1_title: 'हल्का चक्कर आना',
    history_entry1_body: 'सुबह उठने पर संतुलन में कमी। दवा के बाद ठीक हुआ।',
    history_entry2_time: '20 सितंबर 2026',
    history_entry2_title: 'डॉ. सुनीता वर्मा · PHC रामपुर',
    history_entry2_body: 'रक्तचाप जाँच · दवा जारी रखें।',
    history_listen: '🔊 सुनें · इसके बारे में पूछें',

    // ---- Caregiver pairing ----
    pair_title: 'पारिवारिक मददगार',
    pair_subtitle: 'QR कोड या 6-अंकी पासकी से जोड़ें',
    pair_hero_title: 'सुरक्षा संबंध',
    pair_hero_body: 'एक पारिवारिक मददगार जोड़ें।',
    pair_scan: 'अपने बेटे/बेटी के फ़ोन से स्कैन करवाएँ',
    pair_ready: '● तैयार · स्कैन के लिए',
    pair_code_label: 'या 6-अंकी कोड',
    pair_read_aloud: '🔊 बोलकर कोड सुनाएँ',
    pair_linked: 'जुड़ गया',
    pair_continue: 'आगे बढ़ें',

    // ---- Caregiver live SOS ----
    csos_alert: '🚨 आपातकालीन अलर्ट · लाइव',
    csos_default_patient: 'रामप्रसाद जी (72)',
    csos_default_reason: 'सीने में दर्द व सांस फूलना · आवाज़ से SOS',
    csos_join: 'लाइव कॉल में जुड़ें',
    csos_join_sub: '3-तरफ़ा लाइव ऑडियो',
    csos_joined: 'आप कॉल में जुड़े हैं ✓',
    csos_joined_sub: 'जुड़े हुए · 3-तरफ़ा ऑडियो',
    csos_sbar: 'SBAR क्लिनिकल संक्षिप्त विवरण',
    csos_ambulance: '🚑 108 एम्बुलेंस',
    csos_dispatched: 'समानांतर अलर्ट भेजा गया',
    csos_eta: 'पहुँचने में 6 मिनट',
    csos_bp: 'रक्तचाप',
    csos_pulse: 'धड़कन',
    csos_high: 'ज़्यादा',
    csos_live_audio: '● लाइव ऑडियो · AI कैप्शन चालू',
    csos_line1: 'रामप्रसाद: “बेटा… सीने में भारीपन है…”',
    csos_line2: 'सहारा: “शांत रहिए, मदद आ रही है। 108 रास्ते में है।”',
    csos_doctor_joining: 'डॉ. वर्मा (हृदय रोग) जुड़ रहे हैं…',
    csos_resolve: 'मामला सुलझ गया',

    // ---- Emergency ----
    emerg_help_title: 'मदद आ रही है',
    emerg_help_sub: 'सहारा लाइन पर आपके साथ है, कभी नहीं कटेगी',
    emerg_red_path: 'लाल मार्ग: गंभीर आपात स्थिति',
    emerg_you: 'आप',
    emerg_you_st: 'जुड़े ✓',
    emerg_ai: 'सहारा AI',
    emerg_ai_st: 'कॉल पर ✓',
    emerg_caregiver: 'बेटा (रमेश)',
    emerg_caregiver_joined: 'जुड़ गया ✓',
    emerg_caregiver_alerted: 'सूचना भेजी ✓',
    emerg_108_dispatched: 'अलर्ट भेजा ✓',
    emerg_108_active: 'सक्रिय…',
    emerg_step_1: 'SOS सक्रिय — सहारा लाइव ऑडियो कॉल पर',
    emerg_step_2: 'समानांतर भेजना: 108 एम्बुलेंस व परिवार को एक साथ अलर्ट',
    emerg_step_3: 'अस्पताल को SBAR क्लिनिकल विवरण भेजा गया',
    emerg_step_4_ack: 'केयरगिवर ने कॉल स्वीकारी ({by})',
    emerg_step_4_wait: '60 सेकंड मॉनिटरिंग (AVPU) सक्रिय',
    emerg_ladder_title: 'स्थिति · डिस्पैच चरण',
    emerg_avpu_title: 'चेतना व सतर्कता जाँच',
    emerg_avpu_unresp: '⚠️ मरीज़ की आवाज़ बंद है! तत्काल डिफिब्रिलेटर सहायता चाहिए।',
    emerg_avpu_ok: 'सहारा हर 60 सेकंड में मरीज़ की सतर्कता जाँच रहा है।',
    emerg_avpu_a: 'A · सतर्क',
    emerg_avpu_v: 'V · आवाज़',
    emerg_avpu_p: 'P · दर्द',
    emerg_avpu_u: 'U · शांत',
    emerg_im_ok: 'मैं ठीक हूँ',
    emerg_im_ok_sub: 'दबाकर पुष्टि करें',
    emerg_sbar_title: 'SBAR क्लिनिकल संक्षिप्त विवरण',
    emerg_sbar_s: 'स्थिति',
    emerg_sbar_b: 'पृष्ठभूमि',
    emerg_sbar_a: 'आकलन',
    emerg_sbar_r: 'सिफ़ारिश',
    emerg_sbar_default_situation: '72 वर्ष (पुरुष) — तीव्र सीने में दर्द',
    emerg_sbar_default_background: 'हाइपरटेंशन इतिहास · नियमित दवा एम्लोडिपिन 5mg',
    emerg_sbar_default_assessment: 'NEWS2 गंभीर बैंड · हालिया बीपी 190/115',
    emerg_sbar_default_recommendation: '108 ALS एम्बुलेंस से तत्काल अस्पताल परिवहन',
    emerg_verbal: '15-सेकंड मौखिक हैंडऑफ स्क्रिप्ट',
    emerg_call_108: '108 पर कॉल करें',
    emerg_call_108_sub: 'सरकारी एम्बुलेंस को सीधे कॉल',
    emerg_resolve: 'मैं सुरक्षित हूँ',
    emerg_resolve_sub: 'मदद पहुँच गई / संकट समाप्त',

    // ---- Voice session ----
    voice_greeting: 'नमस्ते! मैं सहारा हूँ, आपका स्वास्थ्य साथी। बताइए, मैं आपकी क्या मदद करूँ?',
    voice_farewell: 'अलविदा! अपना ध्यान रखिएगा।',
    voice_card_facility_title: 'प्राथमिक स्वास्थ्य केंद्र रामपुर',
    voice_card_facility_sub: 'खुला है · 2.1 किमी · मुफ़्त दवाएँ',
    voice_timestamp_now: 'अभी',

    // ---- In-chat tool cards ----
    card_open: 'खुला है',
    card_call: 'कॉल करें',
    card_map: 'रास्ता देखें',
    card_taken: '✓ ले ली गई',
    card_pending: 'बाकी है',
    card_time: 'समय',
    card_mark_taken: '✓ मैंने ले ली',
    card_marked_taken: 'दवा ले ली गई',
    card_vitals_title: 'वाइटल्स मॉनिटरिंग',
    card_vitals_sub: 'आज की ताज़ा रीडिंग · सुरक्षित रूप से सेव',
    card_vitals_status: 'सभी वाइटल्स सामान्य और स्थिर हैं।',
    card_bp: 'रक्तचाप',
    card_sugar: 'ब्लड शुगर',
    card_pulse: 'हृदय गति',
    card_spo2: 'ऑक्सीजन (SpO2)',
    card_normal: 'सामान्य',
    card_fasting: 'फास्टिंग',
    card_stable: 'स्थिर',
    card_healthy: 'स्वस्थ स्तर',
    card_sos_title: '🚨 आपातकालीन SOS सक्रिय',
    card_sos_desc: '108 एम्बुलेंस और परिवार को लाइव सूचना भेज दी गई है।',
    card_sos_open: 'SOS स्क्रीन खोलें',
    card_call_108: '108 कॉल करें',
  },
  en: {
    // ---- Onboarding ----
    onb_greet: 'Hello! 🙏',
    onb_tagline: 'I am Sahara — your health companion.',
    onb_choose_lang: 'Choose language',
    onb_lang_hi_sub: 'Talk by voice',
    onb_lang_en_sub: 'Talk or type',
    onb_listen: '🔊 Listen',
    onb_perms_title: 'Permissions · 100% safe',
    onb_perm_mic: 'Microphone',
    onb_perm_mic_sub: 'So you can talk to Sahara by voice',
    onb_perm_loc: 'Location',
    onb_perm_loc_sub: 'So help can reach you in an emergency',
    onb_perm_notif: 'Notifications',
    onb_perm_notif_sub: 'For medicine and check-in reminders',
    onb_start: 'Start',
    onb_helpline: 'Toll-free helpline · 1800-SAHARA',
    onb_s1_title: 'Hello! I am Sahara 🙏',
    onb_s1_body: 'A friendly voice companion for seniors — just speak naturally, no typing needed.',
    onb_s1_voice_now: '🔊 Sahara is speaking...',
    onb_s2_title: 'What Sahara does for you',
    onb_s2_body: 'Two simple promises, in plain words — so you stay healthy without the fuss.',
    onb_s2_p1_title: 'Daily health companion',
    onb_s2_p1_body: 'BP, sugar and medicine reminders — all by voice. Keep steady every day, never forget a dose.',
    onb_s2_p2_title: '24/7 emergency lifeline',
    onb_s2_p2_body: 'If you fall or feel unwell, 108 ambulance and your family are alerted instantly.',
    onb_s3_title: "Let's set you up",
    onb_s3_body: 'Everything below stays safe on your phone. It is only used to get you help.',
    onb_s3_name_label: 'Your Name (Optional)',
    onb_s3_name_hint: 'e.g. Ramprasad',
    onb_s3_caregiver_label: "Son/Daughter's WhatsApp Number",
    onb_s3_caregiver_hint: "Family member's number · e.g. 9876543210",
    onb_s3_caregiver_sub: 'Emergency SOS alerts will go to this number. You can also add it later.',
    onb_s3_perm_title: 'Allow Voice & Location Access',
    onb_s3_perm_sub: 'So you can talk to Sahara by voice and the ambulance can find you in an emergency.',
    onb_s3_perm_granted: '✓ Permissions granted',
    onb_s3_perm_retry: 'Open Settings to allow →',
    onb_s3_enable: 'Enable & Get Started',
    onb_s3_finish: 'Get Started →',
    onb_back: '← Back',
    onb_skip: 'Skip',

    // ---- Talk ----
    frame_title: 'Sahara · Live preview',
    talk_title: 'Sahara · Health AI',
    talk_state_idle: 'Tap to start talking',
    talk_state_connecting: 'Connecting…',
    talk_state_listening: 'Sahara is listening… (speak now)',
    talk_state_thinking: 'Sahara is thinking…',
    talk_state_speaking: 'Sahara is speaking… (tap to interrupt)',
    talk_mic_start: 'Start talking',
    talk_mic_muted: 'Mute mic',
    talk_mic_unmute: 'Unmute mic',
    talk_mic_connecting: 'Connecting…',
    talk_hint_idle: 'Your health companion · always here for you',
    talk_hint_active: 'Ask by voice or type below, any time',
    talk_quick_title: 'Quick prompts',
    talk_input_placeholder: 'Ask Sahara anything or speak…',
    talk_copy: 'Copy',
    talk_speak: 'Listen',
    talk_good: 'Good response',
    talk_bad: 'Needs work',
    talk_new_chat: 'New chat',
    chat_home_welcome: 'Welcome back, {name}!',
    chat_home_welcome_noname: 'Welcome to Sahara! How are you feeling today?',
    chat_sugg_1: '📄 Show my medicines',
    chat_sugg_2: '📍 Nearby hospital',
    chat_sugg_3: '💊 Generic savings',
    a11y_menu: 'Open menu',
    a11y_settings: 'Settings',
    qp_meds_label: 'What is my morning medicine?',
    qp_meds_query: 'What is my morning medicine and when should I take it?',
    qp_clinic_label: 'Nearby government hospital',
    qp_clinic_query: 'Where is the nearest primary health centre?',
    qp_savings_label: 'Generic meds 83% cheaper',
    qp_savings_query: 'What is the price of Amlodipine at Jan Aushadhi?',
    qp_vitals_label: 'Log my BP 125/82',
    qp_vitals_query: 'My blood pressure is 125/82, please log it.',

    // ---- Chat drawer ----
    drawer_search: 'Search or ask anything…',
    drawer_features: 'Health features',
    drawer_recent: 'Recent conversations',
    drawer_see_all: 'See all…',
    drawer_user_status: 'Sahārā Care active',
    feat_ai: 'Sahārā Voice AI',
    feat_ai_sub: 'Live health companion',
    feat_meds: 'Medicines & Jan Aushadhi',
    feat_meds_sub: 'Prescriptions & 83% savings',
    feat_scanner: 'Prescription & Bill Scanner',
    feat_scanner_sub: 'Multi-source check & savings',
    feat_vitals: 'Health vitals',
    feat_vitals_sub: 'BP, sugar, pulse tracker',
    feat_emergency: 'Emergency SOS',
    feat_emergency_sub: '108 & family alert',
    feat_caregiver: 'Family & caregiver',
    feat_caregiver_sub: 'Live monitoring link',
    rc1_title: 'Morning BP reading (125/82)',
    rc1_time: 'Today, 8:15 AM',
    rc1_query: 'Is my blood pressure 125/82 normal?',
    rc2_title: 'Rampur PHC OPD timings & doctor',
    rc2_time: 'Yesterday, 4:30 PM',
    rc2_query: 'Where is the nearest government PHC hospital?',
    rc3_title: 'Amlodipine generic saves ₹40',
    rc3_time: '30 September',
    rc3_query: 'How much does Amlodipine 5mg cost at a Jan Aushadhi centre?',
    rc4_title: 'Mild headache — home remedies',
    rc4_time: '28 September',
    rc4_query: 'What should I do for a headache?',

    // ---- Meds ----
    meds_title: "Today's medicines",
    meds_subtitle: 'Take your medicines on time · save 83% with generics',
    meds_taken_badge: 'Taken ✓',
    meds_pending_badge: 'Pending',
    meds_mark_taken: 'Taken — mark it',
    meds_success_msg: 'Great job! Your medicine has been recorded.',
    meds_adherence: 'Daily adherence',
    meds_progress: '{taken} of {total} doses taken ({pct}%)',
    meds_generic_available: 'Generic option available',
    med_amlo_name: 'Amlodipine 5mg',
    med_amlo_time: 'Morning 8:00 AM (after breakfast)',
    med_amlo_purpose: 'Blood pressure',
    med_met_name: 'Metformin 500mg',
    med_met_time: 'Night 8:30 PM (after dinner)',
    med_met_purpose: 'Sugar control',
    med_ato_name: 'Atorvastatin 10mg',
    med_ato_time: 'Night at bedtime',
    med_ato_purpose: 'Cholesterol & heart',

    // ---- Vitals ----
    vitals_title: 'Health vitals',
    vitals_subtitle: 'Log by voice or tap a card',
    vital_bp: 'Blood pressure',
    vital_pulse: 'Heart rate',
    vital_sugar: 'Blood sugar',
    vital_spo2: 'Oxygen (SpO2)',
    vitals_normal: 'Normal',
    vitals_elevated: 'Elevated',
    vitals_check: 'Check',
    vitals_normal_range: 'Normal range',
    vitals_quick_title: 'Quick test logging',
    vitals_bp_normal: 'BP: 120/80 (normal)',
    vitals_bp_high: 'BP: 152/96 (high alert)',
    vitals_voice_btn: 'Log by voice',
    vitals_voice_sub: "Say: 'My BP is 120/80'",

    // ---- Settings / Profile ----
    settings_title: 'Settings',
    settings_subtitle: 'Accessibility & preferences',
    settings_text_size: 'Text size',
    settings_language: 'Language',
    settings_auto_sos: 'Emergency sensors',
    settings_fall_detect: 'Fall detection — on',
    settings_shake_sos: 'Shake phone for SOS — on',
    settings_forget_me: 'Forget my data',
    settings_demo_screens: 'View all screens',
    size_normal: 'Normal',
    size_large: 'Large (A+)',
    size_xl: 'Largest (A++)',
    demo_onboarding: 'Onboarding',
    demo_onboarding_sub: 'Language selection',
    demo_caregiver: 'Caregiver pairing (QR)',
    demo_caregiver_sub: 'Link family',
    demo_history: 'Health story',
    demo_history_sub: 'Care history',
    demo_emergency: 'Emergency screen',
    demo_emergency_sub: 'Emergency room',
    demo_caregiver_sos: 'Caregiver live-SOS',
    demo_caregiver_sos_sub: 'Caregiver view',

    // ---- Privacy & Consent Vault ----
    consent_title: 'Data Privacy & Consent Vault',
    consent_subtitle: 'Local-first on device · Strictly consent-based sharing',
    consent_caregiver: 'Caregiver Auto-Sync (Ramesh)',
    consent_caregiver_sub: 'Real-time sync of medications and vitals with family',
    consent_emergency: '108 Emergency Break-Glass Access',
    consent_emergency_sub: 'Dispatches SBAR clinical brief to 108 EMS only in acute crises',
    consent_doctor: 'Doctor & Hospital Teleconsult Sharing',
    consent_doctor_sub: 'Share health telemetry with hospitals or clinics (Optional)',
    consent_local_only: 'Local-first encryption active · No data leaves without consent',
    consent_on: 'Active ✓',
    consent_off: 'Disabled',

    // ---- Care history ----
    history_title: 'Health story',
    history_subtitle: 'Medicines, BP and symptoms record',
    history_hero_title: 'This is more than a record',
    history_hero_body: 'It is your health story.',
    history_changes_title: 'Key changes',
    history_change_1: 'Blood pressure stabilised',
    history_change_2: 'Metformin taken on time',
    history_change_3: 'Mild dizziness yesterday',
    history_recent: 'Recent logs',
    history_tab_all: 'All',
    history_tab_symptoms: 'Symptoms',
    history_tab_doctors: 'Doctors',
    history_entry1_time: '23 September 2026 · 10:15 AM',
    history_entry1_title: 'Mild dizziness',
    history_entry1_body: 'Lost balance when getting up in the morning. Fine after medicine.',
    history_entry2_time: '20 September 2026',
    history_entry2_title: 'Dr. Sunita Verma · Rampur PHC',
    history_entry2_body: 'Blood pressure check · continue the medicine.',
    history_listen: '🔊 Listen · Ask about this',

    // ---- Caregiver pairing ----
    pair_title: 'Family caregiver',
    pair_subtitle: 'Link with a QR code or 6-digit passkey',
    pair_hero_title: 'Safety link',
    pair_hero_body: 'Link one family caregiver.',
    pair_scan: 'Ask your son or daughter to scan this with their phone',
    pair_ready: '● Ready to scan',
    pair_code_label: 'Or 6-digit passkey',
    pair_read_aloud: '🔊 Read the code aloud',
    pair_linked: 'Linked',
    pair_continue: 'Continue',

    // ---- Caregiver live SOS ----
    csos_alert: '🚨 EMERGENCY ALERT · LIVE',
    csos_default_patient: 'Ramprasad (72)',
    csos_default_reason: 'Chest pain and breathlessness · voice-triggered SOS',
    csos_join: 'Join live call',
    csos_join_sub: '3-way live audio',
    csos_joined: 'You are in the call ✓',
    csos_joined_sub: 'Connected · 3-way audio',
    csos_sbar: 'SBAR clinical handoff brief',
    csos_ambulance: '🚑 108 ambulance',
    csos_dispatched: 'Parallel alert dispatched',
    csos_eta: 'ETA 6 min',
    csos_bp: 'Blood pressure',
    csos_pulse: 'Heart rate',
    csos_high: 'High',
    csos_live_audio: '● Live audio · AI captions on',
    csos_line1: 'Ramprasad: "Son… my chest feels heavy…"',
    csos_line2: 'Sahara: "Stay calm, help is coming. 108 is on the way."',
    csos_doctor_joining: 'Dr. Verma (Cardiologist) is joining…',
    csos_resolve: 'Mark resolved',

    // ---- Emergency ----
    emerg_help_title: 'Help is on the way',
    emerg_help_sub: 'Sahara stays on the call with you, never hangs up',
    emerg_red_path: 'RED PATH: acute emergency',
    emerg_you: 'You',
    emerg_you_st: 'Connected ✓',
    emerg_ai: 'Sahara AI',
    emerg_ai_st: 'On call ✓',
    emerg_caregiver: 'Caregiver (Ramesh)',
    emerg_caregiver_joined: 'Joined ✓',
    emerg_caregiver_alerted: 'Alerted ✓',
    emerg_108_dispatched: 'Dispatched ✓',
    emerg_108_active: 'Active…',
    emerg_step_1: 'SOS triggered — Sahara is live on the audio call',
    emerg_step_2: 'Parallel dispatch: 108 EMS & family alerted together',
    emerg_step_3: 'SBAR clinical brief sent to the hospital',
    emerg_step_4_ack: 'Caregiver accepted the call ({by})',
    emerg_step_4_wait: '60-second consciousness monitor (AVPU) active',
    emerg_ladder_title: 'Status · dispatch ladder',
    emerg_avpu_title: 'Consciousness monitor (AVPU)',
    emerg_avpu_unresp: '⚠️ Patient unresponsive! Immediate defibrillator support needed.',
    emerg_avpu_ok: 'Sahara checks the patient every 60 seconds by voice.',
    emerg_avpu_a: 'A · Alert',
    emerg_avpu_v: 'V · Voice',
    emerg_avpu_p: 'P · Pain',
    emerg_avpu_u: 'U · Unresponsive',
    emerg_im_ok: 'I am OK',
    emerg_im_ok_sub: 'Tap to confirm',
    emerg_sbar_title: 'SBAR clinical handoff brief',
    emerg_sbar_s: 'Situation',
    emerg_sbar_b: 'Background',
    emerg_sbar_a: 'Assessment',
    emerg_sbar_r: 'Recommendation',
    emerg_sbar_default_situation: '72-year-old male — acute chest pain',
    emerg_sbar_default_background: 'Known hypertension · regular medicine Amlodipine 5mg',
    emerg_sbar_default_assessment: 'NEWS2 critical band · recent BP 190/115',
    emerg_sbar_default_recommendation: 'Immediate hospital transport by 108 ALS ambulance',
    emerg_verbal: '15-second verbal handoff script',
    emerg_call_108: 'Call 108 ambulance',
    emerg_call_108_sub: 'Direct government emergency line',
    emerg_resolve: "I'm safe now",
    emerg_resolve_sub: 'Help arrived / emergency over',

    // ---- Voice session ----
    voice_greeting: 'Hello! I am Sahara, your health companion. How can I help you today?',
    voice_farewell: 'Goodbye! Take care of yourself.',
    voice_card_facility_title: 'Primary Health Centre Rampur',
    voice_card_facility_sub: 'Open now · 2.1 km · free medicines',
    voice_timestamp_now: 'now',

    // ---- In-chat tool cards ----
    card_open: 'Open now',
    card_call: 'Call',
    card_map: 'Directions',
    card_taken: '✓ Taken',
    card_pending: 'Pending',
    card_time: 'Time',
    card_mark_taken: '✓ I took it',
    card_marked_taken: 'Marked as taken',
    card_vitals_title: 'Vitals monitoring',
    card_vitals_sub: "Today's latest reading · stored safely",
    card_vitals_status: 'All vitals are normal and stable.',
    card_bp: 'Blood pressure',
    card_sugar: 'Blood sugar',
    card_pulse: 'Heart rate',
    card_spo2: 'Oxygen (SpO2)',
    card_normal: 'Normal',
    card_fasting: 'Fasting',
    card_stable: 'Stable',
    card_healthy: 'Healthy',
    card_sos_title: '🚨 Emergency SOS active',
    card_sos_desc: '108 ambulance and family have been alerted live.',
    card_sos_open: 'Open SOS screen',
    card_call_108: 'Call 108',
  },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const FONT_SCALES = [1.0, 1.15, 1.3];

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>('hi');
  const [languageChosen, setLanguageChosen] = useState(false);
  const [ready, setReady] = useState(false);
  const [textSize, setTextSize] = useState<TextSizeLevel>(0);
  const [consentCaregiverSync, setConsentCaregiverSyncState] = useState(true);
  const [consentEmergencyBreakGlass, setConsentEmergencyBreakGlassState] = useState(true);
  const [consentDoctorShare, setConsentDoctorShareState] = useState(false);
  const [userName, setUserNameState] = useState('');
  const [caregiverPhone, setCaregiverPhoneState] = useState('');

  // Restore the saved preferences once on mount, so settings survive reloads.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [
        savedLang,
        savedChosen,
        savedCaregiver,
        savedEmergency,
        savedDoctor,
        savedUserName,
        savedCaregiverPhone,
      ] = await Promise.all([
        getItem(LANG_KEY),
        getItem(LANG_CHOSEN_KEY),
        getItem(CONSENT_CAREGIVER_KEY),
        getItem(CONSENT_EMERGENCY_KEY),
        getItem(CONSENT_DOCTOR_KEY),
        getItem(USER_NAME_KEY),
        getItem(CAREGIVER_PHONE_KEY),
      ]);
      if (!mounted) return;
      if (savedLang === 'hi' || savedLang === 'en') setLangState(savedLang);
      setLanguageChosen(savedChosen === '1');
      if (savedCaregiver !== null) setConsentCaregiverSyncState(savedCaregiver === '1');
      if (savedEmergency !== null) setConsentEmergencyBreakGlassState(savedEmergency === '1');
      if (savedDoctor !== null) setConsentDoctorShareState(savedDoctor === '1');
      if (savedUserName) setUserNameState(savedUserName);
      if (savedCaregiverPhone) setCaregiverPhoneState(savedCaregiverPhone);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    setItem(LANG_KEY, next);
    // Manually switching later still counts as an explicit choice.
    setItem(LANG_CHOSEN_KEY, '1');
    setLanguageChosen(true);
  }, []);

  const previewLang = useCallback((next: Language) => {
    setLangState(next);
    setItem(LANG_KEY, next);
  }, []);

  const chooseLanguage = useCallback((next: Language) => {
    setLangState(next);
    setItem(LANG_KEY, next);
    setItem(LANG_CHOSEN_KEY, '1');
    setLanguageChosen(true);
  }, []);

  const setConsentCaregiverSync = useCallback((val: boolean) => {
    setConsentCaregiverSyncState(val);
    setItem(CONSENT_CAREGIVER_KEY, val ? '1' : '0');
  }, []);

  const setConsentEmergencyBreakGlass = useCallback((val: boolean) => {
    setConsentEmergencyBreakGlassState(val);
    setItem(CONSENT_EMERGENCY_KEY, val ? '1' : '0');
  }, []);

  const setConsentDoctorShare = useCallback((val: boolean) => {
    setConsentDoctorShareState(val);
    setItem(CONSENT_DOCTOR_KEY, val ? '1' : '0');
  }, []);

  const setUserName = useCallback((name: string) => {
    const trimmed = (name || '').trim();
    setUserNameState(trimmed);
    if (trimmed) setItem(USER_NAME_KEY, trimmed);
    else removeItem(USER_NAME_KEY);
  }, []);

  const setCaregiverPhone = useCallback((phone: string) => {
    const trimmed = (phone || '').replace(/[^\d+]/g, '');
    setCaregiverPhoneState(trimmed);
    if (trimmed) setItem(CAREGIVER_PHONE_KEY, trimmed);
    else removeItem(CAREGIVER_PHONE_KEY);
  }, []);

  // "Forget my data" must also drop the personal profile, not just consents.
  const resetUserProfile = useCallback(() => {
    setUserNameState('');
    setCaregiverPhoneState('');
    removeItem(USER_NAME_KEY);
    removeItem(CAREGIVER_PHONE_KEY);
  }, []);

  const fontScale = FONT_SCALES[textSize] || 1.0;

  const t = useCallback(
    (key: string): string => {
      return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
    },
    [lang],
  );

  const tf = useCallback(
    (key: string, vars: Record<string, string | number>): string => {
      let out = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
      Object.entries(vars).forEach(([k, v]) => {
        out = out.split(`{${k}}`).join(String(v));
      });
      return out;
    },
    [lang],
  );

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        languageChosen,
        ready,
        previewLang,
        chooseLanguage,
        textSize,
        setTextSize,
        fontScale,
        consentCaregiverSync,
        setConsentCaregiverSync,
        consentEmergencyBreakGlass,
        setConsentEmergencyBreakGlass,
        consentDoctorShare,
        setConsentDoctorShare,
        userName,
        setUserName,
        caregiverPhone,
        setCaregiverPhone,
        resetUserProfile,
        t,
        tf,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
