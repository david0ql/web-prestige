import { expect, test } from '@playwright/test'
import { apiAs, login, logout } from './fixtures'
import { selectOption } from './helpers-ui'

test.describe.serial('Administración, catálogo, control y aislamiento por la UI', () => {
  test('CA-012 · crear un taller nuevo y su usuario sin tocar código', async ({ page }) => {
    await login(page, 'admin')
    await page.goto('/administracion')
    await expect(page).toHaveURL(/administracion/)
    await page.getByTestId('admin-tab-talleres').click()
    await page.getByTestId('workshop-new').click()
    await page.getByTestId('workshop-code').fill('ALX')
    await page.getByTestId('workshop-name').fill('Alex')
    await page.getByTestId('workshop-responsible').fill('Alex')
    await page.getByTestId('workshop-products').getByRole('button').first().click()
    await page.getByRole('option', { name: /GUC-CAD/ }).click()
    await page.keyboard.press('Escape')
    await page.getByTestId('workshop-save').click()
    await expect(page.getByTestId('workshop-created')).toContainText('TALLER-ALX')

    await page.getByTestId('admin-tab-usuarios').click()
    await page.getByTestId('user-new').click()
    await page.getByTestId('user-username').fill('taller.alx')
    await page.getByTestId('user-fullname').fill('Usuario Taller Alex')
    await page.getByTestId('user-email').fill('alx@prestigegold.local')
    await selectOption(page, 'user-role', 'Taller')
    await selectOption(page, 'user-workshop', 'ALX')
    await page.getByTestId('user-password').fill('TallerAlex.2026')
    const mustChange = page.getByRole('checkbox', { name: /cambiar/i })
    if (await mustChange.count()) await mustChange.first().click()
    await page.getByTestId('user-save').click()
    await expect(page.getByTestId('users-table')).toContainText('taller.alx')
    await logout(page)

    await page.goto('/login')
    await page.getByTestId('login-username').fill('taller.alx')
    await page.getByTestId('login-password').fill('TallerAlex.2026')
    await page.getByTestId('login-submit').click()
    await expect(page.getByText('Taller ALX', { exact: true })).toBeVisible()
  })

  test('CA-015 · nueva versión de ficha técnica conservando el histórico', async ({ page }) => {
    await login(page, 'operaciones')
    await page.goto('/catalogo')
    await page.getByTestId('catalog-search').fill('Balines')
    await page.getByTestId('catalog-card').first().click()
    await expect(page.getByTestId('current-sheet')).toBeVisible()
    await page.getByTestId('sheet-new-version').click()
    await page.getByTestId('sheet-measures').fill('Balín 4 mm diamantado · lote 2026')
    await page.getByTestId('sheet-reason').fill('Ajuste de medidas tras control de calidad')
    await page.getByTestId('sheet-save').click()
    await expect(page.getByTestId('sheet-version-2')).toBeVisible()
    await expect(page.getByTestId('sheet-version-1')).toBeVisible()
  })

  test('CA-008 · una diferencia de entrega exige justificación y aprobación de Gerencia', async ({ page }) => {
    // Precondición: entrega aceptada por el taller con un peso menor al despachado.
    const ops = await apiAs('operaciones')
    const tj = await apiAs('taller.tj')
    const mats = (await (await ops.get('materials?pageSize=100')).json()).items as { id: string; code: string }[]
    const ws = (await (await ops.get('workshops?pageSize=50')).json()).items as { id: string; code: string }[]
    const ag = mats.find((m) => m.code === 'AG1000')!.id
    const we = await (await ops.post('weighings', { data: { purpose: 'ENTRY', source: 'MANUAL', grossGrams: 30, materialId: ag, manualReason: 'Precondición' } })).json()
    await ops.post('inventory/entries', { data: { materialId: ag, weighingId: we.id, origin: 'Precondición e2e' } })
    const wd = await (await ops.post('weighings', { data: { purpose: 'DISPATCH', source: 'MANUAL', grossGrams: 10, materialId: ag, manualReason: 'Precondición' } })).json()
    const d = await (await ops.post('dispatches', { data: { workshopId: ws.find((w) => w.code === 'TJ')!.id, purpose: 'Plata para dijes', lines: [{ materialId: ag, weighingId: wd.id }] } })).json()
    await tj.post(`dispatches/${d.id}/respond`, { data: { decision: 'ACCEPT', signerName: 'Jasmine', acceptCommitment: true, lines: [{ lineId: d.lines[0].id, receivedGrams: 9.5 }] } })

    await login(page, 'gerencia')
    await page.goto('/diferencias')
    const justify = page.locator('[data-testid^="disc-justify-"]').first()
    await justify.click()
    await page.getByTestId('disc-justification').fill('Faltante verificado en video de empaque')
    await page.getByTestId('disc-justify-submit').click()
    await page.locator('[data-testid^="disc-approve-"]').first().click()
    await page.getByTestId('disc-review-submit').click()
    await page.getByTestId('disc-filter-status').selectOption('APPROVED')
    await expect(page.getByText('Faltante verificado en video de empaque').first()).toBeVisible()
    const discs = (await (await ops.get(`discrepancies?workshopId=${ws.find((x) => x.code === 'TJ')!.id}&pageSize=50`)).json()).items as { justification: string; status: string; approvedAt: string }[]
    expect(discs.find((x) => x.justification === 'Faltante verificado en video de empaque')).toMatchObject({ status: 'APPROVED' })
  })

  test('CA-007 · un taller no puede ver órdenes de otro taller', async ({ page }) => {
    const ops = await apiAs('operaciones')
    const ws = (await (await ops.get('workshops?pageSize=50')).json()).items as { id: string; code: string }[]
    const ps = (await (await ops.get('products?pageSize=50')).json()).items as { id: string; code: string }[]
    const foreign = await (await ops.post('orders', { data: { productId: ps.find((p) => p.code === 'ANI-CL')!.id, workshopId: ws.find((w) => w.code === 'TC')!.id, targetGrams: 10, commitmentDate: '2026-12-31' } })).json()
    await login(page, 'taller.tj')
    await page.goto(`/taller/ordenes/${foreign.id}`)
    await expect(page.getByText(/no encontrad|no existe|no tienes acceso/i).first()).toBeVisible()
    await page.goto('/finanzas')
    await expect(page.getByText(/permiso|no tienes|no encontrad/i).first()).toBeVisible()
  })

  test('P17 · alertas: ejecutar revisión y marcar como vista', async ({ page }) => {
    await login(page, 'gerencia')
    await page.goto('/alertas')
    await page.getByTestId('alerts-run-checks').click()
    await expect(page.getByTestId('alert-item').first()).toBeVisible()
    const first = page.getByTestId('alert-item').filter({ has: page.getByTestId('alert-ack') }).first()
    const title = (await first.locator('p').first().textContent())!.trim()
    const before = await page.getByTestId('alert-ack').count()
    await first.getByTestId('alert-ack').click()
    await expect(page.getByTestId('alert-ack')).toHaveCount(before - 1)
    const ops = await apiAs('operaciones')
    const acked = ((await (await ops.get('alerts?status=ACKNOWLEDGED&pageSize=100')).json()).items as { title: string; status: string }[]).find((a) => a.title === title)
    expect(acked?.status).toBe('ACKNOWLEDGED')
  })

  test('RF-036 · bitácora de auditoría consultable por el auditor', async ({ page }) => {
    await login(page, 'auditor')
    await page.goto('/auditoria')
    await expect(page.locator('table').getByText('Inicio de sesión').first()).toBeVisible()
  })
})
