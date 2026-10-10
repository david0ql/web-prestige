import { expect, test } from '@playwright/test'
import { apiAs, login, pngBuffer } from './fixtures'
import { selectOption } from './helpers-ui'

/** RNF-002: un flujo real de taller operado completo desde un celular (390 px). */
test('[RNF-002] el taller registra evidencia, consumo y avance desde el celular', async ({ page }) => {
  const tj = await apiAs('taller.tj')
  const order = ((await (await tj.get('orders?status=IN_PRODUCTION&status=PARTIAL&pageSize=10')).json()).items as { id: string }[])[0]
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, 'taller.tj')
  await page.goto(`/taller/ordenes/${order.id}`)
  // Evidencia de la etapa actual desde el uploader del celular.
  const stage = page.locator('[data-testid^="stage-"]').filter({ has: page.locator('[aria-expanded="true"]') }).first()
  const input = stage.locator('input[type=file]').first()
  await input.setInputFiles({ name: 'celular.png', mimeType: 'image/png', buffer: await pngBuffer('#a9822c') })
  await expect(stage.getByTestId('media-thumb').first()).toBeVisible()
  // Consumo.
  await selectOption(page, 'consumption-material', 'Cadena tipo italiana 18K')
  await page.getByTestId('consumption-grams').fill('1.5')
  await page.getByTestId('consumption-submit').click()
  await expect(page.getByTestId('consumption-row-CADIT')).toBeVisible()
  // Avance parcial.
  await page.getByTestId('progress-grams').fill('12')
  await page.getByTestId('progress-units').fill('2')
  await page.getByTestId('progress-notes').fill('Avance desde el celular')
  await page.getByTestId('progress-submit').click()
  await expect(page.getByText('Avance desde el celular').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
})
