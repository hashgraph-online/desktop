import { useEffect } from 'react';

export type AgentInitParams = {
  isConfigured: () => boolean;
  config: unknown;
  isConnected: boolean;
  status: string;
  connect: () => Promise<void>;
};

/**
 * Initializes the agent connection when configuration is ready.
 */
export function useAgentInit(params: AgentInitParams) {
  const { isConfigured, config, isConnected, status, connect } = params;

  useEffect(() => {
    const isConfigComplete = isConfigured();
    const initializeAgent = async () => {
      if (config && isConfigComplete && !isConnected && status === 'idle') {
        try {
          await connect();
        } catch {}
      }
    };

    const timer = setTimeout(() => {
      void initializeAgent();
    }, 100);

    return () => clearTimeout(timer);
  }, [config, isConfigured, isConnected, status, connect]);
}

export default useAgentInit;


