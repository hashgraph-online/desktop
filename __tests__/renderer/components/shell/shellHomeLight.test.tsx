import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShellHome from '../../../../src/renderer/components/shell/ShellHome';

const mockUseConfigStore = jest.fn();

jest.mock('../../../../src/renderer/stores/configStore', () => ({
  __esModule: true,
  useConfigStore: () => mockUseConfigStore(),
}));

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

jest.mock('../../../../src/renderer/components/shell/useShellNavigation', () => ({
  useShellNavigation: () => ({ open: jest.fn(), goHome: jest.fn() }),
}));

describe('ShellHome light theme styling', () => {
  beforeEach(() => {
    mockUseConfigStore.mockReturnValue({
      config: { advanced: { theme: 'light' } },
    });

    if (typeof window.matchMedia !== 'function') {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: () => ({
          matches: false,
          media: '',
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          addListener: jest.fn(),
          removeListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }),
      });
    }
  });

  afterEach(() => {
    mockUseConfigStore.mockReset();
  });

  it('renders light-mode icon styling with accent background and white icon', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path='/' element={<ShellHome />} />
        </Routes>
      </MemoryRouter>
    );

    const chatButton = screen.getByRole('button', { name: /chat agent/i });
    const iconContainer = chatButton.querySelector('div');
    expect(iconContainer?.className).toContain('bg-white');
    expect(iconContainer?.className).toContain('border-gray-200');

    const svg = chatButton.querySelector('svg');
    expect(svg?.classList.toString()).toContain('text-blue-500');
  });

  it('renders mac-style status line in hero', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path='/' element={<ShellHome />} />
        </Routes>
      </MemoryRouter>
    );

    const statusLine = screen.getByTestId('shell-status-line');
    expect(statusLine.className).toMatch(/tracking-\[/);
  });
});
