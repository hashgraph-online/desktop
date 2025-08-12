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





