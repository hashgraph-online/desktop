import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ChatPage from './pages/ChatPage';
import MCPPage from './pages/MCPPage';
import SettingsPage from './pages/SettingsPage';
import PluginsPage from './pages/PluginsPage';
import BlockTesterPage from './pages/BlockTesterPage';
import ToolsPage from './pages/ToolsPage';
import { EntityManagerPage } from './pages/entity-manager-page';
import { HCS10ProfileRegistration } from './pages/HCS10ProfileRegistration';
import AcknowledgementsPage from './pages/AcknowledgementsPage';
import DashboardPage from './pages/DashboardPage';
import AgentDiscoveryPage from './pages/AgentDiscoveryPage';
import ConnectionsPage from './pages/ConnectionsPage';
import { StoreProvider } from './providers/StoreProvider';
import { ConfigInitProvider } from './providers/ConfigInitProvider';
import { SessionInitProvider } from './providers/SessionInitProvider';
import { KeyboardShortcutsProvider } from './providers/KeyboardShortcutsProvider';
import { MCPInitProvider } from './providers/MCPInitProvider';
import { NotificationContainer } from './components/notifications/NotificationContainer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LegalGuard } from './components/ui/LegalGuard';
import { Toaster } from './components/ui/sonner';
import { HCS10Provider } from './contexts/HCS10Context';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ConfigInitProvider>
          <SessionInitProvider>
            <LegalGuard>
              <Router>
                <MCPInitProvider>
                  <HCS10Provider>
                    <KeyboardShortcutsProvider>
                      <Layout>
                        <Routes>
                          <Route path='/' element={<DashboardPage />} />
                          <Route path='/dashboard' element={<DashboardPage />} />
                          <Route path='/chat/:agentId?' element={<ChatPage />} />
                          <Route
                            path='/discover'
                            element={<AgentDiscoveryPage />}
                          />
                          <Route
                            path='/connections'
                            element={<ConnectionsPage />}
                          />
                          <Route path='/mcp' element={<MCPPage />} />
                          <Route path='/plugins' element={<PluginsPage />} />
                          <Route path='/tools' element={<ToolsPage />} />
                          <Route path='/entity-manager' element={<EntityManagerPage />} />
                          <Route path='/block-tester' element={<BlockTesterPage />} />
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
                      <Toaster />
                    </KeyboardShortcutsProvider>
                  </HCS10Provider>
                </MCPInitProvider>
              </Router>
            </LegalGuard>
          </SessionInitProvider>
        </ConfigInitProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
};
export default App;
