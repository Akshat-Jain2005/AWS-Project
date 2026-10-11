import { useRef, useState } from 'react'
import { api, usePoll } from '../api'
import { Panel, ReadState } from '../ui'

const OBSERVATIONS = { dark_color: 'Dark color', foam: 'Foam', sharp_smell: 'Sharp smell', dead_fish: 'Dead fish', oil_sheen: 'Oil sheen', clear: 'Clear water' }

export function ReportForm() {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [locating, setLocating] = useState(false)
  const locate = () => {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser.'); return }
    setLocating(true); setError('')
    navigator.geolocation.getCurrentPosition(p => { setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false) }, () => { setError('Allow location access and try again. Your sample needs a GPS location.'); setLocating(false) }, { enableHighAccuracy: true, timeout: 15000 })
  }
  async function submit(e) {
    e.preventDefault()
    if (lock.current || !position) return
    lock.current = true; setBusy(true); setError('')
    const form = new FormData(e.currentTarget)
    try {
      let photo_key = null
      const photo = form.get('photo')
      if (photo?.size) {
        if (photo.size > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.')
        const upload = await api('/reports/upload-url', { method: 'POST', body: { content_type: photo.type } })
        if (!upload.upload_url) throw new Error('Photo storage is not configured yet. Remove the photo to submit the readings, or try again later.')
        const payload = new FormData()
        Object.entries(upload.fields || {}).forEach(([key, value]) => payload.append(key, value))
        payload.append('file', photo)
        const response = await fetch(upload.upload_url, { method: 'POST', body: payload, signal: AbortSignal.timeout(30000) })
        if (!response.ok) throw new Error('Photo upload failed. Please try again.')
        photo_key = upload.photo_key
      }
      const number = k => form.get(k) === '' ? null : Number(form.get(k))
      setResult(await api('/reports', { method: 'POST', body: { ...position, source_type: form.get('source_type'), location_label: form.get('location_label'), ammonia_ppm: number('ammonia_ppm'), ph: number('ph'), observations: form.getAll('observations'), note: form.get('note'), photo_key } }))
    } catch (err) { setError(err.message) } finally { lock.current = false; setBusy(false) }
  }
  if (result) return <Panel title="Report received"><p role="status">Your report is waiting for review. Thank you for helping monitor the Yamuna.</p><p className="mono">Reference: {result.id}</p><button className="btn-secondary" onClick={() => setResult(null)}>Report another sample</button></Panel>
  return <Panel title="Report a water sample" meta="GPS location required">
    <form onSubmit={submit} className="community-form">
      <p>Share what you observe. Never enter the river or touch suspected contaminated water.</p>
      <button type="button" className="btn-secondary" onClick={locate} disabled={locating}>{locating ? 'Finding location…' : position ? 'Refresh GPS location' : 'Use my GPS location'}</button>
      {position && <p role="status" className="mono">Location locked: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}</p>}
      <label className="field-block">Nearby landmark<input name="location_label" maxLength={120} placeholder="Drain outfall, river bank or street"/></label>
      <label className="field-block">Water source<select name="source_type"><option value="river">River</option><option value="drain_outfall">Drain outfall</option><option value="tap">Tap</option><option value="tanker">Tanker</option></select></label>
      <div className="form-pair"><label className="field-block">Ammonia (ppm)<input type="number" name="ammonia_ppm" min="0" max="50" step="0.01"/></label><label className="field-block">pH<input type="number" name="ph" min="0" max="14" step="0.1"/></label></div>
      <fieldset><legend>What do you see?</legend><div className="check-options">{Object.entries(OBSERVATIONS).map(([value,label]) => <label key={value}><input type="checkbox" name="observations" value={value}/>{label}</label>)}</div></fieldset>
      <label className="field-block">Photo of sample or test strip (optional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/><span className="hint">JPEG, PNG or WebP · up to 5 MB</span></label>
      <label className="field-block">Note (optional)<textarea name="note" maxLength={500} rows={3}/></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-primary" disabled={!position || busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
    </form>
  </Panel>
}

export function ReportList({ rows }) {
  return <div className="report-list">{rows.map(r => <article key={r.id} className="report-row"><div><h3>{r.location_label || r.source_type.replaceAll('_',' ')}</h3><p>{r.note || 'No additional notes.'}</p><p className="muted">{r.ammonia_ppm != null && `Ammonia ${r.ammonia_ppm} ppm · `}{r.ph != null && `pH ${r.ph} · `}{r.reporter_type === 'verified' ? 'Verified reporter' : 'Citizen'} · {new Date(r.created_at * 1000).toLocaleString()}</p><div className="report-tags">{r.observations?.map(o => <span key={o}>{OBSERVATIONS[o] || o}</span>)}</div></div></article>)}</div>
}

export default function Reports() {
  const feed = usePoll('/reports/pending', 10000)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const lock = useRef(false)
  async function review(id, action) {
    if (lock.current) return
    lock.current = true; setBusy(id); setError('')
    try { await api(`/reports/${id}`, { method: 'PATCH', body: { action, note: '' } }); feed.refresh() } catch (e) { setError(e.message) } finally { lock.current = false; setBusy('') }
  }
  return <Panel title="Field report moderation" meta={`${feed.data?.length || 0} pending`}>
    <p className="muted">Review readings and location before approving. Citizen observations never authorize a gate command.</p>
    <ReadState {...feed} retry={feed.refresh}/>{error && <p role="alert" className="error">{error}</p>}
    {!feed.loading && !feed.error && !feed.data?.length && <p className="calm">No reports waiting for review.</p>}
    {!feed.error && feed.data?.map(r => <div key={r.id} className="moderation-item"><ReportList rows={[r]}/>{r.photo_url && <a href={r.photo_url} target="_blank" rel="noreferrer"><img className="report-photo" src={r.photo_url} alt="Submitted water sample" loading="lazy"/></a>}<dl className="triage-facts"><div><dt>GPS</dt><dd>{r.lat}, {r.lng}</dd></div><div><dt>Photo</dt><dd>{r.photo_key ? 'Attached' : 'Not provided'}</dd></div><div><dt>Translation</dt><dd>{r.translated_note || 'Not available'}</dd></div><div><dt>Image tags</dt><dd>{r.image_tags?.join(', ') || 'Not available'}</dd></div></dl><div className="action-row"><button className="btn-primary" disabled={Boolean(busy)} onClick={() => review(r.id, 'approve')}>{busy === r.id ? 'Saving…' : 'Approve report'}</button><button className="btn-secondary" disabled={Boolean(busy)} onClick={() => review(r.id, 'reject')}>Reject report</button></div></div>)}
  </Panel>
}
