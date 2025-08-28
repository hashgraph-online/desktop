import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCResponse } from '../../../shared/schemas';
import { AgentService } from "../../services/agent-service";
import type { AgentConfig, ChatHistory } from "../../services/agent-service";
import { ConfigService } from "../../services/config-service";
import { Logger } from '../../utils/logger';
import { handleIPCError, createSuccessResponse } from './shared-handler-utils';

/**
 * Sets up agent-related IPC handlers
 */
export function setupAgentHandlers(): void {
  const agentService = AgentService.getInstance();
  const logger = new Logger({ module: 'AgentHandlers' });

  ipcMain.handle(
    'agent:initialize',
    async (
      event: IpcMainInvokeEvent,
      config: AgentConfig
    ): Promise<IPCResponse> => {
      const initTimeout = 60000;
      logger.info('Agent initialization requested', {
        llmProvider: config.llmProvider,
        operationalMode: config.operationalMode,
        hasAccountId: !!config.accountId,
        hasPrivateKey: !!config.privateKey,
      });

      try {
        const configService = ConfigService.getInstance();
        const storedConfig = await configService.load();

        const privateKey = storedConfig.hedera?.privateKey || config.privateKey;
        const accountId = storedConfig.hedera?.accountId || config.accountId;

        if (!privateKey || typeof privateKey !== 'string') {
          logger.error(
            'Agent initialization failed: missing or invalid private key'
          );
          return {
            success: false,
            error:
              'Invalid or missing private key in configuration. Please check your Hedera credentials in Settings.',
          };
        }

        if (!accountId || typeof accountId !== 'string') {
          logger.error(
            'Agent initialization failed: missing or invalid account ID'
          );
          return {
            success: false,
            error:
              'Invalid or missing account ID in configuration. Please check your Hedera credentials in Settings.',
          };
        }

        let apiKey: string;
        if (config.llmProvider === 'anthropic') {
          apiKey = storedConfig.anthropic?.apiKey || '';
        } else {
          apiKey = storedConfig.openai?.apiKey || '';
        }

        if (!apiKey) {
          logger.error('Agent initialization failed: missing API key', {
            llmProvider: config.llmProvider,
          });
          return {
            success: false,
            error: `Missing ${config.llmProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key. Please check your LLM provider settings.`,
          };
        }

        const mergedConfig: AgentConfig = {
          accountId,
          privateKey,
          network: config.network || storedConfig.hedera?.network || 'testnet',
          openAIApiKey: apiKey,
          modelName:
            config.modelName ||
            (config.llmProvider === 'openai'
              ? storedConfig.openai?.model || 'gpt-4o-mini'
              : storedConfig.anthropic?.model || 'claude-3-5-sonnet-20241022'),
          operationalMode: config.operationalMode || 'autonomous',
          llmProvider:
            config.llmProvider || storedConfig.llmProvider || 'openai',
        };

        logger.info('Initializing agent with merged configuration', {
          accountId: mergedConfig.accountId,
          network: mergedConfig.network,
          llmProvider: mergedConfig.llmProvider,
          modelName: mergedConfig.modelName,
          operationalMode: mergedConfig.operationalMode,
          hasApiKey: !!mergedConfig.openAIApiKey,
        });

        const initPromise = agentService.initialize(mergedConfig);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Agent initialization timed out after ${initTimeout / 1000} seconds`
              )
            );
          }, initTimeout);
        });

        const result = await Promise.race([initPromise, timeoutPromise]);

        if (result.success) {
          logger.info('Agent initialization successful', {
            sessionId: result.sessionId,
            coreReadyTimeMs: result.coreReadyTimeMs,
            backgroundTasksRemaining: result.backgroundTasksRemaining,
            loadingPhase: result.loadingPhase,
          });

          return {
            success: true,
            data: {
              sessionId: result.sessionId,
              coreReadyTimeMs: result.coreReadyTimeMs,
              backgroundTasksRemaining: result.backgroundTasksRemaining,
              loadingPhase: result.loadingPhase,
            },
          };
        } else {
          logger.error('Agent initialization failed', {
            error: result.error,
          });

          return {
            success: false,
            error: result.error,
            data: {
              coreReadyTimeMs: result.coreReadyTimeMs,
              backgroundTasksRemaining: result.backgroundTasksRemaining,
              loadingPhase: result.loadingPhase,
            },
          };
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to initialize agent';
        logger.error('Agent initialization error', {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        });

        return {
          success: false,
          error: errorMessage,
          data: {
            coreReadyTimeMs: 0,
            backgroundTasksRemaining: 0,
            loadingPhase: 'failed',
          },
        };
      }
    }
  );

  ipcMain.handle(
    'agent:send-message',
    async (
      event: IpcMainInvokeEvent,
      data: {
        content: string;
        chatHistory: ChatHistory[];
        attachments?: Array<{
          name: string;
          data: string;
          type: string;
          size: number;
        }>;
        formSubmission?: {
          formId: string;
          data: Record<string, unknown>;
          timestamp: number;
          toolName: string;
          originalPrompt?: string;
          partialInput?: Record<string, unknown>;
        };
      }
    ): Promise<IPCResponse> => {
      try {
        logger.info('IPC agent:send-message received:', {
          contentLength: data.content?.length || 0,
          historyLength: data.chatHistory?.length || 0,
          attachmentsCount: data.attachments?.length || 0,
          hasAttachments: !!data.attachments && data.attachments.length > 0,
          hasFormSubmission: !!data.formSubmission,
        });

        if (data.formSubmission) {
          const result = await agentService.processFormSubmission(
            data.formSubmission,
            data.chatHistory
          );
          return result;
        }

        const result = await agentService.sendMessageWithAttachments(
          data.content,
          data.chatHistory,
          data.attachments || []
        );
        return result;
      } catch (error) {
        return handleIPCError(error, 'Failed to send message');
      }
    }
  );

  ipcMain.handle(
    'agent:disconnect',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const result = await agentService.disconnect();
        return result;
      } catch (error) {
        return handleIPCError(error, 'Failed to disconnect');
      }
    }
  );

  ipcMain.handle(
    'agent:preload',
    async (
      event: IpcMainInvokeEvent,
      config: AgentConfig
    ): Promise<IPCResponse> => {
      try {
        logger.info('IPC handler agent:preload called');
        logger.info('Preload requested but not implemented');
        return createSuccessResponse();
      } catch (error) {
        return handleIPCError(error, 'Failed to start preload');
      }
    }
  );

  ipcMain.handle(
    'agent:getStatus',
    async (event: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const status = agentService.getStatus();
        return createSuccessResponse(status);
      } catch (error) {
        return handleIPCError(error, 'Failed to get status');
      }
    }
  );

  ipcMain.handle(
    'agent:update-session-context',
    async (
      event: IpcMainInvokeEvent,
      context: {
        sessionId: string;
        mode: 'personal' | 'hcs10';
        topicId?: string;
      }
    ): Promise<IPCResponse> => {
      try {
        logger.info('IPC handler agent:update-session-context called', {
          sessionId: context.sessionId,
          mode: context.mode,
          hasTopicId: !!context.topicId,
        });

        agentService.updateSessionContext(context);
        return createSuccessResponse();
      } catch (error) {
        logger.error('Update session context error:', error);
        return handleIPCError(error, 'Failed to update session context');
      }
    }
  );
}