import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/** API hermana: ../api (monorepo) o ../api-prestige (repositorios separados). Sobrescribible con API_DIR. */
const API_DIR = process.env.API_DIR ?? (existsSync('../api/package.json') ? '../api' : '../api-prestige')

/**
 * Pruebas de clic (end-to-end) sobre un ambiente aislado:
 *  - API en :3301 contra la base `prestige_e2e` (se reconstruye en global-setup).
 *  - Web (Vite) en :5181 con proxy a esa API.
 * Un solo worker porque los escenarios comparten la base.
 */
const API_PORT = 3301
const WEB_PORT = 5181

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: 'node dist/main',
      cwd: API_DIR,
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_NAME: 'prestige_e2e',
        STORAGE_DIR: './storage-e2e',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        WEB_URL: `http://localhost:${WEB_PORT}`,
        LOGIN_THROTTLE_LIMIT: '2000',
        FORGOT_THROTTLE_LIMIT: '2000',
        REFRESH_THROTTLE_LIMIT: '5000',
        THROTTLE_LIMIT: '100000',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
})
