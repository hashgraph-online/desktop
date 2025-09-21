import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShellLayout from '../../../../src/renderer/components/shell/ShellLayout';

jest.mock('framer-motion', () => {
  const React = require('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout']);
  const createMock = (tag: string) => {
    const Component = React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...rest }, ref) => {
      const safeProps: Record<string, unknown> = {};
      Object.entries(rest).forEach(([key, value]) => {
        if (!MOTION_PROPS.has(key)) {
          safeProps[key] = value;
        }
      });
      return React.createElement(tag, { ref, ...safeProps }, children);
    });
    Component.displayName = `MockMotion(${tag})`;
    return Component;
  };

  return {
    __esModule: true,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => createMock(prop),
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const mockUseConfigStore = jest.fn();

jest.mock('../../../../src/renderer/stores/configStore', () => ({
  __esModule: true,
  useConfigStore: () => mockUseConfigStore(),
}));

jest.mock('../../../../src/renderer/components/shell/ShellTaskbar.tsx', () => ({
  __esModule: true,
  ShellTaskbar: () => <div data-testid='mock-shell-taskbar'>Taskbar</div>,
  default: () => <div data-testid='mock-shell-taskbar'>Taskbar</div>,
}));

jest.mock('../../../../src/renderer/components/shell/WalletDisplay.tsx', () => ({
  __esModule: true,
  default: () => <div data-testid='mock-wallet-display'>Wallet</div>,
}));

jest.mock('../../../../src/renderer/components/shell/ShellThemeToggle.tsx', () => ({
  __esModule: true,
  default: () => <button type='button'>toggle</button>,
}));

jest.mock('../../../../src/renderer/components/ui/Logo.tsx', () => ({
  __esModule: true,
  default: () => <div data-testid='mock-logo'>logo</div>,
}));

jest.mock('../../../../src/renderer/components/shell/ShellContext', () => ({
  __esModule: true,
  useShell: () => ({ setActiveWindow: jest.fn() }),
}));

const renderShellLayout = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<ShellLayout />}>
          <Route index element={<div data-testid='shell-layout-content'>content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('ShellLayout theme integration', () => {
  afterEach(() => {
    mockUseConfigStore.mockReset();
  });

  it('applies light theme classes when configuration is light', () => {
    mockUseConfigStore.mockReturnValue({ config: { advanced: { theme: 'light' } } });

    renderShellLayout();

    const root = screen.getByTestId('shell-layout-root');
    expect(root).toHaveAttribute('data-shell-theme', 'light');
    expect(root.className).toContain('shell-theme-light');
    expect(root.className).toContain('from-hol-wallpaper-start');
  });

  it('applies dark theme classes when configuration is dark', () => {
    mockUseConfigStore.mockReturnValue({ config: { advanced: { theme: 'dark' } } });

    renderShellLayout();

    const root = screen.getByTestId('shell-layout-root');
    expect(root).toHaveAttribute('data-shell-theme', 'dark');
    expect(root.className).toContain('shell-theme-dark');
    expect(root.className).toContain('dark:from-gray-900');
  });
});
