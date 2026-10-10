import { expect, type Page } from '@playwright/test'

/** Selecciona en un <select> nativo la opción cuyo texto contiene `text` (sensible a mayúsculas). */
export async function selectOption(page: Page, testId: string, text: string) {
  const select = page.getByTestId(testId)
  await expect(select.locator('option').nth(1)).toBeAttached()
  const value = await select.evaluate((el, t) => [...(el as HTMLSelectElement).options].find((o) => o.text.includes(t))?.value, text)
  expect(value, `opción "${text}" en ${testId}`).toBeTruthy()
  await select.selectOption(value!)
}

/** Dibuja una firma en el canvas de firma digital. */
export async function sign(page: Page) {
  const pad = page.getByTestId('signature-pad')
  await pad.scrollIntoViewIfNeeded()
  const box = (await pad.boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 120, box.y + 80, { steps: 8 })
  await page.mouse.move(box.x + 220, box.y + 40, { steps: 8 })
  await page.mouse.up()
}
