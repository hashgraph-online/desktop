import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from '../stores/agentStore';

export type Hcs10PollingParams = {
  topicId?: string;
  isConnected: boolean;
  hasMessages: boolean;
};

/**
 * Polls HCS-10 conversation messages when connected and a topic is active.
 * Only polls when window is focused to avoid jarring updates.
 */
export function useHcs10Polling(params: Hcs10PollingParams) {
  const {
    topicId,
    isConnected,
    hasMessages,
  } = params;

  const hasInitialLoadedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  
  const startPolling = useCallback(() => {
    if (!topicId || !isConnected || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;
    
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const currentStore = useAgentStore.getState();
        void currentStore.refreshConversationMessages(topicId);
      }
    }, 30000);
  }, [topicId, isConnected]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  useEffect(() => {
    if (!topicId || !isConnected) {
      stopPolling();
      return;
    }

    const store = useAgentStore.getState();

    if (!hasMessages && !hasInitialLoadedRef.current.has(topicId)) {
      hasInitialLoadedRef.current.add(topicId);
      void store.loadConversationMessages(topicId);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [topicId, isConnected, hasMessages, startPolling, stopPolling]);
}

export default useHcs10Polling;
