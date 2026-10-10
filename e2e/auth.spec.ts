import { expect, test } from '@playwright/test'
import { login, logout, PASSWORD } from './fixtures'

test.describe('P01 · Acceso y roles', () => {
  test('protege rutas y redirige al login conservando el destino', async ({ page }) => {
    await page.goto('/inventario')
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await page.getByTestId('login-username').fill('operaciones')
    await page.getByTestId('login-password').fill(PASSWORD)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/inventario/)
  })

  test('credenciales inválidas muestran error genérico', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-username').fill('admin')
    await page.getByTestId('login-password').fill('incorrecta')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-error')).toContainText('Usuario o contraseña incorrectos')
  })

  test('la oficina entra al dashboard y ve navegación de Oficina Madre', async ({ page }) => {
    await login(page, 'gerencia')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Dashboard Oficina Madre' })).toBeVisible()
    await expect(page.getByTestId('kpi-inventory')).toBeVisible()
    await expect(page.getByTestId('nav-aprobaciones')).toBeVisible()
    await expect(page.getByTestId('nav-taller')).toHaveCount(0)
  })

  test('el taller entra a su portal y no ve módulos de oficina', async ({ page }) => {
    await login(page, 'taller.tc')
    await expect(page).toHaveURL(/\/taller/)
    await expect(page.getByTestId('nav-taller')).toBeVisible()
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0)
    await expect(page.getByTestId('nav-finanzas')).toHaveCount(0)
    await expect(page.getByText('Taller TC', { exact: true })).toBeVisible()
  })

  test('la sesión persiste al recargar (refresh token httpOnly) y el logout la cierra', async ({ page }) => {
    await login(page, 'operaciones')
    await page.reload()
    await expect(page).not.toHaveURL(/\/login/)
    await logout(page)
    await page.goto('/ordenes')
    await expect(page).toHaveURL(/\/login/)
  })

  test('recuperación de acceso por correo (Mailpit)', async ({ page, request }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
    await page.getByTestId('forgot-email').fill('auditor@prestigegold.local')
    await page.getByTestId('forgot-submit').click()
    await expect(page.getByTestId('forgot-sent')).toBeVisible()
    let link = ''
    for (let i = 0; i < 20 && !link; i++) {
      const list = await (await request.get('http://127.0.0.1:8025/api/v1/search?query=to:auditor@prestigegold.local')).json()
      if (list.messages?.length) {
        const msg = await (await request.get(`http://127.0.0.1:8025/api/v1/message/${list.messages[0].ID}`)).json()
        link = /http:\/\/localhost:\d+\/restablecer\?token=[^\s"<]+/.exec(msg.Text)?.[0] ?? ''
      } else await page.waitForTimeout(300)
    }
    expect(link).toContain('/restablecer?token=')
    await page.goto(new URL(link).pathname + new URL(link).search)
    await page.locator('input[type=password]').nth(0).fill('Auditoria.2026!')
    await page.locator('input[type=password]').nth(1).fill('Auditoria.2026!')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('Contraseña actualizada')).toBeVisible()
    await page.goto('/login')
    await page.getByTestId('login-username').fill('auditor')
    await page.getByTestId('login-password').fill('Auditoria.2026!')
    await page.getByTestId('login-submit').click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('menú móvil funciona en pantallas pequeñas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'taller.tj')
    await page.getByTestId('mobile-menu').click()
    await expect(page.getByTestId('nav-taller-ordenes').last()).toBeVisible()
  })
})
