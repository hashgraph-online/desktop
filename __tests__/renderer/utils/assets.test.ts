import { getPublicAssetPath } from '../../../src/renderer/utils/assets';

const mockImportMeta = {
  env: { DEV: false },
  url: 'file:///app/src/renderer/utils/assets.ts'
};

Object.defineProperty(global, 'import', {
  value: {
    meta: mockImportMeta
  },
  writable: true
});

describe('assets utility', () => {
  describe('getPublicAssetPath', () => {
    beforeEach(() => {
      mockImportMeta.env.DEV = false;
    });

    describe('development mode', () => {
      beforeEach(() => {
        mockImportMeta.env.DEV = true;
      });

      it('should return path with leading slash for paths without leading slash', () => {
        const result = getPublicAssetPath('images/logo.png');
        expect(result).toBe('/images/logo.png');
      });

      it('should return path with single leading slash for paths with leading slash', () => {
        const result = getPublicAssetPath('/images/logo.png');
        expect(result).toBe('/images/logo.png');
      });

      it('should handle empty string', () => {
        const result = getPublicAssetPath('');
        expect(result).toBe('/');
      });

      it('should handle root path', () => {
        const result = getPublicAssetPath('/');
        expect(result).toBe('/');
      });

      it('should handle nested paths', () => {
        const result = getPublicAssetPath('assets/images/icons/favicon.ico');
        expect(result).toBe('/assets/images/icons/favicon.ico');
      });

      it('should handle paths with multiple leading slashes', () => {
        const result = getPublicAssetPath('///images/logo.png');
        expect(result).toBe('//images/logo.png');
      });
    });

    describe('production mode', () => {
      beforeEach(() => {
        mockImportMeta.env.DEV = false;
      });

      it('should return URL href for paths without leading slash', () => {
        const result = getPublicAssetPath('images/logo.png');
        expect(result).toContain('images/logo.png');
        expect(result).toMatch(/^file:\/\//);
      });

      it('should return URL href for paths with leading slash', () => {
        const result = getPublicAssetPath('/images/logo.png');
        expect(result).toContain('images/logo.png');
        expect(result).toMatch(/^file:\/\//);
      });

      it('should handle empty string in production', () => {
        const result = getPublicAssetPath('');
        expect(result).toMatch(/^file:\/\//);
      });

      it('should handle root path in production', () => {
        const result = getPublicAssetPath('/');
        expect(result).toMatch(/^file:\/\//);
      });

      it('should handle nested paths in production', () => {
        const result = getPublicAssetPath('assets/images/icons/favicon.ico');
        expect(result).toContain('assets/images/icons/favicon.ico');
        expect(result).toMatch(/^file:\/\//);
      });

      it('should create proper URL with base URL', () => {
        mockImportMeta.url = 'file:///custom/base/path/assets.ts';
        const result = getPublicAssetPath('test.png');
        expect(result).toMatch(/^file:\/\//);
        expect(result).toContain('test.png');
      });
    });

    describe('edge cases', () => {
      it('should handle special characters in paths', () => {
        mockImportMeta.env.DEV = true;
        const result = getPublicAssetPath('images/logo with spaces.png');
        expect(result).toBe('/images/logo with spaces.png');
      });

      it('should handle URL-encoded characters', () => {
        mockImportMeta.env.DEV = false;
        const result = getPublicAssetPath('images/logo%20encoded.png');
        expect(result).toContain('logo%20encoded.png');
        expect(result).toMatch(/^file:\/\//);
      });

      it('should handle query parameters', () => {
        mockImportMeta.env.DEV = true;
        const result = getPublicAssetPath('image.png?v=1.0');
        expect(result).toBe('/image.png?v=1.0');
      });

      it('should handle fragments', () => {
        mockImportMeta.env.DEV = true;
        const result = getPublicAssetPath('page.html#section');
        expect(result).toBe('/page.html#section');
      });

      it('should handle paths with dots', () => {
        mockImportMeta.env.DEV = true;
        const result = getPublicAssetPath('../assets/image.png');
        expect(result).toBe('/../assets/image.png');
      });
    });

    describe('mode switching', () => {
      it('should behave differently in dev vs production', () => {
        const path = 'test.png';
        
        mockImportMeta.env.DEV = true;
        const devResult = getPublicAssetPath(path);
        
        mockImportMeta.env.DEV = false;
        const prodResult = getPublicAssetPath(path);
        
        expect(devResult).toBe('/test.png');
        expect(prodResult).toMatch(/^file:\/\//);
        expect(prodResult).toContain('test.png');
        expect(devResult).not.toBe(prodResult);
      });

      it('should consistently remove leading slash regardless of mode', () => {
        const path = '/test.png';
        
        mockImportMeta.env.DEV = true;
        const devResult = getPublicAssetPath(path);
        
        mockImportMeta.env.DEV = false;
        const prodResult = getPublicAssetPath(path);
        
        expect(devResult).toBe('/test.png');
        expect(prodResult).toContain('test.png');
        expect(devResult).not.toContain('//test.png');
        expect(prodResult).not.toMatch(/file:\/\/.*\/\/test.png/);
      });
    });

    describe('URL constructor behavior', () => {
      it('should handle different base URLs correctly', () => {
        mockImportMeta.env.DEV = false;
        
        const testCases = [
          'file:///app/src/utils/',
          'file:///home/user/project/',
          'file:///c:/projects/app/'
        ];
        
        testCases.forEach(baseUrl => {
          mockImportMeta.url = baseUrl + 'assets.ts';
          const result = getPublicAssetPath('logo.png');
          expect(result).toMatch(/^file:\/\//);
          expect(result).toContain('logo.png');
        });
      });
    });
  });
});