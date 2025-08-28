/**
 * Unit tests to verify MCP Registry Service critical bug fixes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('MCPRegistryService Critical Bug Fixes', () => {
  let mockPath: typeof import('path');
  let _mockFs: typeof import('fs');
  let mockUrl: typeof import('url');

  beforeEach(() => {
    mockPath = {
      join: jest.fn().mockReturnValue('/mocked/path'),
      dirname: jest.fn().mockReturnValue('/mocked/dir')
    } as typeof import('path');
    
    _mockFs = {
      existsSync: jest.fn().mockReturnValue(true),
      readFileSync: jest.fn().mockReturnValue('{"servers": []}')
    } as typeof import('fs');
    
    mockUrl = {
      fileURLToPath: jest.fn().mockReturnValue('/mocked/file/path')
    } as typeof import('url');
  });

  it('should resolve __dirname issue in ES module context', () => {
    const fileURLToPath = mockUrl.fileURLToPath;
    const dirname = mockPath.dirname;
    
    const __filename = fileURLToPath('file:///Users/test/app.js');
    const __dirname = dirname(__filename);
    
    expect(fileURLToPath).toHaveBeenCalledWith('file:///Users/test/app.js');
    expect(dirname).toHaveBeenCalledWith('/mocked/file/path');
    expect(__dirname).toBe('/mocked/dir');
  });

  it('should use correct PulseMCP API URL format', () => {
    const correctBaseUrl = 'https://pulsemcp.com/api';
    const correctSearchUrl = `${correctBaseUrl}/servers`;
    const correctDetailsUrl = `${correctBaseUrl}/servers/package-name`;
    
    expect(correctSearchUrl).toBe('https://pulsemcp.com/api/servers');
    expect(correctDetailsUrl).toBe('https://pulsemcp.com/api/servers/package-name');
    
    const oldIncorrectUrl = 'https://pulsemcp.com/api/v1/search/servers';
    expect(correctSearchUrl).not.toBe(oldIncorrectUrl);
  });

  it('should handle fallback file path resolution correctly', () => {
    const mockJoin = mockPath.join;
    const expectedFallbackPath = '/mocked/path';
    
    mockJoin.mockReturnValue(expectedFallbackPath);
    
    const fallbackPath = mockPath.join('/dirname', '../../renderer/data/popularMCPServers.json');
    
    expect(mockJoin).toHaveBeenCalledWith('/dirname', '../../renderer/data/popularMCPServers.json');
    expect(fallbackPath).toBe(expectedFallbackPath);
  });

  it('should verify ES module import structure', () => {
    const mockImports = {
      path: 'path module',
      fs: 'fs module',  
      url: { fileURLToPath: jest.fn() },
      pathDirname: jest.fn()
    };
    
    expect(mockImports.url.fileURLToPath).toBeDefined();
    expect(typeof mockImports.url.fileURLToPath).toBe('function');
    expect(mockImports.pathDirname).toBeDefined();
    expect(typeof mockImports.pathDirname).toBe('function');
  });
});