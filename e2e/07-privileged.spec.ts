import { expect, test } from '@playwright/test'
import { apiAs, login } from './fixtures'

/** Acciones privilegiadas y auditables (RN-015, RN-019, RN-020). */
test.describe.serial('Acciones privilegiadas por la UI', () => {
  test('RN-015 · el administrador reversa una entrada (nunca se borra)', async ({ page }) => {
    const ops = await apiAs('operaciones')
    const mats = (await (await ops.get('materials?pageSize=100')).json()).items as { id: string; code: string }[]
    const cu = mats.find((m) => m.code === 'CU')!.id
    const w = await (await ops.post('weighings', { data: { purpose: 'ENTRY', source: 'MANUAL', grossGrams: 7.77, materialId: cu, manualReason: 'Entrada duplicada de prueba' } })).json()
    const mv = await (await ops.post('inventory/entries', { data: { materialId: cu, weighingId: w.id, origin: 'Duplicado para reverso' } })).json()

    await login(page, 'admin')
    await page.goto('/inventario')
    await page.getByTestId('inv-tab-movements').click()
    await page.getByText(mv.number).first().click()
    await page.getByTestId('movement-reverse').click()
    await page.getByTestId('reason-input').fill('Entrada registrada dos veces')
    await page.getByTestId('reason-confirm').click()
    await expect(page.getByRole('dialog').getByText('Reversado')).toBeVisible()
    const after = await (await ops.get(`inventory/movements/${mv.id}`)).json()
    expect(after.status).toBe('REVERSED')
  })

  test('RN-019 · Gerencia ajusta un pesaje no utilizado con motivo trazado', async ({ page }) => {
    const ops = await apiAs('operaciones')
    const w = await (await ops.post('weighings', { data: { purpose: 'ENTRY', source: 'SCALE', grossGrams: 50.12, rawReading: 'ST,GS,+     50.12 g' } })).json()
    await login(page, 'gerencia')
    await page.goto('/balanza')
    await page.getByRole('tab', { name: /Pesajes recientes/ }).click()
    await page.getByTestId(`weighing-adjust-${w.number}`).click()
    await page.getByTestId('weighing-adjust-grams').fill('50.10')
    await page.getByTestId('weighing-adjust-reason').fill('Recalibración certificada de la balanza')
    await page.getByTestId('weighing-adjust-confirm').click()
    await expect.poll(async () => (await (await ops.get(`weighings/${w.id}`)).json()).currentNetGrams).toBe(50.1)
  })

  test('RN-020 · Finanzas cierra un período y queda bloqueado', async ({ page }) => {
    await login(page, 'finanzas')
    await page.goto('/finanzas')
    await page.getByRole('tab', { name: /Cierres/ }).click()
    await page.getByTestId('close-period').fill('2026-08')
    await page.getByTestId('close-submit').click()
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('closes-table')).toContainText(/agosto/i)
    const fin = await apiAs('finanzas')
    const cats = (await (await fin.get('finance-categories')).json()) as { id: string; code: string }[]
    const res = await fin.post('finance/transactions', { data: { type: 'EXPENSE', categoryId: cats.find((c) => c.code === 'GASTO_OPERATIVO')!.id, concept: 'Tardío', amount: 1000, transactionDate: '2026-08-15' } })
    expect(res.status()).toBe(422)
  })
})
