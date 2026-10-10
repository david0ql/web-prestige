import { execSync } from 'node:child_process'

/** Reconstruye la base e2e (migraciones + seed demo) y compila la API antes de levantarla. */
export default function globalSetup() {
  const opts = { cwd: '../api', stdio: 'inherit' as const, env: { ...process.env, DATABASE_NAME: 'prestige_e2e', STORAGE_DIR: './storage-e2e', NODE_ENV: 'development' } }
  execSync('npm run build', opts)
  execSync('npm run db:reset', opts)
}
