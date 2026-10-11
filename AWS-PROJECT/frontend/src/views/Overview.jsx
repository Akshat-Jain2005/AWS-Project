import { usePoll } from '../api'
import { Panel, TimeBar, ReadState } from '../ui'
import { fmtDur, levelMeta } from '../format'

const SHORT = {
  STATION_01_PANIPAT: 'Panipat I',
  STATION_02_PANIPAT: 'Panipat II',
  STATION_03_SONIPAT: 'Sonipat',
  STATION_04_PALLA: 'Palla',
  STATION_05_WAZIRABAD: 'Wazirabad',
}
const sevOf = (lvl) => levelMeta(lvl).sev
const healthSev = { NORMAL: 'normal', WARNING: 'warning', CRITICAL: 'critical' }

function Corridor({ stations, reaches }) {
  if (!stations?.length) return <div className="corridor-empty">Awaiting station telemetry…</div>
  const W = 1000, H = 210, y = 120
  const n = stations.length
  const xs = stations.map((_, i) => 70 + (i * (W - 140)) / Math.max(1, n - 1))
  const reachSev = (fromId) => {
    const r = reaches?.find((f) => f.properties.from_node === fromId)
    return r ? healthSev[r.properties.health_status] || 'normal' : 'normal'
  }
  return (
    <svg className="corridor" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="River corridor status, Panipat to Wazirabad intake">
      <text x="70" y="26" className="corridor-tick">UPSTREAM · PANIPAT</text>
      <text x={W - 70} y="26" className="corridor-tick end">WAZIRABAD INTAKE · DOWNSTREAM</text>
      {stations.slice(0, -1).map((s, i) => (
        <line key={s.station_id} x1={xs[i]} y1={y} x2={xs[i + 1]} y2={y}
              className={`reach sev-${reachSev(s.station_id)}`} />
      ))}
      {stations.map((s, i) => {
        const sev = sevOf(s.updated_at ? s.status : null)
        const active = sev !== 'normal'
        return (
          <g key={s.station_id} transform={`translate(${xs[i]}, ${y})`} className={`node sev-${sev}`}>
            <circle r="11" className={`node-dot ${active ? 'is-active' : ''}`} />
            {active && <circle r="20" className="node-halo" />}
            <text y="-26" className="node-name">{SHORT[s.station_id] || s.station_id}</text>
            <text y="42" className="node-state">{s.updated_at ? levelMeta(s.status).label : 'Awaiting telemetry'}</text>
          </g>
        )
      })}
      <path d={`M ${W - 60} ${y - 7} l 12 7 l -12 7`} className="flow-arrow" />
    </svg>
  )
}

export default function Overview({ status }) {
  const { data: health, error, loading, refresh } = usePoll('/river-health/yamuna-panipat', 8000)
  const inc = status?.incident
  const stations = status?.stations || []
  const rationing = status?.rationing || []

  return (
    <div className="overview">
      <Panel
        title="Lead forecast — plume arrival"
        meta="to Wazirabad intake"
        className="lead-forecast"
      >
        {!status ? <div className="calm">Waiting for current intake and forecast data.</div> : inc ? (
          <div className={`forecast sev-${levelMeta(inc.level).sev}`}>
            <div className="forecast-eta">
              <span className="eta-k">T-minus to intake</span>
              <strong className="eta-val">{fmtDur(inc.t_minus_seconds)}</strong>
            </div>
            <TimeBar seconds={inc.t_minus_seconds} max={6 * 3600} sev={levelMeta(inc.level).sev} />
            <dl className="forecast-facts">
              <div><dt>Origin station</dt><dd>{SHORT[inc.station_id] || inc.station_id}</dd></div>
              <div><dt>Diagnosis</dt><dd>{inc.anomaly_type}</dd></div>
              <div><dt>Threat level</dt><dd className={`sev-${levelMeta(inc.level).sev}`}>{levelMeta(inc.level).label}</dd></div>
              <div><dt>Confidence</dt><dd>{inc.confidence?.replaceAll('_', ' ').toLowerCase()}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="calm">{stations.some((station) => station.updated_at)
            ? 'No active threat reported to the intake.' : 'No station readings received yet. River condition is not confirmed.'}</div>
        )}
      </Panel>

      <Panel title="River corridor" meta="live station status" className="corridor-panel">
        <ReadState loading={loading} error={error} retry={refresh} />
        <div className="corridor-scroll" tabIndex={0} role="region" aria-label="River corridor diagram">
          <Corridor stations={stations} reaches={error ? [] : health?.features} />
        </div>
        <ol className="station-list" aria-label="Stations, upstream to downstream">
          {stations.map((station) => {
            const condition = levelMeta(station.updated_at ? station.status : null)
            return <li key={station.station_id}>
              <span>{SHORT[station.station_id] || station.station_id}</span>
              <span className={`sev-${condition.sev}`}>{condition.label}</span>
            </li>
          })}
        </ol>
      </Panel>

      {rationing.length > 0 && (
        <Panel title="Rationing in effect" meta={`intake closed · −${status.deficit_mgd} MGD`} className="rationing">
          <ul className="ration-list">
            {rationing.map((r) => (
              <li key={r.ward}><span>{r.ward}</span><span className="sched">{r.schedule}</span></li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
