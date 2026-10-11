import { useEffect, useState } from 'react'
import { api } from '../api'
import { Panel } from '../ui'

export default function ToxicitySimulator() {
  const [ammonia, setAmmonia] = useState(1.2)
  const [ph, setPh] = useState(7.8)
  const [temp, setTemp] = useState(38)
  const [assessment, setAssessment] = useState(null)
  const [curve, setCurve] = useState([])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api(`/toxicity/assess?ammonia_ppm=${ammonia}&ph=${ph}&temp_c=${temp}`, { auth: false }),
      api(`/toxicity/heat-curve?ammonia_ppm=${ammonia}&ph=${ph}`, { auth: false }),
    ])
      .then(([ass, crv]) => {
        if (cancelled) return
        setAssessment(ass)
        setCurve(crv.points || [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [ammonia, ph, temp])

  const bandSev =
    assessment?.band === 'DANGEROUS'
      ? 'critical'
      : assessment?.band === 'ELEVATED'
        ? 'warning'
        : 'normal'

  // SVG dimensions for temperature vs un-ionized ammonia curve
  const W = 460
  const H = 160
  const padL = 40
  const padR = 20
  const padT = 20
  const padB = 30

  const maxUia = Math.max(...curve.map((p) => p.unionized_ammonia_mgl), 0.1)
  const points = curve
    .map((p) => {
      const x = padL + ((p.temperature_c - 15) / 35) * (W - padL - padR)
      const y = H - padB - (p.unionized_ammonia_mgl / maxUia) * (H - padT - padB)
      return `${x},${y}`
    })
    .join(' ')

  const currentX = padL + ((temp - 15) / 35) * (W - padL - padR)
  const currentY = assessment
    ? H - padB - (assessment.unionized_ammonia_mgl / maxUia) * (H - padT - padB)
    : H - padB

  return (
    <div className="toxicity-sim-card">
      <Panel
        title="Heat & Ammonia Toxicity Simulator"
        meta="Emerson–Erickson pKa Thermodynamic Model · Heat & Water Track"
        actions={<span className="sim-formula-chip">UIA = Total NH₃ · [1 / (10^(pKa-pH) + 1)]</span>}
      >
        <div className="sim-layout">
          {/* Controls Column */}
          <div className="sim-controls-col">
            <p className="sim-intro">
              Total ammonia chemical probes only detect gross nitrogen. As river temperatures soar
              to <strong>45–48°C</strong> in Delhi's summer, ammonia dissociates into{' '}
              <strong>Un-ionized Ammonia (NH₃)</strong>—up to <strong>4.2× deadlier</strong> to
              biological water life.
            </p>

            <div className="sim-slider-group">
              <div className="sim-slider-header">
                <span className="slider-label">Water Temperature</span>
                <span className="slider-val text-amber">{temp}°C</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="1"
                value={temp}
                onChange={(e) => setTemp(Number(e.target.value))}
                className="sim-slider slider-temp"
              />
              <div className="slider-ticks">
                <span>15°C (Winter)</span>
                <span>25°C (Lab baseline)</span>
                <span>48°C (Peak Summer)</span>
              </div>
            </div>

            <div className="sim-slider-group">
              <div className="sim-slider-header">
                <span className="slider-label">Total Ammonia (Chemical Probe)</span>
                <span className="slider-val text-cyan">{ammonia.toFixed(2)} ppm</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.05"
                value={ammonia}
                onChange={(e) => setAmmonia(Number(e.target.value))}
                className="sim-slider slider-ammonia"
              />
              <div className="slider-ticks">
                <span>0.2 ppm (Clear)</span>
                <span>0.9 ppm (Intake limit)</span>
                <span>5.0 ppm (Severe spike)</span>
              </div>
            </div>

            <div className="sim-slider-group">
              <div className="sim-slider-header">
                <span className="slider-label">River pH Level</span>
                <span className="slider-val text-blue">{ph.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="6.5"
                max="9.0"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(Number(e.target.value))}
                className="sim-slider slider-ph"
              />
              <div className="slider-ticks">
                <span>6.5 (Acidic)</span>
                <span>7.5 (Neutral)</span>
                <span>9.0 (Alkaline industrial)</span>
              </div>
            </div>

            <div className="sim-presets-row">
              <span className="presets-label">Scenarios:</span>
              <button
                type="button"
                className="btn-preset"
                onClick={() => {
                  setTemp(46)
                  setAmmonia(1.8)
                  setPh(8.2)
                }}
              >
                🔥 Delhi Summer Outbreak
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={() => {
                  setTemp(20)
                  setAmmonia(0.6)
                  setPh(7.2)
                }}
              >
                ❄️ Winter Flow
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={() => {
                  setTemp(35)
                  setAmmonia(0.85)
                  setPh(7.6)
                }}
              >
                ⚡ Wazirabad Intake Threshold
              </button>
            </div>
          </div>

          {/* Results & Interactive Curve Column */}
          <div className="sim-results-col">
            <div className={`sim-metric-card sev-${bandSev}`}>
              <div className="sim-metric-top">
                <span className="sim-metric-k">BIOLOGICAL THREAT LEVEL</span>
                <span className={`sim-band-pill sev-${bandSev}`}>
                  {assessment?.band || 'CALCULATING'}
                </span>
              </div>
              <div className="sim-metric-main">
                <span className="sim-uia-val">
                  {assessment ? assessment.unionized_ammonia_mgl.toFixed(4) : '—'}{' '}
                  <span className="sim-unit">mg/L UIA</span>
                </span>
              </div>
              <div className="sim-multiplier-row">
                <span className="mult-icon">📈</span>
                <span className="mult-text">
                  Toxicity is <strong>{assessment?.heat_multiplier_vs_25c || 1}× higher</strong> than
                  at standard 25°C baseline due to temperature dissociation.
                </span>
              </div>
            </div>

            {/* SVG Thermodynamic Response Curve */}
            <div className="sim-chart-card">
              <div className="sim-chart-head">
                <span className="chart-title">Heat Dissociation Curve (15°C → 50°C)</span>
                <span className="chart-sub">Un-ionized NH₃ response</span>
              </div>

              <div className="sim-svg-wrapper">
                <svg viewBox={`0 0 ${W} ${H}`} className="sim-svg-chart" role="img">
                  {/* Danger zone background band */}
                  <rect
                    x={padL}
                    y={padT}
                    width={W - padL - padR}
                    height={(H - padT - padB) * 0.4}
                    fill="rgba(239, 68, 68, 0.08)"
                  />
                  <line
                    x1={padL}
                    y1={padT + (H - padT - padB) * 0.4}
                    x2={W - padR}
                    y2={padT + (H - padT - padB) * 0.4}
                    stroke="rgba(239, 68, 68, 0.4)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={W - padR - 6}
                    y={padT + (H - padT - padB) * 0.4 - 5}
                    textAnchor="end"
                    className="chart-danger-label"
                  >
                    DANGEROUS &gt; 0.05 mg/L
                  </text>

                  {/* Grid Lines */}
                  <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(255,255,255,0.15)" />
                  <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="rgba(255,255,255,0.15)" />

                  {/* Curve Line */}
                  {curve.length > 0 && (
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Current Operating Point Pin */}
                  {assessment && (
                    <g>
                      <circle cx={currentX} cy={currentY} r="7" className="curve-pulse-ring" />
                      <circle cx={currentX} cy={currentY} r="4.5" fill="#f59e0b" />
                      <line
                        x1={currentX}
                        y1={currentY}
                        x2={currentX}
                        y2={H - padB}
                        stroke="#f59e0b"
                        strokeDasharray="2 3"
                        opacity="0.7"
                      />
                    </g>
                  )}

                  {/* Axis Ticks */}
                  <text x={padL} y={H - 10} className="chart-axis-label">15°C</text>
                  <text x={padL + (W - padL - padR) * 0.5} y={H - 10} textAnchor="middle" className="chart-axis-label">32.5°C</text>
                  <text x={W - padR} y={H - 10} textAnchor="end" className="chart-axis-label">50°C</text>
                </svg>
              </div>

              <div className="sim-chart-legend">
                <span className="legend-chip">
                  <span className="legend-box safe" /> &lt;0.02 mg/L Safe
                </span>
                <span className="legend-chip">
                  <span className="legend-box warning" /> 0.02–0.05 mg/L Elevated
                </span>
                <span className="legend-chip">
                  <span className="legend-box danger" /> &gt;0.05 mg/L Dangerous
                </span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
