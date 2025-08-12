module.exports = {
  ipcMain: {
    handle: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    getPath: jest.fn((name) => `/mock/path/${name}`),
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((plainText) => Buffer.from(`encrypted_${plainText}`)),
    decryptString: jest.fn((buffer) => buffer.toString().replace('encrypted_', '')),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      setWindowOpenHandler: jest.fn(),
      on: jest.fn(),
    },
  })),
  shell: {
    openExternal: jest.fn(),
  },
};