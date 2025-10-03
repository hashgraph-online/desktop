import React from 'react';
import { Navigate, useLocation, useRoutes } from 'react-router-dom';
import Layout from '../Layout';
import DashboardPage from '../../pages/DashboardPage';
import ChatPage from '../../pages/ChatPage';
import MCPPage from '../../pages/MCPPage';
import PluginsPage from '../../pages/PluginsPage';
import ToolsPage from '../../pages/ToolsPage';
import BlockTesterPage from '../../pages/BlockTesterPage';
import SettingsPage from '../../pages/SettingsPage';
import AcknowledgementsPage from '../../pages/AcknowledgementsPage';
import AgentDiscoveryPage from '../../pages/AgentDiscoveryPage';
import ConnectionsPage from '../../pages/ConnectionsPage';
import { EntityManagerPage } from '../../pages/entity-manager-page';
import { HCS10ProfileRegistration } from '../../pages/HCS10ProfileRegistration';

const BuilderStudioRoutes: React.FC = () => {
  const location = useLocation();

  const element = useRoutes([
    { path: '', element: <DashboardPage /> },
    { path: 'dashboard', element: <DashboardPage /> },
    { path: 'chat/:agentId?', element: <ChatPage /> },
    { path: 'discover', element: <AgentDiscoveryPage /> },
    { path: 'connections', element: <ConnectionsPage /> },
    { path: 'mcp', element: <MCPPage /> },
    { path: 'plugins', element: <PluginsPage /> },
    { path: 'tools', element: <ToolsPage /> },
    { path: 'entity-manager', element: <EntityManagerPage /> },
    { path: 'block-tester', element: <BlockTesterPage /> },
    { path: 'hcs10-profile', element: <HCS10ProfileRegistration /> },
    { path: 'settings', element: <SettingsPage /> },
    { path: 'acknowledgements', element: <AcknowledgementsPage /> },
    { path: '*', element: <Navigate to='dashboard' replace /> },
  ]);

  const hideSidebar = location.pathname.startsWith('/builder/entity-manager') ||
    location.pathname.startsWith('/builder/block-tester');

  return <Layout hideSidebar={hideSidebar}>{element}</Layout>;
};

export default BuilderStudioRoutes;
