import { describe, it, expect } from '@jest/globals'
import { normalizeGithubUrl, computeMcpIdFromRegistryServer } from '../src/main/utils/mcp-identity'

describe('mcp-identity utils', () => {
  describe('normalizeGithubUrl', () => {
    const cases = [
      ['https://github.com/Owner/Repo', 'https://github.com/owner/repo'],
      ['http://github.com/Owner/Repo', 'https://github.com/owner/repo'],
      ['git+https://github.com/Owner/Repo.git', 'https://github.com/owner/repo'],
      ['git@github.com:Owner/Repo.git', 'https://github.com/owner/repo'],
      ['github:Owner/Repo', 'https://github.com/owner/repo'],
      ['OWNER/REPO', 'https://github.com/owner/repo'],
    ] as const

    it('normalizes multiple GitHub URL formats', () => {
      for (const [input, expected] of cases) {
        expect(normalizeGithubUrl(input)).toBe(expected)
      }
    })

    it('returns null for non-github hosts or bad input', () => {
      expect(normalizeGithubUrl(undefined)).toBeNull()
      expect(normalizeGithubUrl(null as any)).toBeNull()
      expect(normalizeGithubUrl('https://gitlab.com/owner/repo')).toBeNull()
      expect(normalizeGithubUrl('not a url')).toBeNull()
    })
  })

  describe('computeMcpIdFromRegistryServer', () => {
    it('prefers GitHub over package names', () => {
      const id = computeMcpIdFromRegistryServer({
        name: 'Some Tool',
        packageRegistry: 'npm',
        packageName: '@Acme/Tool',
        repository: { url: 'git@github.com:Owner/Repo.git' },
      })
      expect(id).toBe('gh:owner/repo')
    })

    it('falls back to npm when GitHub missing', () => {
      const id = computeMcpIdFromRegistryServer({
        packageRegistry: 'npm',
        packageName: '@Scope/Package'
      })
      expect(id).toBe('npm:@scope/package')
    })

    it('falls back to pypi when npm and GitHub missing', () => {
      const id = computeMcpIdFromRegistryServer({
        packageRegistry: 'pypi',
        packageName: 'Project_Name'
      })
      expect(id).toBe('pypi:project_name')
    })

    it('falls back to name when no repo or package present', () => {
      const id = computeMcpIdFromRegistryServer({ name: 'Friendly Name' })
      expect(id).toBe('name:friendly name')
    })

    it('produces same id for GitHub variants (dedupe support)', () => {
      const a = computeMcpIdFromRegistryServer({ repository: { url: 'github:Owner/Repo' } })
      const b = computeMcpIdFromRegistryServer({ repository: { url: 'https://github.com/owner/repo' } })
      const c = computeMcpIdFromRegistryServer({ repository: { url: 'git@github.com:OWNER/REPO.git' } })
      expect(a).toBe('gh:owner/repo')
      expect(b).toBe('gh:owner/repo')
      expect(c).toBe('gh:owner/repo')
    })
  })
})

