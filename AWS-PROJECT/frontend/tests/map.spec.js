import { test, expect } from '@playwright/test'

const STATUS = {
  overall: 'NORMAL', intake_status: 'OPEN', deficit_mgd: 0, incident: null, rationing: [],
  stations: [{ station_id: 'S1', name: 'Panipat II', status: 'NORMAL', updated_at: 1728412800, unionized_ammonia_mgl: 0.02, coords: [29.39, 76.97] }],
}
const READINGS = { station_id: 'S1', readings: [{ timestamp: 1728412800, ammonia_ppm: 0.3, ph: 7.4, avg_velocity_mms: 30, avg_depth_cm: 40, erratic_index: 12, temperature_c: 31, threat_level: 'NORMAL' }] }

async function setup(page) {
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.hostname !== '127.0.0.1') return route.fallback()
    const p = u.pathname
    const r = (json, status = 200) => route.fulfill({ json, status })
    if (p === '/auth/config') return r({ google_client_id: '', dev_login_enabled: false, password_login_enabled: true, registration_enabled: true, staff_login_enabled: false })
    if (p === '/status') return r(STATUS)
    if (p === '/river-health/yamuna-panipat') return r({ features: [] })
    if (p === '/me') return r({ role: 'public', name: 'anonymous' })
    if (p.startsWith('/telemetry/')) return r(READINGS)
    if (p === '/reports') return r([])
    if (p === '/map-config') return r({ region: 'ap-southeast-2', style: 'Standard', style_url: 'http://127.0.0.1:5173/map/style/Standard/descriptor' })
    if (p.startsWith('/map/')) return r({ detail: 'Map service not configured' }, 503) // force graceful fallback (no WebGL/key in CI)
    return route.fallback()
  })
}

test('a station exposes GPS coordinates with an arrow that opens the location map', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  const openMap = page.getByRole('button', { name: /Open map of Panipat II/ })
  await expect(openMap).toBeVisible()
  await openMap.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Panipat II · location')
  await expect(dialog).toContainText('29.39000, 76.97000')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).not.toBeVisible()
})
