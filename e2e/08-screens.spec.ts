import { expect, test, type Page } from '@playwright/test'
import { apiAs, login } from './fixtures'

/**
 * Recorre las 20 pantallas de la sección 12 (P01–P20) con el rol que las usa y
 * comprueba que cargan su contenido sin errores de página.
 * Requiere los datos del escenario demo (lo carga 04-commercial en la misma corrida).
 */
const ids: Record<string, string> = {}

async function open(page: Page, user: string, path: string) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page, user)
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  return errors
}

const badge = (page: Page, code: string) => page.locator('span', { hasText: new RegExp(`^${code}$`) }).first()

test.describe.serial('Pantallas P01–P20', () => {
  test.beforeAll(async () => {
    const g = await apiAs('gerencia')
    const orders = (await (await g.get('orders?pageSize=100')).json()).items as { id: string; status: string; workshop: { code: string } }[]
    ids.closed = orders.find((o) => o.status === 'APPROVED_CLOSED')!.id
    const tc = await apiAs('taller.tc')
    ids.tcOrder = ((await (await tc.get('orders?pageSize=50')).json()).items as { id: string }[])[0].id
    ids.tcDispatch = ((await (await tc.get('dispatches?pageSize=50')).json()).items as { id: string }[])[0].id
    ids.product = ((await (await g.get('catalog/products')).json()) as { id: string }[])[0].id
  })

  test('[P01] inicio de sesión con recuperación de acceso', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('login-username')).toBeVisible()
    await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeVisible()
  })

  const office: [string, string, string, string?][] = [
    ['P02', 'gerencia', '/dashboard', 'kpi-inventory'],
    ['P03', 'operaciones', '/balanza', 'entry-weighing'],
    ['P04', 'gerencia', '/inventario', 'inventory-summary-table'],
    ['P05', 'operaciones', '/asignaciones', 'dispatch-workshop'],
    ['P13', 'finanzas', '/clientes', 'customers-table'],
    ['P14', 'finanzas', '/finanzas', 'kpi-income'],
    ['P15', 'gerencia', '/productividad'],
    ['P16', 'gerencia', '/rentabilidad'],
    ['P17', 'gerencia', '/alertas', 'alerts-open-count'],
    ['P18', 'admin', '/administracion', 'workshops-table'],
    ['P19', 'operaciones', '/catalogo', 'catalog-grid'],
  ]
  for (const [code, user, path, testId] of office) {
    test(`[${code}] ${path}`, async ({ page }) => {
      const errors = await open(page, user, path)
      await expect(badge(page, code)).toBeVisible()
      if (testId) await expect(page.getByTestId(testId).first()).toBeVisible()
      expect(errors).toEqual([])
    })
  }

  test('[P06] [P11] [P12] orden de producción: seguimiento, recepción/calidad/ley y conciliación', async ({ page }) => {
    const errors = await open(page, 'gerencia', `/ordenes/${ids.closed}`)
    await expect(badge(page, 'P06')).toBeVisible()
    await expect(page.getByTestId('order-lifecycle')).toBeVisible()
    await page.getByTestId('tab-recepcion').click()
    await expect(page.getByText(/Ley/).first()).toBeVisible()
    await page.getByTestId('tab-conciliacion').click()
    await expect(page.getByTestId('reconciliation-lines')).toBeVisible()
    await page.goto('/recepciones')
    await expect(badge(page, 'P11')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('[P20] historia visual / mosaico de fabricación', async ({ page }) => {
    const errors = await open(page, 'gerencia', `/ordenes/${ids.closed}/historia`)
    await expect(badge(page, 'P20')).toBeVisible()
    await expect(page.getByTestId('media-thumb').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('[P07] portal / dashboard de taller', async ({ page }) => {
    const errors = await open(page, 'taller.tc', '/taller')
    await expect(badge(page, 'P07')).toBeVisible()
    await expect(page.getByTestId('kpi-custody')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('[P08] confirmación de entrega', async ({ page }) => {
    const errors = await open(page, 'taller.tc', `/taller/entregas/${ids.tcDispatch}`)
    await expect(badge(page, 'P08')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('[P09] [P10] registro de producción, evidencias y producto terminado', async ({ page }) => {
    const errors = await open(page, 'taller.tc', `/taller/ordenes/${ids.tcOrder}`)
    await expect(badge(page, 'P09')).toBeVisible()
    await expect(badge(page, 'P10')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('[P19] ficha técnica de modelo con versiones', async ({ page }) => {
    const errors = await open(page, 'operaciones', `/catalogo/${ids.product}`)
    await expect(page.getByTestId('current-sheet')).toBeVisible()
    await expect(page.getByTestId('sheet-versions')).toBeVisible()
    expect(errors).toEqual([])
  })
})
