import hardwareNodeImg from '../assets/hardware-node.jpg'
import Biomonitor3DViewer from './Biomonitor3DViewer'

export default function Home({ onOpenAuth, onOpenDashboard }) {
  const scrollToDashboard = () => {
    if (onOpenDashboard) return onOpenDashboard()
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-page">
      {/* 1. Live Ticker / Alert Bar */}
      <div className="hero-ticker-bar" role="region" aria-label="Live river broadcast ticker">
        <div className="hero-ticker-inner">
          <span className="ticker-live-badge">
            <span className="ticker-live-dot" aria-hidden="true"></span>
            LIVE
          </span>
          <span className="ticker-text">
            Night discharges beat daylight sensors · Ammonia above 0.9 ppm shuts Delhi intakes · Heat makes ammonia more toxic · 110+ MGD deficit · Serverless on AWS
          </span>
        </div>
      </div>

      {/* 2. Main Hero Section */}
      <section className="hero-section" aria-label="Bio-Sentinel Overview">
        <div className="hero-container">
          {/* Left Column: Headlines & Actions */}
          <div className="hero-col-left">
            <div className="hero-badges-row">
              <span className="badge-hackathon">AWS ENVIRONMENTAL HACKATHON 2026</span>
              <span className="badge-track">HEAT & WATER TRACK</span>
            </div>

            <h1 className="hero-main-title">
              Living sensors that catch what chemical probes <span className="highlight-amber">miss.</span>
            </h1>

            <p className="hero-subtext">
              Bio-Sentinel monitors live water fleas in the Yamuna. When a toxin passes
              ordinary chemical probes, their swimming changes first. We turn that into an
              alert, a countdown to the intake, and a plan for the city.
            </p>

            <div className="hero-cta-group">
              <button
                type="button"
                className="btn-hero-primary"
                onClick={scrollToDashboard}
                id="hero-open-dashboard-btn"
              >
                Open live dashboard →
              </button>
              <button
                type="button"
                className="btn-hero-secondary"
                onClick={scrollToHowItWorks}
                id="hero-see-works-btn"
              >
                See how it works
              </button>
            </div>
          </div>

          {/* Right Column: Hardware Node Unit Image */}
          <div className="hero-col-right">
            <div className="hardware-display-card">
              <div className="hardware-card-topbar">
                <span className="hardware-station-label">STATION 01 / PANIPAT EDGE UNIT</span>
                <span className="hardware-live-tag">
                  <span className="ticker-live-dot" aria-hidden="true"></span>
                  LIVE TELEMETRY
                </span>
              </div>
              <div className="hardware-img-container">
                <img
                  src={hardwareNodeImg}
                  alt="Bio-Sentinel Yamuna Watch Panipat-01 Rugged Field Display"
                  className="hardware-screen-img"
                />
              </div>
              <div className="hardware-card-footer">
                <div className="hardware-param">
                  <span className="param-k">AMMONIA</span>
                  <span className="param-v">0.38 <span className="param-u">ppm</span></span>
                  <span className="param-tag tag-ok">OK</span>
                </div>
                <div className="hardware-param">
                  <span className="param-k">DAPHNIA STATUS</span>
                  <span className="param-v">ACTIVE <span className="param-u">STABLE</span></span>
                  <span className="param-tag tag-ok">NORMAL</span>
                </div>
                <div className="hardware-param">
                  <span className="param-k">CELLULAR GPS</span>
                  <span className="param-v">29.39°N <span className="param-u">76.97°E</span></span>
                  <span className="param-tag tag-conn">LINKED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2nd Page: The Gap — 1. Gap Content -> 2. Temperatures -> 3. Blackout Loop */}
      <section className="section-gap-page" id="gap" aria-label="The Gap: Chemical probes limitation">
        {/* 1. The Gap Heading & Side-by-Side Comparison Board */}
        <div className="gap-content-container">
          <div className="gap-header-wrap">
            <span className="gap-tag">THE GAP</span>
            <h2 className="gap-headline">
              Chemical probes only find<br />
              what they are told to look for.
            </h2>
            <p className="gap-subtext">
              Municipal sensors are tuned to known parameters like ammonia or pH. A new dye,
              a solvent, or a chemical cocktail can pass straight through while every light stays green.
            </p>
          </div>

          <div className="gap-comparison-container">
            {/* Left Card: Conventional Chemical Probe */}
            <div className="comparison-card card-conventional">
              <div className="comparison-card-topbar">
                <span>CONVENTIONAL CHEMICAL PROBE</span>
              </div>
              <div className="comparison-table-rows">
                <div className="comparison-row">
                  <span className="comp-param-label">Ammonia 0.38 ppm</span>
                  <span className="comp-status-badge badge-ok">OK</span>
                </div>
                <div className="comparison-row">
                  <span className="comp-param-label">pH 7.4</span>
                  <span className="comp-status-badge badge-ok">OK</span>
                </div>
                <div className="comparison-row">
                  <span className="comp-param-label">Temperature 32°C</span>
                  <span className="comp-status-badge badge-ok">OK</span>
                </div>
              </div>
              <div className="comparison-card-footer footer-all-clear">
                <div className="comp-footer-heading text-ok">All clear</div>
                <div className="comp-footer-sub">Blind to unknown dyes, solvents and chemical cocktails.</div>
              </div>
            </div>

            {/* Center VS Indicator */}
            <div className="comparison-vs-badge" aria-hidden="true">
              <span>VS</span>
            </div>

            {/* Right Card: Bio-Sentinel Living Sensor */}
            <div className="comparison-card card-biosentinel">
              <div className="comparison-card-topbar topbar-biosentinel">
                <span>BIO-SENTINEL LIVING SENSOR</span>
              </div>
              <div className="comparison-table-rows">
                <div className="comparison-row">
                  <span className="comp-param-label">Swim speed 38 mm/s</span>
                  <span className="comp-status-badge badge-alarm">ALARM</span>
                </div>
                <div className="comparison-row">
                  <span className="comp-param-label">Depth 12 cm (sinking)</span>
                  <span className="comp-status-badge badge-alarm">ALARM</span>
                </div>
                <div className="comparison-row">
                  <span className="comp-param-label">Erratic index 90</span>
                  <span className="comp-status-badge badge-alarm">ALARM</span>
                </div>
              </div>
              <div className="comparison-card-footer footer-toxin-alert">
                <div className="comp-footer-heading text-alarm">Toxin alert</div>
                <div className="comp-footer-sub">Every toxin class changes how the fleas swim, so we catch what probes miss.</div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Temperatures / Metric Cards Strip */}
        <div className="gap-metrics-strip-wrapper">
          <div className="gap-metrics-strip">
            <div className="gap-metric-card border-amber">
              <div className="gap-metric-val">45–48°C</div>
              <div className="gap-metric-desc">Peak Delhi summer heat</div>
            </div>
            <div className="gap-metric-card border-blue">
              <div className="gap-metric-val">0.9 ppm</div>
              <div className="gap-metric-desc">Ammonia limit at the water intakes</div>
            </div>
            <div className="gap-metric-card border-red">
              <div className="gap-metric-val">110+ MGD</div>
              <div className="gap-metric-desc">Drinking water deficit when intakes shut</div>
            </div>
          </div>
        </div>

        {/* 3. The Blackout Loop Ribbon Bar */}
        <div className="blackout-loop-bar" role="region" aria-label="The Blackout Loop">
          <div className="blackout-loop-inner">
            <span className="blackout-tag">THE BLACKOUT LOOP</span>
            <span className="blackout-step">LOW RIVER FLOW</span>
            <span className="blackout-arrow">→</span>
            <span className="blackout-step">NIGHT DISCHARGE</span>
            <span className="blackout-arrow">→</span>
            <span className="blackout-step">AMMONIA SPIKE</span>
            <span className="blackout-arrow">→</span>
            <span className="blackout-step">INTAKES SHUT</span>
            <span className="blackout-arrow">→</span>
            <span className="blackout-step">DELHI RUNS DRY</span>
          </div>
        </div>
      </section>

      {/* 3rd Page: The Sensor — Compact Biomonitor with Camera & 3D Interactive Model */}
      <section className="section-sensor-page" id="sensor" aria-label="The Sensor Biomonitor">
        <div className="sensor-page-container">
          {/* Left Column: Heading, Subtitle, and Numbered Steps */}
          <div className="sensor-col-left">
            <span className="sensor-page-tag">THE SENSOR</span>
            <h2 className="sensor-main-title">
              A compact biomonitor with<br />
              a camera and a scoring model.
            </h2>
            <p className="sensor-subtext">
              Water fleas are filter feeders that react to many kinds of toxins. A camera tracks how they swim, and our model scores it in real time.
            </p>

            <div className="sensor-steps-list">
              <div className="sensor-step-item">
                <div className="step-num-badge">1</div>
                <div className="step-text">Camera tracks speed, depth and erratic turns</div>
              </div>
              <div className="sensor-step-item">
                <div className="step-num-badge">2</div>
                <div className="step-text">Steady backlight keeps tracking clean</div>
              </div>
              <div className="sensor-step-item">
                <div className="step-num-badge">3</div>
                <div className="step-text">Live Daphnia magna in a flowing river sample</div>
              </div>
              <div className="sensor-step-item">
                <div className="step-num-badge">4</div>
                <div className="step-text">Edge unit sends readings to AWS</div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Interactive Biomonitor Viewer */}
          <div className="sensor-col-right">
            <Biomonitor3DViewer />
          </div>
        </div>
      </section>

      {/* 4th Page: How It Works & Roles with consistent white background */}
      <section className="section-how-it-works-page" id="how-it-works" aria-label="How it works">
        <div className="section-content-container">
          <div className="section-header-wrap">
            <span className="section-subtitle-tag">HOW IT WORKS</span>
            <h2 className="section-page-title">From one flea to one decision.</h2>
          </div>

          <div className="how-it-works-grid">
            <div className="process-step-card border-accent-blue">
              <div className="process-step-num num-blue">01</div>
              <h3 className="process-step-name">WATCH</h3>
              <p className="process-step-desc">
                Camera tracks swimming speed, depth and turns every few seconds.
              </p>
            </div>

            <div className="process-step-card border-accent-cyan">
              <div className="process-step-num num-cyan">02</div>
              <h3 className="process-step-name">SCORE</h3>
              <p className="process-step-desc">
                A model flags toxic behaviour. A heat-adjusted ammonia check adds chemistry.
              </p>
            </div>

            <div className="process-step-card border-accent-amber">
              <div className="process-step-num num-amber">03</div>
              <h3 className="process-step-name">PREDICT</h3>
              <p className="process-step-desc">
                A plume model counts down to the intake: T-minus 04h 18m (sample).
              </p>
            </div>

            <div className="process-step-card border-accent-red">
              <div className="process-step-num num-red">04</div>
              <h3 className="process-step-name">ACT</h3>
              <p className="process-step-desc">
                Operators approve the gate. Residents get Telegram and Amazon SNS alerts in English and Hindi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="section-roles-page" id="roles" aria-label="Platform Roles">
        <div className="section-content-container">
          <div className="section-header-wrap">
            <span className="section-subtitle-tag">ROLES</span>
            <h2 className="section-page-title">One system. Three doors.</h2>
          </div>

          <div className="roles-cards-grid">
            {/* Card 1: Public */}
            <div className="role-portal-card border-top-blue">
              <h3 className="role-portal-title text-blue">PUBLIC</h3>
              <ul className="role-feature-list bullet-blue">
                <li>Live river status & AWS map</li>
                <li>Water timings by ward</li>
                <li>Telegram & Amazon SNS alerts</li>
                <li>Delhi Jal Board advisory & intake forecast</li>
              </ul>
              <div className="role-portal-btns">
                <button
                  type="button"
                  className="btn-role-portal btn-portal-primary"
                  onClick={scrollToDashboard}
                >
                  Open live dashboard →
                </button>
              </div>
            </div>

            {/* Card 2: Reporters */}
            <div className="role-portal-card border-top-cyan">
              <h3 className="role-portal-title text-cyan">REPORTERS</h3>
              <ul className="role-feature-list bullet-blue">
                <li>Submit field samples</li>
                <li>Add photos and readings</li>
                <li>Help confirm incidents</li>
                <li>No sensor needed</li>
              </ul>
              <button
                type="button"
                className="btn-role-portal btn-portal-outline"
                onClick={() => onOpenAuth ? onOpenAuth('reporter') : scrollToDashboard()}
              >
                Report a sample
              </button>
            </div>

            {/* Card 3: Operators */}
            <div className="role-portal-card border-top-dark">
              <h3 className="role-portal-title text-dark">OPERATORS</h3>
              <ul className="role-feature-list bullet-dark">
                <li>Full command center</li>
                <li>Approve gate actions</li>
                <li>Send alerts and review reports</li>
                <li>Login with MFA</li>
              </ul>
              <button
                type="button"
                className="btn-role-portal btn-portal-dark"
                onClick={() => onOpenAuth ? onOpenAuth('operator') : scrollToDashboard()}
              >
                Operator login
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA River Warning Gradient Banner */}
      <section className="banner-river-warning" aria-label="Action Call to Action">
        <div className="banner-warning-inner">
          <h2 className="banner-warning-title">The river won't warn you. We will.</h2>
          <div className="banner-warning-actions">
            <button
              type="button"
              className="btn-banner-accent"
              onClick={scrollToDashboard}
            >
              Open live dashboard →
            </button>
            <button
              type="button"
              className="btn-banner-secondary"
              onClick={scrollToHowItWorks}
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="site-landing-footer-minimal">
        <div className="footer-minimal-inner">
          <span className="footer-min-brand">BIO-SENTINEL</span>
          <span className="footer-min-meta">AWS Environmental Hackathon 2026 / Heat & Water</span>
          <span className="footer-min-tech">Serverless on AWS</span>
        </div>
      </footer>
    </div>
  )
}

