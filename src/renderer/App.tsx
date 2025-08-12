import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ChatPage from './pages/ChatPage';
import MCPPage from './pages/MCPPage';
import SettingsPage from './pages/SettingsPage';
import PluginsPage from './pages/PluginsPage';
import { HCS10ProfileRegistration } from './pages/HCS10ProfileRegistration';
import AcknowledgementsPage from './pages/AcknowledgementsPage';
import DashboardPage from './pages/DashboardPage';
import { StoreProvider } from './providers/StoreProvider';
import { KeyboardShortcutsProvider } from './providers/KeyboardShortcutsProvider';
import { MCPInitProvider } from './providers/MCPInitProvider';
import { ConfigInitProvider } from './providers/ConfigInitProvider';
import { NotificationContainer } from './components/notifications/NotificationContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LegalGuard } from './components/ui/LegalGuard';

interface AppProps { }

const App: React.FC<AppProps> = () => {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <LegalGuard>
          <Router>
            <ConfigInitProvider>
              <MCPInitProvider>
                <KeyboardShortcutsProvider>
                  <Layout>
                    <Routes>
                      <Route path='/' element={<DashboardPage />} />
                      <Route path='/dashboard' element={<DashboardPage />} />
                      <Route path='/chat/:agentId?' element={<ChatPage />} />
                      <Route path='/mcp' element={<MCPPage />} />
                      <Route path='/plugins' element={<PluginsPage />} />
                      <Route
                        path='/hcs10-profile'
                        element={<HCS10ProfileRegistration />}
                      />
                      <Route path='/settings' element={<SettingsPage />} />
                      <Route
                        path='/acknowledgements'
                        element={<AcknowledgementsPage />}
                      />
                    </Routes>
                  </Layout>
                  <NotificationContainer />
                </KeyboardShortcutsProvider>
              </MCPInitProvider>
            </ConfigInitProvider>
          </Router>
        </LegalGuard>
      </StoreProvider>
    </ErrorBoundary>
  );
};
export default App;
