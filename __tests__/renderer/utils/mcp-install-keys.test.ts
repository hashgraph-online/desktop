import {
  getInstalledServerInstallKey,
  getRegistryServerInstallKey,
  getRegistryServerInstallCommandParts,
  selectPreferredRegistryServer,
  type InstalledServerLike,
  type RegistryServerLike,
} from '../../../src/renderer/utils/mcp-install-keys'

describe('mcp install keys', () => {
  test('registry servers with shared names use command for uniqueness', () => {
    const first: RegistryServerLike = {
      id: 'one',
      name: 'Shared Server',
      packageRegistry: 'npm',
      packageName: '@acme/shared-one',
      config: {
        command: 'npx',
        args: ['-y', '@acme/shared-one'],
      },
    }

    const second: RegistryServerLike = {
      id: 'two',
      name: 'Shared Server',
      packageRegistry: 'npm',
      packageName: '@acme/shared-two',
      config: {
        command: 'npx',
        args: ['-y', '@acme/shared-two'],
      },
    }

    const firstKey = getRegistryServerInstallKey(first)
    const secondKey = getRegistryServerInstallKey(second)

    expect(firstKey).toBe('npx -y @acme/shared-one')
    expect(secondKey).toBe('npx -y @acme/shared-two')
    expect(firstKey).not.toBe(secondKey)

    const firstParts = getRegistryServerInstallCommandParts(first)
    const secondParts = getRegistryServerInstallCommandParts(second)

    expect(firstParts).toEqual({ command: 'npx', args: ['-y', '@acme/shared-one'] })
    expect(secondParts).toEqual({ command: 'npx', args: ['-y', '@acme/shared-two'] })
  })

  test('installed server keys include command arguments', () => {
    const installed: InstalledServerLike = {
      id: 'installed-one',
      name: 'Shared Server',
      config: {
        type: 'custom',
        command: 'npx',
        args: ['-y', '@acme/shared-one'],
      },
    }

    const installedKey = getInstalledServerInstallKey(installed)

    expect(installedKey).toBe('npx -y @acme/shared-one')
  })

  test('fallbacks to id when no install command exists', () => {
    const registryOnlyName: RegistryServerLike = {
      id: 'repo-1',
      name: 'Minimal Server',
    }

    const installedWithoutCommand: InstalledServerLike = {
      id: 'server-123',
      name: 'Filesystem',
      config: {
        type: 'filesystem',
      },
    }

    expect(getRegistryServerInstallKey(registryOnlyName)).toBe('repo-1')
    expect(getInstalledServerInstallKey(installedWithoutCommand)).toBe('server-123')
  })

  test('prefers registry server with npm package and higher installs', () => {
    const githubVariant: RegistryServerLike = {
      id: 'wikipedia-github',
      name: 'Wikipedia',
      repository: { url: 'https://github.com/rudra-ravi/wikipedia-mcp' },
      githubStars: 10,
    }

    const npmVariant: RegistryServerLike = {
      id: 'wikipedia-npm',
      name: 'Wikipedia',
      packageRegistry: 'npm',
      packageName: '@mcp/wikipedia',
      installCount: 12500,
      rating: 4.8,
    }

    const preferred = selectPreferredRegistryServer(githubVariant, npmVariant)
    expect(preferred).toBe(npmVariant)

    const preferredWhenReversed = selectPreferredRegistryServer(npmVariant, githubVariant)
    expect(preferredWhenReversed).toBe(npmVariant)
  })

  test('retains existing server when candidates are lower priority', () => {
    const highPriority: RegistryServerLike = {
      id: 'preferred',
      name: 'Example',
      packageRegistry: 'npm',
      packageName: '@acme/example',
      installCount: 5000,
      updatedAt: '2024-06-01T00:00:00Z',
    }

    const lowPriority: RegistryServerLike = {
      id: 'alt',
      name: 'Example',
      repository: { url: 'https://github.com/acme/example' },
    }

    const preferred = selectPreferredRegistryServer(highPriority, lowPriority)
    expect(preferred).toBe(highPriority)
  })
})
