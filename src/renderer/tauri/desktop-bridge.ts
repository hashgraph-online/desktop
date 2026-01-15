import type { BrowserBounds, BrowserLayoutInfo } from '../../shared/browser-layout';
import type { BrowserState } from '@/types/desktop-bridge';
import type { MCPServerConfig } from '@/types/mcp';
import type { AppConfig } from '@/stores/configStore';

type ElectronData = unknown;
type Listener = (...args: ElectronData[]) => void;

interface RegisteredListener {
  readonly unlisten: () => void;
  readonly callback: Listener;
}

type TauriInternals = {
  invoke: (cmd: string, payload?: unknown, options?: unknown) => Promise<unknown>;
};

type CommandResponse<T extends Record<string, unknown>> = {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
};

type LoadConfigResponse = {
  success: boolean;
  config?: AppConfig | null;
  error?: string;
};

type PluginToggleResponse = {
  success: boolean;
  data?: Record<string, unknown> | null;
  error?: string;
};

type TransactionExecutionResult = {
  transactionId?: string;
  status?: string;
  entityId?: string;
  entityType?: string;
  [key: string]: unknown;
};

const mergeCommandResponse = <T extends Record<string, unknown>>(
  response: CommandResponse<T>
): CommandResponse<T> & T => {
  if (response.data && typeof response.data === 'object') {
    const { data, ...rest } = response;
    return { ...rest, ...data } as CommandResponse<T> & T;
  }

  return response as CommandResponse<T> & T;
};

const registeredListeners = new Map<string, RegisteredListener[]>();

const notImplemented = async <T>(feature: string): Promise<T> => {
  throw new Error(`${feature} is not implemented in the Tauri bridge`);
};

const getTauriInternals = (): TauriInternals | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const candidate = (window as Window & {
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, payload?: unknown, options?: unknown) => Promise<unknown>;
    };
  }).__TAURI_INTERNALS__;

  if (candidate && typeof candidate.invoke === 'function') {
    return candidate as TauriInternals;
  }

  return undefined;
};

const isTauriRuntime = () => Boolean(getTauriInternals());

let tauriReadyPromise: Promise<TauriInternals | undefined> | null = null;

const waitForTauriInternals = async (
  timeoutMs = 5000
): Promise<TauriInternals | undefined> => {
  if (tauriReadyPromise) {
    return tauriReadyPromise;
  }

  tauriReadyPromise = new Promise<TauriInternals | undefined>((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const internals = getTauriInternals();
      if (internals?.invoke) {
        resolve(internals);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error('Tauri runtime not ready'));
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  })
    .catch((error) => {
      tauriReadyPromise = null;
      throw error;
    })
    .then((internals) => {
      tauriReadyPromise = Promise.resolve(internals);
      return internals;
    });

  return tauriReadyPromise;
};

const ensureTauriReady = async () => {
  try {
    return await waitForTauriInternals();
  } catch (error) {
    return undefined;
  }
};

const invoke = async <T = unknown>(channel: string, data?: Record<string, unknown>) => {
  const internals = await ensureTauriReady();
  if (!internals?.invoke) {
    throw new Error(`Tauri IPC unavailable: ${channel}`);
  }

  return internals.invoke(channel, data) as Promise<T>;
};

const invokeWithPayload = async <T = unknown>(
  channel: string,
  payload: Record<string, unknown> | null | undefined
) => invoke<T>(channel, { payload: payload ?? null });

let eventModulePromise: Promise<typeof import('@tauri-apps/api/event') | null> | null = null;

const loadEventModule = async () => {
  if (!eventModulePromise) {
    eventModulePromise = ensureTauriReady().then(async (internals) => {
      if (!internals) {
        return null;
      }

      try {
        return await import('@tauri-apps/api/event');
      } catch (error) {
        return null;
      }
    });
  }

  return eventModulePromise;
};

const emitEvent = async (channel: string, payload?: ElectronData) => {
  const eventModule = await loadEventModule();
  await eventModule?.emit?.(channel, payload);
};

const registerListener = async (channel: string, callback: Listener): Promise<() => void> => {
  const eventModule = await loadEventModule();
  if (!eventModule?.listen) {
    return async () => {
      /* noop */
    };
  }

  const unlisten = await eventModule.listen(channel, (event) => {
    const payload = event.payload;
    if (Array.isArray(payload)) {
      callback(...payload);
    } else {
      callback(payload as ElectronData);
    }
  });

  const entries = registeredListeners.get(channel) ?? [];
  entries.push({ unlisten, callback });
  registeredListeners.set(channel, entries);

  return () => {
    unlisten();
    const current = registeredListeners.get(channel);
    if (!current) {
      return;
    }
    registeredListeners.set(
      channel,
      current.filter((entry) => entry.unlisten !== unlisten)
    );
  };
};

if (typeof window !== 'undefined') {
  const desktopLike = {
    versions: {
      node: 'tauri',
      chrome: 'tauri',
      electron: 'tauri'
    },
    send: (channel: string, data?: ElectronData) => {
      void emitEvent(channel, data);
    },
    on: (channel: string, callback: Listener) => {
      const disposerPromise = registerListener(channel, callback);
      return () => {
        void disposerPromise.then((dispose) => {
          dispose();
        });
      };
    },
    invoke,
    credentials: {
      store: (service: string, account: string, password: string) =>
        invoke('credential_store', { service, account, password }),
      get: (service: string, account: string) =>
        invoke('credential_get', { service, account }),
      delete: (service: string, account: string) =>
        invoke('credential_delete', { service, account }),
      clear: (service?: string) =>
        invoke('credential_clear', { service: service ?? 'conversational-agent' })
    }
  };

  const desktopBridge = {
    saveConfig: (config: ElectronData) => invoke('save_config', { config }),
    loadConfig: async (): Promise<LoadConfigResponse> => {
      const payload = await invoke<LoadConfigResponse>('load_config');
      if (!payload || typeof payload.success !== 'boolean') {
        return {
          success: false,
          config: null,
          error: 'Invalid load_config response',
        } satisfies LoadConfigResponse;
      }

      return {
        success: payload.success,
        config: payload.config ?? null,
        error: payload.error,
      } satisfies LoadConfigResponse;
    },
    getEnvironmentConfig: () => invoke('get_environment_config'),
    getWalletStatus: () => invoke('wallet_status'),
    testHederaConnection: (payload: { accountId: string; privateKey: string; network: 'mainnet' | 'testnet' }) =>
      invoke('connection_test_hedera', payload),
    testOpenAIConnection: (payload: { apiKey: string; model: string }) =>
      invoke('connection_test_openai', payload),
    testAnthropicConnection: (payload: { apiKey: string; model: string }) =>
      invoke('connection_test_anthropic', payload),
    setTheme: (theme: 'light' | 'dark') => invoke('set_theme', { theme }),
    setAutoStart: (autoStart: boolean) => invoke('set_auto_start', { auto_start: autoStart }),
    setLogLevel: (logLevel: 'debug' | 'info' | 'warn' | 'error') => invoke('set_log_level', { log_level: logLevel }),
    connectAgent: () => notImplemented('connectAgent'),
    disconnectAgent: () => invoke('agent_disconnect'),
    sendMessage: () => notImplemented('sendMessage'),
    initializeAgent: (config: Record<string, unknown>) => invoke('agent_initialize', { config }),
    preloadAgent: () => notImplemented('preloadAgent'),
    sendAgentMessage: (payload: Record<string, unknown>) =>
      invoke('agent_send_message', { request: payload }),
    updateAgentSessionContext: (
      payload: { sessionId: string; mode: string; topicId?: string }
    ) => invoke('agent_update_session_context', { payload }),
    disconnectAgentNew: () => invoke('agent_disconnect'),
    getAgentStatus: () => invoke('agent_status'),
    loadMCPServers: () => invoke('mcp_load_servers'),
    saveMCPServers: (servers: MCPServerConfig[]) => invokeWithPayload('mcp_save_servers', { servers }),
    testMCPConnection: (server: MCPServerConfig) => invoke('mcp_test_connection', { server }),
    connectMCPServer: (serverId: string) => invoke('mcp_connect_server', { serverId }),
    disconnectMCPServer: (serverId: string) => invoke('mcp_disconnect_server', { serverId }),
    getMCPServerTools: (serverId: string) => invoke('mcp_get_server_tools', { serverId }),
    refreshMCPServerTools: (serverId: string) => invoke('mcp_refresh_server_tools', { serverId }),
    searchMCPRegistry: (options: Record<string, unknown>) =>
      invoke('mcp_search_registry', { options }),
    getMCPRegistryServerDetails: (serverId: string, packageName?: string) =>
      invoke('mcp_get_registry_server_details', { serverId, packageName }),
    installMCPFromRegistry: (
      serverId: string,
      packageName?: string,
      installCommand?: { command: string; args: string[] }
    ) =>
      invokeWithPayload('mcp_install_from_registry', {
        serverId,
        packageName,
        installCommand,
      }),
    clearMCPRegistryCache: () => invoke('mcp_clear_registry_cache'),
    getMCPCacheStats: async () => {
      try {
        return await invoke('mcp_get_cache_stats');
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Command mcp_get_cache_stats not found')
        ) {
          return { success: false };
        }

        throw error;
      }
    },
    triggerMCPBackgroundSync: () => invoke('mcp_trigger_background_sync'),
    enrichMCPMetrics: (options?: { limit?: number; concurrency?: number }) =>
      invoke('mcp_enrich_metrics', { options: options ?? {} }),
    searchPlugins: (query: string, registry?: string) =>
      invoke('plugin_search', { query, registry }),
    installPlugin: () => notImplemented('installPlugin'),
    uninstallPlugin: () => notImplemented('uninstallPlugin'),
    updatePlugin: () => notImplemented('updatePlugin'),
    enablePlugin: (pluginId: string) =>
      invoke<PluginToggleResponse>('plugin_enable', { pluginId }),
    disablePlugin: (pluginId: string) =>
      invoke<PluginToggleResponse>('plugin_disable', { pluginId }),
    configurePlugin: () => notImplemented('configurePlugin'),
    grantPluginPermissions: () => notImplemented('grantPluginPermissions'),
    revokePluginPermissions: () => notImplemented('revokePluginPermissions'),
    getInstalledPlugins: () => notImplemented('getInstalledPlugins'),
    checkPluginUpdates: () => notImplemented('checkPluginUpdates'),
    agent_update_session_context: (payload: { sessionId: string; mode: string; topicId?: string }) =>
      invokeWithPayload('agent_update_session_context', payload),
    chat_create_session: (payload?: Record<string, unknown>) =>
      invokeWithPayload('chat_create_session', payload ?? null),
    chat_load_session: (payload: Record<string, unknown>) =>
      invokeWithPayload('chat_load_session', payload),
    chat_save_session: (payload: Record<string, unknown>) =>
      invokeWithPayload('chat_save_session', payload),
    chat_delete_session: (payload: Record<string, unknown>) =>
      invokeWithPayload('chat_delete_session', payload),
    chat_load_all_sessions: () => invoke('chat_load_all_sessions'),
    chat_save_message: (payload: Record<string, unknown>) =>
      invokeWithPayload('chat_save_message', payload),
    chat_load_session_messages: (payload: Record<string, unknown>) =>
      invokeWithPayload('chat_load_session_messages', payload),
    findFormById: (formId: string, sessionId?: string) =>
      invokeWithPayload('chat_find_form_by_id', { formId, sessionId }),
    updateFormState: (
      formId: string,
      completionState: string,
      completionData?: Record<string, unknown>,
      sessionId?: string
    ) =>
      invokeWithPayload('chat_update_form_state', {
        formId,
        completionState,
        completionData,
        sessionId,
      }),
    entity: {
      getAll: (filters?: Record<string, unknown>) =>
        invokeWithPayload('entity_get_all', filters ?? null),
      delete: (entityId: string) =>
        invokeWithPayload('entity_delete', { entityId }),
      bulkDelete: (entityIds: string[]) =>
        invokeWithPayload('entity_bulk_delete', { entityIds }),
      rename: (entityId: string, newName: string) =>
        invokeWithPayload('entity_rename', { entityId, newName }),
      export: (
        filters?: Record<string, unknown>,
        format: 'json' | 'csv' = 'json'
      ) =>
        invokeWithPayload('entity_export', {
          filters: filters ?? null,
          format,
        }),
      getById: (entityId: string) =>
        invokeWithPayload('entity_get_by_id', { entityId }),
      search: (query: string, entityType?: string) =>
        invokeWithPayload('entity_search', { query, entityType }),
    },
    mirrorNode: {
      getScheduleInfo: (scheduleId: string, network?: string) =>
        invokeWithPayload('mirror_node_get_schedule_info', { scheduleId, network }),
      getTransactionByTimestamp: (timestamp: string, network?: string) =>
        invokeWithPayload('mirror_node_get_transaction_by_timestamp', {
          timestamp,
          network,
        }),
      getScheduledTransactionStatus: (scheduleId: string, network?: string) =>
        invokeWithPayload('mirror_node_get_scheduled_transaction_status', {
          scheduleId,
          network,
        }),
      getTransaction: (transactionId: string, network?: string) =>
        invokeWithPayload('mirror_node_get_transaction', { transactionId, network }),
      getTokenInfo: async (tokenId: string, network?: string) => {
        try {
          return await invokeWithPayload('mirror_node_get_token_info', {
            transactionId: tokenId,
            network,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Command mirror_node_get_token_info not found')
          ) {
            return { success: false };
          }

          throw error;
        }
      },
    },
    transactionParser: {
      validate: async (transactionBytes: string) => {
        try {
          return await invokeWithPayload('transaction_parser_validate', {
            transactionBytes,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Command transaction_parser_validate not found')
          ) {
            return { success: false };
          }

          throw error;
        }
      },
      parse: async (transactionBytes: string) => {
        try {
          return await invokeWithPayload('transaction_parser_parse', {
            transactionBytes,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Command transaction_parser_parse not found')
          ) {
            return { success: false };
          }

          throw error;
        }
      },
    },
    executeScheduledTransaction: (scheduleId: string) =>
      invoke('execute-scheduled-transaction', { scheduleId }),
    deleteScheduledTransaction: (scheduleId: string) =>
      invoke('delete-scheduled-transaction', { scheduleId }),
    getScheduledTransaction: (scheduleId: string) =>
      invoke('get-scheduled-transaction', { scheduleId }),
    setCurrentWallet: (
      info: { accountId: string; network: 'mainnet' | 'testnet' } | null
    ) => invokeWithPayload('wallet_set_current', { info }),
    executeTransactionBytes: async (
      transactionBytes: string,
      entityContext?: { name?: string; description?: string }
    ) =>
      mergeCommandResponse(
        await invokeWithPayload<CommandResponse<TransactionExecutionResult>>(
          'execute-transaction-bytes',
          {
            transactionBytes,
            entityContext,
          }
        )
      ),
    hydrateExecutedTransaction: (
      transactionId: string,
      sessionId: string,
      options?: {
        entityContext?: { name?: string; description?: string };
        network?: string;
      }
    ) =>
      invokeWithPayload('wallet_hydrate_entity', {
        transactionId,
        sessionId,
        entityContext: options?.entityContext,
        network: options?.network,
      }),
    send: desktopLike.send,
    invoke: desktopLike.invoke,
    on: desktopLike.on,
    removeListener: (channel: string, callback: Listener) => {
      const listeners = registeredListeners.get(channel);
      if (!listeners) {
        return;
      }
      const remaining = listeners.filter((entry) => entry.callback !== callback);
      listeners
        .filter((entry) => entry.callback === callback)
        .forEach((entry) => {
          entry.unlisten();
        });
      if (remaining.length === 0) {
        registeredListeners.delete(channel);
      } else {
        registeredListeners.set(channel, remaining);
      }
    },
    openExternal: async (url: string) => {
      try {
        await invoke<void>('browser_open_external', { url });
        console.info('[desktop-bridge] openExternal success', url);
      } catch (error) {
        console.error('[desktop-bridge] openExternal failed', url, error);
        throw error;
      }
    },
    reloadApp: () => {
      window.location.reload();
      return Promise.resolve();
    },
    getPaths: () => notImplemented('getPaths'),
    browser: {
      navigate: (url: string) => invoke<void>('browser_navigate', { url }),
      reload: () => invoke<void>('browser_reload'),
      goBack: () => invoke<void>('browser_go_back'),
      goForward: () => invoke<void>('browser_go_forward'),
      setBounds: (bounds: BrowserBounds) => invoke<void>('browser_set_bounds', { bounds }),
      setLayout: (layout: BrowserLayoutInfo) => invoke<void>('browser_set_layout', { layout }),
      getState: () => invoke<BrowserState>('browser_get_state'),
      executeJavaScript: <T = unknown>(script: string) => invoke<T>('browser_execute_js', { script }),
      captureContext: () => invoke<{title?: string; description?: string; selection?: string; favicons?: string[]} | null>('browser_capture_context'),
      openDevTools: () => invoke<void>('browser_open_devtools'),
      attach: () => invoke<void>('browser_attach'),
      detach: () => invoke<void>('browser_detach'),
      onState: (listener: (state: BrowserState) => void) => {
        const disposerPromise = registerListener('browser_state', (payload) => {
          listener(payload as BrowserState);
        });
        return () => {
          void disposerPromise.then((dispose) => {
            dispose();
          });
        };
      }
    }
  };

  window.desktopAPI = desktopLike as unknown as Window['desktopAPI'];
  window.desktop = desktopBridge as unknown as Window['desktop'];
}
