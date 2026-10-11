import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Panel } from '../ui'

const STATE_LABEL = {
  OPEN: 'Open — normal supply',
  CLOSED_EMERGENCY_SHUTDOWN: 'Closed — emergency shutdown',
  DIVERTED_TO_BYPASS: 'Diverted to bypass',
}

export default function GateControl({ status, refreshStatus }) {
  const [rationale, setRationale] = useState('')
  const [pending, setPending] = useState(null) // the action awaiting confirm
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const dialog = useRef(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const node = dialog.current
    if (pending && !node?.open) node?.showModal()
    if (!pending && node?.open) node.close()
  }, [pending])

  const current = status?.intake_status
  const isOpen = current === 'OPEN'
  const ready = !!status && rationale.trim().length >= 10

  const run = async (action) => {
    if (!ready || inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(null)
    try {
      await api('/gate-command', { method: 'POST', body: { action, rationale: rationale.trim() } })
      setRationale(''); setPending(null)
      refreshStatus?.()
    } catch (e) {
      setError(e.message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <Panel title="Intake gate" meta="Wazirabad headworks">
        <div className={`gate-state ${!status ? 'muted' : isOpen ? 'sev-normal' : 'sev-critical'}`}>
          <span className="k">Current status</span>
          <strong>{STATE_LABEL[current] || 'Unknown — waiting for current status'}</strong>
          {!isOpen && status?.deficit_mgd ? <span className="deficit">−{status.deficit_mgd} MGD supply deficit</span> : null}
        </div>

        <label className="field-block" htmlFor="rationale">
          Operator rationale <span className="req">required · logged to the audit chain</span>
          <textarea
            id="rationale"
            rows={3}
            value={rationale}
            placeholder="State the hydrological justification for this actuation…"
            onChange={(e) => setRationale(e.target.value)}
          />
        </label>

        <div className="gate-actions">
          {isOpen ? (
            <>
              <button className="btn-danger" disabled={!ready || busy} onClick={() => setPending('SHUTDOWN')}>
                Emergency shutdown
              </button>
              <button className="btn-secondary" disabled={!ready || busy} onClick={() => run('DIVERT_BYPASS')}>
                Divert to bypass
              </button>
            </>
          ) : (
            <button className="btn-primary" disabled={!ready || busy} onClick={() => run('RESTORE')}>
              Restore normal supply
            </button>
          )}
        </div>
        {!ready && <p className="hint">{!status ? 'Gate controls are disabled until current status is available.' : 'Enter a rationale of at least 10 characters to actuate the gate.'}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </Panel>

        <dialog ref={dialog} className="confirm" aria-labelledby="shutdown-title" aria-describedby="shutdown-description" onKeyDown={(event) => {
          if (event.key !== 'Tab') return
          const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
          const first = buttons[0], last = buttons.at(-1)
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }} onCancel={(event) => {
          if (busy) event.preventDefault()
          else setPending(null)
        }}>
          <div className="confirm-card">
            <h3 id="shutdown-title">Confirm emergency shutdown</h3>
            <p id="shutdown-description">
              This closes the Wazirabad intake and records your rationale in the audit log.
              Rationing notices follow the configured automation rules. Use Restore normal supply to reopen the gate.
            </p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="confirm-actions">
              <button className="btn-ghost" autoFocus disabled={busy} onClick={() => setPending(null)}>Cancel</button>
              <button className="btn-danger" disabled={busy || !ready} onClick={() => run('SHUTDOWN')}>
                {busy ? 'Actuating…' : 'Shut the intake'}
              </button>
            </div>
          </div>
        </dialog>

      {status?.rationing?.length > 0 && (
        <Panel title="Rationing dispatched" meta={`${status.rationing.length} wards`}>
          <ul className="ration-list">
            {status.rationing.map((r) => (
              <li key={r.ward}><span>{r.ward}</span><span className="sched">{r.schedule}</span></li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
