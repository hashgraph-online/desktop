import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserSurfaceForTesting } from '../../../src/renderer/components/shell/ShellBrowserWindow';
import { MemoryRouter } from 'react-router-dom';

jest.mock('framer-motion', () => {
  const React = require('react');
const create = (element: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: React.Ref<HTMLElement>) => {
      const {
        whileHover,
        whileTap,
        initial,
        animate,
        exit,
        transition,
        layout,
        variants,
        addEventListener,
        removeEventListener,
        ...rest
      } = props;
      return React.createElement(element, { ...rest, ref }, rest.children);
    });
  return {
    motion: {
      div: create('div'),
      button: create('button'),
      span: create('span'),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('../../../src/renderer/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('../../../src/renderer/components/chat/headers/AnimatedSuggestions', () => ({
  __esModule: true,
  default: ({ onSelect }: { onSelect: (text: string) => void }) => (
    <button type='button' data-testid='animated-suggestions' onClick={() => onSelect('')} />
  ),
}));

jest.mock('../../../src/renderer/components/shell/ShellWindow', () => {
  const React = require('react');
  const ShellWindow = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return {
    __esModule: true,
    ShellWindow,
    default: ShellWindow,
    useShellWindowControls: () => ({
      minimize: jest.fn(),
      close: jest.fn(),
      toggleExpand: jest.fn(),
      isExpanded: false,
      isMinimized: false,
    }),
  };
});

jest.mock('../../../src/renderer/components/shell/ShellContext', () => ({
  __esModule: true,
  SHELL_WINDOWS: {
    browser: {
      label: 'Browser',
      title: 'Browser',
      icon: () => null,
    },
  },
  useShell: () => ({
    registerWindow: jest.fn(),
    unregisterWindow: jest.fn(),
    minimizeWindow: jest.fn(),
    restoreWindow: jest.fn(),
    isWindowMinimized: () => false,
    setActiveWindow: jest.fn(),
    getWindowState: () => null,
    setWindowState: jest.fn(),
    clearWindowState: jest.fn(),
    resetWindowMetadata: jest.fn(),
    setWindowMetadata: jest.fn(),
    windowMetadata: {
      browser: {
        icon: () => null,
      },
    },
  }),
}));

jest.mock('../../../src/renderer/hooks/useAgentInit', () => ({
  useAgentInit: jest.fn(),
}));

const createMockBrowserApi = () => {
  return {
    attach: jest.fn().mockResolvedValue(undefined),
    detach: jest.fn().mockResolvedValue(undefined),
    setBounds: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockResolvedValue({
      requestedUrl: 'https://hedera.kiloscribe.com',
      currentUrl: 'https://hedera.kiloscribe.com',
      title: 'KiloScribe',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      lastError: null,
    }),
    onState: jest.fn().mockReturnValue(jest.fn()),
    navigate: jest.fn(),
    reload: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    executeJavaScript: jest.fn().mockResolvedValue(null),
  };
};

const renderBrowserSurface = () => {
  return render(
    <MemoryRouter>
      <BrowserSurfaceForTesting />
    </MemoryRouter>
  );
};

beforeEach(() => {
  jest.useFakeTimers();

  const browserApi = createMockBrowserApi();
  (window as unknown as { electron: unknown }).electron = {
    browser: browserApi,
    openExternal: jest.fn(),
  };

  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, props?: MouseEventInit) {
      super(type, props);
    }
  }

  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent =
    PointerEventPolyfill as unknown as typeof MouseEvent;

  class ResizeObserverStub {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(): void {}

    disconnect(): void {}
  }

  (window as unknown as { ResizeObserver: ResizeObserver }).ResizeObserver = ResizeObserverStub as unknown as ResizeObserver;

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

  const mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mediaQueryList) {
    const prototype = Object.getPrototypeOf(mediaQueryList) as Record<string, unknown>;
    if (typeof prototype.addEventListener !== 'function') {
      prototype.addEventListener = jest.fn();
    }
    if (typeof prototype.removeEventListener !== 'function') {
      prototype.removeEventListener = jest.fn();
    }
  }
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllTimers();
});

const openAssistant = async () => {
  const toggle = screen.getByRole('button', { name: /toggle assistant/i });
  await act(async () => {
    fireEvent.click(toggle);
  });

  await waitFor(() => {
    expect(screen.getByTestId('assistant-dock')).toBeInTheDocument();
  });
};

describe('BrowserSurface layout', () => {
  it('cycles dock placement using layout controls', async () => {
    renderBrowserSurface();

    await openAssistant();

    await waitFor(() => {
      expect(screen.getByTestId('assistant-dock')).toHaveAttribute('data-dock', 'right');
    });

    const dockBottom = screen.getByRole('button', { name: /dock assistant to bottom/i });
    fireEvent.click(dockBottom);

    await waitFor(() => {
      expect(screen.getByTestId('assistant-dock')).toHaveAttribute('data-dock', 'bottom');
    });

    const dockLeft = screen.getByRole('button', { name: /dock assistant to left/i });
    fireEvent.click(dockLeft);

    await waitFor(() => {
      expect(screen.getByTestId('assistant-dock')).toHaveAttribute('data-dock', 'left');
    });
  });

  it('resizes assistant panel with drag handle', async () => {
    renderBrowserSurface();
    await openAssistant();

    const getWidth = () => {
      const container = screen.getByTestId('assistant-dock');
      const value = container.style.width;
      return value ? parseFloat(value.replace('px', '')) : 0;
    };

    const resizer = screen.getByTestId('assistant-resizer');

    const initialWidth = getWidth();
    expect(initialWidth).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.pointerDown(resizer, { clientX: 100, clientY: 100 });
      fireEvent.pointerMove(window, { clientX: 60, clientY: 100 });
      fireEvent.pointerUp(window);
    });

    await waitFor(() => {
      expect(getWidth()).toBeGreaterThan(initialWidth);
    });
  });
});
