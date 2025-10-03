export interface RegistryServerLike {
  id?: string
  name?: string
  packageRegistry?: string
  packageName?: string
  repository?: {
    url?: string | null
  } | null
  config?: {
    command?: string | null
    args?: string[] | null
  } | null
  installCount?: number | null
  rating?: number | null
  githubStars?: number | null
  updatedAt?: string | null
}

export interface InstalledServerLike {
  id: string
  name?: string
  config?: {
    type?: string
    command?: string | null
    args?: string[] | null
  } | null
}

export interface InstallCommandParts {
  command: string
  args: string[]
}

const trimmedJoin = (parts: string[]): string =>
  parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ')

const stripGitSuffix = (value: string): string =>
  value.replace(/\.git$/i, '')

const normalizeGithubReference = (value?: string | null): string | null => {
  if (!value) {
    return null
  }
  const raw = value.trim()
  if (!raw) {
    return null
  }

  if (raw.startsWith('github:')) {
    return stripGitSuffix(raw.slice('github:'.length))
  }

  if (raw.startsWith('git@github.com:')) {
    return stripGitSuffix(raw.slice('git@github.com:'.length))
  }

  const withoutGitPrefix = raw.replace(/^git\+/, '')

  try {
    const parsed = new URL(withoutGitPrefix)
    if (/github\.com$/i.test(parsed.hostname)) {
      const segments = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean)
      if (segments.length >= 2) {
        return stripGitSuffix(`${segments[0]}/${segments[1]}`)
      }
    }
  } catch {}

  const simpleMatch = withoutGitPrefix.match(/^([^/]+)\/([^/]+)$/)
  if (simpleMatch) {
    return stripGitSuffix(`${simpleMatch[1]}/${simpleMatch[2]}`)
  }

  return null
}

const buildCommandFromParts = (
  command: string,
  args: string[] | null | undefined
): string => {
  return trimmedJoin([command, ...(args ?? [])])
}

const resolveInstallPartsFromRegistry = (
  server: RegistryServerLike
): InstallCommandParts | null => {
  const command = server.config?.command?.trim()
  if (command) {
    return {
      command,
      args: server.config?.args ? [...server.config.args] : [],
    }
  }

  if (server.packageRegistry === 'npm' && server.packageName) {
    return {
      command: 'npx',
      args: ['-y', server.packageName],
    }
  }

  if (server.packageRegistry === 'pypi' && server.packageName) {
    return {
      command: 'uvx',
      args: [server.packageName],
    }
  }

  const repoUrl = server.repository?.url
  if (repoUrl) {
    const repo = normalizeGithubReference(repoUrl)
    if (repo) {
      return {
        command: 'npx',
        args: ['-y', `github:${repo}`],
      }
    }
  }

  return null
}

const computeRegistryServerScore = (
  server: RegistryServerLike
): number => {
  let score = 0
  const installParts = resolveInstallPartsFromRegistry(server)
  if (installParts) {
    score += 1_000_000
  }

  if (server.packageRegistry === 'npm') {
    score += 500_000
  } else if (server.packageRegistry === 'pypi') {
    score += 400_000
  } else if (server.packageRegistry) {
    score += 100_000
  }

  if (server.packageName) {
    score += 25_000
  }

  if (server.repository?.url) {
    score += 10_000
  }

  const installCount = Number(server.installCount ?? 0)
  if (!Number.isNaN(installCount) && installCount > 0) {
    score += Math.min(Math.floor(installCount), 1_500_000)
  }

  const rating = Number(server.rating ?? 0)
  if (!Number.isNaN(rating) && rating > 0) {
    score += Math.floor(rating * 1000)
  }

  const githubStars = Number(server.githubStars ?? 0)
  if (!Number.isNaN(githubStars) && githubStars > 0) {
    score += Math.min(Math.floor(githubStars), 500_000)
  }

  const updatedAt = server.updatedAt ? Date.parse(server.updatedAt) : NaN
  if (!Number.isNaN(updatedAt) && updatedAt > 0) {
    score += Math.floor(updatedAt / 1_000_000)
  }

  return score
}

const getUpdatedAtTimestamp = (server: RegistryServerLike): number => {
  const value = server.updatedAt ? Date.parse(server.updatedAt) : NaN
  return Number.isNaN(value) ? 0 : value
}

/**
 * Builds a key representing the installation target for a registry server.
 * @param server Registry server metadata
 * @returns Key string used for uniqueness checks
 */
export function getRegistryServerInstallKey(server: RegistryServerLike): string {
  const derived = resolveInstallPartsFromRegistry(server)
  if (derived) {
    return buildCommandFromParts(derived.command, derived.args)
  }

  if (server.packageName) {
    return server.packageName.toLowerCase()
  }

  if (server.repository?.url) {
    const normalized = normalizeGithubReference(server.repository.url)
    if (normalized) {
      return `github:${normalized}`
    }
    return server.repository.url.toLowerCase()
  }

  if (server.id) {
    return server.id
  }

  if (server.name) {
    return server.name.toLowerCase()
  }

  return ''
}

/**
 * Returns the normalized command and args for installing a registry server.
 * @param server Registry server metadata
 * @returns Command parts or null when unavailable
 */
export function getRegistryServerInstallCommandParts(
  server: RegistryServerLike
): InstallCommandParts | null {
  const parts = resolveInstallPartsFromRegistry(server)
  if (!parts) {
    return null
  }
  return {
    command: parts.command,
    args: [...parts.args],
  }
}

/**
 * Builds a stable key for an installed MCP server configuration.
 * @param server Installed server configuration
 * @returns Key string used for comparisons with registry entries
 */
export function getInstalledServerInstallKey(server: InstalledServerLike): string {
  const config = server.config
  if (config && config.type === 'custom' && config.command) {
    return buildCommandFromParts(config.command, config.args ?? [])
  }
  return server.id
}

/**
 * Selects the preferred registry server when duplicates share the same install key.
 * @param existing Currently selected server
 * @param candidate Candidate server to compare
 * @returns Server with higher priority
 */
export function selectPreferredRegistryServer<T extends RegistryServerLike>(
  existing: T,
  candidate: T
): T {
  const existingScore = computeRegistryServerScore(existing)
  const candidateScore = computeRegistryServerScore(candidate)

  if (candidateScore > existingScore) {
    return candidate
  }

  if (candidateScore < existingScore) {
    return existing
  }

  const existingInstallCount = Number(existing.installCount ?? 0)
  const candidateInstallCount = Number(candidate.installCount ?? 0)
  if (candidateInstallCount > existingInstallCount) {
    return candidate
  }
  if (candidateInstallCount < existingInstallCount) {
    return existing
  }

  const existingUpdated = getUpdatedAtTimestamp(existing)
  const candidateUpdated = getUpdatedAtTimestamp(candidate)
  if (candidateUpdated > existingUpdated) {
    return candidate
  }
  if (candidateUpdated < existingUpdated) {
    return existing
  }

  if (candidate.packageRegistry === 'npm' && existing.packageRegistry !== 'npm') {
    return candidate
  }
  if (existing.packageRegistry === 'npm' && candidate.packageRegistry !== 'npm') {
    return existing
  }

  if (candidate.repository?.url && !existing.repository?.url) {
    return candidate
  }
  if (!candidate.repository?.url && existing.repository?.url) {
    return existing
  }

  return existing
}
