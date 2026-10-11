import { test, expect } from '@playwright/test'

// Public portal + email/password flow. No Google is configured here; the backend
// session is faked (register/login return a token the stubbed /me recognises).
const STATUS = {
  overall: 'NORMAL', intake_status: 'OPEN', deficit_mgd: 0, incident: null,
  stations: [['STATION_01_PANIPAT', 'Panipat I'], ['STATION_02_PANIPAT', 'Panipat II']]
    .map(([station_id, name]) => ({ station_id, name, status: 'NORMAL', updated_at: 1728412800, toxicity_band: 'SAFE' })),
}
const MEMBER = { role: 'authenticated', name: 'River Member', email: 'member@example.com', id: 'user:member@example.com' }

async function setup(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') return route.fallback()
    const path = url.pathname
    const method = route.request().method()
    const respond = (json, status = 200) => route.fulfill({ json, status })
    if (path === '/auth/config') return respond({ google_client_id: '', dev_login_enabled: false, password_login_enabled: true, registration_enabled: true, staff_login_enabled: false })
    if (path === '/status') return respond(STATUS)
    if (path === '/river-health/yamuna-panipat') return respond({ features: [] })
    if (path === '/me') {
      const auth = route.request().headers().authorization
      return respond(auth === 'Bearer tok-member' ? MEMBER : { role: 'public', name: 'anonymous' })
    }
    if (path === '/auth/register' && method === 'POST') return respond({ token: 'tok-member', user: MEMBER }, 201)
    if (path === '/auth/login' && method === 'POST') {
      const body = route.request().postDataJSON()
      return (body.email === 'member@example.com' && body.password === 'hunter2hunter')
        ? respond({ token: 'tok-member', user: MEMBER })
        : respond({ detail: 'Incorrect email or password' }, 401)
    }
    return route.fallback()
  })
}

test('the public advisory page is open without signing in', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bio-Sentinel', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Monitoring stations' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.locator('.site-nav').getByRole('button', { name: 'Create account', exact: true })).toBeVisible()
})

test('a visitor can register and becomes a signed-in member', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await page.locator('.site-nav').getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByPlaceholder('Your name').fill('River Member')
  await page.getByPlaceholder('you@example.com').fill('member@example.com')
  await page.getByPlaceholder('Password', { exact: true }).fill('hunter2hunter')
  await page.getByPlaceholder('Re-enter password').fill('hunter2hunter')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await expect(page.locator('.site-nav').getByText('River Member', { exact: true })).toBeVisible()
})

test('mismatched passwords are caught before submitting', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await page.locator('.site-nav').getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByPlaceholder('Your name').fill('River Member')
  await page.getByPlaceholder('you@example.com').fill('member@example.com')
  await page.getByPlaceholder('Password', { exact: true }).fill('hunter2hunter')
  await page.getByPlaceholder('Re-enter password').fill('different-pass')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Passwords do not match')
})

test('a member can sign in with email and password', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await page.locator('.site-nav').getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('tab', { name: 'Citizen', exact: true }).click()
  await page.getByPlaceholder('you@example.com').fill('member@example.com')
  await page.getByPlaceholder('Password', { exact: true }).fill('hunter2hunter')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
})
