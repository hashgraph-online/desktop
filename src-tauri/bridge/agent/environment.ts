type WriteStderr = (...args: unknown[]) => void;

const formatErrorPayload = (error: Error, type: string): Record<string, string> => ({
  type,
  message: error.message ?? String(error),
  stack: error.stack ?? 'No stack trace available',
  error: String(error),
});

export const setupProcessHandlers = (writeStderr: WriteStderr): void => {
  process.on('uncaughtException', (error: Error) => {
    writeStderr(JSON.stringify(formatErrorPayload(error, 'uncaught_exception')));
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    writeStderr(JSON.stringify(formatErrorPayload(error, 'unhandled_rejection')));
    process.exit(1);
  });
};

export const ensureBrowserLikeGlobals = (): void => {
  const windowValue = Reflect.get(globalThis, 'window');
  if (typeof windowValue === 'undefined') {
    const windowLike: { crypto?: Crypto } = {};
    if (typeof globalThis.crypto !== 'undefined') {
      windowLike.crypto = globalThis.crypto;
    }
    Reflect.set(globalThis, 'window', windowLike);
  } else if (
    typeof windowValue === 'object' &&
    windowValue !== null &&
    typeof Reflect.get(windowValue, 'crypto') === 'undefined' &&
    typeof globalThis.crypto !== 'undefined'
  ) {
    Reflect.set(windowValue, 'crypto', globalThis.crypto);
  }

  if (typeof Reflect.get(globalThis, 'self') === 'undefined') {
    Reflect.set(globalThis, 'self', globalThis);
  }

  const navigatorValue = Reflect.get(globalThis, 'navigator');
  if (typeof navigatorValue !== 'object' || navigatorValue === null) {
    Reflect.set(globalThis, 'navigator', { userAgent: 'node' });
    return;
  }

  const currentUserAgent = Reflect.get(navigatorValue, 'userAgent');
  if (typeof currentUserAgent !== 'string' || currentUserAgent.trim().length === 0) {
    Reflect.set(navigatorValue, 'userAgent', 'node');
  }
};
