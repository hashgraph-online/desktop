import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BrowserAssistantPanel from '../../../src/renderer/components/shell/BrowserAssistantPanel';

const agentStoreState: Record<string, unknown> = {};
const configStoreState: Record<string, unknown> = {};
const notificationStoreState: Record<string, unknown> = {};

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

jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(
        (
          props: React.HTMLAttributes<HTMLDivElement>,
          ref: React.ForwardedRef<HTMLDivElement>
        ) => React.createElement('div', { ...props, ref })
      ),
    },
  };
});

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../../src/renderer/hooks/useAgentInit', () => ({
  useAgentInit: jest.fn(),
}));

const fileAttachmentsMock = jest.fn();

jest.mock('../../../src/renderer/hooks/useFileAttachments', () => ({
  __esModule: true,
  default: (...args: unknown[]) => fileAttachmentsMock(...args),
}));

jest.mock('../../../src/renderer/stores/agentStore', () => ({
  useAgentStore: (selector: (state: Record<string, unknown>) => unknown) => selector(agentStoreState),
}));

jest.mock('../../../src/renderer/stores/configStore', () => ({
  useConfigStore: (selector: (state: Record<string, unknown>) => unknown) => selector(configStoreState),
}));

jest.mock('../../../src/renderer/stores/notificationStore', () => ({
  useNotificationStore: (selector: (state: Record<string, unknown>) => unknown) => selector(notificationStoreState),
}));

  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: jest.fn(),
    writable: true,
  });

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


describe('BrowserAssistantPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Object.keys(agentStoreState).forEach((key) => {
      delete agentStoreState[key];
    });
    Object.assign(agentStoreState, {
      isConnected: true,
      status: 'connected',
      connect: jest.fn(),
      sendMessage: jest.fn(),
      messages: [],
      isTyping: false,
      chatContext: { mode: 'personal' },
      currentSession: { id: 'session-1', name: 'Session', mode: 'personal' },
      createSession: jest.fn(),
      loadSession: jest.fn(),
    });

    Object.keys(configStoreState).forEach((key) => {
      delete configStoreState[key];
    });
    Object.assign(configStoreState, {
      config: null,
      isConfigured: true,
    });

    Object.keys(notificationStoreState).forEach((key) => {
      delete notificationStoreState[key];
    });
    Object.assign(notificationStoreState, {
      addNotification: jest.fn(),
    });

    fileAttachmentsMock.mockReturnValue({
      files: [],
      addFiles: jest.fn(),
      removeFile: jest.fn(),
      reset: jest.fn(),
      fileError: null,
      toBase64: jest.fn(),
    });
  });

  it('renders browser-specific empty state copy', () => {
    render(
      <BrowserAssistantPanel
        isOpen
        sessionId='session-1'
        hostLabel='hedera.kiloscribe.com'
        currentUrl='https://hedera.kiloscribe.com'
        pageTitle='Hedera Docs'
        onSessionCreated={jest.fn()}
        fetchPageContext={async () => null}
        onClose={jest.fn()}
        dock='right'
        onDockChange={jest.fn()}
      />
    );

    expect(screen.getByText(/Moonscape Copilot/i)).toBeInTheDocument();
    expect(screen.getByText(/Try asking/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/I can help you with Hedera Hashgraph operations/)
    ).not.toBeInTheDocument();
  });
});
