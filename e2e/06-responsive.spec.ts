import { expect, test } from '@playwright/test'
import { login } from './fixtures'

/** RNF-001/002: funciones de taller y oficina operables en móvil/tablet sin scroll horizontal. */
const noHorizontalScroll = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)

for (const [user, paths] of [
  ['taller.tj', ['/taller', '/taller/ordenes', '/taller/entregas', '/taller/solicitudes', '/alertas']],
  ['gerencia', ['/dashboard', '/ordenes', '/inventario', '/aprobaciones', '/productividad', '/rentabilidad', '/finanzas', '/catalogo']],
  ['operaciones', ['/balanza', '/asignaciones', '/ordenes/nueva', '/clientes']],
] as const) {
  test(`móvil 390px sin desbordes · ${user}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, user)
    for (const path of paths) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(await noHorizontalScroll(page), `${path} desborda horizontalmente`).toBe(true)
    }
  })
}
