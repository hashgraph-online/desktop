import React, { useEffect, ReactNode } from 'react';
import { useConfigStore } from '../stores/configStore';

interface ConfigInitProviderProps {
  children: ReactNode;
}

/**
 * Provider that initializes configuration loading on app startup.
 * This ensures that configuration is loaded from storage before
 * any components that depend on it are rendered.
 *
 * @param children - Child components to render after configuration initialization
 * @returns React component that handles configuration initialization
 */
export const ConfigInitProvider: React.FC<ConfigInitProviderProps> = ({
  children,
}) => {
  const { loadConfig } = useConfigStore();

  useEffect(() => {
    loadConfig().catch((error) => {

    });
  }, [loadConfig]);

  return <>{children}</>;
};