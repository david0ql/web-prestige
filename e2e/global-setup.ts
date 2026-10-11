import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** API hermana: ../api (monorepo) o ../api-prestige (repositorios separados). Sobrescribible con API_DIR. */
const API_DIR = process.env.API_DIR ?? (existsSync('../api/package.json') ? '../api' : '../api-prestige')

/** Reconstruye la base e2e (migraciones + seed demo) y compila la API antes de levantarla. */
export default function globalSetup() {
  const opts = { cwd: API_DIR, stdio: 'inherit' as const, env: { ...process.env, DATABASE_NAME: 'prestige_e2e', STORAGE_DIR: './storage-e2e', NODE_ENV: 'development' } }
  execSync('npm run build', opts)
  execSync('npm run db:reset', opts)
}
