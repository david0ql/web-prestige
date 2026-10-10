import { expect, type Page, type APIRequestContext, request as pwRequest } from '@playwright/test'
import sharp from 'sharp'

export const PASSWORD = 'Prestige.2026!'
export const API = 'http://localhost:3301/api'

/** Inicia sesión por la UI (como lo haría el usuario). */
export async function login(page: Page, username: string) {
  await page.goto('/login')
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function logout(page: Page) {
  await page.getByTestId('user-menu').click()
  await page.getByTestId('logout').click()
  await expect(page).toHaveURL(/\/login/)
}

/** Cliente API autenticado para preparar precondiciones rápidamente. */
export async function apiAs(username: string): Promise<APIRequestContext & { token: string }> {
  const ctx = await pwRequest.newContext({ baseURL: `${API}/` })
  const res = await ctx.post('auth/login', { data: { username, password: PASSWORD } })
  const { accessToken } = await res.json()
  const authed = await pwRequest.newContext({ baseURL: `${API}/`, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } })
  return Object.assign(authed, { token: accessToken as string })
}

export async function pngBuffer(color = '#c9a24c') {
  return sharp({ create: { width: 320, height: 240, channels: 3, background: color } }).png().toBuffer()
}

export function mp4Buffer() {
  const ftyp = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d])
  return Buffer.concat([ftyp, Buffer.from([0, 0, 0, 0x10, 0x6d, 0x64, 0x61, 0x74]), Buffer.alloc(8, 1)])
}

/** Captura manual en el panel de Balanza Madre (rol con permiso scale.manual). */
export async function weighManually(page: Page, testId: string, grams: number) {
  await page.getByTestId(`${testId}-manual-toggle`).click()
  await page.getByTestId(`${testId}-manual-grams`).fill(String(grams))
  await page.getByTestId(`${testId}-manual-reason`).fill('Prueba de clic automatizada (balanza en calibración)')
  await page.getByTestId(`${testId}-capture`).click()
  await expect(page.getByTestId(`${testId}-captured`)).toBeVisible()
}

/** Pesaje con el simulador de balanza (flujo Web Serial simulado). */
export async function weighWithSimulator(page: Page, testId: string, grams: number) {
  await page.getByTestId(`${testId}-simulator`).click()
  await page.getByTestId(`${testId}-sim-weight`).fill(String(grams))
  await page.getByRole('button', { name: 'Poner' }).click()
  await expect(page.getByTestId(`${testId}-capture`)).toBeEnabled({ timeout: 6000 })
  await page.getByTestId(`${testId}-capture`).click()
  await expect(page.getByTestId(`${testId}-captured`)).toBeVisible()
}
