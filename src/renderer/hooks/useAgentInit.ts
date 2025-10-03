import { useEffect } from 'react';

export type AgentInitParams = {
  isConfigured: () => boolean;
  config: unknown;
  isConnected: boolean;
  status: string;
  connect: () => Promise<void>;
  /**
   * Defer agent initialization until this becomes true.
   * Pass wallet readiness (e.g., wallet init complete) to avoid mode races.
   */
  ready?: boolean;
};

/**
 * Initializes the agent connection when configuration is ready.
 */
export function useAgentInit(params: AgentInitParams) {
  const { isConfigured, config, isConnected, status, connect, ready = true } = params;

  useEffect(() => {
    const isConfigComplete = isConfigured();
    const initializeAgent = async () => {
      if (config && isConfigComplete && ready && !isConnected && status === 'idle') {
        try {
          await connect();
        } catch {}
      }
    };

    const timer = setTimeout(() => {
      try { console.debug('[useAgentInit] tick', { isConfigComplete, ready, isConnected, status }, new Date().toISOString()); } catch {}
      void initializeAgent();
    }, 100);

    return () => clearTimeout(timer);
  }, [config, isConfigured, isConnected, status, connect, ready]);
}

export default useAgentInit;

