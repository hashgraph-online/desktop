import { CredentialManager } from '../services/credential-manager';
import { registerTransactionHandlers } from '../handlers/transactionHandlers';
import { setupHCS10Handlers } from './hcs10-handlers';
import { registerHCS10DiscoveryHandlers } from './hcs10-discovery-handlers';
import { registerHCS10ChatHandlers } from './hcs10-chat-handlers';
import { setupChatHandlers } from './chat-handlers';
import {
  setupSecurityHandlers,
  setupConfigHandlers,
} from './handlers/security-config-handlers';
import { setupAgentHandlers } from './handlers/agent-handlers';
import { setupConnectionHandlers } from './handlers/connection-handlers';
import { setupMCPHandlers } from './handlers/mcp-handlers';
import { setupPluginHandlers } from './handlers/plugin-handlers';
import {
  setupMirrorNodeHandlers,
  setupThemeHandlers,
  setupUpdateHandlers,
  setupOpenRouterHandlers,
} from './handlers/utility-handlers';
import { setupEntityHandlers } from './handlers/entity-handlers';

/**
 * Sets up all IPC handlers
 * @param masterPassword - The master password for credential encryption
 */
export function setupIPCHandlers(masterPassword: string): void {
  const credentialManager = new CredentialManager(masterPassword);

  setupSecurityHandlers(credentialManager);
  setupConfigHandlers();
  setupAgentHandlers();
  setupConnectionHandlers();
  setupMCPHandlers();
  setupPluginHandlers();
  setupEntityHandlers();
  setupMirrorNodeHandlers();
  setupThemeHandlers();
  setupUpdateHandlers();
  setupOpenRouterHandlers();

  registerTransactionHandlers();
  setupHCS10Handlers();
  registerHCS10DiscoveryHandlers();
  registerHCS10ChatHandlers();
  setupChatHandlers();
}
