// Shared vocabulary and primitives for the console. Threat state is encoded in
// form (line weight / fill), not colour alone, so it survives glare and colour
// vision differences — colour reinforces, it never carries the signal alone.

export function ReadState({ loading, error, retry }) {
  if (error) return <div className="read-error" role="alert"><p>{error.message}</p>
    {retry && <button className="btn-secondary" onClick={retry}>Try again</button>}
  </div>
  if (loading) return <p className="muted" role="status">Loading current data…</p>
  return null
}

export function Panel({ title, meta, actions, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {meta && <span className="panel-meta">{meta}</span>}
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

// A reading paired with its label, figures tabular so columns align.
export function Field({ label, value, unit, sev }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className={`field-value ${sev ? `sev-${sev}` : ''}`}>
        {value}
        {unit && <span className="field-unit">{unit}</span>}
      </span>
    </div>
  )
}

// Duration drawn as length: a scaled bar so ETA / age read spatially, not only
// as numerals. `state` sets the fill form: live=solid, pending=dashed, stale=faint.
export function TimeBar({ seconds, max, sev = 'normal', state = 'live', label }) {
  const pct = max ? Math.min(100, Math.max(2, (seconds / max) * 100)) : 0
  return (
    <div className="timebar" data-state={state}>
      <div className={`timebar-track sev-${sev}`}>
        <div className="timebar-fill" style={{ width: `${pct}%` }} />
      </div>
      {label && <span className="timebar-label">{label}</span>}
    </div>
  )
}
