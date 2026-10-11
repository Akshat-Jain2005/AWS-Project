import { usePoll } from '../api'
import { conditionMeta, levelMeta } from '../format'

// Public, interactive advisory page — open to everyone, no sign-in required.
// It reads only the public /status feed (no controls, no audit trail).
const BADGE = { normal: 'normal', elevated: 'warning', warning: 'warning', critical: 'critical' }

function scrollToStations() {
  document.getElementById('stations')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Home() {
  const { data, error } = usePoll('/status', 5000)
  const status = error ? null : data
  const stations = status?.stations || []
  const hasReadings = stations.some((s) => s.updated_at)
  const cond = conditionMeta(hasReadings || status?.incident ? status?.overall : null)
  const shut = status && status.intake_status !== 'OPEN'

  return (
    <>
      <section className="site-hero">
        <h1>Bio-Sentinel</h1>
        <p className="site-tagline">
          A biomonitoring early-warning watch on the Yamuna — forecasting contamination
          before it reaches the Wazirabad intake.
        </p>
        <div className="site-hero-cta">
          <button type="button" className="site-scroll-link" onClick={scrollToStations}>
            See live corridor status ↓
          </button>
        </div>
      </section>

      <section className="site-condition" aria-label="Current river condition">
        <div>
          <div className={`site-cond-word sev-${cond.sev}`}>{cond.label}</div>
          <div className="site-cond-note">{cond.note}</div>
        </div>
        <div className="site-cond-intake">
          Wazirabad intake:{' '}
          <strong>{!status ? 'Unknown' : status.intake_status === 'DIVERTED_TO_BYPASS' ? 'Bypassed' : shut ? 'Closed' : 'Open'}</strong>
          {status?.deficit_mgd ? ` · −${status.deficit_mgd} MGD` : ''}
        </div>
      </section>

      <div className="site-sections">
        <h2 className="site-section-title" id="stations">Monitoring stations</h2>
        {error && <p className="site-cond-note">Live data is unavailable right now. Please check back shortly.</p>}
        <div className="site-grid">
          {stations.map((s) => {
            const meta = levelMeta(s.updated_at ? s.status : null)
            const sev = BADGE[meta.sev] || 'unknown'
            return (
              <div key={s.station_id} className="site-card">
                <div className="site-card-head">
                  <h3>{s.name || s.station_id}</h3>
                  <span className={`site-badge sev-${sev}`}>{meta.label}</span>
                </div>
                <div className="site-k">Un-ionized ammonia</div>
                <div className="site-v">{s.unionized_ammonia_mgl != null ? `${s.unionized_ammonia_mgl} mg/L` : '—'}</div>
              </div>
            )
          })}
          {!stations.length && !error && <p className="site-cond-note">Awaiting station telemetry…</p>}
        </div>

        <section className="site-cta">
          <h2 className="site-section-title">How it works</h2>
          <p>Bio-Sentinel watches the Panipat–Wazirabad corridor of the Yamuna, pairing living
            Daphnia biosensors with chemical readings to forecast a contamination plume's arrival at
            the Wazirabad intake. This advisory is open to everyone; operators sign in for the
            control console, and residents can create an account to follow the corridor.</p>
        </section>
      </div>
    </>
  )
}
