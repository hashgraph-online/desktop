import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertCircle,
  FiX,
  FiGrid,
  FiList,
  FiPlus,
  FiInfo,
  FiTool,
  FiZap,
  FiShield,
  FiDatabase,
  FiServer,
  FiPackage,
  FiGithub,
  FiHardDrive,
} from 'react-icons/fi';
import Typography from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { MCPServerList } from '../components/mcp/MCPServerList';
import { MCPSetupWizard } from '../components/mcp/MCPSetupWizard';
import { MCPConnectionTester } from '../components/mcp/MCPConnectionTester';
import { MCPServerCatalog } from '../components/mcp/MCPServerCatalog';
import { MCPRegistry } from '../components/mcp/MCPRegistry';
import { AddMCPServer } from '../components/mcp/AddMCPServer';
import { MCPInfoPanel } from '../components/mcp/MCPInfoPanel';
import { useMCPStore } from '../stores/mcpStore';
import { MCPServerConfig, MCPServerFormData } from '../types/mcp';
import { cn } from '../lib/utils';

interface MCPServerQuickInstall {
  name: string;
  template: {
    type: string;
    config: Record<string, unknown>;
  };
  requirements?: string[];
}

type ViewMode = 'servers' | 'browse';

interface Tab {
  key: ViewMode;
  label: string;
  icon: React.ElementType;
  description: string;
}

const tabs: Tab[] = [
  {
    key: 'servers',
    label: 'My Servers',
    icon: FiServer,
    description: 'Manage your installed MCP servers',
  },
  {
    key: 'browse',
    label: 'Browse Catalog',
    icon: FiPackage,
    description: 'Discover and install new servers',
  },
];

const tabGradients = {
  servers: 'from-hgo-blue to-hgo-green',
  browse: 'from-hgo-green to-hgo-purple',
};

/**
 * Main page for MCP server management
 * @returns Complete MCP management interface with server list and configuration
 */
const MCPPage: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLearnMCPModalOpen, setIsLearnMCPModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(
    null
  );
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('servers');
  const [serverTemplate, setServerTemplate] = useState<any>(null);

  const {
    servers,
    isLoading,
    error,
    connectionTests,
    addServer,
    updateServer,
    deleteServer,
    toggleServer,
    testConnection,
    loadServers,
    reloadServers,
    clearError,
  } = useMCPStore();

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    if (serverTemplate) {
      setIsAddModalOpen(true);
    }
  }, [serverTemplate]);

  useEffect(() => {
    const interval = setInterval(() => {
      reloadServers();
    }, 5000);

    return () => clearInterval(interval);
  }, [reloadServers]);

  const handleAddServer = async (data: MCPServerFormData) => {
    try {
      if (editingServer) {
        await updateServer(editingServer.id, {
          name: data.name,
          type: data.type,
          config: data.config,
        });
      } else {
        await addServer(data);
      }
      setIsAddModalOpen(false);
      setEditingServer(null);
      setServerTemplate(null);
    } catch (error) {}
  };

  const handleEditServer = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (server) {
      setEditingServer(server);
      setIsAddModalOpen(true);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this server? This action cannot be undone.'
      )
    ) {
      try {
        await deleteServer(serverId);
      } catch (error) {}
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    try {
      await toggleServer(serverId, enabled);
    } catch (error) {}
  };

  const handleTestConnection = async (serverId: string) => {
    setTestingServerId(serverId);
    try {
      await testConnection(serverId);
    } catch (error) {
    } finally {
      setTestingServerId(null);
    }
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingServer(null);
    setServerTemplate(null);
  };

  const handleQuickInstall = (server: MCPServerQuickInstall) => {
    setServerTemplate({
      name: server.name,
      type: server.template.type,
      config: server.template.config,
      requirements: server.requirements,
    });
    setViewMode('servers');
  };

  const handleRegistryInstall = async (server: { id: string; name: string; description: string; author?: string; version?: string }) => {
    await loadServers();
    setViewMode('servers');
  };

  if (isLoading && servers.length === 0) {
    return (
      <div className='min-h-screen bg-background'>
        <div className='container mx-auto px-6 py-8 max-w-6xl'>
          <div className='flex items-center justify-center min-h-[400px]'>
            <div className='text-center space-y-4'>
              <motion.div
                className='w-16 h-16 bg-gradient-to-br from-hgo-blue to-hgo-green rounded-2xl flex items-center justify-center mx-auto'
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              >
                <FiServer className='w-8 h-8 text-white' />
              </motion.div>
              <Typography variant='body1' color='muted'>
                Loading MCP servers...
              </Typography>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-6 py-8 max-w-6xl'>
        {/* Header */}
        <div className='mb-8'>
          <Typography
            variant='h1'
            className='text-3xl font-bold mb-4 bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green bg-clip-text text-transparent'
            noMargin
          >
            MCP Servers
          </Typography>
          <Typography variant='body1' className='text-muted-foreground'>
            Extend your agent's capabilities with Model Context Protocol servers
          </Typography>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className='mb-4 sm:mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3'
            role='alert'
            aria-live='polite'
          >
            <FiAlertCircle
              className='w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5'
              aria-hidden='true'
            />
            <div className='flex-1'>
              <Typography
                variant='caption'
                className='text-red-800 dark:text-red-300'
              >
                {error}
              </Typography>
            </div>
            <button
              onClick={clearError}
              className='text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 -m-1 rounded focus:outline-none focus:ring-2 focus:ring-red-500/50'
              aria-label='Dismiss error'
            >
              <FiX className='w-5 h-5' />
            </button>
          </div>
        )}

        {/* Info Banner for First Time Users */}
        {servers.length === 0 && !isLoading && viewMode === 'servers' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className='mb-6 p-4 bg-gradient-to-br from-hgo-blue/10 to-hgo-green/10 rounded-lg border border-hgo-blue/20'
          >
            <div className='flex items-start gap-3'>
              <div className='w-10 h-10 bg-gradient-to-br from-hgo-blue to-hgo-green rounded-lg flex items-center justify-center flex-shrink-0'>
                <FiInfo className='w-5 h-5 text-white' />
              </div>
              <div>
                <Typography variant='body1' className='font-medium mb-1'>
                  Get Started with MCP Servers
                </Typography>
                <Typography variant='body2' className='text-muted-foreground'>
                  MCP servers extend your agent with powerful capabilities like
                  file system access, web browsing, database connections, and
                  code execution. Browse the catalog to discover available
                  servers or add your own custom server.
                </Typography>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Content Card */}
        <Card className='shadow-lg'>
          {/* Tabs */}
          <div className='border-b border-gray-200 dark:border-gray-700 overflow-x-auto'>
            <nav
              className='flex space-x-4 sm:space-x-8 px-4 sm:px-6 min-w-max'
              role='tablist'
              aria-label='MCP server tabs'
            >
              {tabs.map((tab, index) => {
                const Icon = tab.icon;
                const isActive = viewMode === tab.key;
                const gradient = tabGradients[tab.key];

                return (
                  <motion.button
                    key={tab.key}
                    onClick={() => setViewMode(tab.key)}
                    className={cn(
                      'relative py-4 px-1 flex items-center gap-2 text-sm font-medium transition-colors focus:outline-none',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    role='tab'
                    aria-selected={isActive}
                    aria-controls={`${tab.key}-panel`}
                    whileHover={{ y: -1 }}
                    whileTap={{ y: 0 }}
                  >
                    <Icon className='w-4 h-4 flex-shrink-0' />
                    <span className='hidden sm:inline'>{tab.label}</span>
                    <span className='sm:hidden'>{tab.label.split(' ')[0]}</span>

                    {isActive && (
                      <motion.div
                        className={cn(
                          'absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r',
                          gradient
                        )}
                        layoutId='activeTab'
                        initial={false}
                        transition={{
                          type: 'spring',
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}

              {/* Action Buttons (aligned to the right) */}
              {viewMode === 'servers' && (
                <div className='ml-auto flex items-center gap-2 py-4'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setIsLearnMCPModalOpen(true)}
                    className='text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  >
                    <FiInfo className='w-4 h-4 mr-1.5' />
                    Learn about MCP
                  </Button>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={() => setIsAddModalOpen(true)}
                    className='bg-gradient-to-r from-hgo-blue to-hgo-green text-white hover:opacity-90 transition-opacity'
                  >
                    <FiPlus className='w-4 h-4 mr-1.5' />
                    Add Server
                  </Button>
                </div>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <CardContent className='p-6'>
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, x: viewMode === 'servers' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: viewMode === 'servers' ? 20 : -20 }}
              transition={{ duration: 0.2 }}
              role='tabpanel'
              id={`${viewMode}-panel`}
              aria-labelledby={`${viewMode}-tab`}
            >
              {viewMode === 'servers' ? (
                <div className='grid gap-6 lg:grid-cols-3'>
                  <div className='lg:col-span-2'>
                    <MCPServerList
                      servers={servers}
                      loading={isLoading}
                      onToggle={handleToggleServer}
                      onEdit={handleEditServer}
                      onDelete={handleDeleteServer}
                      onTest={handleTestConnection}
                      onAdd={() => setIsAddModalOpen(true)}
                    />
                  </div>

                  <div className='space-y-4'>
                    {testingServerId && (
                      <MCPConnectionTester
                        serverId={testingServerId}
                        serverName={
                          servers.find((s) => s.id === testingServerId)?.name ||
                          'Server'
                        }
                        onTest={() => handleTestConnection(testingServerId)}
                        result={connectionTests[testingServerId]?.result}
                        loading={false}
                      />
                    )}

                    <MCPInfoPanel
                      serverCount={servers.length}
                      activeCount={
                        servers.filter(
                          (s) =>
                            s.status === 'connected' || s.status === 'ready'
                        ).length
                      }
                      totalTools={servers.reduce(
                        (acc, s) => acc + (s.tools?.length || 0),
                        0
                      )}
                    />
                  </div>
                </div>
              ) : (
                <MCPRegistry onInstall={handleRegistryInstall} />
              )}
            </motion.div>
          </CardContent>
        </Card>
      </div>

      <AddMCPServer
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleAddServer}
        editingServer={editingServer}
        template={serverTemplate}
      />

      {/* Learn about MCP Modal */}
      {isLearnMCPModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className='relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col'
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className='flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-hgo-blue to-hgo-green rounded-lg flex items-center justify-center'>
                  <FiInfo className='w-5 h-5 text-white' />
                </div>
                <div>
                  <Typography variant='h2' className='text-xl font-semibold'>
                    What is MCP?
                  </Typography>
                </div>
              </div>
              <button
                onClick={() => setIsLearnMCPModalOpen(false)}
                className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300'
                aria-label='Close modal'
              >
                <FiX className='w-5 h-5' />
              </button>
            </div>

            {/* Modal Content */}
            <div className='flex-1 overflow-y-auto p-6 space-y-4'>
              <div className='space-y-4'>
                <div>
                  <Typography
                    variant='h3'
                    className='text-lg font-semibold mb-2 text-hgo-blue'
                  >
                    Model Context Protocol
                  </Typography>
                  <Typography
                    variant='body1'
                    className='text-gray-600 dark:text-gray-400'
                  >
                    The Model Context Protocol (MCP) is an open standard that
                    enables seamless integration between AI assistants and
                    external data sources and tools. It provides a universal way
                    for AI models to access and interact with various services.
                  </Typography>
                </div>

                <div>
                  <Typography
                    variant='h3'
                    className='text-lg font-semibold mb-2 text-hgo-green'
                  >
                    Key Benefits
                  </Typography>
                  <ul className='space-y-2 text-gray-600 dark:text-gray-400'>
                    <li className='flex items-start gap-2'>
                      <FiZap className='w-4 h-4 text-hgo-green mt-0.5 flex-shrink-0' />
                      <Typography variant='body2'>
                        <strong>Enhanced Capabilities:</strong> Connect your
                        agent to databases, APIs, file systems, and more
                      </Typography>
                    </li>
                    <li className='flex items-start gap-2'>
                      <FiShield className='w-4 h-4 text-hgo-green mt-0.5 flex-shrink-0' />
                      <Typography variant='body2'>
                        <strong>Secure Integration:</strong> Maintain control
                        over what data and tools your agent can access
                      </Typography>
                    </li>
                    <li className='flex items-start gap-2'>
                      <FiPackage className='w-4 h-4 text-hgo-green mt-0.5 flex-shrink-0' />
                      <Typography variant='body2'>
                        <strong>Modular Design:</strong> Add or remove
                        capabilities without modifying core agent logic
                      </Typography>
                    </li>
                  </ul>
                </div>

                <div>
                  <Typography
                    variant='h3'
                    className='text-lg font-semibold mb-2 text-hgo-purple'
                  >
                    Popular MCP Servers
                  </Typography>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                      <div className='flex items-center gap-2 mb-1'>
                        <FiHardDrive className='w-4 h-4 text-hgo-blue' />
                        <Typography variant='body2' className='font-medium'>
                          Filesystem
                        </Typography>
                      </div>
                      <Typography
                        variant='caption'
                        className='text-gray-500 dark:text-gray-400'
                      >
                        Read, write, and manage local files
                      </Typography>
                    </div>
                    <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                      <div className='flex items-center gap-2 mb-1'>
                        <FiGithub className='w-4 h-4 text-hgo-blue' />
                        <Typography variant='body2' className='font-medium'>
                          GitHub
                        </Typography>
                      </div>
                      <Typography
                        variant='caption'
                        className='text-gray-500 dark:text-gray-400'
                      >
                        Access repositories and code
                      </Typography>
                    </div>
                    <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                      <div className='flex items-center gap-2 mb-1'>
                        <FiDatabase className='w-4 h-4 text-hgo-blue' />
                        <Typography variant='body2' className='font-medium'>
                          PostgreSQL
                        </Typography>
                      </div>
                      <Typography
                        variant='caption'
                        className='text-gray-500 dark:text-gray-400'
                      >
                        Query and manage databases
                      </Typography>
                    </div>
                    <div className='p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                      <div className='flex items-center gap-2 mb-1'>
                        <FiServer className='w-4 h-4 text-hgo-blue' />
                        <Typography variant='body2' className='font-medium'>
                          Custom
                        </Typography>
                      </div>
                      <Typography
                        variant='caption'
                        className='text-gray-500 dark:text-gray-400'
                      >
                        Build your own integrations
                      </Typography>
                    </div>
                  </div>
                </div>

                <div className='p-4 bg-gradient-to-br from-hgo-blue/10 to-hgo-green/10 rounded-lg border border-hgo-blue/20'>
                  <Typography
                    variant='body2'
                    className='text-gray-700 dark:text-gray-300'
                  >
                    <strong>Getting Started:</strong> Click the "Add Server"
                    button to configure your first MCP server. Each server
                    extends your agent with new capabilities that can be used
                    during conversations.
                  </Typography>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className='flex justify-between items-center p-6 border-t border-gray-200 dark:border-gray-800'>
              <a
                href='https://modelcontextprotocol.io'
                target='_blank'
                rel='noopener noreferrer'
                className='text-sm text-hgo-blue hover:text-hgo-blue-dark transition-colors'
              >
                Learn more at modelcontextprotocol.io →
              </a>
              <Button
                variant='default'
                size='sm'
                onClick={() => setIsLearnMCPModalOpen(false)}
                className='bg-gradient-to-r from-hgo-blue to-hgo-green text-white hover:opacity-90'
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default MCPPage;
