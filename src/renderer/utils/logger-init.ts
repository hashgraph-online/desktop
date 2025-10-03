import { setLoggerFactory } from '@hashgraphonline/standards-sdk';
import { createElectronRendererLogger } from './electron-logger-adapter';

/**
 * Initialize the logger factory for the renderer process
 * This should be called once at the very beginning of the renderer process
 */
export function initializeRendererLogger(): void {
  setLoggerFactory(createElectronRendererLogger);
}
