import {
  ElectronRendererLoggerAdapter,
  createElectronRendererLogger,
  type LoggerOptions,
  type LogLevel
} from '../../../src/renderer/utils/electron-logger-adapter';

describe('ElectronRendererLoggerAdapter', () => {
  let logger: ElectronRendererLoggerAdapter;
  let mockConsole: any;

  beforeEach(() => {
    mockConsole = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      trace: jest.fn()
    };

    global.console = mockConsole;

    const originalEnv = process.env;
    process.env = { ...originalEnv, NODE_ENV: 'development' };

    logger = new ElectronRendererLoggerAdapter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should create logger with default options', () => {
      const logger = new ElectronRendererLoggerAdapter();

      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
      expect(logger.getLevel()).toBe('info');
    });

    test('should create logger with custom options', () => {
      const options: LoggerOptions = {
        module: 'test-module',
        level: 'debug',
        silent: false
      };

      const logger = new ElectronRendererLoggerAdapter(options);

      expect(logger.getLevel()).toBe('debug');
      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
    });

    test('should set silent mode in test environment', () => {
      process.env.NODE_ENV = 'test';
      const logger = new ElectronRendererLoggerAdapter();

      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
    });

    test('should respect explicit silent option', () => {
      const options: LoggerOptions = {
        silent: true
      };

      const logger = new ElectronRendererLoggerAdapter(options);

      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
    });
  });

  describe('Message Formatting', () => {
    test('should format simple string messages', () => {
      logger.info('Test message');

      expect(mockConsole.info).toHaveBeenCalledWith('[renderer] Test message');
    });

    test('should format multiple string arguments', () => {
      logger.debug('First message', 'Second message', 'Third message');

      expect(mockConsole.debug).toHaveBeenCalledWith('[renderer] First message Second message Third message');
    });

    test('should format number arguments', () => {
      logger.info('Count:', 42, 'items');

      expect(mockConsole.info).toHaveBeenCalledWith('[renderer] Count: 42 items');
    });

    test('should format boolean arguments', () => {
      logger.warn('Flag is', true, 'and status is', false);

      expect(mockConsole.warn).toHaveBeenCalledWith('[renderer] Flag is true and status is false');
    });

    test('should format Error objects with stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test location';

      logger.error('Something went wrong:', error);

      const callArgs = mockConsole.error.mock.calls[0][0];
      expect(callArgs).toContain('[renderer] Something went wrong: Test error');
      expect(callArgs).toContain('Error: Test error\n    at test location');
    });

    test('should format Error objects without stack trace', () => {
      const error = new Error('Simple error');

      logger.error('Failed:', error);

      const callArgs = mockConsole.error.mock.calls[0][0];
      expect(callArgs).toContain('[renderer] Failed: Simple error');
    });

    test('should format complex objects with JSON.stringify', () => {
      const obj = { name: 'test', value: 123 };

      logger.info('Object:', obj);

      expect(mockConsole.info).toHaveBeenCalledWith('[renderer] Object: {\n  "name": "test",\n  "value": 123\n}');
    });

    test('should handle JSON.stringify errors gracefully', () => {
      const circularObj = { self: null };
      circularObj.self = circularObj;

      logger.warn('Circular object:', circularObj);

      expect(mockConsole.warn).toHaveBeenCalledWith('[renderer] Circular object: [object Object]');
    });

    test('should format mixed argument types', () => {
      const obj = { type: 'test' };
      const error = new Error('Test error');

      logger.debug('String:', 42, true, obj, error);

      const expectedMessage = expect.stringContaining('[renderer] String: 42 true');
      expect(mockConsole.debug).toHaveBeenCalledWith(expectedMessage);
    });
  });

  describe('Logging Methods', () => {
    test('should call console.debug for debug messages', () => {
      logger.debug('Debug message');

      expect(mockConsole.debug).toHaveBeenCalledWith('[renderer] Debug message');
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
    });

    test('should call console.info for info messages', () => {
      logger.info('Info message');

      expect(mockConsole.info).toHaveBeenCalledWith('[renderer] Info message');
      expect(mockConsole.info).toHaveBeenCalledTimes(1);
    });

    test('should call console.warn for warn messages', () => {
      logger.warn('Warning message');

      expect(mockConsole.warn).toHaveBeenCalledWith('[renderer] Warning message');
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
    });

    test('should call console.error for error messages', () => {
      logger.error('Error message');

      expect(mockConsole.error).toHaveBeenCalledWith('[renderer] Error message');
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
    });

    test('should call console.debug with TRACE prefix for trace messages', () => {
      logger.trace('Trace message');

      expect(mockConsole.debug).toHaveBeenCalledWith('[TRACE]', '[renderer] Trace message');
      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
    });

    test('should handle empty arguments', () => {
      logger.info();

      expect(mockConsole.info).toHaveBeenCalledWith('[renderer]');
    });

    test('should handle undefined and null arguments', () => {
      logger.debug('Value:', undefined, null, 'end');

      expect(mockConsole.debug).toHaveBeenCalledWith('[renderer] Value:  null end');
    });
  });

  describe('Log Level Management', () => {
    test('should set and get log level', () => {
      expect(logger.getLevel()).toBe('info');

      logger.setLogLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLogLevel('error');
      expect(logger.getLevel()).toBe('error');
    });

    test('should handle all log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'trace'];

      levels.forEach(level => {
        logger.setLogLevel(level);
        expect(logger.getLevel()).toBe(level);
      });
    });

    test('should handle logger with transports', () => {
      const mockLoggerWithTransports = {
        ...mockConsole,
        transports: {
          console: {
            level: 'info'
          }
        }
      };

      const logger = new ElectronRendererLoggerAdapter();
      (logger as any).logger = mockLoggerWithTransports;

      logger.setLogLevel('debug');

      expect(mockLoggerWithTransports.transports.console.level).toBe('debug');
    });

    test('should handle logger without transports gracefully', () => {
      const logger = new ElectronRendererLoggerAdapter();

      expect(() => logger.setLogLevel('debug')).not.toThrow();
      expect(logger.getLevel()).toBe('debug');
    });
  });

  describe('Module Management', () => {
    test('should set module context', () => {
      logger.setModule('test-module');

      logger.info('Test message');

      expect(mockConsole.info).toHaveBeenCalledWith('[test-module] Test message');
    });

    test('should use custom module from constructor', () => {
      const logger = new ElectronRendererLoggerAdapter({ module: 'custom-module' });

      logger.warn('Warning message');

      expect(mockConsole.warn).toHaveBeenCalledWith('[custom-module] Warning message');
    });

    test('should handle empty module name', () => {
      logger.setModule('');

      logger.error('Error message');

      expect(mockConsole.error).toHaveBeenCalledWith('[] Error message');
    });

    test('should handle special characters in module name', () => {
      logger.setModule('test-module_123');

      logger.debug('Debug message');

      expect(mockConsole.debug).toHaveBeenCalledWith('[test-module_123] Debug message');
    });
  });

  describe('Silent Mode', () => {
    test('should implement setSilent method', () => {
      expect(() => logger.setSilent(true)).not.toThrow();
      expect(() => logger.setSilent(false)).not.toThrow();
    });

    test('should handle silent mode in constructor', () => {
      const logger = new ElectronRendererLoggerAdapter({ silent: true });

      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
    });
  });

  describe('Factory Function', () => {
    test('should create logger instance with factory function', () => {
      const options: LoggerOptions = {
        module: 'factory-test',
        level: 'warn'
      };

      const logger = createElectronRendererLogger(options);

      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
      expect(logger.getLevel()).toBe('warn');
    });

    test('should create logger with default options using factory', () => {
      const logger = createElectronRendererLogger({});

      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
      expect(logger.getLevel()).toBe('info');
    });

    test('should create logger with partial options using factory', () => {
      const logger = createElectronRendererLogger({ module: 'partial-test' });

      expect(logger).toBeInstanceOf(ElectronRendererLoggerAdapter);
      expect(logger.getLevel()).toBe('info'); // default level
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete logging workflow', () => {
      const logger = new ElectronRendererLoggerAdapter({
        module: 'workflow-test',
        level: 'debug'
      });

      logger.debug('Debug information', { key: 'value' });
      logger.info('Operation started', 123);
      logger.warn('Warning condition', true);
      logger.error('Error occurred', new Error('Test error'));
      logger.trace('Detailed trace', 'data');

      logger.setModule('updated-module');
      logger.info('Message with updated module');

      logger.setLogLevel('error');
      expect(logger.getLevel()).toBe('error');

      expect(mockConsole.debug).toHaveBeenCalledWith('[workflow-test] Debug information {\n  "key": "value"\n}');
      expect(mockConsole.info).toHaveBeenCalledWith('[workflow-test] Operation started 123');
      expect(mockConsole.warn).toHaveBeenCalledWith('[workflow-test] Warning condition true');
      expect(mockConsole.error).toHaveBeenCalledWith(expect.stringContaining('[workflow-test] Error occurred Test error'));
      expect(mockConsole.debug).toHaveBeenNthCalledWith(2, '[TRACE]', '[workflow-test] Detailed trace data');
      expect(mockConsole.info).toHaveBeenCalledWith('[updated-module] Message with updated module');
    });

    test('should handle multiple logger instances independently', () => {
      const logger1 = new ElectronRendererLoggerAdapter({ module: 'logger1' });
      const logger2 = new ElectronRendererLoggerAdapter({ module: 'logger2' });

      logger1.info('Message from logger1');
      logger2.info('Message from logger2');

      expect(mockConsole.info).toHaveBeenCalledWith('[logger1] Message from logger1');
      expect(mockConsole.info).toHaveBeenCalledWith('[logger2] Message from logger2');
    });

    test('should handle different log levels correctly', () => {
      const debugLogger = new ElectronRendererLoggerAdapter({ level: 'debug' });
      const errorLogger = new ElectronRendererLoggerAdapter({ level: 'error' });

      debugLogger.debug('Debug message');
      errorLogger.debug('This should still log');

      expect(mockConsole.debug).toHaveBeenCalledTimes(2);
    });

    test('should handle complex error objects', () => {
      const complexError = new Error('Complex error');
      complexError.stack = 'Error: Complex error\n    at function1\n    at function2\n    at function3';

      logger.error('Complex error occurred:', complexError, { context: 'test' });

      const loggedMessage = mockConsole.error.mock.calls[0][0];
      expect(loggedMessage).toContain('[renderer] Complex error occurred: Complex error');
      expect(loggedMessage).toContain('at function1');
      expect(loggedMessage).toContain('at function2');
      expect(loggedMessage).toContain('at function3');
      expect(loggedMessage).toContain('{\n  "context": "test"\n}');
    });
  });

  describe('Edge Cases', () => {
    test('should handle extremely long messages', () => {
      const longMessage = 'a'.repeat(10000);

      logger.info(longMessage);

      expect(mockConsole.info).toHaveBeenCalledWith(`[renderer] ${longMessage}`);
    });

    test('should handle special characters in messages', () => {
      const specialMessage = 'Message with special chars: !@#$%^&*()[]{}|\\:;"\'<>,.?/~`';

      logger.warn(specialMessage);

      expect(mockConsole.warn).toHaveBeenCalledWith(`[renderer] ${specialMessage}`);
    });

    test('should handle non-stringifiable objects', () => {
      const nonStringifiable = {
        toString: () => 'custom toString',
        toJSON: () => { throw new Error('Cannot stringify'); }
      };

      logger.error('Non-stringifiable object:', nonStringifiable);

      expect(mockConsole.error).toHaveBeenCalledWith('[renderer] Non-stringifiable object: custom toString');
    });

    test('should handle empty and whitespace-only strings', () => {
      logger.debug('');
      logger.info('   ');
      logger.warn('\t\n');

      expect(mockConsole.debug).toHaveBeenCalledWith('[renderer] ');
      expect(mockConsole.info).toHaveBeenCalledWith('[renderer]    ');
      expect(mockConsole.warn).toHaveBeenCalledWith('[renderer] \t\n');
    });

    test('should handle function arguments', () => {
      const func = () => 'test';

      logger.info('Function:', func);

      const callArgs = mockConsole.info.mock.calls[0][0];
      expect(callArgs).toContain('[renderer] Function:');
    });
  });

  describe('TypeScript Interface Compliance', () => {
    test('should implement ILogger interface correctly', () => {
      const logger = new ElectronRendererLoggerAdapter();

      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.setLogLevel).toBe('function');
      expect(typeof logger.getLevel).toBe('function');
      expect(typeof logger.setSilent).toBe('function');
      expect(typeof logger.setModule).toBe('function');

      expect(() => logger.debug('test')).not.toThrow();
      expect(() => logger.info('test')).not.toThrow();
      expect(() => logger.warn('test')).not.toThrow();
      expect(() => logger.error('test')).not.toThrow();
      expect(() => logger.trace('test')).not.toThrow();
      expect(() => logger.setLogLevel('info')).not.toThrow();
      expect(typeof logger.getLevel()).toBe('string');
      expect(() => logger.setSilent(false)).not.toThrow();
      expect(() => logger.setModule('test')).not.toThrow();
    });

    test('should handle all LogLevel types', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'trace'];

      levels.forEach(level => {
        logger.setLogLevel(level);
        expect(logger.getLevel()).toBe(level);
      });
    });

    test('should handle LoggerOptions interface', () => {
      const validOptions: LoggerOptions = {
        module: 'test',
        level: 'debug',
        silent: true
      };

      const logger = new ElectronRendererLoggerAdapter(validOptions);
      expect(logger.getLevel()).toBe('debug');
    });
  });
});
