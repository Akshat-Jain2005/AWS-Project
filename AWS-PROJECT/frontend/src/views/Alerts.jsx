import { useRef, useState } from 'react'
import { api, usePoll } from '../api'
import { Panel, ReadState } from '../ui'
import { fmtClock } from '../format'

const STATUS_LABEL = {
  created: 'created', sent: 'sent', pending_approval: 'awaiting 2nd operator',
}

function Compose({ onSent, wardHints }) {
  const [wards, setWards] = useState('')
  const [channels, setChannels] = useState({ sms: true, telegram: false })
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const list = [...new Set(wards.split(',').map((w) => w.trim()).filter(Boolean))]
  const chans = Object.entries(channels).filter(([, v]) => v).map(([k]) => k)
  const ready = list.length && chans.length && message.trim()

  const send = async () => {
    if (!ready || inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(null); setResult(null)
    try {
      const a = await api('/alerts/send', { method: 'POST', body: { wards: list, channels: chans, message: message.trim() } })
      setResult(a); setMessage('')
      onSent?.()
    } catch (e) { setError(e.message) }
    finally { inFlight.current = false; setBusy(false) }
  }

  return (
    <Panel title="Compose advisory" meta="citizen SMS / operator Telegram">
      <label className="field-block">Target wards
        <input value={wards} placeholder="Civil Lines, Karol Bagh" onChange={(e) => setWards(e.target.value)} />
      </label>
      {wardHints?.length > 0 && (
        <div className="ward-hints">
          {wardHints.map((w) => (
            <button key={w} className="chip" onClick={() => setWards((s) => (s ? `${s}, ${w}` : w))}>+ {w}</button>
          ))}
        </div>
      )}
      <div className="channel-row">
        {['sms', 'telegram'].map((c) => (
          <label key={c} className="check">
            <input type="checkbox" checked={channels[c]} onChange={(e) => setChannels((s) => ({ ...s, [c]: e.target.checked }))} />
            {c === 'sms' ? 'Citizen SMS' : 'Operator Telegram'}
          </label>
        ))}
      </div>
      <label className="field-block">Message
        <textarea rows={3} value={message} placeholder="Advisory text for residents…" onChange={(e) => setMessage(e.target.value)} />
      </label>
      <button className="btn-primary" disabled={!ready || busy} onClick={send}>{busy ? 'Dispatching…' : 'Dispatch advisory'}</button>
      {result && (
        <p role="status" className={`dispatch-result ${result.status === 'pending_approval' ? 'sev-warning' : 'sev-normal'}`}>
          {result.status === 'pending_approval'
            ? `Large audience (${result.recipients}) — a second operator must approve.`
            : `Dispatched to ${result.sent} recipient(s)${result.skipped_cooldown ? `, ${result.skipped_cooldown} on cooldown` : ''}.`}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </Panel>
  )
}

function Rules() {
  const { data, refresh, error, loading } = usePoll('/automation/rules', 30000)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const toggle = async (k, v) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setActionError(null)
    try { await api('/automation/rules', { method: 'PUT', body: { [k]: !v } }); await refresh() }
    catch (err) { setActionError(err.message) }
    finally { inFlight.current = false; setBusy(false) }
  }
  const LABELS = {
    operator_telegram_on_incident: 'Telegram the operator channel on new incidents',
    sms_on_shutdown: 'SMS ward rationing on intake shutdown',
    all_clear_on_restore: 'SMS all-clear on supply restore',
  }
  return (
    <Panel title="Automation rules">
      <ReadState loading={loading} error={error} retry={refresh} />
      {actionError && <p className="error" role="alert">{actionError}</p>}
      <ul className="rules">
        {Object.entries(data || {}).map(([k, v]) => (
          <li key={k}>
            <span>{LABELS[k] || k}</span>
            <button className={`switch ${v ? 'on' : ''}`} role="switch" aria-label={LABELS[k] || k} aria-checked={v} disabled={busy || !!error} onClick={() => toggle(k, v)}>
              <span className="knob" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export default function Alerts({ refreshStatus }) {
  const { data: alerts, refresh, loading, error: readError } = usePoll('/alerts', 6000)
  const { data: summary } = usePoll('/subscribers/summary', 60000)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const inFlight = useRef(false)
  const wardHints = summary?.by_ward ? Object.keys(summary.by_ward) : []

  const approve = async (id) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(id)
    setError(null)
    try { await api(`/alerts/${id}/approve`, { method: 'POST' }); refresh(); refreshStatus?.() }
    catch (e) { setError(e.message) }
    finally { inFlight.current = false; setBusy(null) }
  }

  return (
    <div className="alerts">
      <Compose onSent={() => { refresh(); refreshStatus?.() }} wardHints={wardHints} />
      <Rules />
      <Panel title="Dispatch log" meta={`${(alerts || []).length} total`} className="span-2">
        <ReadState loading={loading} error={readError} retry={refresh} />
        {error && <p className="error" role="alert">{error}</p>}
        {!loading && !readError && <ul className="alert-log">
          {(alerts || []).map((a) => (
            <li key={a.id} className={a.status === 'pending_approval' ? 'is-lit sev-warning' : ''}>
              <span className="al-kind">{a.kind}</span>
              <span className="al-wards">{(a.wards || []).join(', ')}</span>
              <span className="al-count">{a.sent}/{a.recipients}</span>
              <span className="al-time">{fmtClock(a.created_at)}</span>
              <span className={`al-status ${a.status === 'sent' ? 'sev-normal' : ''}`}>{STATUS_LABEL[a.status] || a.status}</span>
              {a.status === 'pending_approval' && <button className="btn-secondary" disabled={!!busy} onClick={() => approve(a.id)}>{busy === a.id ? 'Approving…' : 'Approve'}</button>}
            </li>
          ))}
          {!alerts?.length && <li className="muted">No advisories dispatched yet.</li>}
        </ul>}
      </Panel>
    </div>
  )
}
