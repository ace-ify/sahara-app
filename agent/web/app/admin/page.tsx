'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  listPatients,
  registerPatient,
  startFollowupCall,
  setFollowupOutcome,
  listFollowupCalls,
  type AdminPatient,
  type FollowupCall,
} from '@/services/api'

type Outcome = 'fine' | 'needs_review' | 'escalate'

const RISK_STYLE: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  red: 'bg-red-100 text-red-800 border-red-300',
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  fine: 'Fine',
  needs_review: 'Needs review',
  escalate: 'Escalate',
}

export default function AdminDashboard() {
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [calls, setCalls] = useState<FollowupCall[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([listPatients(), listFollowupCalls()])
      setPatients(p)
      setCalls(c)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'backend unreachable')
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const handleRegister = async () => {
    if (!name.trim()) return
    setBusy('register')
    try {
      await registerPatient(name.trim(), phone.trim() || undefined)
      setName('')
      setPhone('')
      setSuccessMsg(`✓ Added patient ${name.trim()}`)
      setTimeout(() => setSuccessMsg(null), 5000)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'register failed')
    } finally {
      setBusy(null)
    }
  }

  const handleCall = async (patient: AdminPatient) => {
    setBusy(patient.id)
    try {
      await startFollowupCall(patient.id)
      setSuccessMsg(`✓ Calling ${patient.name} (${patient.caregiver_phone || 'phone'}) via Twilio PSTN (+1 682 349 7450)... Phone is ringing!`)
      setTimeout(() => setSuccessMsg(null), 8000)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'call failed')
    } finally {
      setBusy(null)
    }
  }

  const handleOutcome = async (call: FollowupCall, outcome: Outcome) => {
    setBusy(call.call_id)
    try {
      await setFollowupOutcome(call.call_id, outcome)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'outcome failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Sahārā · Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Proactive follow-up calls for chronic-care patients</p>
          </div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Voice demo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {successMsg && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error} — is the Python backend running?
          </div>
        )}

        {/* Register a patient */}
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Add patient</h2>
          <div className="flex flex-wrap gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Patient name (e.g. Ramprasad)"
              className="h-10 flex-1 min-w-48 rounded-md border border-slate-300 px-3 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Caregiver WhatsApp (optional)"
              className="h-10 flex-1 min-w-48 rounded-md border border-slate-300 px-3 text-sm"
            />
            <Button onClick={handleRegister} disabled={busy === 'register' || !name.trim()}>
              Add
            </Button>
          </div>
        </section>

        {/* Patient list with risk + Call now */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Patients</h2>
          {patients.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-white p-6 text-sm text-slate-500">
              No patients yet — add one above. Onboarding on the mobile app also registers here on next SOS.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Risk status</th>
                    <th className="px-4 py-3 font-medium">Pending doses</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.caregiver_phone || 'no caregiver number'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${RISK_STYLE[p.risk.level]}`}>
                          {p.risk.level}
                        </span>
                        <div className="mt-1 text-xs text-slate-500">{p.risk.reasons[0]}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.risk.pending_doses}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" onClick={() => handleCall(p)} disabled={busy === p.id}>
                          📞 Call now
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent calls with typed outcomes */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent follow-up calls</h2>
          {calls.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-white p-6 text-sm text-slate-500">No calls yet.</p>
          ) : (
            <div className="space-y-3">
              {calls.map((c) => (
                <div key={c.call_id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-900">{c.patient_name}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {c.status === 'in_progress' ? 'in progress…' : new Date((c.ended_at || c.started_at) * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    {c.outcome && (
                      <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                        {OUTCOME_LABEL[c.outcome as Outcome]}
                      </span>
                    )}
                  </div>
                  {c.summary && <p className="mt-1 text-sm text-slate-600">{c.summary}</p>}
                  <div className="mt-3 flex gap-2">
                    {(['fine', 'needs_review', 'escalate'] as Outcome[]).map((o) => (
                      <Button
                        key={o}
                        size="sm"
                        variant={o === 'escalate' ? 'destructive' : c.outcome === o ? 'default' : 'outline'}
                        disabled={busy === c.call_id || c.outcome !== null}
                        onClick={() => handleOutcome(c, o)}
                      >
                        {OUTCOME_LABEL[o]}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-400">
          “Call now” places a live cellular PSTN call via Sahara&apos;s Twilio trunk (+1 682 349 7450) with Polly.Aditi Hindi AI voice, while simultaneously bridging telemetry to this clinical dashboard.
        </p>
      </main>
    </div>
  )
}
