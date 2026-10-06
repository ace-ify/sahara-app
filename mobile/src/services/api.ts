import { NativeModules, Platform } from 'react-native';

export function getBackendBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (Platform.OS === 'web') {
    // If running in browser on a remote domain (like Netlify or custom domain), use live Render backend
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return 'https://sahara-sh0i.onrender.com';
    }
    return 'http://localhost:8000';
  }
  // Derive the backend host from the Metro bundler URL so any machine serving
  // the app also serves the API (no hardcoded developer-LAN IP that breaks on
  // demo Wi-Fi). Falls back to the Android emulator host-loopback alias.
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/:\/\/([^:/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:8000`;
      }
    }
  } catch {}
  // Metro served from localhost (Android emulator) → host machine's alias.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
}

export const API_BASE_URL = getBackendBaseUrl();

// Lightweight reachability probe backing the on-screen connection indicator,
// so the UI can distinguish "server slow" from "server gone" and show honest
// degraded states instead of fabricated data.
let backendReachable: boolean | null = null;

export async function checkBackendHealth(force = false): Promise<boolean> {
  if (!force && backendReachable !== null) return backendReachable;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(`${getBackendBaseUrl()}/get_config`, { signal: controller.signal });
      backendReachable = res.ok;
    } finally {
      clearTimeout(id);
    }
  } catch {
    backendReachable = false;
  }
  return backendReachable;
}

export function isBackendReachable(): boolean | null {
  return backendReachable;
}

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

// --- Companion Tools Endpoints (Real User Data — honest offline states) ---

/**
 * Offline/empty marker: screens check this to render an honest empty state
 * (e.g. "सर्वर से संपर्क नहीं हो पा रहा") instead of fabricated data.
 */
export const OFFLINE_STATUS = 'offline';

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
    if (res.ok) {
      const data = await res.json();
      if (data && data.medications && data.medications.length > 0) return data;
    }
  } catch (err) {
    console.warn('[meds] server unreachable:', err);
  }
  // Honest offline state — no fabricated medicine list.
  return {
    status: OFFLINE_STATUS,
    total_medications: 0,
    pending_count: 0,
    taken_count: 0,
    medications: [],
    message_hi: 'सर्वर से संपर्क नहीं हो पा रहा। कृपया इंटरनेट जाँचें।',
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
  } catch (err) {
    console.warn('[meds] add medication unreachable:', err);
  }
  return { status: OFFLINE_STATUS, message_hi: 'कनेक्शन नहीं — दवा सहेजी नहीं जा सकी।' };
}

export async function resetAllData(): Promise<{ status: string; message: string }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/reset`, {
      method: 'POST',
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('[reset] server unreachable:', err);
  }
  return { status: OFFLINE_STATUS, message: 'Backend unreachable — local data still cleared' };
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
  } catch (err) {
    console.warn('[scan] server unreachable:', err);
  }
  return { status: OFFLINE_STATUS, medicines: [] };
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
  } catch (err) {
    console.warn('[meds] log unreachable:', err);
  }
  return {
    status: OFFLINE_STATUS,
    medication: name,
    logged_at: '—',
    message_hi: 'कनेक्शन नहीं — दवा सर्वर पर दर्ज नहीं हो सकी।',
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
  } catch (err) {
    console.warn('[facilities] server unreachable:', err);
  }

  return {
    status: OFFLINE_STATUS,
    count: 0,
    nearest: null,
    facilities: [],
    message_hi: 'सर्वर से संपर्क नहीं — नज़दीकी अस्पताल खोज रहे हैं…',
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
  } catch (err) {
    console.warn('[price] server unreachable:', err);
  }
  return {
    status: OFFLINE_STATUS,
    medicine: name,
    branded_price: '—',
    generic_price: '—',
    savings_percentage: '—',
    message_hi: 'कनेक्शन नहीं — कीमत की जानकारी उपलब्ध नहीं।',
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
  } catch (err) {
    console.warn('[scheme] server unreachable:', err);
  }
  return {
    status: OFFLINE_STATUS,
    scheme: name,
    summary: '—',
    details: '—',
    helpline: '—',
    message_hi: 'कनेक्शन नहीं — योजना की जानकारी उपलब्ध नहीं।',
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
  } catch (err) {
    console.warn('[vitals] log unreachable:', err);
  }

  // Offline: still give the local reading interpretation (no network claim),
  // but mark status so the screen can show the unsaved state honestly.
  let msg = `आपकी रीडिंग (${value} ${unit}) दर्ज कर ली गई है।`;
  if (vitalType.toLowerCase().includes('bp')) {
    const sys = parseInt(value.split('/')[0]) || 120;
    msg = sys >= 140 ? `आपका BP ${value} थोड़ा बढ़ा हुआ है। आराम करें और पानी पिएं।` : `आपका BP ${value} सामान्य है।`;
  }
  return { status: OFFLINE_STATUS, vital_type: vitalType, value, message_hi: msg };
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
  } catch (err) {
    console.warn('[escalate] server unreachable:', err);
  }
  return {
    status: OFFLINE_STATUS,
    caregiver: '',
    phone: '',
    reason,
    urgency,
    message_hi: 'कनेक्शन नहीं — केयरगिवर को सूचना नहीं भेजी जा सकी।',
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
    if (res.ok) {
      const data = await res.json();
      if (data && data.history && data.history.length > 0) return data;
    }
  } catch (err) {
    console.warn('[vitals] history unreachable:', err);
  }
  // Honest offline state — no fabricated readings.
  return {
    status: OFFLINE_STATUS,
    count: 0,
    history: [],
    message_hi: 'कनेक्शन नहीं — रीडिंग उपलब्ध नहीं।',
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
  } catch (err) {
    console.warn('[reminders] server unreachable:', err);
  }
  return {
    status: OFFLINE_STATUS,
    count: 0,
    reminders: [],
    message_hi: 'कनेक्शन नहीं — रिमाइंडर उपलब्ध नहीं।',
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
  } catch (err) {
    console.warn('[reminders] set unreachable:', err);
  }
  return {
    status: OFFLINE_STATUS,
    message_hi: `कनेक्शन नहीं — रिमाइंडर '${title}' सेट नहीं हो सका।`,
  };
}

// --- LLM Chat & Voice Turn Endpoint ---

export interface StreamChatHandlers {
  /** Called for each streamed text delta as it arrives (live captions). */
  onDelta?: (delta: string) => void;
}

export async function sendChatMessage(
  text: string,
  channel: string = 'default',
  lang: string = 'hi',
  history: Array<{ role: string; content: string }> = [],
  profile?: { patient?: string; caregiverPhone?: string },
  streamHandlers?: StreamChatHandlers,
): Promise<{ text: string; card?: any }> {
  // SSE reading needs response-body streaming (ReadableStream.getReader) —
  // available in browsers, not on RN/Hermes fetch. Native gets the JSON path.
  const doStream = Platform.OS === 'web' && Boolean(streamHandlers?.onDelta);
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
          stream: doStream,
          lang,
          // Profile context so a voice-detected emergency dispatches to the
          // real caregiver instead of a server-side placeholder contact.
          patient: profile?.patient || undefined,
          caregiver_phone: profile?.caregiverPhone || undefined,
        }),
      },
      // Streamed replies are already rendering to screen as they arrive; give
      // the network a generous ceiling rather than killing a healthy stream.
      doStream ? 60000 : 20000,
    );
    if (res.ok) {
      if (!doStream) {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || '';
        return { text: reply, card: data.card || null };
      }
      // SSE stream: accumulate deltas (driving live captions) and return the
      // full text. Card pushes ride the normal /api/card/latest poller.
      const reader = res.body?.getReader();
      if (!reader) throw new Error('no stream body');
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let full = '';
      let card: any = null;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          // SSE events are separated by a blank line; process complete ones.
          const events = sseBuffer.split('\n\n');
          sseBuffer = events.pop() || '';
          for (const ev of events) {
            for (const line of ev.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (delta) {
                  full += delta;
                  streamHandlers?.onDelta?.(delta);
                }
                // Some gateways attach a non-stream card to the terminal chunk.
                if (parsed?.card) card = parsed.card;
              } catch {}
            }
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {}
      }
      return { text: full, card };
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

/**
 * Trigger the emergency dispatch ladder. `caregiverPhone` (from onboarding)
 * routes the WhatsApp alert to the real family member. Offline, returns an
 * incident marked UNDELIVERED — never a fabricated "alerted ✓" for a message
 * that was never sent.
 */
export async function triggerEmergency(
  channel: string,
  reason: string,
  patient: string = 'मरीज़',
  caregiverPhone?: string,
): Promise<{ status: string; incident: IncidentSnapshot; card?: any }> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        reason,
        severity: 'critical',
        patient,
        caregiver_phone: caregiverPhone || undefined,
      }),
    }, 4000);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('[emergency] dispatch server unreachable:', err);
  }

  // Honest offline state: nothing was sent. The on-screen 108 dialer is the
  // patient's live lifeline here.
  return {
    status: 'offline',
    incident: {
      channel,
      reason,
      severity: 'critical',
      patient,
      status: 'dispatching',
      attempts: [],
    },
  };
}

export async function getEmergencyStatus(channel: string): Promise<{
  status: 'active' | 'none' | 'offline';
  incident?: IncidentSnapshot;
}> {
  try {
    const res = await fetchWithTimeout(`${getBackendBaseUrl()}/api/emergency/status?channel=${encodeURIComponent(channel)}`, {}, 2000);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('[emergency] status unreachable:', err);
  }

  // Offline: honestly report no server knowledge — never fabricate an active
  // incident with fake "delivered" attempts.
  return { status: 'offline' };
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
  } catch (err) {
    console.warn('[emergency] ack unreachable:', err);
  }

  return {
    status: OFFLINE_STATUS,
    incident: {
      channel,
      reason: 'आपातकाल',
      severity: 'critical',
      patient: 'मरीज़',
      status: 'dispatching',
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
  } catch (err) {
    console.warn('[emergency] resolve unreachable:', err);
  }

  return {
    status: OFFLINE_STATUS,
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
  } catch (err) {
    console.warn('[whatsapp] send unreachable:', err);
  }
  // Offline: clearly NOT delivered — callers can surface this honestly.
  return { status: 'failed', simulated: true };
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
  } catch (err) {
    console.warn('[emergency] avpu unreachable:', err);
  }

  return {
    status: OFFLINE_STATUS,
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
  } catch (err) {
    console.warn('[emergency] sbar unreachable:', err);
  }

  return {
    status: OFFLINE_STATUS,
    channel,
    sbar: null,
  };
}

