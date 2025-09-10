import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'

const arch = os.arch() // 'arm64' or 'x64'
const outDir = join(process.cwd(), 'out')

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts })
  if (res.status !== 0) {
    process.exit(res.status || 1)
  }
}

run('pnpm', ['run', 'package'])

function findAppPath() {
  const expected = join(outDir, `HOL Desktop-darwin-${arch}`, 'HOL Desktop.app')
  if (existsSync(expected)) return expected

  try {
    const top = readdirSync(outDir).filter((d) => {
      try { return statSync(join(outDir, d)).isDirectory() } catch { return false }
    })
    for (const d of top) {
      const candidate = join(outDir, d, 'HOL Desktop.app')
      if (existsSync(candidate)) return candidate
    }
  } catch {}
  return null
}

const appPath = findAppPath()
if (!appPath) {
  console.error('[fast:run] Could not locate packaged app in out/.')
  process.exit(1)
}

const binPath = join(appPath, 'Contents', 'MacOS', 'HOL Desktop')
const existsBin = existsSync(binPath)
if (!existsBin) {
  console.warn('[fast:run] Binary not found, falling back to open:', binPath)
  console.log(`[fast:run] Opening: ${appPath}`)
  run('open', [appPath])
  process.exit(0)
}

console.log(`[fast:run] Launching binary: ${binPath}`)
const smokeDir = join(process.cwd(), 'temp', 'smoke')
if (process.env.FAST_SMOKE === '1') { try { mkdirSync(smokeDir, { recursive: true }) } catch {} }

const childEnv = {
  ...process.env,
  ELECTRON_ENABLE_LOGGING: '1',
  ELECTRON_ENABLE_STACK_DUMPING: '1',
}
if (process.env.FAST_SMOKE === '1') {
  childEnv.SMOKE_DB = '1'
  childEnv.USER_DATA_DIR = smokeDir
}

const res = spawnSync(binPath, [], {
  stdio: 'inherit',
  env: childEnv,
})

if (process.env.FAST_SMOKE === '1') {
  try {
    const stamp = join(smokeDir, 'smoke-db.json')
    if (existsSync(stamp)) {
      const out = readFileSync(stamp, 'utf8')
      console.log('\n[fast:run] Smoke DB result =>', out)
    } else {
      console.warn('[fast:run] Smoke DB result file not found:', stamp)
    }
  } catch (e) {
    console.warn('[fast:run] Smoke DB read failed:', e?.message || e)
  }
}

process.exit(res.status || 0)
