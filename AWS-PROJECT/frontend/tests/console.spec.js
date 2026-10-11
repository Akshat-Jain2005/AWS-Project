import { test, expect } from '@playwright/test'

const OPERATOR = { role: 'operator', name: 'Operator One', email: 'operator@gmail.com', id: 'google:123' }
const PUBLIC = { role: 'public', name: 'anonymous' }
const STATUS = {
  overall: 'NORMAL', intake_status: 'OPEN', deficit_mgd: 0, incident: null, rationing: [],
  stations: ['STATION_01_PANIPAT', 'STATION_02_PANIPAT', 'STATION_03_SONIPAT', 'STATION_04_PALLA', 'STATION_05_WAZIRABAD']
    .map((station_id) => ({ station_id, status: 'NORMAL', updated_at: 1728412800 })),
}

// Only application behavior is exercised here. Google issuance and backend
// signature verification are separate checks; this fake never grants real access.
const GOOGLE_STUB = `window.google = {accounts: {id: {
  initialize: (options) => { window.googleCredentialCallback = options.callback },
  renderButton: (host) => {
    const button = document.createElement('button');
    button.textContent = 'Sign in with Google';
    button.onclick = () => window.googleCredentialCallback({credential:'test.id.token'});
    host.append(button);
  }, disableAutoSelect: () => {}
}}};`

async function setup(page, { role = 'operator', configFailure = false, scriptFailure = false, dev = false, statusFailure = false } = {}) {
  const state = { role, configFailure, scriptFailure, statusFailure, expired: false, sends: 0, gates: 0 }
  await page.route('https://accounts.google.com/**', (route) => state.scriptFailure
    ? route.abort() : route.fulfill({ contentType: 'text/javascript', body: GOOGLE_STUB }))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.fallback()
    const path = url.pathname
    const respond = (json, status = 200) => route.fulfill({ json, status })
    if (path === '/auth/config') return state.configFailure
      ? route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Bad gateway</h1>' })
      : respond({ google_client_id: 'test.apps.googleusercontent.com', dev_login_enabled: dev,
                  password_login_enabled: false, registration_enabled: false, staff_login_enabled: true })
    if (path === '/me') {
      if (!route.request().headers().authorization || state.role === 'public') return respond(PUBLIC)
      return respond({ ...OPERATOR, role: state.role })
    }
    if (path === '/auth/staff-login') {
      const code = route.request().postDataJSON()?.code
      return code === '123456' ? respond({ token: 'staff.token', user: OPERATOR })
        : respond({ detail: 'Incorrect email, password, or authenticator code' }, 401)
    }
    if (path === '/status') return state.statusFailure ? respond({ detail: 'Status is temporarily unavailable.' }, 503) : respond(STATUS)
    if (path === '/river-health/yamuna-panipat') return respond({ features: [] })
    if (path === '/incidents') return state.expired ? respond({ detail: 'Login required' }, 401) : respond([])
    if (path.startsWith('/telemetry/')) return respond({ readings: [] })
    if (path === '/reports' || path === '/reports/pending') return respond([])
    if (path === '/campaigns') return respond({ active: 'upkeep', campaigns: [], donor_wall: [] })
    if (path === '/audit' || path === '/alerts') return respond([])
    if (path === '/subscribers/summary') return respond({ by_ward: { 'Civil Lines': 1 } })
    if (path === '/automation/rules') return route.request().method() === 'PUT'
      ? respond({ detail: 'Rule update failed. Try again.' }, 503)
      : respond({ sms_on_shutdown: true, all_clear_on_restore: true })
    if (path === '/alerts/send') {
      state.sends++
      await new Promise((resolve) => setTimeout(resolve, 250))
      return respond({ status: 'sent', sent: 1, recipients: 1 })
    }
    if (path === '/gate-command') {
      state.gates++
      return respond({ detail: 'Gate command failed. Try again.' }, 503)
    }
    return route.fallback()
  })
  return state
}

async function openAuth(page) {
  await page.goto('/')
  await page.locator('.site-nav').getByRole('button', { name: 'Sign in', exact: true }).click()
}

async function signIn(page) {
  await openAuth(page)
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible()
}

test('operator signs in, uses tabs, and signs out without persistent storage', async ({ page }) => {
  await setup(page)
  await signIn(page)
  expect(await page.evaluate(() => localStorage.getItem('bs_operator_token'))).toBeNull()
  expect(await page.evaluate(() => sessionStorage.getItem('bs_operator_token'))).toBe('test.id.token')
  const overview = page.getByRole('tab', { name: 'Overview', exact: true })
  await overview.focus(); await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('heading', { name: 'Yamuna Watch', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Yamuna water watch', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('bs_operator_token'))).toBeNull()
  await expect(page.getByRole('button', { name: 'Developer access', exact: true })).toHaveCount(0)
})

test('unverified sign-in is reported and a member lands on the public page', async ({ page }) => {
  const state = await setup(page, { role: 'public' })
  await openAuth(page)
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Sign-in could not be verified')
  state.role = 'authenticated'
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click()
  // A verified-but-not-operator account is a member: signed in on the public page, no console tabs.
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)
})

test('blocked Google script and broken config both offer working retry', async ({ page }) => {
  const state = await setup(page, { configFailure: true, scriptFailure: true })
  await openAuth(page)
  await expect(page.getByRole('alert')).toContainText('unreadable response')
  state.configFailure = false
  await page.getByRole('button', { name: 'Retry connection' }).click()
  await expect(page.getByRole('alert')).toContainText('Google sign-in could not load')
  state.scriptFailure = false
  await page.getByRole('button', { name: 'Retry Google sign-in' }).click()
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeVisible()
})

test('expired credentials return the operator to sign-in', async ({ page }) => {
  const state = await setup(page)
  await signIn(page)
  state.expired = true
  await page.getByRole('tab', { name: 'Incidents', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your session has expired')
  expect(await page.evaluate(() => sessionStorage.getItem('bs_operator_token'))).toBeNull()
})

test('late identity response cannot undo sign-out', async ({ page }) => {
  await setup(page)
  await signIn(page)
  let release
  const barrier = new Promise((resolve) => { release = resolve })
  await page.route('**/me', async (route) => { await barrier; await route.fulfill({ json: OPERATOR }) })
  const request = page.waitForRequest('**/me')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await request
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  release()
  await expect(page.getByRole('heading', { name: 'Yamuna water watch', exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)
})

test('unavailable status disables gate actions and never implies normal water', async ({ page }) => {
  await setup(page, { statusFailure: true })
  await signIn(page)
  await expect(page.locator('.condition-word')).toHaveText('Unavailable')
  await expect(page.locator('.condition-intake strong')).toHaveText('UNKNOWN')
  await expect(page.getByText('Waiting for current intake and forecast data.')).toBeVisible()
  await page.getByRole('tab', { name: 'Intake Gate', exact: true }).click()
  await page.getByLabel('Operator rationale').fill('Confirmed contamination at the intake')
  await expect(page.getByRole('button', { name: 'Restore normal supply' })).toBeDisabled()
})

test('dispatch prevents duplicate submission and failed rules show feedback', async ({ page }) => {
  const state = await setup(page)
  await signIn(page)
  await page.getByRole('tab', { name: 'Alerts', exact: true }).click()
  await page.getByLabel('Target wards').fill('Civil Lines, Civil Lines')
  await page.getByLabel('Message', { exact: true }).fill('Test advisory for local browser validation')
  await page.getByRole('button', { name: 'Dispatch advisory' }).evaluate((button) => { button.click(); button.click() })
  await expect(page.getByRole('status')).toContainText('Dispatched to 1')
  expect(state.sends).toBe(1)
  await page.getByRole('switch', { name: 'SMS ward rationing on intake shutdown' }).click()
  await expect(page.getByRole('alert')).toContainText('Rule update failed')
})

test('shutdown confirmation traps focus, cancels with Escape, and shows action failures', async ({ page }) => {
  const state = await setup(page)
  await signIn(page)
  await page.getByRole('tab', { name: 'Intake Gate', exact: true }).click()
  await page.getByLabel('Operator rationale').fill('Confirmed contamination at the intake')
  await page.getByRole('button', { name: 'Emergency shutdown', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm emergency shutdown' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Shut the intake' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect(state.gates).toBe(0)
  await page.getByRole('button', { name: 'Emergency shutdown', exact: true }).click()
  await dialog.getByRole('button', { name: 'Shut the intake' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Gate command failed')
})

test('console layouts fit the viewport and capture the completed interface', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await setup(page)
  await signIn(page)
  for (const name of ['Overview', 'Incidents', 'Intake Gate', 'Alerts', 'Audit']) {
    await page.getByRole('tab', { name, exact: true }).click()
    await expect(page.getByRole('tabpanel').getByRole('heading').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('operator signs in with email, password, and an authenticator code', async ({ page }) => {
  await setup(page)
  await openAuth(page)   // nav "Sign in" opens the Operator tab
  await page.getByPlaceholder('you@djb.example').fill('ops@djb.example')
  await page.getByPlaceholder('Password', { exact: true }).fill('operatorpass1')
  await page.getByPlaceholder('123 456').fill('123456')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible()
})
