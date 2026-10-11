import { useEffect, useMemo, useRef, useState } from 'react'
import { api, usePoll } from '../api'
import { Panel, ReadState } from '../ui'
import { fmtDur, fmtClock, levelMeta } from '../format'

const SHORT = {
  STATION_01_PANIPAT: 'Panipat I', STATION_02_PANIPAT: 'Panipat II',
  STATION_03_SONIPAT: 'Sonipat', STATION_04_PALLA: 'Palla', STATION_05_WAZIRABAD: 'Wazirabad',
}
const openOnly = (i) => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED'

function Readings({ stationId }) {
  const { data, loading, error, refresh } = usePoll(`/telemetry/${stationId}`, 10000, { enabled: !!stationId })
  if (!stationId) return <p className="muted">Field report — no station readings attached.</p>
  if (loading || error) return <ReadState loading={loading} error={error} retry={refresh} />
  const rows = (data?.readings || []).slice(-6).reverse()
  if (!rows.length) return <p className="muted">No recent readings.</p>
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Recent station readings"><table className="readings">
      <thead>
        <tr><th>Time</th><th>NH₃ ppm</th><th>pH</th><th>Erratic idx</th><th>Level</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{fmtClock(r.received_at)}</td>
            <td className="num">{r.ammonia_ppm?.toFixed(2) ?? '—'}</td>
            <td className="num">{r.ph?.toFixed(2) ?? '—'}</td>
            <td className="num">{r.erratic_index?.toFixed(0) ?? '—'}</td>
            <td className={`sev-${levelMeta(r.threat_level).sev}`}>{levelMeta(r.threat_level).label}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  )
}

export default function Incidents({ refreshStatus }) {
  const { data, refresh, error, loading } = usePoll('/incidents', 5000)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(null)
  const inFlight = useRef(false)
  const [acked, setAcked] = useState(() => new Set())
  const [open, setOpen] = useState(null)
  const prev = useRef({})

  const incidents = useMemo(() => {
    const live = (data || []).filter(openOnly)
    return [...live].sort((a, b) =>
      levelMeta(b.level).rank - levelMeta(a.level).rank || a.t_minus_seconds - b.t_minus_seconds)
  }, [data])

  // Flag escalations: a new incident, or one whose level rose since last poll,
  // stays lit until the operator acknowledges it.
  useEffect(() => {
    const next = {}
    for (const i of incidents) {
      next[i.id] = levelMeta(i.level).rank
      const was = prev.current[i.id]
      if (was === undefined || levelMeta(i.level).rank > was) {
        setAcked((s) => { const c = new Set(s); c.delete(i.id); return c })
      }
    }
    prev.current = next
  }, [incidents])

  const close = async (id) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(id); setActionError(null)
    try {
      await api(`/incidents/${id}/close`, { method: 'POST' })
      refresh(); refreshStatus?.()
    } catch (err) { setActionError(err.message) }
    finally { inFlight.current = false; setBusy(null) }
  }

  if (loading || error) return <Panel title="Incident queue"><ReadState loading={loading} error={error} retry={refresh} /></Panel>

  if (!incidents.length) {
    return <Panel title="Incident queue" meta="0 active"><div className="calm">No active incidents. The queue is clear.</div></Panel>
  }

  return (
    <Panel title="Incident queue" meta={`${incidents.length} active · ranked by threat, then arrival`}>
      {actionError && <p className="error" role="alert">{actionError}</p>}
      <ul className="queue">
        {incidents.map((i) => {
          const m = levelMeta(i.level)
          const lit = !acked.has(i.id) && m.rank >= 2
          const isOpen = open === i.id
          return (
            <li key={i.id} className={`qrow sev-${m.sev} ${lit ? 'is-lit' : ''}`}>
              <button className="qrow-head" onClick={() => setOpen(isOpen ? null : i.id)} aria-expanded={isOpen}>
                <span className="q-mark" data-sev={m.sev} aria-hidden="true" />
                <span className="q-level">{m.label}</span>
                <span className="q-station">{SHORT[i.station_id] || i.station_id}</span>
                <span className="q-anom">{i.anomaly_type}</span>
                <span className="q-conf">{i.confidence?.replaceAll('_', ' ').toLowerCase()}</span>
                <span className="q-eta">T− {fmtDur(i.t_minus_seconds)}</span>
              </button>
              {isOpen && (
                <div className="qrow-detail">
                  <dl className="facts">
                    <div><dt>Incident</dt><dd className="mono">{i.id}</dd></div>
                    <div><dt>Opened</dt><dd>{fmtClock(i.opened_at)}</dd></div>
                    <div><dt>Last seen</dt><dd>{fmtClock(i.last_seen)}</dd></div>
                    <div><dt>Sources</dt><dd>{(i.sources || []).join(', ') || '—'}</dd></div>
                  </dl>
                  <Readings stationId={i.station_id} />
                  <div className="qrow-actions">
                    {lit && <button className="btn-ghost" onClick={() => setAcked((s) => new Set(s).add(i.id))}>Acknowledge</button>}
                    <button className="btn-danger" disabled={!!busy} onClick={() => close(i.id)}>{busy === i.id ? 'Closing…' : 'Close incident'}</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
