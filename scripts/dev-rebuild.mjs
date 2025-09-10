import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

function run(cmd, env) {
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })
}

try {
  const homeDir = join(process.cwd(), '.home')
  try { mkdirSync(homeDir, { recursive: true }) } catch {}
  const env = {
    HOME: homeDir,
  }
  const cmd = 'npx electron-rebuild -f -w better-sqlite3'
  console.log('[dev:rebuild] Running:', cmd, 'with HOME=', homeDir)
  run(cmd, env)
  console.log('[dev:rebuild] electron-rebuild complete')
} catch (err) {
  console.error('[dev:rebuild] electron-rebuild failed:', err?.message || err)
  process.exit(1)
}

