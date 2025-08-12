import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Fix Node.js globals in jsdom environment
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (callback: Function, ...args: any[]) => {
    return setTimeout(callback, 0, ...args);
  };
  global.clearImmediate = clearTimeout;
}

// Mock Electron APIs globally
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
  // MCP related methods
  listMCPServers: jest.fn(),
  addMCPServer: jest.fn(),
  removeMCPServer: jest.fn(),
  testMCPServer: jest.fn(),
  startMCPServer: jest.fn(),
  stopMCPServer: jest.fn(),
  // HCS10 related methods
  registerHCS10Profile: jest.fn(),
  getHCS10Status: jest.fn(),
  cancelHCS10Registration: jest.fn(),
  // Agent methods
  sendMessage: jest.fn(),
  startAgent: jest.fn(),
  stopAgent: jest.fn(),
  getAgentStatus: jest.fn(),
  // Update methods
  checkForUpdates: jest.fn(),
  downloadUpdate: jest.fn(),
  installUpdate: jest.fn(),
  // File system methods
  readFile: jest.fn(),
  writeFile: jest.fn(),
  selectDirectory: jest.fn(),
  // Notification methods
  showNotification: jest.fn(),
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
  configurable: true,
});

// Mock matchMedia
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

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver  
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Text encoding/decoding
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock HTMLCanvasElement methods
HTMLCanvasElement.prototype.getContext = jest.fn();

// Mock crypto for tests that need it
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

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});