/**
 * Minimal Pino stub for Electron builds to avoid worker/transport usage.
 */
type LevelMethod = (...args: unknown[]) => void;

interface StubLogger {
  info: LevelMethod;
  error: LevelMethod;
  warn: LevelMethod;
  debug: LevelMethod;
  trace: LevelMethod;
  fatal: LevelMethod;
  child: () => StubLogger;
}

function createStub(): StubLogger {
  const noop: LevelMethod = () => {};
  const logger: StubLogger = {
    info: noop,
    error: noop,
    warn: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => createStub(),
  };
  return logger;
}

export default function pino(): StubLogger {
  return createStub();
}

export type { StubLogger };
/** Minimal levels map to satisfy packages that import `levels` from pino */
export const levels = {
  values: {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    debug: 20,
    trace: 10,
    silent: 0,
  },
  labels: {
    60: 'fatal',
    50: 'error',
    40: 'warn',
    30: 'info',
    20: 'debug',
    10: 'trace',
    0: 'silent',
  } as Record<number, string>,
};



