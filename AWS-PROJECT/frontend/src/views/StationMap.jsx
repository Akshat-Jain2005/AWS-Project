import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { api } from '../api'

// Renders the station's location on an Amazon Location Service basemap, served
// through the backend's keyless proxy (/map-config → style descriptor → tiles).
// Lazy-loaded by StationWatch so maplibre ships only when the map is opened.
// Degrades to coordinates + an external link when the map service is unconfigured.
export default function StationMap({ station }) {
  const host = useRef(null)
  const [state, setState] = useState('loading') // 'loading' | 'ready' | 'error'
  const coords = Array.isArray(station?.coords) ? station.coords : null
  const lat = coords?.[0]
  const lng = coords?.[1]

  useEffect(() => {
    let map
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api('/map-config', { auth: false })
        if (cancelled || !host.current) return
        map = new maplibregl.Map({
          container: host.current,
          style: cfg.style_url,
          center: coords ? [lng, lat] : [77.0, 28.7],
          zoom: coords ? 11 : 8,
          attributionControl: { compact: true },
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
        map.on('load', () => { if (!cancelled) { setState('ready'); map.resize() } })
        // Tile/style failures (e.g. the Location key is not configured) surface here.
        map.on('error', () => { if (!cancelled) setState((s) => (s === 'ready' ? s : 'error')) })
        if (coords) new maplibregl.Marker({ color: '#2f6fb0' }).setLngLat([lng, lat]).addTo(map)
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true; try { map?.remove() } catch { /* already gone */ } }
    // Re-init only when the location changes — not on every status poll, which
    // hands us a fresh `coords` array each time.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  return (
    <div className="station-map">
      <div ref={host} className="station-map-canvas" />
      {state !== 'ready' && (
        <div className="station-map-overlay" role="status">
          <p>{state === 'loading' ? 'Loading map…' : 'Live map unavailable — the Amazon Location key may not be configured.'}</p>
          {coords && <p className="station-map-coords mono">{lat.toFixed(5)}, {lng.toFixed(5)}</p>}
          {coords && state === 'error' && (
            <a className="station-map-link" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`}
              target="_blank" rel="noreferrer">Open in OpenStreetMap →</a>
          )}
        </div>
      )}
    </div>
  )
}
