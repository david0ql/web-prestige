import { chromium } from '@playwright/test'
const out = process.argv[2]
const user = process.argv[3] ?? 'gerencia'
const paths = process.argv.slice(4)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('http://localhost:5180/login')
await page.screenshot({ path: `${out}/login.png` })
await page.fill('[data-testid=login-username]', user)
await page.fill('[data-testid=login-password]', 'Prestige.2026!')
await page.click('[data-testid=login-submit]')
await page.waitForTimeout(2500)
for (const p of paths) {
  await page.goto(`http://localhost:5180${p}`)
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${out}/${user}${p.replace(/\//g, '_') || '_root'}.png`, fullPage: true })
}
console.log('errors:', JSON.stringify(errors.slice(0, 10)))
await browser.close()
