import { expect, test, type Page } from '@playwright/test'
import { apiAs, login, logout, weighManually, weighWithSimulator } from './fixtures'

async function ids() {
  const api = await apiAs('admin')
  const mats = (await (await api.get('materials?pageSize=100')).json()).items as { id: string; code: string }[]
  const ws = (await (await api.get('workshops?pageSize=50')).json()).items as { id: string; code: string }[]
  const ps = (await (await api.get('products?pageSize=50')).json()).items as { id: string; code: string }[]
  const m = (c: string) => mats.find((x) => x.code === c)!.id
  const w = (c: string) => ws.find((x) => x.code === c)!.id
  const p = (c: string) => ps.find((x) => x.code === c)!.id
  return { m, w, p }
}

/** Entrada vía API (precondición rápida, mismas reglas que la UI). */
async function apiEntry(materialId: string, grams: number) {
  const api = await apiAs('operaciones')
  const w = await (await api.post('weighings', { data: { purpose: 'ENTRY', source: 'MANUAL', grossGrams: grams, materialId, manualReason: 'Precondición de prueba' } })).json()
  const r = await api.post('inventory/entries', { data: { materialId, weighingId: w.id, origin: 'Precondición e2e' } })
  expect(r.ok()).toBeTruthy()
}

async function selectByLabelContaining(page: Page, testId: string, text: string) {
  const select = page.getByTestId(testId)
  await expect(select.locator('option').nth(1)).toBeAttached()
  // Coincidencia exacta de mayúsculas (hasText es insensible y confunde "Oro 24K" con "Hilo de oro 24K").
  const value = await select.evaluate((el, t) => [...(el as HTMLSelectElement).options].find((o) => o.text.includes(t))?.value, text)
  expect(value, `opción "${text}" en ${testId}`).toBeTruthy()
  await select.selectOption(value!)
}

test.describe('Materiales · Balanza, inventario y asignación', () => {
  test('CA-001 · registrar entrada en Balanza Madre y verla en inventario', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto('/balanza')
    await selectByLabelContaining(page, 'entry-material', 'Oro 24K')
    await page.getByTestId('entry-origin').fill('Compra Fundidora Andina')
    await page.getByTestId('entry-reference').fill('FAC-1001')
    await weighWithSimulator(page, 'entry-weighing', 1000)
    await page.getByTestId('entry-submit').click()
    await expect(page.getByTestId('entry-success')).toBeVisible()
    await page.goto('/inventario')
    await expect(page.getByTestId('summary-row-AU24')).toContainText('1.000')
  })

  test('Escenario A / CA-002 · distribuir a talleres y confirmar con firma digital', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto('/asignaciones')
    await selectByLabelContaining(page, 'dispatch-workshop', 'TC ·')
    await page.getByTestId('dispatch-purpose').fill('Distribución de 200 g a Colmenares')
    await selectByLabelContaining(page, 'dispatch-line-material-0', 'Oro 24K')
    await weighManually(page, 'dispatch-line-weighing-0', 200)
    await page.getByTestId('dispatch-submit').click()
    await expect(page.getByTestId('dispatch-success')).toBeVisible()
    const number = (await page.getByTestId('dispatch-number').textContent())!.trim()
    await logout(page)

    // El taller confirma recepción con firma digital (RF-011 / RF-035).
    await login(page, 'taller.tc')
    await page.goto('/taller/entregas')
    await page.getByTestId(`dispatch-card-${number}`).click()
    await expect(page.getByTestId('confirm-signer')).toBeVisible()
    // Sin orden asociada no hay compromiso de producción que aceptar.
    if (await page.getByTestId('confirm-commitment').count()) await page.getByTestId('confirm-commitment').check()
    await page.getByTestId('confirm-signer').fill('Colmenares')
    const pad = page.getByTestId('signature-pad')
    const box = (await pad.boundingBox())!
    await page.mouse.move(box.x + 20, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 })
    await page.mouse.move(box.x + 220, box.y + 40, { steps: 8 })
    await page.mouse.up()
    await page.getByTestId('confirm-accept').click()
    await expect(page).not.toHaveURL(new RegExp(`entregas/${number}`))
    await logout(page)

    // El total global se conserva y el taller ve únicamente lo suyo.
    await login(page, 'gerencia')
    await page.goto('/inventario')
    await expect(page.getByTestId('summary-row-AU24')).toContainText('200')
  })

  test('Escenario C / CA-003 · insuficiencia de hilo con decisión trazada', async ({ page }) => {
    const { m, w, p } = await ids()
    await apiEntry(m('HILO24'), 50)
    const ops = await apiAs('operaciones')
    const order = await (await ops.post('orders', { data: { productId: p('GUC-CAD'), workshopId: w('TC'), targetGrams: 250, targetUnits: 10, commitmentDate: '2026-12-20' } })).json()
    await ops.post(`orders/${order.id}/plan`)

    await login(page, 'operaciones')
    await page.goto('/asignaciones')
    await selectByLabelContaining(page, 'dispatch-workshop', 'TC ·')
    await selectByLabelContaining(page, 'dispatch-order', order.number)
    await expect(page.getByTestId('dispatch-requirements')).toContainText('70')
    await page.getByTestId('dispatch-purpose').fill('Producción cadena Gucci')
    // Las líneas sugeridas se precargan desde los requerimientos; se pesa lo disponible.
    for (let i = 0; i < 2; i++) {
      const label = await page.getByTestId(`dispatch-line-material-${i}`).locator('option:checked').textContent()
      await weighManually(page, `dispatch-line-weighing-${i}`, label!.includes('Hilo') ? 50 : 180)
    }
    await page.getByTestId('dispatch-submit').click()
    await expect(page.getByTestId('insufficiency-dialog')).toBeVisible()
    await expect(page.getByTestId('insufficiency-dialog')).toContainText('20')
    await page.getByTestId('insufficiency-action-REQUEST_FABRICATION').click()
    await selectByLabelContaining(page, 'insufficiency-fabrication-workshop', 'TJV')
    await page.getByTestId('insufficiency-justification').fill('Fabricar 20 g de hilo con Javier')
    await page.getByTestId('insufficiency-confirm').click()
    await expect(page.getByTestId('dispatch-success')).toBeVisible()

    const detail = await (await ops.get(`orders/${order.id}`)).json()
    expect(detail.decisions[0]).toMatchObject({ action: 'REQUEST_FABRICATION', shortfallGrams: 20 })
    expect(detail.decisions[0].generatedOrderId).toBeTruthy()
  })

  test('P04 · pestañas de inventario, custodia y kardex', async ({ page }) => {
    await login(page, 'gerencia')
    await page.goto('/inventario')
    for (const tab of ['balances', 'custody', 'movements', 'kardex']) {
      await page.getByTestId(`inv-tab-${tab}`).click()
    }
    await selectByLabelContaining(page, 'kardex-material', 'Oro 24K')
    await expect(page.getByTestId('kardex-table')).toBeVisible()
  })
})
