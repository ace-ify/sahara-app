const API_BASE_URL = '/api'

export interface GetConfigResponse {
  app_id: string
  token: string
  uid: string
  channel_name: string
  agent_uid: string
}

export async function getConfig(options?: { channel?: string; uid?: string | number }): Promise<GetConfigResponse> {
  const params = new URLSearchParams()
  if (options?.channel !== undefined && options.channel !== '') {
    params.set('channel', options.channel)
  }
  if (options?.uid !== undefined && options.uid !== '') {
    params.set('uid', String(options.uid))
  }

  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}/get_config${query ? `?${query}` : ''}`, {
    method: 'GET',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  const result = await response.json()
  if (result.code !== 0 || !result.data) {
    throw new Error(result.msg || 'Failed to get configuration')
  }
  return result.data
}

export async function startAgent(channelName: string, rtcUid: number, userUid: number): Promise<string> {
  const payload = { channelName, rtcUid, userUid }

  const response = await fetch(`${API_BASE_URL}/startAgent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  const result = await response.json()
  if (result.code !== 0 || !result.data?.agent_id) {
    throw new Error(result.msg || 'Failed to start agent')
  }
  return result.data.agent_id
}

export async function stopAgent(agentId: string): Promise<void> {
  if (!agentId) return

  const response = await fetch(`${API_BASE_URL}/stopAgent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
}

// --- Admin dashboard: patients, risk, outbound follow-up calls ---

export interface PatientRisk {
  level: 'green' | 'amber' | 'red'
  reasons: string[]
  pending_doses: number
}

export interface AdminPatient {
  id: string
  name: string
  caregiver_phone: string | null
  channel: string
  risk: PatientRisk
}

export interface FollowupCall {
  call_id: string
  patient_id: string
  patient_name: string
  channel: string
  note: string | null
  status: string
  outcome: string | null
  summary: string | null
  started_at: number
  ended_at?: number
}

export async function listPatients(): Promise<AdminPatient[]> {
  const response = await fetch(`${API_BASE_URL}/admin/patients`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const result = await response.json()
  return result.patients || []
}

export async function registerPatient(name: string, caregiverPhone?: string, channel?: string): Promise<AdminPatient> {
  const response = await fetch(`${API_BASE_URL}/admin/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, caregiver_phone: caregiverPhone || null, channel: channel || null }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return (await response.json()).patient
}

export async function startFollowupCall(patientId: string, note?: string): Promise<{ call: FollowupCall; simulated: boolean }> {
  const response = await fetch(`${API_BASE_URL}/admin/followup/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, note: note || null }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return await response.json()
}

export async function setFollowupOutcome(callId: string, outcome: 'fine' | 'needs_review' | 'escalate', summary?: string): Promise<FollowupCall> {
  const response = await fetch(`${API_BASE_URL}/admin/followup/outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_id: callId, outcome, summary: summary || null }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return (await response.json()).call
}

export async function listFollowupCalls(): Promise<FollowupCall[]> {
  const response = await fetch(`${API_BASE_URL}/admin/followup/calls`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const result = await response.json()
  return result.calls || []
}
