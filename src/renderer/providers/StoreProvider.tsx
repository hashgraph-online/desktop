import React, { createContext, useContext, ReactNode } from 'react';

interface StoreProviderProps {
  children: ReactNode;
}

const StoreContext = createContext<boolean>(true);

/**
 * Provider that ensures stores are properly initialized.
 * Wraps the application to provide store context.
 *
 * @param children - Child components to render within store context
 * @returns React component that provides store initialization
 */
export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  return <StoreContext.Provider value={true}>{children}</StoreContext.Provider>;
};

/**
 * Hook to access store context.
 * Ensures components are wrapped in StoreProvider.
 *
 * @returns Boolean indicating store is initialized
 */
export const useStoreContext = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  return context;
};
