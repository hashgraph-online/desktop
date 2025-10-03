import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type InvokeFn = ReturnType<typeof vi.fn>;

const configureTauriInternals = (invokeMock: InvokeFn, requestAnimationFrameImpl: typeof window.requestAnimationFrame) => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: { invoke: invokeMock },
    configurable: true,
    writable: true,
    enumerable: false,
  });

  window.requestAnimationFrame = requestAnimationFrameImpl;
};

const resetTauriInternals = (originalRequestAnimationFrame: typeof window.requestAnimationFrame | undefined) => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  if (typeof originalRequestAnimationFrame === 'function') {
    window.requestAnimationFrame = originalRequestAnimationFrame;
  }
  Reflect.deleteProperty(window, 'desktop');
  Reflect.deleteProperty(window, 'desktopAPI');
};

describe('desktop bridge MCP registry commands', () => {
  let invokeMock: InvokeFn;
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame | undefined;

  beforeEach(async () => {
    invokeMock = vi.fn().mockResolvedValue({ success: true });
    originalRequestAnimationFrame = window.requestAnimationFrame;

    configureTauriInternals(invokeMock, (callback) => {
      callback(performance.now());
      return 0;
    });

    vi.resetModules();
    await import('../renderer/tauri/desktop-bridge');
  });

  afterEach(() => {
    resetTauriInternals(originalRequestAnimationFrame);
  });

  it('wraps registry search options in the invoke payload', async () => {
    const options = { query: 'docs', limit: 3 };

    const search = window.desktop?.searchMCPRegistry;
    expect(search).toBeDefined();
    if (!search) {
      throw new Error('searchMCPRegistry not available');
    }

    await search(options);

    expect(invokeMock).toHaveBeenCalledWith('mcp_search_registry', {
      options,
    });
  });
});
