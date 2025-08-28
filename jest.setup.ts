import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

if (typeof setImmediate === 'undefined') {
  global.setImmediate = (callback: Function, ...args: any[]) => {
    return setTimeout(callback, 0, ...args);
  };
  global.clearImmediate = clearTimeout;
}

const mockElectron = {
  saveConfig: jest.fn(),
  loadConfig: jest.fn(),
  testHederaConnection: jest.fn(),
  testOpenAIConnection: jest.fn(),
  testAnthropicConnection: jest.fn(),
  setTheme: jest.fn(),
  setAutoStart: jest.fn(),
  setLogLevel: jest.fn(),
  openExternal: jest.fn(),
  showMessageBox: jest.fn(),
  showOpenDialog: jest.fn(),
  showSaveDialog: jest.fn(),
  getAppVersion: jest.fn(() => '1.0.0'),
  isPackaged: false,
  platform: 'darwin',
  listMCPServers: jest.fn(),
  addMCPServer: jest.fn(),
  removeMCPServer: jest.fn(),
  testMCPServer: jest.fn(),
  startMCPServer: jest.fn(),
  stopMCPServer: jest.fn(),
  registerHCS10Profile: jest.fn(),
  getHCS10Status: jest.fn(),
  cancelHCS10Registration: jest.fn(),
  sendMessage: jest.fn(),
  startAgent: jest.fn(),
  stopAgent: jest.fn(),
  getAgentStatus: jest.fn(),
  checkForUpdates: jest.fn(),
  downloadUpdate: jest.fn(),
  installUpdate: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  selectDirectory: jest.fn(),
  showNotification: jest.fn(),
  
  'chat:create-session': jest.fn(),
  'chat:load-session': jest.fn(),
  'chat:save-session': jest.fn(),
  'chat:delete-session': jest.fn(),
  'chat:load-all-sessions': jest.fn(),
  'chat:save-message': jest.fn(),
  'chat:load-session-messages': jest.fn(),
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

HTMLCanvasElement.prototype.getContext = jest.fn();

Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn(() => 'mock-uuid'),
  },
});

// Mock import.meta.url for ES modules
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      url: 'file:///mock/filename.js'
    }
  },
  configurable: true
});

beforeEach(() => {
  jest.clearAllMocks();
});