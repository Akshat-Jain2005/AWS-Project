import { useState } from 'react'
import { usePoll } from '../api'
import { fmtDur } from '../format'
import CorridorMap from './CorridorMap'
import StationWatch from './StationWatch'
import logoMark from '../assets/logo-mark.png'

const DEFAULT_STATIONS = [
  {
    id: 'STATION_01_PANIPAT',
    shortName: 'Panipat I',
    fullName: 'Panipat Upstream Drain Outfall',
    behavior: 'Fleas sinking, depth 12 cm',
    status: 'CRITICAL',
    sev: 'critical',
    circleClass: 'circle-critical',
    badgeClass: 'badge-critical',
  },
  {
    id: 'STATION_02_PANIPAT',
    shortName: 'Panipat II',
    fullName: 'Panipat Industrial Outfall',
    behavior: 'Erratic swimming, index 90',
    status: 'CRITICAL',
    sev: 'critical',
    circleClass: 'circle-critical',
    badgeClass: 'badge-critical',
  },
  {
    id: 'STATION_03_SONIPAT',
    shortName: 'Sonipat',
    fullName: 'Sonipat Industrial Cluster',
    behavior: 'Fleas slightly slower',
    status: 'ELEVATED',
    sev: 'elevated',
    circleClass: 'circle-elevated',
    badgeClass: 'badge-elevated',
  },
  {
    id: 'STATION_04_PALLA',
    shortName: 'Palla',
    fullName: 'Palla Delhi-Haryana Entry Point',
    behavior: 'Swimming normally',
    status: 'NORMAL',
    sev: 'normal',
    circleClass: 'circle-normal',
    badgeClass: 'badge-normal',
  },
  {
    id: 'STATION_05_WAZIRABAD',
    shortName: 'Wazirabad',
    fullName: 'Wazirabad DJB Intake Reservoir',
    isDelhiIntake: true,
    behavior: 'Swimming normally',
    status: 'NORMAL',
    sev: 'normal',
    circleClass: 'circle-normal',
    badgeClass: 'badge-normal',
  },
]

const WARDS_ADVISORY = [
  { name: 'Civil Lines', advisory: 'Supply may be affected in about 8 hours. Store water safely.' },
  { name: 'Karol Bagh', advisory: 'Supply may be affected in about 8 hours. Store water safely.' },
  { name: 'Sangam Vihar', advisory: 'Supply may be affected in about 8 hours. Store water safely.' },
  { name: 'Kusumpur Pahadi', advisory: 'Supply may be affected in about 8 hours. Store water safely.' },
]

export default function PublicDashboard({ onBack, onOpenAuth, user, onSignOut }) {
  const feed = usePoll('/status', 5000)
  const [selectedStationId, setSelectedStationId] = useState('STATION_02_PANIPAT')
  const [showLiveTraces, setShowLiveTraces] = useState(true)
  const [showMap, setShowMap] = useState(true)

  const status = feed.error ? null : feed.data
  const member = Boolean(user?.role && user.role !== 'public')

  // Check if live incident is present or use sample incident
  const incident = status?.incident
  const intakeStatus = status?.intake_status?.replaceAll('_', ' ') || 'OPEN'
  const isIntakeOpen = intakeStatus === 'OPEN'

  // Map station telemetry if live status is available
  const stations = DEFAULT_STATIONS.map((ds) => {
    const liveMatch = status?.stations?.find((s) => s.station_id === ds.id)
    if (liveMatch && liveMatch.updated_at) {
      let st = liveMatch.status.toUpperCase()
      let circle = st === 'CRITICAL' ? 'circle-critical' : st === 'ELEVATED' || st === 'WARNING' ? 'circle-elevated' : 'circle-normal'
      let badge = st === 'CRITICAL' ? 'badge-critical' : st === 'ELEVATED' || st === 'WARNING' ? 'badge-elevated' : 'badge-normal'
      return {
        ...ds,
        status: st,
        circleClass: circle,
        badgeClass: badge,
      }
    }
    return ds
  })

  // Format T-Minus timer
  const tMinusText = incident
    ? `T-MINUS ${fmtDur(incident.t_minus_seconds)}`
    : 'T-MINUS 08H 24M (SAMPLE)'

  const conditionText = incident ? 'Alert' : (status?.overall === 'CRITICAL' ? 'Alert' : 'Alert')

  return (
    <div className="yww-page">
      {/* 1. Clean Top Header Bar */}
      <header className="yww-header">
        <div className="yww-header-inner">
          {/* Left Brand */}
          <div className="yww-brand" onClick={onBack} role="button" tabIndex={0}>
            <img className="yww-logo" src={logoMark} alt="Bio-Sentinel logo" />
            <span className="yww-brand-title">Bio-Sentinel</span>
          </div>

          {/* Center Yamuna Water Watch Pill */}
          <div className="yww-header-center">
            <span className="yww-center-pill">
              <span className="yww-blue-dot" />
              YAMUNA WATER WATCH
            </span>
          </div>

          {/* Right Nav Actions */}
          <div className="yww-header-actions">
            <span className="yww-public-chip">PUBLIC VIEW · READ ONLY</span>

            {member && (
              <span className="site-userchip" title={user.email || user.name}>
                👤 {user.name || user.email?.split('@')[0] || 'Member'}
              </span>
            )}

            <button
              type="button"
              className="yww-btn-operator"
              onClick={() => onOpenAuth ? onOpenAuth('operator') : null}
            >
              Operator login
            </button>

            {member && onSignOut && (
              <button type="button" className="yww-btn-signout" onClick={onSignOut}>
                Sign out
              </button>
            )}

            <button type="button" className="yww-btn-back" onClick={onBack}>
              ← Back to site
            </button>
          </div>
        </div>
      </header>

      {/* 2. Live River Corridor Broadcast Strip */}
      <div className="yww-ticker-ribbon" role="region" aria-label="Live river broadcast status">
        <div className="yww-ticker-content">
          <span className="yww-live-tag">
            <span className="yww-live-dot" aria-hidden="true" />
            LIVE
          </span>
          <span className="yww-ticker-text">
            Yamuna River Corridor · Panipat → Wazirabad · Telemetry refresh 5s · Amazon Location Service · Serverless on AWS
          </span>
        </div>
      </div>

      {/* 3. Main Body Container */}
      <main className="yww-container">
        {/* Hero Section */}
        <div className="yww-hero">
          <div className="yww-hero-left">
            <div className="yww-badges">
              <span className="yww-hackathon-badge">AWS ENVIRONMENTAL HACKATHON 2026</span>
              <span className="yww-track-badge">HEAT & WATER TRACK</span>
            </div>

            <h1 className="yww-title">
              Yamuna River <span className="yww-title-highlight">Water</span>
              <br />
              <span className="yww-title-highlight">Watch</span>
            </h1>

            <p className="yww-subtitle">
              Live Daphnia biomonitoring, geospatial mapping, community water timings and verified field reports. Updated every 5 seconds. View only.
            </p>
          </div>

          {/* Right Corridor Condition Card */}
          <div className="yww-hero-right">
            <div className="yww-condition-card" role="status">
              <span className="yww-cond-label">CORRIDOR CONDITION</span>
              <div className="yww-cond-value alert">
                {conditionText}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Alert Banner Card */}
        <section className="yww-alert-banner" aria-label="Corridor contamination alert">
          <div className="yww-alert-lead">
            <span className="yww-alert-tag">ALERT</span>
            <p className="yww-alert-text">
              {incident
                ? `Toxic pollution suspected upstream at ${incident.station_id}. The Wazirabad intake may be affected in about ${fmtDur(incident.t_minus_seconds)} (estimate). Sensor alert, not yet confirmed.`
                : 'Toxic pollution suspected upstream at Panipat. The Wazirabad intake may be affected in about 8 hours (estimate). Sensor alert, not yet confirmed.'}
            </p>
          </div>

          <div className="yww-alert-intake">
            <span className="yww-intake-label">WAZIRABAD INTAKE</span>
            <span className={`yww-intake-status ${isIntakeOpen ? 'open' : 'closed'}`}>
              {intakeStatus}
            </span>
            <span className="yww-intake-time">{tMinusText}</span>
          </div>
        </section>

        {/* 5. Interactive AWS Location Service Geospatial Map */}
        <section className="yww-card yww-map-card" aria-label="AWS Geospatial Corridor Map">
          <div className="yww-card-head" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.85rem', flexWrap: 'wrap' }}>
              <h2 className="yww-card-title">Geospatial River Map</h2>
              <span className="yww-corridor-sub">Amazon Location Service V2 · Panipat (Upstream) to Wazirabad Intake (Delhi)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="yww-map-badge">
                5 Monitored Stations · Vector Basemap (ap-southeast-2)
              </span>
              <button
                type="button"
                className="btn-dash-secondary"
                onClick={() => setShowMap((v) => !v)}
                style={{ fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}
              >
                {showMap ? 'Hide map' : 'Show map'}
              </button>
            </div>
          </div>

          {showMap && (
            <div className="yww-map-wrapper">
              <CorridorMap
                stations={status?.stations?.length ? status.stations : stations}
                incident={incident}
                intakeStatus={intakeStatus}
                selectedStationId={selectedStationId}
                onSelectStation={(id) => setSelectedStationId(id)}
              />
            </div>
          )}
        </section>

        {/* 6. Main 2-Column Grid */}
        <div className="yww-main-grid">
          {/* Left Column: River Threat Corridor */}
          <div className="yww-card yww-corridor-card">
            <div className="yww-card-head">
              <h2 className="yww-card-title">River threat corridor</h2>
              <span className="yww-corridor-sub">Panipat → Wazirabad</span>
            </div>

            {/* Progression Diagram */}
            <div className="yww-progression">
              <div className="yww-progression-meta">
                <span>UPSTREAM · PANIPAT</span>
                <span>WAZIRABAD INTAKE · DOWNSTREAM</span>
              </div>

              <div className="yww-timeline-track">
                <div className="yww-track-line" />
                <div className="yww-timeline-nodes">
                  {stations.map((st) => (
                    <div
                      key={st.id}
                      className={`yww-node ${selectedStationId === st.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedStationId(st.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="yww-node-name">{st.shortName}</div>
                      <div className={`yww-node-circle ${st.circleClass}`} />
                      <div className="yww-node-desc">{st.behavior}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stacked Station Rows */}
            <div className="yww-stations-list">
              {stations.map((st) => (
                <div
                  key={st.id}
                  className={`yww-station-row ${selectedStationId === st.id ? 'is-active-row' : ''}`}
                  onClick={() => setSelectedStationId(st.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="yww-station-name-wrap">
                    <span className="yww-station-name">{st.fullName}</span>
                    {st.isDelhiIntake && (
                      <span className="yww-intake-badge">DELHI INTAKE</span>
                    )}
                  </div>
                  <div className="yww-station-flea">{st.behavior}</div>
                  <div className={`yww-station-badge ${st.badgeClass}`}>{st.status}</div>
                </div>
              ))}
            </div>

            <p className="yww-footer-hint">
              Telemetry updates every 5 seconds. Live traces for the Panipat Industrial Outfall station are shown below.
            </p>
          </div>

          {/* Right Column: Water timings by ward */}
          <div className="yww-card yww-timings-card">
            <div className="yww-card-head">
              <h2 className="yww-card-title">Water timings by ward</h2>
            </div>
            <span className="yww-timings-sub">Delhi Jal Board Advisory</span>

            <span className="yww-advisory-label">ADVISORY FOR ALL WARDS</span>

            <div className="yww-wards-list">
              {WARDS_ADVISORY.map((w) => (
                <div key={w.name} className="yww-ward-item">
                  <div className="yww-ward-name">{w.name}</div>
                  <div className="yww-ward-desc">{w.advisory}</div>
                </div>
              ))}
            </div>

            <p className="yww-timings-note">
              Timings will update here if the intake is closed.
            </p>

            <div className="yww-gate-footer">
              <span className="yww-gate-title">Intake gate</span>
              <span className="yww-gate-status">{intakeStatus}</span>
            </div>
          </div>
        </div>

        {/* 6. Live Biomonitor & Chemical Waveform Traces Tray */}
        <section className="yww-station-inspect">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Live Station Traces &amp; Biological Signals
              </h3>
              <p style={{ color: '#94a3b8', margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                Observing live Daphnia magna swim velocity, erratic index and ammonia ppm at {stations.find((s) => s.id === selectedStationId)?.fullName || 'Panipat Industrial Outfall'}
              </p>
            </div>
            <button
              type="button"
              className="btn-dash-secondary"
              onClick={() => setShowLiveTraces((v) => !v)}
              style={{ fontSize: '0.85rem' }}
            >
              {showLiveTraces ? 'Hide live traces' : 'Inspect live traces'}
            </button>
          </div>

          {showLiveTraces && (
            <StationWatch
              stations={status?.stations || []}
              selectedStationId={selectedStationId}
            />
          )}
        </section>
      </main>
    </div>
  )
}
