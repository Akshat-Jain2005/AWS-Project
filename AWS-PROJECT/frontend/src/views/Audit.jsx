import { usePoll } from '../api'
import { Panel, ReadState } from '../ui'
import { fmtClock } from '../format'

const ACTION_SEV = (a) =>
  a.includes('SHUTDOWN') || a.includes('CRITICAL') ? 'critical'
    : a.includes('PENDING') || a.includes('DIVERT') ? 'warning'
    : a.includes('RESTORE') || a.includes('APPROVED') || a.includes('SENT') ? 'normal'
    : 'elevated'

const summarize = (d = {}) => {
  const bits = []
  if (d.station_id) bits.push(d.station_id)
  if (d.kind) bits.push(d.kind)
  if (d.sent != null) bits.push(`${d.sent} sent`)
  if (d.rationale) bits.push(`“${d.rationale}”`)
  if (d.new_status) bits.push(d.new_status)
  if (d.recipients != null) bits.push(`${d.recipients} recipients`)
  return bits.join(' · ')
}

export default function Audit() {
  const { data, loading, error, refresh } = usePoll('/audit', 8000)
  const entries = data || []
  return (
    <Panel title="Issuance log" meta="append-only · hash-chained" className="audit">
      <p className="audit-note">
        Every actuation and advisory is written once to a tamper-evident chain. Entries are never
        edited or removed.
      </p>
      <ReadState loading={loading} error={error} retry={refresh} />
      {!loading && !error && <ol className="ledger">
        {entries.map((e) => (
          <li key={e.audit_id} className={`ledger-row sev-${ACTION_SEV(e.action)}`}>
            <span className="led-time">{fmtClock(e.timestamp)}</span>
            <span className="led-mark" aria-hidden="true" />
            <span className="led-action">{e.action.replaceAll('_', ' ')}</span>
            <span className="led-actor">{e.actor}</span>
            <span className="led-detail">{summarize(e.detail)}</span>
            <span className="led-id mono">{e.audit_id}</span>
          </li>
        ))}
        {!entries.length && <li className="muted">No entries yet.</li>}
      </ol>}
    </Panel>
  )
}
