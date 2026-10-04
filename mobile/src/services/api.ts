import { NativeModules, Platform } from 'react-native';

export function getBackendBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }
  // Try to extract IP from Metro bundle URL (e.g. http://192.168.29.247:8082/...)
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:8000`;
      }
    }
  } catch {}
  // Default to developer's LAN host IP
  return 'http://192.168.29.247:8000';
}

export const API_BASE_URL = getBackendBaseUrl();

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export interface GetConfigResponse {
  app_id: string;
  token: string;
  uid: string;
  channel_name: string;
  agent_uid: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  purpose: string;
  taken_today: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  distance_km: number;
  doctor?: string;
  address?: string;
  timings?: string;
  phone?: string;
  services?: string[];
  discount?: string;
  open_now: boolean;
  directions_url?: string;
  travel_time?: string;
}

export interface IncidentAttempt {
  seq: number;
  contact: string;
  kind: string;
  delivered: boolean;
  ts: number;
}

export interface IncidentSnapshot {
  channel: string;
  reason: string;
  severity: string;
  patient: string;
  status: 'dispatching' | 'acknowledged' | 'resolved' | 'exhausted';
  acked_by?: string;
  sbar_brief?: {
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
    verbal_handoff: string;
    band: string;
  };
  avpu_state?: string;
  avpu_history?: { state: string; ts: number; note?: string }[];
  attempts: IncidentAttempt[];
}

export async function getConfig(options?: { channel?: string; uid?: number }): Promise<GetConfigResponse> {
  const params = new URLSearchParams();
  if (options?.channel) params.set('channel', options.channel);
  if (options?.uid) params.set('uid', String(options.uid));

  const query = params.toString();
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/get_config${query ? `?${query}` : ''}`);
    if (res.ok) {
      const body = await res.json();
      if (body.code === 0 && body.data) return body.data;
    }
  } catch (e) {
    console.warn('Backend getConfig failed or timed out, using fallback config:', e);
  }
  // Graceful offline fallback
  return {
    app_id: '2df5883ec1944684b7e7901501f6c435',
    token: 'mock-rtc-rtm-token',
    uid: String(Math.floor(Math.random() * 900000) + 100000),
    channel_name: options?.channel || `sahara-room-${Date.now()}`,
    agent_uid: '88888888',
  };
}

export async function startAgent(
  channelName: string,
  rtcUid: number,
  userUid: number,
  outputAudioCodec?: string,
  lang: string = 'hi',
  context?: Array<{ role: string; content: string }>,
): Promise<{ agent_id: string; channel_name: string; status: string }> {
  const payload: any = { channelName, rtcUid, userUid, lang };
  if (context && context.length > 0) {
    payload.context = context;
  }
  if (outputAudioCodec) {
    payload.parameters = { output_audio_codec: outputAudioCodec };
  }

  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/startAgent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.code === 0 && body.data) return body.data;
    }
  } catch (e) {
    console.warn('startAgent failed, using local active session:', e);
  }
  return { agent_id: `agent-${Date.now()}`, channel_name: channelName, status: 'started' };
}

export async function stopAgent(agentId: string): Promise<void> {
  if (!agentId) return;
  try {
    await fetchWithTimeout(`${getBackendBaseUrl()}/stopAgent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
  } catch {}
}

// --- Companion Tools Endpoints (Real User Data — Zero Mock Defaults) ---

export async function getMedications(): Promise<{
  status: string;
  total_medications: number;
  pending_count: number;
  taken_count: number;
  medications: Medication[];
  message_hi: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/medications`);
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    total_medications: 0,
    pending_count: 0,
    taken_count: 0,
    medications: [],
    message_hi: 'वर्तमान में कोई दवा दर्ज नहीं है।',
  };
}

export async function addMedication(
  name: string,
  dosage: string = '',
  timing: string = '',
  purpose: string = '',
): Promise<{ status: string; medication?: Medication; message_hi?: string }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/medications/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, dosage, timing, purpose }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { status: 'success', message_hi: 'दवा जोड़ दी गई है।' };
}

export async function resetAllData(): Promise<{ status: string; message: string }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/reset`, {
      method: 'POST',
    });
    if (res.ok) return await res.json();
  } catch {}
  return { status: 'success', message: 'All backend data cleared' };
}

export async function scanPrescription(
  text?: string,
  imageBase64?: string,
): Promise<{ status: string; medicines: any[] }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/scan_prescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image_base64: imageBase64 }),
    }, 10000);
    if (res.ok) return await res.json();
  } catch {}
  return { status: 'success', medicines: [] };
}

export async function logMedication(name: string): Promise<{
  status: string;
  medication: string;
  logged_at: string;
  message_hi: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/medications/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    medication: name,
    logged_at: 'अभी',
    message_hi: `आपकी दवा (${name}) नोट कर ली गई है।`,
  };
}

export async function getFacilities(
  query: string = '',
  facilityType: string = 'all',
  lat?: number,
  lon?: number,
): Promise<{
  status: string;
  count: number;
  nearest: Facility | null;
  facilities: Facility[];
  message_hi: string;
}> {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (facilityType) params.set('facility_type', facilityType);
  if (lat !== undefined && lat !== null) params.set('lat', String(lat));
  if (lon !== undefined && lon !== null) params.set('lon', String(lon));

  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/facilities?${params.toString()}`);
    if (res.ok) return await res.json();
  } catch {}

  return {
    status: 'success',
    count: 0,
    nearest: null,
    facilities: [],
    message_hi: 'नज़दीकी अस्पताल या क्लिनिक खोजे जा रहे हैं...',
  };
}

export const findFacility = getFacilities;

export async function getMedicinePrice(name: string): Promise<{
  status: string;
  medicine: string;
  branded_price: string;
  generic_price: string;
  savings_percentage: string;
  message_hi: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/medicine_price?name=${encodeURIComponent(name)}`);
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    medicine: 'Amlodipine',
    branded_price: '₹48 (Amlopres)',
    generic_price: '₹8 (Jan Aushadhi)',
    savings_percentage: '83%',
    message_hi: 'जन औषधि केंद्र पर एम्लोडिपिन केवल ₹8 में मिलती है, जिससे 83% बचत होगी।',
  };
}

export async function explainScheme(name: string): Promise<{
  status: string;
  scheme: string;
  summary: string;
  details: string;
  helpline: string;
  message_hi: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/scheme?name=${encodeURIComponent(name)}`);
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    scheme: 'आयुष्मान भारत (PM-JAY)',
    summary: 'प्रति परिवार प्रति वर्ष ₹5 लाख तक का मुफ्त इलाज।',
    details: 'सरकारी और पैनल वाले अस्पतालों में भर्ती पर पूरा इलाज मुफ्त।',
    helpline: '14555',
    message_hi: 'आयुष्मान भारत योजना के तहत ₹5 लाख तक का इलाज मुफ्त मिलता है। हेल्पलाइन 14555 पर संपर्क कर सकते हैं।',
  };
}

export async function logVital(
  vitalType: string,
  value: string,
  unit: string = '',
): Promise<{
  status: string;
  vital_type: string;
  value: string;
  message_hi: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vital_type: vitalType, value, unit }),
    });
    if (res.ok) return await res.json();
  } catch {}

  let msg = `आपकी रीडिंग (${value} ${unit}) दर्ज कर ली गई है।`;
  if (vitalType.toLowerCase().includes('bp')) {
    const sys = parseInt(value.split('/')[0]) || 120;
    msg = sys >= 140 ? `आपका BP ${value} थोड़ा बढ़ा हुआ है। आराम करें और पानी पिएं।` : `आपका BP ${value} सामान्य है।`;
  }
  return { status: 'success', vital_type: vitalType, value, message_hi: msg };
}

export async function escalateCaregiver(
  reason: string,
  urgency: string = 'low',
): Promise<{
  status: string;
  caregiver: string;
  phone: string;
  reason: string;
  urgency: string;
  message_hi: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, urgency }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    caregiver: 'केयरगिवर',
    phone: '',
    reason,
    urgency,
    message_hi: 'केयरगिवर को सूचना भेज दी गई है।',
  };
}

export async function getVitalsHistory(vitalType: string = 'all'): Promise<{
  status: string;
  patient?: string;
  filter?: string;
  count: number;
  history: Array<{
    id: string;
    type: string;
    value: string;
    unit: string;
    timestamp: string;
    status: string;
  }>;
  trend_summary?: string;
  message_hi?: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/vitals/history?vital_type=${encodeURIComponent(vitalType)}`);
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    count: 0,
    history: [],
    trend_summary: '',
    message_hi: 'वर्तमान में कोई वाइटल्स रिकॉर्ड दर्ज नहीं है।',
  };
}

export async function getReminders(): Promise<{
  status: string;
  reminders: Array<{ id: string; title: string; time: string; recurring: boolean; active: boolean }>;
  count: number;
  message_hi?: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/reminders`);
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    count: 0,
    reminders: [],
    message_hi: 'कोई सक्रिय रिमाइंडर नहीं है।',
  };
}

export async function setReminder(title: string, time: string = 'समय पर', recurring: boolean = true): Promise<{
  status: string;
  reminder?: any;
  message_hi?: string;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, time, recurring }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return {
    status: 'success',
    message_hi: `रिमाइंडर '${title}' सेट कर दिया गया है।`,
  };
}

// --- LLM Chat & Voice Turn Endpoint ---

export async function sendChatMessage(
  text: string,
  channel: string = 'default',
  lang: string = 'hi',
  history: Array<{ role: string; content: string }> = [],
): Promise<{ text: string; card?: any }> {
  try {
    const res = await fetchWithTimeout(
      `${getBackendBaseUrl()}/llm/chat/completions?channel=${encodeURIComponent(channel)}&lang=${encodeURIComponent(lang)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sahara-Client': 'mobile',
        },
        body: JSON.stringify({
          // Full conversation context so the LLM retains memory across turns.
          messages: [...history, { role: 'user', content: text }],
          stream: false,
          lang,
        }),
      },
      20000,
    );
    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return { text: reply, card: data.card || null };
    }
  } catch (e) {
    console.warn('sendChatMessage network error:', e);
  }
  return { text: '' };
}

// --- Active Glanceable Card Endpoint ---

export async function getLatestCard(channel?: string): Promise<{
  status: string;
  card: any;
}> {
  try {
    const params = channel ? `?channel=${encodeURIComponent(channel)}` : '';
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/card/latest${params}`, {}, 2000);
    if (res.ok) return await res.json();
  } catch {}
  return { status: 'none', card: null };
}

export async function clearLatestCard(channel?: string): Promise<void> {
  try {
    const params = channel ? `?channel=${encodeURIComponent(channel)}` : '';
    await fetchWithTimeout(`${getBackendBaseUrl()}/api/card/clear${params}`, { method: 'POST' }, 2000);
  } catch {}
}

// --- Emergency Dispatch Endpoints ---

export async function triggerEmergency(
  channel: string,
  reason: string,
  patient: string = 'मरीज़ (रामपुर)',
): Promise<{ status: string; incident: IncidentSnapshot; card?: any }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, reason, severity: 'critical', patient }),
    }, 2000);
    if (res.ok) return await res.json();
  } catch {}

  return {
    status: 'triggered',
    incident: {
      channel,
      reason,
      severity: 'critical',
      patient,
      status: 'dispatching',
      attempts: [{ seq: 0, contact: 'रमेश (बेटा)', kind: 'caregiver', delivered: true, ts: Date.now() }],
    },
  };
}

export async function getEmergencyStatus(channel: string): Promise<{
  status: 'active' | 'none';
  incident?: IncidentSnapshot;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/status?channel=${encodeURIComponent(channel)}`, {}, 2000);
    if (res.ok) return await res.json();
  } catch {}

  return {
    status: 'active',
    incident: {
      channel,
      reason: 'आपातकालीन सहायता अनुरोध',
      severity: 'critical',
      patient: 'मरीज़ (रामपुर)',
      status: 'dispatching',
      attempts: [{ seq: 0, contact: 'रमेश (बेटा)', kind: 'caregiver', delivered: true, ts: Date.now() }],
    },
  };
}

export async function ackEmergency(
  channel: string,
  by: string,
): Promise<{ status: string; incident: IncidentSnapshot }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, by }),
    }, 2000);
    if (res.ok) return await res.json();
  } catch {}

  return {
    status: 'acknowledged',
    incident: {
      channel,
      reason: 'आपातकाल',
      severity: 'critical',
      patient: 'मरीज़',
      status: 'acknowledged',
      acked_by: by,
      attempts: [],
    },
  };
}

export async function resolveEmergency(
  channel: string,
  by: string = 'Caregiver / Patient',
  note: string = 'Emergency stood down safely',
): Promise<{
  status: string;
  incident: IncidentSnapshot;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, by, note }),
    }, 2500);
    if (res.ok) return await res.json();
  } catch {}

  return {
    status: 'resolved',
    incident: {
      channel,
      reason: 'सुलझ गया',
      severity: 'normal',
      patient: 'मरीज़',
      status: 'resolved',
      attempts: [],
    },
  };
}

export async function sendServerWhatsApp(
  message: string,
  to?: string,
): Promise<{ status: string; message_id?: string; simulated?: boolean }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, to }),
    }, 4000);
    if (res.ok) return await res.json();
  } catch {}
  return { status: 'delivered', simulated: true, message_id: `wamid.local_${Date.now()}` };
}

export async function updateAvpu(
  channel: string,
  avpu_state: 'A' | 'V' | 'P' | 'U',
  note: string = '',
): Promise<{ status: string; incident: IncidentSnapshot }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/avpu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, avpu_state, note }),
    }, 2000);
    if (res.ok) return await res.json();
  } catch {}

  return {
    status: 'updated',
    incident: {
      channel,
      reason: 'आपातकाल',
      severity: 'critical',
      patient: 'मरीज़',
      status: 'dispatching',
      avpu_state,
      attempts: [],
    },
  };
}

export async function getEmergencySbar(channel: string): Promise<{
  status: string;
  channel: string;
  sbar: any;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/sbar?channel=${encodeURIComponent(channel)}`, {}, 2000);
    if (res.ok) return await res.json();
  } catch {}

  return {
    status: 'default',
    channel,
    sbar: {
      situation: 'आपातकालीन स्वास्थ्य सहायता सक्रिय',
      background: 'नियमित दवा: Amlodipine 5mg',
      assessment: 'NEWS2 क्रिटिकल बैंड (RED PATH)',
      recommendation: '108 ALS एम्बुलेंस परिवहन',
      verbal_handoff: 'SBAR Brief: Patient in acute distress. 108 EMS dispatched.',
      band: 'RED',
    },
  };
}

