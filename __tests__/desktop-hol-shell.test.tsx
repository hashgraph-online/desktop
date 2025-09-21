import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesktopShellRouter } from '../src/renderer/components/shell/DesktopShellRouter';

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

jest.mock('../src/renderer/components/shell/BuilderStudioRouter', () => ({
  __esModule: true,
  default: () => <div data-testid='builder-studio-window'>Builder Studio</div>,
}));

jest.mock('../src/renderer/components/shell/ShellTaskbar', () => ({
  __esModule: true,
  ShellTaskbar: () => <div data-testid='shell-taskbar'>Taskbar</div>,
  default: () => <div data-testid='shell-taskbar'>Taskbar</div>,
}));

jest.mock('../src/renderer/components/brand/SaucerSwapLogo', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../src/renderer/components/shell/ShellThemeToggle', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('../src/renderer/stores/configStore', () => {
  const mockConfigState = { config: null };
  const mockUseConfigStore = Object.assign(
    (selector?: (state: typeof mockConfigState) => unknown) => {
      if (typeof selector === 'function') {
        return selector(mockConfigState);
      }
      return mockConfigState;
    },
    {
      getState: () => mockConfigState,
    }
  );

  return {
    __esModule: true,
    useConfigStore: mockUseConfigStore,
  };
});

jest.mock('../src/renderer/pages/ChatPage', () => ({
  __esModule: true,
  default: () => <div data-testid='chat-window'>Chat Page</div>,
}));

beforeAll(() => {
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

const renderShell = (initialEntries: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <DesktopShellRouter />
    </MemoryRouter>
  );
};

describe('DesktopShellRouter', () => {
  it('renders HOL desktop launch icons', () => {
    renderShell(['/']);
    expect(screen.getAllByRole('button', { name: /chat agent/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /moonscape/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('preloads browser webview with default homepage', () => {
    renderShell(['/browser']);
    const addressInput = screen.getByRole('textbox', { name: /browser address/i }) as HTMLInputElement;
    const browserSurface = screen.getByTestId('browser-surface');
    expect(addressInput.value).toBe('https://hedera.kiloscribe.com');
    expect(browserSurface).toHaveAttribute('data-current-url', 'https://hedera.kiloscribe.com');
    expect(screen.getByRole('button', { name: /close browser/i })).toBeInTheDocument();
  });

  it('updates webview source when a new address is submitted', async () => {
    renderShell(['/browser']);
    const addressInput = screen.getByRole('textbox', { name: /browser address/i });
    fireEvent.change(addressInput, { target: { value: 'example.com' } });
    expect(screen.getByRole('textbox', { name: /browser address/i })).toHaveValue('example.com');
    const form = addressInput.closest('form');
    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /browser address/i })).toHaveValue('https://example.com');
    });
    await waitFor(() => {
      expect(screen.getByTestId('browser-surface')).toHaveAttribute('data-current-url', 'https://example.com');
    });
  });

  it('closes an open window and returns to desktop', () => {
    renderShell(['/browser']);
    fireEvent.click(screen.getByRole('button', { name: /close browser/i }));
    expect(screen.getAllByRole('button', { name: /chat agent/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /close browser/i })).not.toBeInTheDocument();
  });

  it('renders acknowledgements window without builder sidebar', () => {
    renderShell(['/acknowledgements']);

    expect(screen.queryByTestId('builder-studio-window')).not.toBeInTheDocument();
    expect(screen.getByText(/acknowledgements/i)).toBeInTheDocument();
  });
});
