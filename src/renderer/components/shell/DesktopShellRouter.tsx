import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { ShellProvider } from './ShellContext';
import ShellLayout from './ShellLayout';
import ShellHome from './ShellHome';
import ShellBrowserWindow from './ShellBrowserWindow';
import ShellChatWindow from './ShellChatWindow';
import ShellBuilderWindow from './ShellBuilderWindow';
import ShellDiscoveryWindow from './ShellDiscoveryWindow';
import ShellConnectionsWindow from './ShellConnectionsWindow';
import ShellMCPWindow from './ShellMCPWindow';
import ShellPluginsWindow from './ShellPluginsWindow';
import ShellToolsWindow from './ShellToolsWindow';
import ShellSettingsWindow from './ShellSettingsWindow';
import ShellProfileWindow from './ShellProfileWindow';
import ShellMediaWindow from './ShellMediaWindow';
import ShellAcknowledgementsWindow from './ShellAcknowledgementsWindow';

export const DesktopShellRouter: React.FC = () => {
  return (
    <ShellProvider>
      <Routes>
        <Route element={<ShellLayout />}>
          <Route index element={<ShellHome />} />
          <Route path='chat'>
            <Route index element={<ShellChatWindow />} />
            <Route path=':agentId' element={<ShellChatWindow />} />
          </Route>
          <Route path='browser' element={<ShellBrowserWindow />} />
          <Route path='media' element={<ShellMediaWindow />} />
          <Route path='discover' element={<ShellDiscoveryWindow />} />
          <Route path='connections' element={<ShellConnectionsWindow />} />
          <Route path='mcp' element={<ShellMCPWindow />} />
          <Route path='plugins' element={<ShellPluginsWindow />} />
          <Route path='tools' element={<ShellToolsWindow />} />
          <Route path='settings' element={<ShellSettingsWindow />} />
          <Route path='hcs10-profile' element={<ShellProfileWindow />} />
          <Route path='acknowledgements' element={<ShellAcknowledgementsWindow />} />
          <Route path='builder/*' element={<ShellBuilderWindow />} />
        </Route>
      </Routes>
    </ShellProvider>
  );
};

export default DesktopShellRouter;
