import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerWindow = vi.fn();
const unregisterWindow = vi.fn();
const minimizeWindow = vi.fn();
const restoreWindow = vi.fn();
const isWindowMinimized = vi.fn().mockReturnValue(false);
const setActiveWindow = vi.fn();
const getWindowState = vi.fn();
const setWindowState = vi.fn();
const clearWindowState = vi.fn();
const resetWindowMetadata = vi.fn();

const TestIcon = () => null;

vi.mock('../ShellContext', () => ({
  useShell: () => ({
    registerWindow,
    unregisterWindow,
    minimizeWindow,
    restoreWindow,
    isWindowMinimized,
    setActiveWindow,
    getWindowState,
    setWindowState,
    clearWindowState,
    resetWindowMetadata,
  }),
  SHELL_WINDOWS: {
    mcp: {
      label: 'MCP',
      title: 'MCP',
      icon: TestIcon,
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, layout: _layout, ...rest }: { children?: ReactNode; layout?: boolean }) => (
      <section {...rest}>{children}</section>
    ),
  },
}));

describe('ShellWindow layout', () => {
  beforeEach(() => {
    registerWindow.mockClear();
    unregisterWindow.mockClear();
    minimizeWindow.mockClear();
    restoreWindow.mockClear();
    isWindowMinimized.mockClear();
    setActiveWindow.mockClear();
    getWindowState.mockClear();
    setWindowState.mockClear();
    clearWindowState.mockClear();
    resetWindowMetadata.mockClear();
  });

  it('exposes a scrollable content host to prevent MCP layout lockups', async () => {
    const { ShellWindow } = await import('../ShellWindow');

    const { container } = render(
      <ShellWindow windowKey='mcp'>
        <div data-testid='shell-content'>Scrollable content</div>
      </ShellWindow>
    );

    const content = container.querySelector('[data-testid="shell-content"]');
    const chromeWrapper = content?.parentElement?.parentElement;

    expect(chromeWrapper).toBeTruthy();
    expect(chromeWrapper?.className).toContain('overflow-y-auto');
    expect(chromeWrapper?.className).not.toContain('overflow-hidden');
  });
});
