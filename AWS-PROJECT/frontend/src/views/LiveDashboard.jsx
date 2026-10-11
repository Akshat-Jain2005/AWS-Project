import { useState } from 'react'
import { usePoll } from '../api'
import { conditionMeta, fmtDur, levelMeta } from '../format'
import { Panel, ReadState } from '../ui'
import { Corridor } from './Overview'
import CorridorMap from './CorridorMap'
import StationWatch from './StationWatch'
import { ReportForm, ReportList } from './Reports'
import Subscribe from './Subscribe'
import ToxicitySimulator from './ToxicitySimulator'
import { WARDS } from '../wards'
import logoMark from '../assets/logo-mark.png'

export default function LiveDashboard({ onBack, onOpenAuth }) {
  const feed = usePoll('/status', 5000)
  const reports = usePoll('/reports', 10000)
  const healthPoll = usePoll('/river-health/yamuna-panipat', 8000)
  const [view, setView] = useState('status') // 'status' | 'map' | 'toxicity' | 'report' | 'subscribe'
  const [ward, setWard] = useState(WARDS[0])
  const [selectedStationId, setSelectedStationId] = useState('')

  const status = feed.error ? null : feed.data
  const stations = status?.stations || []
  const hasReadings = stations.some((s) => s.updated_at)
  const cond = conditionMeta(hasReadings || status?.incident ? status?.overall : null)
  const schedule = status?.rationing?.find((r) => r.ward === ward)

  const handleStationSelect = (sid) => {
    setSelectedStationId(sid)
  }

  return (
    <div className="live-dash">
      {/* 1. Header Navigation Bar (synced with landing page header) */}
      <header className="live-dash-nav-wrap">
        <nav className="site-nav live-nav-bar" aria-label="Live dashboard navigation">
          <button
            type="button"
            className="dash-brand"
            onClick={onBack}
            aria-label="Back to Bio-Sentinel landing page"
          >
            <img className="site-logo" src={logoMark} alt="Bio-Sentinel logo" />
            <span className="site-brand-name">Bio-Sentinel</span>
          </button>
          <div className="live-nav-meta">
            <span className="live-nav-pill">
              <span className="ticker-live-dot" aria-hidden="true" />
              YAMUNA COMMAND CENTER
            </span>
          </div>
          <div className="site-nav-actions">
            <button
              type="button"
              className="site-nav-login"
              onClick={() => (onOpenAuth ? onOpenAuth('operator') : onBack?.())}
            >
              Operator login
            </button>
            <button type="button" className="site-nav-dashboard" onClick={onBack}>
              ← Back to site
            </button>
          </div>
        </nav>
      </header>

      {/* 2. Live Telemetry Ticker Ribbon */}
      <div className="hero-ticker-bar" role="region" aria-label="Live river broadcast ticker">
        <div className="hero-ticker-inner">
          <span className="ticker-live-badge">
            <span className="ticker-live-dot" aria-hidden="true" />
            LIVE
          </span>
          <span className="ticker-text">
            Yamuna River Corridor · Panipat → Wazirabad · Telemetry refresh 5s · Amazon Location Service V2 · Serverless on AWS
          </span>
        </div>
      </div>

      {/* 3. Main Dashboard Body */}
      <main className="public-dashboard">
        {/* Title & Overall Condition */}
        <div className="dash-hero-header">
          <div className="dash-badges-row">
            <span className="badge-hackathon">AWS ENVIRONMENTAL HACKATHON 2026</span>
            <span className="badge-track">HEAT & WATER TRACK</span>
          </div>
          <div className="public-heading">
            <div>
              <h1 className="dash-title">
                Yamuna River <span className="highlight-cyan">Water Watch</span>
              </h1>
              <p className="dash-subtitle">
                Live Daphnia biomonitoring corridor, AWS Location geospatial mapping, community water timings & field reports.
              </p>
            </div>
            <div className={`status-badge-lg sev-${cond.sev}`} role="status">
              <span className="status-badge-dot" aria-hidden="true" />
              <div>
                <span className="status-badge-k">CORRIDOR CONDITION</span>
                <strong className="status-badge-v">{cond.label}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Live Status, AWS Geospatial Map, Toxicity Simulator, Report Sample, Telegram & AWS SNS Alerts) */}
        <nav className="public-nav dash-tabs" aria-label="Dashboard views">
          <button
            type="button"
            className={view === 'status' ? 'is-active' : ''}
            onClick={() => setView('status')}
          >
            <span className="tab-icon">📡</span> Live status & corridor
          </button>
          <button
            type="button"
            className={view === 'map' ? 'is-active' : ''}
            onClick={() => setView('map')}
          >
            <span className="tab-icon">🗺️</span> AWS Geospatial Map
          </button>
          <button
            type="button"
            className={view === 'toxicity' ? 'is-active' : ''}
            onClick={() => setView('toxicity')}
          >
            <span className="tab-icon">🌡️</span> Heat Toxicity Simulator
          </button>
          <button
            type="button"
            className={view === 'report' ? 'is-active' : ''}
            onClick={() => setView('report')}
          >
            <span className="tab-icon">📝</span> Report a sample
          </button>
          <button
            type="button"
            className={view === 'subscribe' ? 'is-active' : ''}
            onClick={() => setView('subscribe')}
          >
            <span className="tab-icon">📲</span> Telegram & AWS SNS Alerts
          </button>
        </nav>

        {/* View: Report a Sample */}
        {view === 'report' && (
          <div className="dash-subview">
            <ReportForm />
          </div>
        )}

        {/* View: Telegram & AWS SNS Alerts */}
        {view === 'subscribe' && (
          <div className="dash-subview">
            <Subscribe />
          </div>
        )}

        {/* View: Heat & Ammonia Toxicity Simulator */}
        {view === 'toxicity' && (
          <div className="dash-subview">
            <ToxicitySimulator />
          </div>
        )}

        {/* View: Dedicated Full Geospatial Map */}
        {view === 'map' && (
          <div className="dash-subview">
            <Panel
              title="AWS Location Service · Yamuna Corridor Geospatial Map"
              meta="Amazon Location Service V2 · Panipat (Upstream) to Wazirabad Intake (Delhi)"
              actions={
                <span className="map-meta-chip">
                  5 Monitored Stations · Vector Basemap (ap-southeast-2)
                </span>
              }
            >
              <CorridorMap
                stations={stations}
                incident={status?.incident}
                intakeStatus={status?.intake_status}
                selectedStationId={selectedStationId}
                onSelectStation={handleStationSelect}
              />
            </Panel>
          </div>
        )}

        {/* View: Live Status Overview */}
        {view === 'status' && (
          <>
            <ReadState {...feed} retry={feed.refresh} />

            {/* Condition Banner */}
            <div className={`public-condition-banner sev-${cond.sev}`} role="status">
              <div className="cond-banner-lead">
                <span className="cond-banner-badge">{cond.label}</span>
                <p className="cond-banner-note">
                  {status?.incident ? (
                    <>
                      <strong>Pollution detected upstream at {status.incident.station_id}.</strong> Estimated time to Wazirabad intake:{' '}
                      <span className="highlight-amber">{fmtDur(status.incident.t_minus_seconds)}</span>.
                    </>
                  ) : (
                    cond.note
                  )}
                </p>
              </div>
              <div className="cond-banner-intake">
                <div>
                  <span className="cond-intake-k">WAZIRABAD INTAKE</span>
                  <strong className={`cond-intake-v gate-${status?.intake_status?.toLowerCase() || 'open'}`}>
                    {status?.intake_status?.replaceAll('_', ' ') || 'OPEN'}
                  </strong>
                </div>
                {status?.deficit_mgd > 0 && (
                  <div className="cond-deficit">
                    <span className="cond-intake-k">SUPPLY DEFICIT</span>
                    <strong className="cond-deficit-v">−{status.deficit_mgd} MGD</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Plume Dispersion Journey Tracker (When pollution is detected upstream) */}
            {status?.incident && (
              <div className="plume-journey-card" role="region" aria-label="Plume Dispersion Journey Tracker">
                <div className="plume-journey-header">
                  <div className="journey-lead">
                    <span className="journey-tag">HYDROLOGICAL PLUME MODEL</span>
                    <h3 className="journey-title">Active River Dispersion &amp; Arrival Journey</h3>
                  </div>
                  <div className="journey-speed-badge">
                    <span className="mono">v = 0.82 m/s (Summer Baseflow)</span>
                  </div>
                </div>

                <div className="plume-timeline">
                  {[
                    { id: 'STATION_01_PANIPAT', label: 'Panipat I', dist: '68 km' },
                    { id: 'STATION_02_PANIPAT', label: 'Panipat II', dist: '50 km' },
                    { id: 'STATION_03_SONIPAT', label: 'Sonipat', dist: '38.5 km' },
                    { id: 'STATION_04_PALLA', label: 'Palla (Delhi Border)', dist: '16.5 km' },
                    { id: 'STATION_05_WAZIRABAD', label: 'Wazirabad Intake', dist: '0 km' },
                  ].map((step, idx) => {
                    const isOrigin = status.incident.station_id === step.id
                    const isPassed = idx <= ['STATION_01_PANIPAT', 'STATION_02_PANIPAT', 'STATION_03_SONIPAT', 'STATION_04_PALLA', 'STATION_05_WAZIRABAD'].indexOf(status.incident.station_id)
                    const isTarget = step.id === 'STATION_05_WAZIRABAD'
                    return (
                      <div
                        key={step.id}
                        className={`timeline-step ${isOrigin ? 'is-origin' : ''} ${isPassed ? 'is-passed' : 'is-pending'}`}
                      >
                        <div className="step-point">
                          <span className="step-dot" />
                          {isOrigin && <span className="step-halo" />}
                        </div>
                        <div className="step-info">
                          <strong className="step-name">{step.label}</strong>
                          <span className="step-dist mono">{step.dist}</span>
                          {isOrigin && <span className="step-flag origin-flag">Plume Origin</span>}
                          {isTarget && (
                            <span className="step-flag eta-flag">
                              ETA: {fmtDur(status.incident.t_minus_seconds)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Public Grid: Threat Corridor & Water Timings */}
            <div className="public-grid">
              {/* River Threat Corridor */}
              <Panel
                title="River threat corridor"
                meta="Panipat → Wazirabad"
                actions={
                  <button
                    type="button"
                    className="btn-dash-secondary"
                    onClick={() => setView('map')}
                  >
                    🗺️ Open AWS Map →
                  </button>
                }
              >
                <div className="public-corridor">
                  <Corridor stations={stations} reaches={healthPoll.data?.features} />
                </div>

                <ul className="public-stations-list">
                  {stations.map((s) => {
                    const sm = levelMeta(s.updated_at ? s.status : null)
                    const isSelected = selectedStationId === s.station_id
                    return (
                      <li
                        key={s.station_id}
                        className={`station-row-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleStationSelect(s.station_id)}
                      >
                        <div className="station-row-left">
                          <span className={`station-dot sev-${sm.sev}`} />
                          <strong>{s.name}</strong>
                          {s.station_id === 'STATION_05_WAZIRABAD' && (
                            <span className="station-role-tag">Delhi Intake</span>
                          )}
                        </div>
                        <div className="station-row-right">
                          <span className={`status-pill sev-${sm.sev}`}>
                            {s.updated_at ? sm.label : 'Awaiting telemetry'}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <p className="hint">
                  Telemetry updates every 5 seconds. Click any station to inspect its live chemical and Daphnia swimming traces below.
                </p>
              </Panel>

              {/* Water Timings Card */}
              <Panel title="Water timings near you" meta="Delhi Jal Board Advisory">
                <label className="field-block">
                  <span>Select your ward</span>
                  <select
                    className="ward-select"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                  >
                    {WARDS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="ward-schedule-card">
                  <span className="ward-card-label">CURRENT ADVISORY FOR</span>
                  <h3 className="ward-name-title">{ward}</h3>
                  <div className="ward-schedule-box">
                    <p className="ward-schedule-text">
                      {!status
                        ? 'Current schedule unavailable.'
                        : schedule
                          ? schedule.schedule
                          : 'No active rationing schedule reported for this ward. Regular DJB supply.'}
                    </p>
                  </div>
                  {schedule && (
                    <p className="hint">
                      Configured advisory schedule; please confirm with your local DJB water tanker kiosk.
                    </p>
                  )}
                </div>

                <div className="intake-status-summary">
                  <div className="intake-summary-row">
                    <span className="summary-k">Intake Gate</span>
                    <strong className={`summary-v gate-${status?.intake_status?.toLowerCase() || 'open'}`}>
                      {status?.intake_status?.replaceAll('_', ' ') || 'OPEN'}
                    </strong>
                  </div>
                  {status?.deficit_mgd > 0 && (
                    <div className="intake-summary-row">
                      <span className="summary-k">Supply Deficit</span>
                      <strong className="summary-v deficit">−{status.deficit_mgd} MGD</strong>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-dash-primary"
                  onClick={() => setView('subscribe')}
                >
                  Get Telegram & AWS SNS alerts →
                </button>
              </Panel>
            </div>

            {/* Station Watch (Living Daphnia & Chemical Telemetry) */}
            <StationWatch stations={stations} selectedStationId={selectedStationId} />

            {/* Verified Field Reports Panel */}
            <Panel
              title="Verified field reports"
              meta="Community water observations"
              actions={
                <button
                  type="button"
                  className="btn-dash-secondary"
                  onClick={() => setView('report')}
                >
                  + Report a water sample
                </button>
              }
            >
              <ReadState {...reports} retry={reports.refresh} />
              {!reports.error && <ReportList rows={reports.data || []} />}
              {!reports.loading && !reports.error && !reports.data?.length && (
                <p className="muted">No approved reports yet.</p>
              )}
            </Panel>
          </>
        )}

        {/* Minimal Footer synced with Landing Page */}
        <footer className="dashboard-footer-synced">
          <div className="dash-footer-inner">
            <span className="dash-footer-brand">BIO-SENTINEL · YAMUNA RIVER DEFENSE</span>
            <span className="dash-footer-meta">
              AWS Environmental Hackathon 2026 · Powered by Amazon Location Service & Serverless
            </span>
            <span className="dash-footer-disclaimer">
              Monitoring is an advisory. Follow local water authority guidance.
            </span>
          </div>
        </footer>
      </main>
    </div>
  )
}
