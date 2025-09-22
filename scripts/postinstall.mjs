import { execSync } from 'node:child_process'
import { platform, cwd } from 'node:process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

function run(cmd, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv }
  execSync(cmd, { stdio: 'inherit', env })
}

try {
  const homeDir = join(cwd(), '.home')
  try { mkdirSync(homeDir, { recursive: true }) } catch {}
  run('npx electron-rebuild -f -w better-sqlite3', { HOME: homeDir })
} catch (err) {
  console.error('[postinstall] electron-rebuild failed:', err?.message || err)
  process.exit(1)
}

if (platform === 'darwin') {
  const nativeModules = [
    'macos-alias',
    'fs-xattr',
  ]
  for (const mod of nativeModules) {
    try {
      console.log(`[postinstall] Rebuilding ${mod} for DMG creation...`)
      run(`npm rebuild ${mod} --build-from-source`)
      console.log(`[postinstall] ${mod} rebuild complete.`)
    } catch (err) {
      console.warn(`[postinstall] ${mod} rebuild failed (DMG build may fail):`, err?.message || err)
    }
  }
} else {
  console.log('[postinstall] Non-macOS platform; skipping macos-alias rebuild.')
}
