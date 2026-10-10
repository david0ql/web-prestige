import { expect, test } from '@playwright/test'
import { apiAs, login, logout, mp4Buffer, pngBuffer, weighManually } from './fixtures'
import { selectOption, sign } from './helpers-ui'

/**
 * Ciclo de vida completo por la interfaz (secciones 6 y 7.1): orden → asignación →
 * confirmación firmada → producción con evidencias → producto terminado →
 * recepción con calidad y ley → conciliación → aprobación → historia visual.
 * CA-003…CA-006, CA-013, CA-016.
 */
test.describe.serial('Producción punta a punta por la UI', () => {
  let orderUrl = ''
  let orderNumber = ''

  test.beforeAll(async () => {
    const ops = await apiAs('operaciones')
    const mats = (await (await ops.get('materials?pageSize=100')).json()).items as { id: string; code: string }[]
    const au18 = mats.find((m) => m.code === 'AU18')!.id
    const w = await (await ops.post('weighings', { data: { purpose: 'ENTRY', source: 'MANUAL', grossGrams: 60, materialId: au18, manualReason: 'Precondición de prueba' } })).json()
    expect((await ops.post('inventory/entries', { data: { materialId: au18, weighingId: w.id, origin: 'Compra oro 18K (e2e)' } })).ok()).toBeTruthy()
  })

  test('P06 · crear y planificar la orden', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto('/ordenes/nueva')
    await selectOption(page, 'order-product', 'Anillo clásico 18K')
    await selectOption(page, 'order-workshop', 'TC')
    await page.getByTestId('order-grams').fill('20')
    await page.getByTestId('order-units').fill('4')
    await page.getByTestId('order-commitment').fill('2026-12-15')
    await expect(page.getByTestId('order-preview')).toContainText('20,4')
    await page.getByTestId('order-create-submit').click()
    await expect(page).toHaveURL(/\/ordenes\/[0-9a-f-]{36}/)
    orderUrl = new URL(page.url()).pathname
    await expect(page.locator('h1').first()).toContainText(/OP-\d{4}-\d+/)
    orderNumber = (await page.locator('h1').first().textContent())!.match(/OP-\d{4}-\d+/)![0]
    await page.getByTestId('order-plan').click()
    await expect(page.getByTestId('order-lifecycle')).toContainText('Lista para despacho')
  })

  test('P05 · despachar desde la orden con pesaje', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto(orderUrl)
    await page.getByTestId('order-dispatch').first().click()
    await expect(page).toHaveURL(/\/asignaciones\?orderId=/)
    await expect(page.getByTestId('dispatch-requirements')).toContainText('20,4')
    await page.getByTestId('dispatch-purpose').fill(`Anillos clásicos ${orderNumber}`)
    await weighManually(page, 'dispatch-line-weighing-0', 20.4)
    await page.getByTestId('dispatch-submit').click()
    await expect(page.getByTestId('dispatch-success')).toBeVisible()
  })

  test('P08 · el taller acepta con firma digital y compromiso', async ({ page }) => {
    await login(page, 'taller.tc')
    await page.goto('/taller/entregas')
    await page.locator('[data-testid^="dispatch-card-"]', { hasText: orderNumber }).first().click()
    await page.getByTestId('confirm-commitment').check()
    await page.getByTestId('confirm-signer').fill('Colmenares')
    await sign(page)
    await page.getByTestId('confirm-accept').click()
    await expect(page).toHaveURL(/\/taller\/ordenes\//)
  })

  test('P09/P10 · el taller registra etapas con fotos y videos, consumos y producto terminado', async ({ page }) => {
    await login(page, 'taller.tc')
    await page.goto(orderUrl.replace('/ordenes/', '/taller/ordenes/'))
    const png = { name: 'evidencia.png', mimeType: 'image/png', buffer: await pngBuffer() }
    const mp4 = { name: 'proceso.mp4', mimeType: 'video/mp4', buffer: mp4Buffer() }

    // Validación crítica: no se completa una etapa obligatoria sin evidencia.
    const fund = page.getByTestId('stage-FUNDICION')
    if ((await fund.getByRole('button').first().getAttribute('aria-expanded')) !== 'true') await fund.getByRole('button').first().click()
    await page.getByTestId('stage-complete-FUNDICION').click()
    await expect(page.getByText(/exige evidencia|falta/i).first()).toBeVisible()

    for (const code of ['FUNDICION', 'ARMADO', 'SOLDADURA', 'PULIDO']) {
      const stage = page.getByTestId(`stage-${code}`)
      const header = stage.getByRole('button').first()
      if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()
      await page.getByTestId(`stage-upload-${code}-input`).setInputFiles(png)
      if (code === 'PULIDO') await page.getByTestId(`stage-upload-${code}-input`).setInputFiles(mp4)
      await expect(stage.getByTestId('media-thumb').first()).toBeVisible()
      await page.getByTestId(`stage-complete-${code}`).click()
      await expect(stage).toContainText(/Completada|completada/)
    }
    const fin = page.getByTestId('stage-TERMINADO')
    const finHeader = fin.getByRole('button').first()
    if ((await finHeader.getAttribute('aria-expanded')) !== 'true') await finHeader.click()
    await page.getByTestId('stage-upload-TERMINADO-input').setInputFiles([png, { ...png, name: 'evidencia-2.png' }])
    await page.getByTestId('stage-upload-TERMINADO-input').setInputFiles(mp4)
    await expect(fin.getByTestId('media-thumb')).toHaveCount(3)

    await selectOption(page, 'consumption-material', 'Oro 18K')
    await page.getByTestId('consumption-grams').fill('20.4')
    await page.getByTestId('consumption-submit').click()
    await expect(page.getByTestId('consumption-row-AU18')).toContainText('20,4')

    await page.getByTestId('finished-grams').fill('20')
    await page.getByTestId('finished-units').fill('4')
    await page.getByTestId('finished-var-CALIBRE').fill('1.8')
    await page.getByTestId('finished-var-ACABADO').selectOption('Brillante')
    await page.getByTestId('finished-var-TALLA').fill('7')
    await page.getByTestId('finished-labor-rate').fill('9000')
    await page.getByTestId('finished-submit').click()
    await expect(page.getByText('Terminada por taller').first()).toBeVisible()
  })

  test('P11 · recepción final pesada, control de calidad y verificación de ley', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto(`${orderUrl}#recepcion`)
    await page.getByTestId('tab-recepcion').click()
    await page.getByTestId('receipt-type').getByText('Final').click()
    await selectOption(page, 'receipt-line-type-0', 'Producto terminado')
    await page.getByTestId('receipt-line-units-0').fill('4')
    await weighManually(page, 'receipt-weighing-0', 20)
    await page.getByTestId('receipt-submit').click()
    await expect(page.getByTestId('order-lifecycle')).toContainText('En revisión')

    await page.locator('[data-testid^="quality-open-"]').first().click()
    await page.getByTestId('quality-submit').click()
    await page.locator('[data-testid^="purity-open-"]').first().click()
    await page.getByTestId('purity-method').selectOption('XRF')
    await page.getByTestId('purity-value').fill('740')
    await expect(page.getByTestId('purity-conformity')).toContainText(/No conforme|no conforme/)
    await page.getByTestId('purity-value').fill('751.5')
    await expect(page.getByTestId('purity-conformity')).toContainText(/Conforme/)
    await page.getByTestId('purity-support').fill('XRF-E2E-001')
    await page.getByTestId('purity-submit').click()
    await expect(page.getByText('751,5').first()).toBeVisible()
  })

  test('P12 · conciliación, registro de merma y aprobación por Gerencia', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto(`${orderUrl}#conciliacion`)
    await page.getByTestId('tab-conciliacion').click()
    await expect(page.getByTestId('reconciliation-transformation')).toContainText('0,4')
    await page.getByTestId('generate-discrepancies').click()
    await expect(page.getByTestId('reconciliation-status')).toContainText(/Cuadrada|cuadrada|sin bloqueos/i)
    await logout(page)

    // RN-009: el taller no puede aprobar; Gerencia sí.
    await login(page, 'gerencia')
    await page.goto(`${orderUrl}#conciliacion`)
    await page.getByTestId('tab-conciliacion').click()
    await expect(page.getByTestId('approval-panel')).toBeVisible()
    await page.getByTestId('approve-notes').fill('Producción conforme')
    await page.getByTestId('approve-submit').click()
    await expect(page.getByText('Orden aprobada y cerrada')).toBeVisible()
    await expect(page.getByTestId('order-cost-snapshot')).toBeVisible()
  })

  test('P20 · historia visual por etapas y enlace público para el consumidor', async ({ page, browser }) => {
    await login(page, 'gerencia')
    await page.goto(`${orderUrl}/historia`)
    await expect(page.getByTestId('story-timeline')).toBeVisible()
    await expect(page.getByTestId('media-thumb').first()).toBeVisible()
    await page.getByTestId('story-share-create').click()
    await page.getByTestId('story-share-submit').click()
    const shares = page.getByTestId('story-shares')
    await expect(shares).toContainText('/historia/')
    const href = await shares.locator('a[href*="/historia/"]').first().getAttribute('href')
    const url = new URL(href!).pathname
    const anon = await browser.newPage()
    await anon.goto(url)
    await expect(anon.getByText('Anillo clásico 18K').first()).toBeVisible()
    await expect(anon.locator('img').first()).toBeVisible()
    await anon.close()
  })
})
