import { useEffect, useRef } from 'react';
import { useAgentStore, type OperationalMode } from '../stores/agentStore';
import { useWalletStore } from '../stores/walletStore';

type AgentStatus = ReturnType<typeof useAgentStore.getState>['status'];

type WalletOperationalSnapshot = {
  walletConnected: boolean;
  walletInitializing: boolean;
  walletReady: boolean;
  agentStatus: AgentStatus;
};

const DISCONNECTED_MODE: OperationalMode = 'autonomous';

export function useWalletOperationalMode(): WalletOperationalSnapshot {
  const walletConnected = useWalletStore((state) => state.isConnected);
  const walletInitializing = useWalletStore((state) => state.isInitializing);
  const operationalMode = useAgentStore((state) => state.operationalMode);
  const setOperationalMode = useAgentStore((state) => state.setOperationalMode);
  const agentStatus = useAgentStore((state) => state.status);
  const disconnect = useAgentStore((state) => state.disconnect);
  const connect = useAgentStore((state) => state.connect);

  const previousModeRef = useRef<OperationalMode>(DISCONNECTED_MODE);
  const previousWalletConnectedRef = useRef<boolean>(walletConnected);

  useEffect(() => {
    if (walletInitializing) {
      return;
    }

    if (walletConnected) {
      const isChangingMode = operationalMode !== 'provideBytes' && agentStatus !== 'connecting' && agentStatus !== 'disconnecting';

      if (isChangingMode) {
        previousModeRef.current = operationalMode;
        previousWalletConnectedRef.current = true;
        void setOperationalMode('provideBytes');
        return;
      }

      if (!previousWalletConnectedRef.current) {
        previousWalletConnectedRef.current = true;
        if (agentStatus === 'connected') {
          void disconnect().finally(() => {
            void connect().catch(() => {});
          });
        }
      }
      return;
    }

    if (previousWalletConnectedRef.current) {
      previousWalletConnectedRef.current = false;
    }

    if (operationalMode !== previousModeRef.current && agentStatus !== 'connecting' && agentStatus !== 'disconnecting') {
      void setOperationalMode(previousModeRef.current);
    }
  }, [walletConnected, walletInitializing, operationalMode, setOperationalMode, agentStatus, disconnect, connect]);

  return {
    walletConnected,
    walletInitializing,
    walletReady: walletConnected || walletInitializing === false,
    agentStatus,
  };
}

export default useWalletOperationalMode;
