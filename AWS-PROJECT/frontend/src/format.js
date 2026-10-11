export const LEVEL_META = {
  NORMAL: { label: 'Normal', sev: 'normal', rank: 0 },
  ELEVATED_LEVEL_1: { label: 'Elevated', sev: 'elevated', rank: 1 },
  WARNING_LEVEL_2: { label: 'Warning', sev: 'warning', rank: 2 },
  CRITICAL_LEVEL_3: { label: 'Critical', sev: 'critical', rank: 3 },
}
export const levelMeta = (lvl) => LEVEL_META[lvl] || { label: 'No reading', sev: 'unknown', rank: -1 }

export const CONDITION_META = {
  NORMAL: { label: 'Normal', sev: 'normal', note: 'River corridor nominal' },
  WATCH: { label: 'Watch', sev: 'warning', note: 'Anomalies under observation' },
  ALERT: { label: 'Alert', sev: 'critical', note: 'Active threat to intake' },
}
export const conditionMeta = (c) => CONDITION_META[c] || { label: 'Unavailable', sev: 'unknown', note: 'Current condition is not confirmed' }

export function fmtDur(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h >= 1) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m >= 1) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${s}s`
}

export function fmtClock(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

