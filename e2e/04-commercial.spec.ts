import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { apiAs, login, logout, weighManually } from './fixtures'
import { selectOption } from './helpers-ui'

/**
 * Clientes, ventas, abonos y finanzas (P13/P14, RF-025…028, RF-045, CA-009, CA-014).
 * Precondición: escenario demo completo (escenarios A/B/C, piezas liberadas, clientes).
 */
test.describe.serial('Comercial y finanzas por la UI', () => {
  let doradoId = ''

  test.beforeAll(() => {
    execSync('node scripts/demo-scenario.mjs http://localhost:3301', { cwd: '../api', stdio: 'inherit' })
  })

  test('P13 · estado de cuenta con saldos de dinero y material separados', async ({ page }) => {
    await login(page, 'finanzas')
    await page.goto('/clientes')
    await page.getByTestId('customer-search').fill('Dorado')
    await page.getByText('Joyería El Dorado SAS').first().click()
    await expect(page).toHaveURL(/\/clientes\//)
    doradoId = page.url().split('/').pop()!
    await expect(page.getByTestId('balance-money')).toBeVisible()
    await expect(page.getByTestId('balance-material')).toBeVisible()
  })

  test('CA-009 · abono monetario y aporte de material como operaciones diferenciadas', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto(`/clientes/${doradoId}`)
    await page.getByTestId('account-operations').getByText('Cadenas Gucci').first().click()
    await expect(page).toHaveURL(/\/operaciones\//)
    const moneyBefore = await page.getByTestId('op-balance-money').textContent()

    // Aporte de material después de la fabricación (pesado en Balanza Madre).
    await page.getByTestId('contribution-new').click()
    await selectOption(page, 'contribution-material', 'Oro 18K')
    await weighManually(page, 'contribution-weighing', 10)
    await page.getByTestId('contribution-declared').fill('750')
    await page.getByTestId('contribution-timing').selectOption('AFTER_FABRICATION')
    await page.getByTestId('contribution-origin').fill('Cadena rota del cliente')
    await page.getByTestId('contribution-price').fill('400000')
    await expect(page.getByTestId('contribution-fine')).toContainText('7,5')
    await page.getByTestId('contribution-submit').click()
    await page.getByRole('tab', { name: /Aportes de material/ }).click()
    await expect(page.getByTestId('op-contributions')).toContainText('Cadena rota del cliente')
    // El aporte de material no cambia el saldo en dinero.
    await expect(page.getByTestId('op-balance-money')).toHaveText(moneyBefore!)
    await logout(page)

    await login(page, 'finanzas')
    await page.goto(`/clientes/${doradoId}`)
    await page.getByTestId('account-operations').getByText('Cadenas Gucci').first().click()
    await page.getByTestId('payment-new').click()
    await page.getByTestId('payment-amount').fill('2000000')
    await selectOption(page, 'payment-method', 'Efectivo')
    await page.getByTestId('payment-reference').fill('REC-777')
    await page.getByTestId('payment-submit').click()
    await page.getByRole('tab', { name: /Abonos en dinero/ }).click()
    await expect(page.getByTestId('op-payments')).toContainText('REC-777')
    await expect(page.getByTestId('op-balance-money')).not.toHaveText(moneyBefore!)
  })

  test('RF-025 / CA-014 · venta de pieza liberada; las piezas en cuarentena no se pueden despachar', async ({ page }) => {
    // Precondición: una pieza recibida parcialmente (en cuarentena: sin calidad ni ley).
    const ops = await apiAs('operaciones')
    const pul = ((await (await ops.get('orders?status=IN_PRODUCTION&pageSize=50')).json()).items as { id: string; product: { code: string } }[]).find((o) => o.product.code === 'PUL-PIE')!
    const w = await (await ops.post('weighings', { data: { purpose: 'RECEPTION', source: 'MANUAL', grossGrams: 10, manualReason: 'Recepción parcial de prueba' } })).json()
    expect((await ops.post(`orders/${pul.id}/receipts`, { data: { type: 'PARTIAL', acknowledgeWarnings: true, lines: [{ lineType: 'FINISHED_PRODUCT', units: 1, weighingId: w.id }] } })).status()).toBe(201)
    const quarantine = (await (await ops.get('finished-goods?status=QUARANTINE')).json()).items as { id: string; code: string }[]
    expect(quarantine.length).toBeGreaterThan(0)
    await login(page, 'operaciones')
    await page.goto(`/clientes/${doradoId}`)
    await page.getByTestId('account-operations').getByText('Cadenas Gucci').first().click()
    const good = page.getByTestId('sale-good-0')
    await expect(good.locator('option').nth(1)).toBeAttached()
    // Las piezas no liberadas aparecen deshabilitadas.
    const enabled = await good.evaluate((el) => [...(el as HTMLSelectElement).options].filter((o) => o.value && !o.disabled).map((o) => o.value))
    expect(enabled.length).toBeGreaterThan(0)
    const disabled = await good.evaluate((el) => [...(el as HTMLSelectElement).options].filter((o) => o.disabled).map((o) => o.text))
    expect(disabled.some((t) => t.includes(quarantine[0].code))).toBe(true)
    await good.selectOption(enabled[0])
    await page.getByTestId('sale-units-0').fill('1')
    await page.getByTestId('sale-value-0').fill('3200000')
    await page.getByTestId('sale-submit').click()
    await page.getByRole('tab', { name: /Despachos/ }).click()
    await expect(page.getByTestId('op-dispatches')).toContainText('3.200.000')

    // Regla en API: una pieza en cuarentena es rechazada aunque se fuerce la petición.
    const opId = page.url().split('/').pop()
    const res = await ops.post('sales', { data: { operationId: opId, dispatchDate: '2026-10-10', lines: [{ finishedGoodId: quarantine[0].id, units: 1, value: 1 }] } })
    expect(res.status()).toBe(422)
    expect((await res.json()).error).toBe('PRODUCT_NOT_RELEASED')
  })

  test('P14 · registrar egreso con soporte y pago a taller', async ({ page }) => {
    await login(page, 'finanzas')
    await page.goto('/finanzas')
    await page.getByTestId('tx-new').click()
    await page.getByTestId('tx-concept').fill('Mantenimiento de balanza')
    await selectOption(page, 'tx-category', 'Gasto operativo')
    await page.getByTestId('tx-amount').fill('350000')
    await page.getByTestId('tx-support').fill('FAC-BAL-01')
    await page.getByTestId('tx-submit').click()
    await page.getByTestId('tx-finish').click()
    await page.getByRole('tab', { name: 'Transacciones' }).click()
    await page.getByTestId('tx-search').fill('Mantenimiento de balanza')
    await expect(page.getByTestId('tx-table')).toContainText('350.000')
  })

  test('P15/P16/RF-040 · productividad, rentabilidad y exportación', async ({ page }) => {
    await login(page, 'gerencia')
    await page.goto('/productividad')
    await expect(page.locator('svg').getByText('TJV · Javier').first()).toBeVisible()
    await page.goto('/rentabilidad')
    await expect(page.getByText(/Utilidad/).first()).toBeVisible()
    await page.goto('/reportes')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Excel/ }).first().click()
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/)
  })
})
