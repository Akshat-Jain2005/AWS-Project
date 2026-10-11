import { useRef, useState } from 'react'
import { api, usePoll } from '../api'
import { Panel, ReadState } from '../ui'
import { WARDS } from '../wards'

const TELEGRAM_CHANNEL_URL = 'https://t.me/+6woVGWzSUv01NWNl'

export default function Subscribe() {
  const [phone, setPhone] = useState('')
  const [selectedWard, setSelectedWard] = useState(WARDS[0])
  const [language, setLanguage] = useState('en')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmedData, setConfirmedData] = useState(null)
  const lock = useRef(false)

  // Poll status to get current rationing schedule for the ward
  const statusPoll = usePoll('/status', 10000)
  const configPoll = usePoll('/subscribe/config', 15000)
  const schedule = statusPoll.data?.rationing?.find((r) => r.ward === selectedWard)
  const metrics = configPoll.data?.community_metrics
  const [aiPreviewLang, setAiPreviewLang] = useState('en') // 'en' | 'hi'

  async function handleSnsSubscribe(e) {
    e.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const alertTypes = form.getAll('alert_types')
    const consent = form.get('consent') === 'on'

    try {
      const resp = await api('/subscribe', {
        method: 'POST',
        body: {
          phone,
          ward: selectedWard,
          language,
          alert_types: alertTypes.length > 0 ? alertTypes : ['pollution', 'rationing', 'all_clear'],
          consent,
          direct: true, // Instant Amazon SNS subscription without SMS OTP hurdle
        },
      })
      setSubscribed(true)
      setConfirmedData(resp)
    } catch (err) {
      setError(err.message || 'Unable to subscribe via Amazon SNS. Please try again.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <div className="subscribe-layout">
      {/* Channel 1: Official Telegram Emergency Alerts */}
      <Panel
        title="Official Telegram Channel"
        meta="Instant broadcasts · Zero SMS delay"
        actions={<span className="channel-live-chip"><span className="ticker-live-dot" aria-hidden="true" />CONNECTED</span>}
      >
        <div className="telegram-channel-card">
          <div className="telegram-header-row">
            <div className="telegram-avatar">
              <span className="telegram-logo-icon">✈️</span>
            </div>
            <div>
              <h3 className="telegram-channel-title">Bio-Sentinel | Yamuna Water Alerts</h3>
              <p className="telegram-handle">@biosentinel_alert_bot · Official Channel</p>
            </div>
          </div>

          <p className="telegram-desc">
            Direct real-time alerts broadcast whenever ammonia plumes exceed 0.9 ppm, Wazirabad intake gates close,
            or emergency clean water tankers are routed to your ward.
          </p>

          <ul className="telegram-perks-list">
            <li>⚡ <strong>Zero SMS latency:</strong> Instant push notifications to your phone or desktop</li>
            <li>⏱️ <strong>Live T-Minus countdown:</strong> Real-time plume travel arrival countdowns</li>
            <li>💧 <strong>Clean tanker dispatches:</strong> Ward-by-ward rationing schedules and tanker points</li>
            <li>🔒 <strong>Private & Anonymous:</strong> No mobile number disclosure needed</li>
          </ul>

          <a
            href={TELEGRAM_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-telegram-primary"
          >
            Join Official Telegram Channel ↗
          </a>
        </div>
      </Panel>

      {/* Channel 2: Amazon SNS Direct SMS Alerts */}
      <Panel
        title="Amazon SNS Emergency Alerts"
        meta="AWS SNS direct dispatch · No OTP verification required"
      >
        <ReadState {...statusPoll} retry={statusPoll.refresh} />

        {subscribed ? (
          <div className="subscribe-success-card" role="status">
            <div className="success-icon-badge">✓</div>
            <h3>Amazon SNS Alerts Activated</h3>
            <p className="success-phone-text">
              Registered Mobile: <strong>{confirmedData?.phone || phone}</strong>
            </p>
            <p className="success-ward-text">
              Monitoring Ward: <strong>{confirmedData?.ward || selectedWard}</strong>
            </p>

            <div className="success-schedule-box">
              <span className="schedule-box-label">CURRENT ADVISORY SCHEDULE FOR {selectedWard}</span>
              <p className="schedule-box-val">
                {schedule ? schedule.schedule : 'Regular supply schedule in effect. No active rationing.'}
              </p>
            </div>

            <p className="success-provider-note">
              Delivered via Amazon Simple Notification Service (Sender ID: <code>BIOSNT</code>).
              You will receive automated alerts when ammonia spikes or intake rationing occurs in your ward.
            </p>

            <button
              type="button"
              className="btn-dash-secondary"
              onClick={() => {
                setSubscribed(false)
                setPhone('')
              }}
            >
              Register another number
            </button>
          </div>
        ) : (
          <form onSubmit={handleSnsSubscribe} className="community-form subscribe-form">
            <p className="subscribe-intro-text">
              Subscribe your phone directly to the Amazon SNS resident notification topic. Emergency broadcasts
              and ward rationing advisories will be sent via AWS SNS without needing third-party SMS verification codes.
            </p>

            <label className="field-block">
              <span>Mobile number</span>
              <input
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit Indian mobile number (e.g. 9876543210)"
              />
            </label>

            <div className="form-pair">
              <label className="field-block">
                <span>Your ward</span>
                <select
                  name="ward"
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                >
                  {WARDS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-block">
                <span>Alert language</span>
                <select
                  name="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="both">Bilingual (English + हिन्दी)</option>
                </select>
              </label>
            </div>

            {/* Community Reach Banner */}
            {metrics && (
              <div className="community-reach-badge">
                <span className="reach-icon">📢</span>
                <span className="reach-stat">
                  <strong>{metrics.active_subscribers.toLocaleString()}</strong> verified residents across{' '}
                  <strong>{metrics.monitored_wards} DJB wards</strong> linked to this broadcast network
                </span>
              </div>
            )}

            {/* Current Ward Schedule Preview */}
            <div className="ward-preview-banner">
              <span className="ward-preview-label">LIVE DJB SCHEDULE FOR {selectedWard}:</span>
              <span className="ward-preview-sched">
                {schedule ? schedule.schedule : 'Regular DJB pipeline supply in effect.'}
              </span>
            </div>

            {/* Amazon Bedrock GenAI Alert Message Preview */}
            <div className="bedrock-preview-box">
              <div className="bedrock-head">
                <div className="bedrock-title-group">
                  <span className="bedrock-ai-badge">AWS BEDROCK · GENAI</span>
                  <span className="bedrock-label">Bilingual Alert Preview</span>
                </div>
                <div className="bedrock-lang-toggles">
                  <button
                    type="button"
                    className={`btn-lang-toggle ${aiPreviewLang === 'en' ? 'is-active' : ''}`}
                    onClick={() => setAiPreviewLang('en')}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={`btn-lang-toggle ${aiPreviewLang === 'hi' ? 'is-active' : ''}`}
                    onClick={() => setAiPreviewLang('hi')}
                  >
                    हिन्दी
                  </button>
                </div>
              </div>
              <div className="bedrock-message-bubble">
                <p className="bedrock-message-text">
                  {aiPreviewLang === 'en'
                    ? `Water alert: River ammonia spike detected. ${selectedWard} will get piped supply ${schedule?.schedule || 'as per DJB roster'} today. Piped water is safe. Store water safely.`
                    : `जल सूचना: यमुना में अमोनिया बढ़ने के कारण ${selectedWard} में आज जलापूर्ति ${schedule?.schedule || 'रोस्टर अनुसार'} रहेगी। पानी सुरक्षित संग्रह करें।`}
                </p>
                <span className="bedrock-sender-tag">From: BIOSNT (Amazon SNS &amp; Telegram Channel)</span>
              </div>
            </div>

            <fieldset>
              <legend>Alert types to receive</legend>
              <div className="check-options">
                {[
                  ['pollution', 'River pollution & ammonia spikes (>0.9 ppm)'],
                  ['rationing', 'Intake gate shutdown & water rationing timings'],
                  ['all_clear', 'All-clear & piped supply resumption notifications'],
                ].map(([v, l]) => (
                  <label key={v}>
                    <input name="alert_types" value={v} type="checkbox" defaultChecked />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="check-label">
              <input type="checkbox" name="consent" required defaultChecked />
              I consent to receiving official emergency river and water rationing broadcasts from Bio-Sentinel via Amazon SNS.
            </label>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn-dash-primary" disabled={busy}>
              {busy ? 'Registering with Amazon SNS…' : 'Activate Amazon SNS Alerts →'}
            </button>
          </form>
        )}
      </Panel>
    </div>
  )
}
