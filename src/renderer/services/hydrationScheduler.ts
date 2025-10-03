import { Logger } from '@hashgraphonline/standards-sdk';

export type EntityContext = { name?: string; description?: string };

type SessionResolver = () => string | undefined;
type NetworkResolver = () => string | undefined;

interface HydrationOptions {
  session?: SessionResolver;
  network?: NetworkResolver;
}

const MAX_ATTEMPTS = 5;
const SHORT_DELAY_MS = 1500;
const LONG_DELAY_MS = 3000;
const FALLBACK_DELAY_MS = 2000;

const retryTimers = new Map<string, NodeJS.Timeout>();
const pendingAttempts = new Map<string, number>();

const logger = new Logger({ module: 'TransactionHydrationScheduler' });

const isWindowUnavailable = () => typeof window === 'undefined';

const clearRetryTimer = (transactionId: string) => {
  const timer = retryTimers.get(transactionId);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(transactionId);
  }
};

const scheduleRetry = (
  transactionId: string,
  entityContext: EntityContext | undefined,
  nextAttempt: number,
  delay: number,
  options: HydrationOptions
): void => {
  const timer = setTimeout(() => {
    retryTimers.delete(transactionId);
    void attemptHydration(transactionId, entityContext, nextAttempt, options);
  }, delay);

  retryTimers.set(transactionId, timer);
};

const resolveSessionId = (resolver: SessionResolver | undefined): string | undefined => {
  if (!resolver) {
    return undefined;
  }
  try {
    return resolver();
  } catch {
    return undefined;
  }
};

const resolveNetwork = (resolver: NetworkResolver | undefined): string | undefined => {
  if (!resolver) {
    return undefined;
  }
  try {
    return resolver();
  } catch {
    return undefined;
  }
};

const attemptHydration = async (
  transactionId: string,
  entityContext: EntityContext | undefined,
  attempt: number,
  options: HydrationOptions
): Promise<void> => {
  if (isWindowUnavailable()) {
    return;
  }

  const sessionId = resolveSessionId(options.session);
  if (!sessionId) {
    if (attempt >= MAX_ATTEMPTS) {
      return;
    }

    scheduleRetry(
      transactionId,
      entityContext,
      attempt + 1,
      FALLBACK_DELAY_MS,
      options
    );
    return;
  }

  try {
    const hydrateFn = window?.desktop?.hydrateExecutedTransaction;

    if (!hydrateFn) {
      throw new Error('Hydration bridge unavailable');
    }

    const network = resolveNetwork(options.network);
    pendingAttempts.set(transactionId, attempt);
    logger.info('hydrateExecutedTransaction attempt', {
      transactionId,
      attempt,
    });

    const payload = entityContext ? { ...entityContext } : undefined;
    const response = await hydrateFn(transactionId, sessionId, {
      entityContext: payload,
      network,
    });

    if (response?.success) {
      logger.info('hydrateExecutedTransaction succeeded', {
        transactionId,
        attempts: attempt,
      });
      pendingAttempts.delete(transactionId);
      clearRetryTimer(transactionId);
      return;
    }

    if (attempt >= MAX_ATTEMPTS) {
      logger.warn('hydrateExecutedTransaction exhausted retries', {
        transactionId,
        error: response?.error,
      });
      pendingAttempts.delete(transactionId);
      clearRetryTimer(transactionId);
      return;
    }

    const delay = attempt < 3 ? SHORT_DELAY_MS : LONG_DELAY_MS;
    logger.info('hydrateExecutedTransaction scheduling retry', {
      transactionId,
      nextAttempt: attempt + 1,
      delay,
      error: response?.error,
    });
    scheduleRetry(transactionId, entityContext, attempt + 1, delay, options);
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      logger.error('hydrateExecutedTransaction failed after retries', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      pendingAttempts.delete(transactionId);
      clearRetryTimer(transactionId);
      return;
    }

    logger.info('hydrateExecutedTransaction error, scheduling retry', {
      transactionId,
      nextAttempt: attempt + 1,
      delay: FALLBACK_DELAY_MS,
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleRetry(transactionId, entityContext, attempt + 1, FALLBACK_DELAY_MS, options);
  }
};

export const enqueueHydration = (
  transactionId: string,
  entityContext?: EntityContext,
  options?: {
    session?: string | SessionResolver;
    network?: string | (() => string | undefined);
  }
): void => {
  if (!transactionId || isWindowUnavailable()) {
    return;
  }

  const sessionOption: SessionResolver | undefined = (() => {
    if (!options?.session) {
      return undefined;
    }
    if (typeof options.session === 'function') {
      return options.session;
    }
    const value = options.session;
    return () => value;
  })();

  const networkOption: NetworkResolver | undefined = (() => {
    if (!options?.network) {
      return undefined;
    }
    if (typeof options.network === 'function') {
      return options.network;
    }
    const value = options.network;
    return () => value;
  })();

  const normalizedOptions: HydrationOptions = {
    session: sessionOption,
    network: networkOption,
  };

  clearRetryTimer(transactionId);
  pendingAttempts.delete(transactionId);
  void attemptHydration(transactionId, entityContext, 1, normalizedOptions);
};

export const flushHydrationQueue = (): void => {
  retryTimers.forEach((timer) => clearTimeout(timer));
  retryTimers.clear();
  pendingAttempts.clear();
};
