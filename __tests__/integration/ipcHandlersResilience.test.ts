import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const userDataPath = path.join(os.tmpdir(), 'ipc-handler-resilience');
const registeredConfigChannels = new Set<string>();

if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

jest.mock('electron', () => {
  return {
    app: {
      getPath: jest.fn(() => userDataPath),
      setPath: jest.fn(),
      isPackaged: false,
    },
    safeStorage: {
      isEncryptionAvailable: jest.fn(() => false),
      encryptString: jest.fn((value: string) => Buffer.from(value, 'utf8')),
      decryptString: jest.fn(),
    },
    ipcMain: {
      handle: jest.fn(),
      removeHandler: jest.fn(),
      on: jest.fn(),
    },
    ipcRenderer: {
      invoke: jest.fn(),
      on: jest.fn(),
      send: jest.fn(),
    },
    BrowserWindow: jest.fn(),
    shell: { openExternal: jest.fn() },
    nativeImage: { createFromPath: jest.fn(() => ({ isEmpty: () => true })) },
    WebContentsView: jest.fn(),
  } as const;
});

jest.mock('@hashgraphonline/standards-sdk', () => {
  class MockLogger {
    info(): void {}
    warn(): void {}
    error(): void {}
    debug(): void {}
    trace(): void {}
    setLogLevel(): void {}
    getLevel(): string {
      return 'info';
    }
    setSilent(): void {}
    setModule(): void {}
  }

  const capability = {
    TEXT_GENERATION: 'TEXT_GENERATION',
    DATA_INTEGRATION: 'DATA_INTEGRATION',
    MARKET_INTELLIGENCE: 'MARKET_INTELLIGENCE',
    WORKFLOW_AUTOMATION: 'WORKFLOW_AUTOMATION',
    LANGUAGE_TRANSLATION: 'LANGUAGE_TRANSLATION',
    IMAGE_GENERATION: 'IMAGE_GENERATION',
    CODE_GENERATION: 'CODE_GENERATION',
    SUMMARIZATION_EXTRACTION: 'SUMMARIZATION_EXTRACTION',
    API_INTEGRATION: 'API_INTEGRATION',
  } as const;

  const agentType = {
    AUTONOMOUS: 'AUTONOMOUS',
    MANUAL: 'MANUAL',
  } as const;

  const profileType = {
    PERSON: 'person',
    AI_AGENT: 'aiAgent',
  } as const;

  return {
    Logger: MockLogger,
    LoggerOptions: {},
    LogLevel: {
      debug: 'debug',
      info: 'info',
      warn: 'warn',
      error: 'error',
      silent: 'silent',
    },
    ILogger: MockLogger,
    NetworkType: { MAINNET: 'mainnet', TESTNET: 'testnet' },
    HederaMirrorNode: class {},
    AIAgentCapability: capability,
    AIAgentType: agentType,
    ProfileType: profileType,
  } as const;
});

jest.mock('@hashgraphonline/conversational-agent', () => ({
  OperationalMode: 'autonomous',
}));

jest.mock('../../src/main/services/credential-manager', () => ({
  CredentialManager: jest.fn(() => {
    throw new Error('credential manager init failure');
  }),
}));

jest.mock('../../src/main/handlers/transactionHandlers', () => ({
  registerTransactionHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/hcs10-handlers', () => ({
  setupHCS10Handlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/hcs10-discovery-handlers', () => ({
  registerHCS10DiscoveryHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/hcs10-chat-handlers', () => ({
  registerHCS10ChatHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/chat-handlers', () => ({
  setupChatHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/handlers/agent-handlers', () => ({
  setupAgentHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/handlers/connection-handlers', () => ({
  setupConnectionHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/handlers/mcp-handlers', () => ({
  setupMCPHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/handlers/plugin-handlers', () => ({
  setupPluginHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/handlers/entity-handlers', () => ({
  setupEntityHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/handlers/utility-handlers', () => ({
  setupMirrorNodeHandlers: jest.fn(),
  setupThemeHandlers: jest.fn(),
  setupUpdateHandlers: jest.fn(),
  setupOpenRouterHandlers: jest.fn(),
}));

jest.mock('../../src/main/ipc/handlers/security-config-handlers', () => ({
  setupConfigHandlers: jest.fn(),
  setupSecurityHandlers: jest.fn(),
}));

let setupIPCHandlers: (masterPassword: string) => void;

beforeAll(async () => {
  ({ setupIPCHandlers } = await import('../../src/main/ipc/handlers'));
});

describe('setupIPCHandlers resilience', () => {
  beforeEach(async () => {
    const electron = await import('electron');
    (electron.app.getPath as jest.Mock).mockImplementation(
      () => userDataPath
    );
    (electron.ipcMain.handle as jest.Mock).mockImplementation(
      () => undefined
    );
    (electron.ipcMain.removeHandler as jest.Mock).mockImplementation(
      () => undefined
    );
    registeredConfigChannels.clear();
    const securityModule = jest.requireMock(
      '../../src/main/ipc/handlers/security-config-handlers'
    );
    (securityModule.setupConfigHandlers as jest.Mock).mockImplementation(() => {
      registeredConfigChannels.add('config:load');
      registeredConfigChannels.add('config:save');
      registeredConfigChannels.add('config:getEnvironment');
    });
  });

  it('registers config handlers even when credential manager initialization fails', async () => {
    expect(() => setupIPCHandlers('test-master-password')).not.toThrow();
    const electron = await import('electron');
    const securityModule = jest.requireMock(
      '../../src/main/ipc/handlers/security-config-handlers'
    );
    expect(securityModule.setupConfigHandlers).toHaveBeenCalled();
    expect(registeredConfigChannels.has('config:load')).toBe(true);
    expect(registeredConfigChannels.has('config:save')).toBe(true);
    expect(registeredConfigChannels.has('config:getEnvironment')).toBe(true);
  });
});
