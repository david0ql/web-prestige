import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { apiAs, login } from './fixtures'
import { sign } from './helpers-ui'

/**
 * RNF-001 · Usabilidad, medida con criterios objetivos:
 *  1) accesibilidad WCAG 2.1 A/AA (axe-core): cero violaciones graves o críticas en las pantallas operativas;
 *  2) apta para tablet: sin desbordes a 1024×768 y metas táctiles ≥ 44 px en las acciones del taller;
 *  3) flujo mínimo de pasos: el taller confirma una entrega desde su panel en ≤ 7 interacciones.
 */
const TABLET = { width: 1024, height: 768 }

/** Una orden del taller TC (la crea si la corrida no trae datos previos). */
async function tcOrderId() {
  const tc = await apiAs('taller.tc')
  const found = ((await (await tc.get('orders?pageSize=10')).json()).items as { id: string }[])[0]
  if (found) return found.id
  const ops = await apiAs('operaciones')
  const pick = async (path: string, code: string) => ((await (await ops.get(path)).json()).items as { id: string; code: string }[]).find((x) => x.code === code)!.id
  const res = await ops.post('orders', { data: { productId: await pick('products?pageSize=50', 'ANI-CL'), workshopId: await pick('workshops?pageSize=50', 'TC'), targetGrams: 10, commitmentDate: '2026-12-31' } })
  return (await res.json()).id as string
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
}

test.describe('RNF-001 · usabilidad medible', () => {
  test.use({ viewport: TABLET })

  test('[RNF-001] accesibilidad WCAG 2.1 AA sin violaciones graves en las pantallas operativas (tablet)', async ({ page }) => {
    const report: Record<string, string[]> = {}
    await page.goto('/login')
    report['/login'] = await axe(page)
    const tcOrder = await tcOrderId()
    const screens: [string, string[]][] = [
      ['gerencia', ['/dashboard', '/inventario', '/ordenes', '/aprobaciones', '/productividad', '/rentabilidad', '/alertas']],
      ['operaciones', ['/balanza', '/asignaciones', '/recepciones', '/clientes', '/catalogo']],
      ['finanzas', ['/finanzas']],
      ['admin', ['/administracion']],
      ['taller.tc', ['/taller', '/taller/entregas', `/taller/ordenes/${tcOrder}`, '/taller/solicitudes']],
    ]
    for (const [user, paths] of screens) {
      await login(page, user)
      for (const path of paths) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        report[path] = await axe(page)
        if (!(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))) report[path].push('desborde horizontal en tablet')
      }
      await page.context().clearCookies()
    }
    const failing = Object.entries(report).filter(([, v]) => v.length)
    expect(failing, JSON.stringify(failing, null, 2)).toEqual([])
  })

  test('[RNF-001] metas táctiles ≥ 44 px en las acciones del taller (tablet y celular)', async ({ page }) => {
    const order = await tcOrderId()
    for (const vp of [TABLET, { width: 390, height: 844 }]) {
      await page.setViewportSize(vp)
      await login(page, 'taller.tc')
      await page.goto(`/taller/ordenes/${order}`)
      await page.waitForLoadState('networkidle')
      const small = await page.locator('main button:visible, main a[role=button]:visible, main [role=tab]:visible').evaluateAll((els) =>
        els
          .map((e) => ({ t: (e.getAttribute('data-testid') || e.textContent || '').trim().slice(0, 40), h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width }))
          .filter((x) => x.h > 0 && (x.h < 44 || x.w < 44)),
      )
      expect(small, `${vp.width}px: ${JSON.stringify(small)}`).toEqual([])
      await page.context().clearCookies()
    }
  })

  test('[RNF-001] flujo mínimo: el taller confirma una entrega desde su panel en ≤ 7 interacciones', async ({ page }) => {
    // Precondición por API: orden planificada y despacho pesado pendiente para el taller TC.
    const ops = await apiAs('operaciones')
    const pick = async (path: string, code: string) => ((await (await ops.get(path)).json()).items as { id: string; code: string }[]).find((x) => x.code === code)!.id
    const au18 = await pick('materials?pageSize=100', 'AU18')
    const weigh = async (grams: number, purpose: string) => (await (await ops.post('weighings', { data: { purpose, source: 'MANUAL', grossGrams: grams, materialId: au18, manualReason: 'Prueba de pasos' } })).json()).id as string
    await ops.post('inventory/entries', { data: { materialId: au18, weighingId: await weigh(12, 'ENTRY'), origin: 'Prueba de pasos' } })
    const order = await (await ops.post('orders', { data: { productId: await pick('products?pageSize=50', 'ANI-CL'), workshopId: await pick('workshops?pageSize=50', 'TC'), targetGrams: 10, targetUnits: 2, commitmentDate: '2026-12-31' } })).json()
    await ops.post(`orders/${order.id}/plan`)
    const d = await (await ops.post('dispatches', { data: { orderId: order.id, purpose: 'Prueba de pasos', lines: [{ materialId: au18, weighingId: await weigh(10.2, 'DISPATCH') }] } })).json()

    await login(page, 'taller.tc')
    await page.goto('/taller')
    let steps = 0
    const step = async (fn: () => Promise<unknown>) => { steps++; await fn() }
    await step(() => page.locator('[data-testid^="task-"]', { hasText: d.number }).first().click())
    await step(() => page.getByTestId('confirm-received-0').fill('10.2'))
    await step(() => page.getByTestId('confirm-commitment').check())
    await step(() => page.getByTestId('confirm-signer').fill('Colmenares'))
    await step(() => sign(page))
    await step(() => page.getByTestId('confirm-accept').click())
    await expect(page).toHaveURL(/\/taller\/ordenes\//)
    const after = await (await ops.get(`dispatches/${d.id}`)).json()
    expect(after.status).toBe('ACCEPTED')
    expect(steps).toBeLessThanOrEqual(7)
  })
})
