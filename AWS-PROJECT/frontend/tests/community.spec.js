import { test, expect } from '@playwright/test'

const stations = ['Panipat I', 'Panipat II', 'Sonipat', 'Palla', 'Wazirabad'].map((name, i) => ({ station_id: ['STATION_01_PANIPAT','STATION_02_PANIPAT','STATION_03_SONIPAT','STATION_04_PALLA','STATION_05_WAZIRABAD'][i], name, status: i ? 'NORMAL' : 'CRITICAL_LEVEL_3', updated_at: 1791660000 }))
const report = { id: 'report_1', location_label: 'Panipat river bank', source_type: 'river', note: 'Foam near the outfall', observations: ['foam'], reporter_type: 'citizen', ammonia_ppm: 4, ph: 8.6, lat: 29.39, lng: 76.97, created_at: 1791660000 }
async function mock(page, operator = false) {
  if (operator) await page.addInitScript(() => sessionStorage.setItem('bs_operator_token', 'test-token'))
  const state = { report: null, subscribed: null, reviewed: false }
  await page.route('**/*', route => {
    const p = new URL(route.request().url()).pathname
    const respond = json => route.fulfill({ json })
    if (p === '/auth/config') return respond({})
    if (p === '/me') return respond({ role: operator ? 'operator' : 'public', name: 'Test Operator' })
    if (p === '/status') return respond({ overall: 'ALERT', stations, intake_status: 'CLOSED_EMERGENCY_SHUTDOWN', deficit_mgd: 110, incident: { t_minus_seconds: 14400, level: 'CRITICAL_LEVEL_3', station_id: 'STATION_01_PANIPAT', confidence: 'CONFIRMED' }, rationing: [{ ward: 'Civil Lines', schedule: '6–9 AM and 5–8 PM' }] })
    if (p.startsWith('/telemetry/')) return respond({ readings: [0,1,2].map(n => ({ timestamp: 1791660000 + n, ammonia_ppm: 4 + n / 10, ph: 5.4, avg_depth_cm: 10 - n, avg_velocity_mms: 2 + n, erratic_index: .8, temperature_c: 26.1, threat_level: 'CRITICAL_LEVEL_3' })) })
    if (p === '/river-health/yamuna-panipat') return respond({ features: [] })
    if (p === '/reports/pending') return respond(state.reviewed ? [] : [report])
    if (p === '/reports/report_1') { state.reviewed = true; return respond({ status: 'approved' }) }
    if (p === '/reports' && route.request().method() === 'POST') { state.report = route.request().postDataJSON(); return respond({ id: 'submitted_1' }) }
    if (p === '/reports') return respond([report])
    if (p === '/subscribe') { state.subscribed = route.request().postDataJSON(); return respond({ status: 'otp_sent' }) }
    if (p === '/subscribe/verify') return respond({ status: 'subscribed' })
    if (p === '/campaigns') return respond({ active: 'relief', campaigns: [{ id: 'upkeep', title: 'Node Upkeep Fund', raised_inr: 199 }, { id: 'relief', title: 'Emergency Clean Water Relief Fund', raised_inr: 499 }], donor_wall: [{ name: 'Anonymous', amount_inr: 499, campaign_id: 'relief' }] })
    return route.fallback()
  })
  return state
}

test('public watch connects references to live data and fits each viewport', async ({ page }, info) => {
  await mock(page); await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Yamuna water watch', exact: true })).toBeVisible()
  await expect(page.locator('.lcd-status')).toContainText('CRITICAL')
  await expect(page.locator('.lcd-display')).toContainText('NOT REPORTED')
  await expect(page.getByText('6–9 AM and 5–8 PM')).toBeVisible()
  await page.locator('.hardware-reference summary').click()
  await expect(page.locator('.hardware-pair img')).toHaveCount(2)
  await page.locator('.hardware-reference summary').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('public-watch.png'), fullPage: true })
  await page.getByRole('button', { name: 'Donate', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Emergency Clean Water Relief Fund', exact: true })).toBeVisible()
  await expect(page.locator('.donor-wall').getByText('Anonymous')).toBeVisible()
  await page.screenshot({ path: info.outputPath('funding.png'), fullPage: true })
})

test('citizen locks GPS and submits actual observation fields', async ({ page, context }) => {
  const state = await mock(page)
  await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: 29.39, longitude: 76.97 })
  await page.goto('/'); await page.getByRole('button', { name: 'Report a sample', exact: true }).click()
  await page.getByRole('button', { name: 'Use my GPS location' }).click()
  await expect(page.getByRole('status')).toContainText('Location locked')
  await page.getByLabel('Ammonia (ppm)').fill('4.8'); await page.getByLabel('Foam', { exact: true }).check()
  await page.getByRole('button', { name: 'Submit report', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Report received' })).toBeVisible()
  expect(state.report).toMatchObject({ lat: 29.39, lng: 76.97, ammonia_ppm: 4.8, observations: ['foam'] })
})

test('SMS subscription requires consent and verifies an OTP', async ({ page }) => {
  const state = await mock(page); await page.goto('/')
  await page.getByRole('button', { name: 'SMS alerts', exact: true }).click()
  await page.getByLabel('Mobile number').fill('9876543210')
  await page.getByLabel('I agree to receive water alerts').check()
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify and subscribe' }).click()
  await expect(page.getByRole('status')).toContainText('You’re subscribed')
  expect(state.subscribed.consent).toBe(true)
})

test('operator reviews reports and sees the funding ledger', async ({ page }, info) => {
  const state = await mock(page, true); await page.goto('/')
  await page.getByRole('tab', { name: 'Field reports', exact: true }).click()
  await expect(page.getByText('Foam near the outfall')).toBeVisible()
  await page.screenshot({ path: info.outputPath('moderation.png'), fullPage: true })
  await page.getByRole('button', { name: 'Approve report' }).click()
  await expect(page.getByText('No reports waiting for review.')).toBeVisible()
  expect(state.reviewed).toBe(true)
  await page.getByRole('tab', { name: 'Funding ledger', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Campaign contributions' })).toBeVisible()
})
