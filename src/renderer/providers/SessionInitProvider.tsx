import React, { useEffect, ReactNode } from 'react';
import { useAgentStore } from '../stores/agentStore';

interface SessionInitProviderProps {
  children: ReactNode;
}

/**
 * Provider that initializes session loading on app startup.
 * This loads all sessions from the database and prepares for session restoration.
 * Session restoration happens after successful agent connection.
 *
 * @param children - Child components to render after session initialization
 * @returns React component that handles session initialization
 */
export const SessionInitProvider: React.FC<SessionInitProviderProps> = ({
  children,
}) => {
  const { initializeSessions, isInitialized } = useAgentStore();

  useEffect(() => {
    if (!isInitialized) {
      initializeSessions().catch(() => {});
    }
  }, [initializeSessions, isInitialized]);

  return <>{children}</>;
};
