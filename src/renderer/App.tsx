import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './providers/StoreProvider';
import { ConfigInitProvider } from './providers/ConfigInitProvider';
import { SessionInitProvider } from './providers/SessionInitProvider';
import { KeyboardShortcutsProvider } from './providers/KeyboardShortcutsProvider';
import { MCPInitProvider } from './providers/MCPInitProvider';
import { WalletInitProvider } from './providers/WalletInitProvider';
import { NotificationContainer } from './components/notifications/NotificationContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LegalGuard } from './components/ui/LegalGuard';
import { Toaster } from './components/ui/sonner';
import { HCS10Provider } from './contexts/HCS10Context';
import DesktopShellRouter from './components/shell/DesktopShellRouter';
import BuilderStudioRoutes from './components/shell/BuilderStudioRouter';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ConfigInitProvider>
          <SessionInitProvider>
            <WalletInitProvider>
              <LegalGuard>
                <Router>
                  <MCPInitProvider>
                    <HCS10Provider>
                      <KeyboardShortcutsProvider>
                        <Routes>
                          <Route path='/*' element={<DesktopShellRouter />} />
                          <Route path='/studio/*' element={<BuilderStudioRoutes />} />
                          <Route path='/dashboard' element={<Navigate to='/builder/dashboard' replace />} />
                          <Route path='/entity-manager' element={<Navigate to='/builder/entity-manager' replace />} />
                          <Route path='/block-tester' element={<Navigate to='/builder/block-tester' replace />} />
                          <Route path='/acknowledgements' element={<Navigate to='/builder/acknowledgements' replace />} />
                          <Route path='*' element={<Navigate to='/' replace />} />
                        </Routes>
                        <NotificationContainer />
                        <Toaster />
                      </KeyboardShortcutsProvider>
                    </HCS10Provider>
                  </MCPInitProvider>
                </Router>
              </LegalGuard>
            </WalletInitProvider>
          </SessionInitProvider>
        </ConfigInitProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
};
export default App;
