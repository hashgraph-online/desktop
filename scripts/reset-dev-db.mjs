import { homedir } from 'node:os'
import { join } from 'node:path'
import { rmSync, existsSync } from 'node:fs'

const platform = process.platform
let dbPath
if (platform === 'darwin') {
  dbPath = join(homedir(), 'Library', 'Application Support', 'HOL Desktop', 'mcp-registry.db')
} else if (platform === 'win32') {
  const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
  dbPath = join(appData, 'HOL Desktop', 'mcp-registry.db')
} else {
  dbPath = join(homedir(), '.config', 'HOL Desktop', 'mcp-registry.db')
}

if (existsSync(dbPath)) {
  rmSync(dbPath, { force: true })
  console.log('[reset-dev-db] removed', dbPath)
} else {
  console.log('[reset-dev-db] not found', dbPath)
}

