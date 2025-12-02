import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiServer,
  FiCpu,
  FiSettings,
  FiAlertCircle,
  FiX,
} from 'react-icons/fi';
import { HederaSettings } from './settings/HederaSettings';
import { LLMSettings } from './settings/LLMSettings';
import { AdvancedSettings } from './settings/AdvancedSettings';
import { WalletSettings } from './settings/WalletSettings';
import { useConfigStore } from '../stores/configStore';
import { useAgentStore } from '../stores/agentStore';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui/tabs';
import Typography from '../components/ui/Typography';
import { cn } from '../lib/utils';
import { SwarmSettings } from './settings/SwarmSettings';

interface SettingsPageProps { }

type TabKey = 'hedera' | 'wallet' | 'llm' | 'advanced';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType;
}

const tabs: Tab[] = [
  { key: 'hedera', label: 'Hedera', icon: FiServer, component: HederaSettings },
  { key: 'wallet', label: 'Wallet', icon: FiServer, component: WalletSettings },
  { key: 'llm', label: 'AI Models', icon: FiCpu, component: LLMSettings },
  {
    key: 'advanced',
    label: 'Advanced',
    icon: FiSettings,
    component: AdvancedSettings,
  },
];

const tabGradients = {
  hedera: 'from-hgo-purple to-hgo-blue',
  llm: 'from-hgo-blue to-hgo-green',
  advanced: 'from-hgo-green to-hgo-purple',
};

const SettingsPage: React.FC<SettingsPageProps> = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('hedera');
  const {
    isLoading,
    loadConfig,
    saveConfig,
    error,
    clearError,
    isHederaConfigValid,
    isLLMConfigValid,
  } = useConfigStore();
  const [hasChanges, setHasChanges] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [configNeverSaved, setConfigNeverSaved] = useState(false);

  useEffect(() => {
    loadConfig().then(() => {
      const checkConfigSaved = async () => {
        try {
          const result = await window?.desktop?.loadConfig();
          if (!result) {
            setConfigNeverSaved(true);
            setHasChanges(true);
          }
        } catch (error) {
          setConfigNeverSaved(true);
          setHasChanges(true);
        }
      };
      checkConfigSaved();
    });
  }, [loadConfig]);

  useEffect(() => {
    const unsubscribe = useConfigStore.subscribe((state, prevState) => {
      if (!state.hasLoadedInitialConfig || !prevState?.hasLoadedInitialConfig) {
        return;
      }

      const changed = JSON.stringify(state.config) !== JSON.stringify(prevState.config);
      if (changed) {
        try { console.debug('[SettingsPage] config changed; scheduling save debounce'); } catch { }
        setHasChanges(true);

        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        const hederaValid = isHederaConfigValid();
        const llmValid = isLLMConfigValid();

        const advancedChanged = Boolean(
          state.config?.advanced &&
          JSON.stringify(state.config.advanced) !== JSON.stringify(prevState.config?.advanced)
        );
        const shouldAutoSave = (hederaValid && llmValid) || advancedChanged;

        if (shouldAutoSave) {
          const timeout = setTimeout(async () => {
            try {
              try { console.debug('[SettingsPage] auto-saving config'); } catch { }
              await saveConfig();
              setHasChanges(false);
            } catch (error) { }
          }, 2000);
          setSaveTimeout(timeout);
        }
      }
    });

    return () => {
      unsubscribe();
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveConfig, isHederaConfigValid, isLLMConfigValid, saveTimeout]);

  const { isConnected, disconnect, connect } = useAgentStore();

  const handleSaveConfiguration = async () => {
    try {
      const oldConfig = localStorage.getItem('app-config');
      await saveConfig();
      setHasChanges(false);
      setConfigNeverSaved(false);

      const newConfig = localStorage.getItem('app-config');
      if (oldConfig && newConfig) {
        const oldParsed = JSON.parse(oldConfig);
        const newParsed = JSON.parse(newConfig);
        const modelOrProviderChanged =
          oldParsed.openai?.model !== newParsed.openai?.model ||
          oldParsed.anthropic?.model !== newParsed.anthropic?.model ||
          oldParsed.llmProvider !== newParsed.llmProvider;

        if (modelOrProviderChanged && isConnected) {
          await disconnect();
          setTimeout(async () => {
            await connect();
          }, 500);
        }
      }
    } catch (error) { }
  };

  const handleCancel = async () => {
    await loadConfig();
    setHasChanges(false);
  };

  const isConfigValid = isHederaConfigValid() && isLLMConfigValid();

  if (isLoading) {
    return (
      <div
        data-testid='settings-page-root'
        className='h-full min-h-full overflow-y-auto bg-background'
      >
        <div
          data-testid='settings-page-container'
          className='container mx-auto max-w-6xl px-6 pt-8 pb-16 sm:pb-20'
        >
          <div className='flex min-h-[400px] items-center justify-center'>
            <Typography variant='body1' color='muted'>
              Loading configuration...
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid='settings-page-root'
      className='h-full min-h-full overflow-y-auto bg-background'
    >
      <div
        data-testid='settings-page-container'
        className='container mx-auto max-w-3xl px-6 pt-8 pb-16 sm:pb-20'
      >
        <div className='mb-8'>
          <Typography variant='h1' className='text-3xl font-bold mb-2' noMargin>
            Settings
          </Typography>
          <Typography variant='body1' className='text-muted-foreground'>
            Configure your agent's connection to Hedera, AI models, and advanced
            options
          </Typography>
        </div>

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

        <Card className='shadow-lg'>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as TabKey)}
          >
            <div className='border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6'>
              <TabsList className='grid grid-cols-4 h-auto bg-transparent overflow-x-auto gap-2 sm:gap-3 no-scrollbar'>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      className={cn(
                        'py-3 sm:py-4 px-2 sm:px-3 font-medium text-sm flex items-center gap-2 shrink-0',
                        'transition-colors min-h-[44px] touch-manipulation relative',
                        'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                        'data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-brand-blue',
                        'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-colors duration-200'
                        )}
                        aria-hidden='true'
                      />
                      <span className='whitespace-nowrap transition-all duration-300'>
                        {tab.label}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <CardContent className='p-4 sm:p-6'>
              <TabsContent value='hedera' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <HederaSettings />
                </motion.div>
              </TabsContent>

              <TabsContent value='wallet' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <WalletSettings />
                </motion.div>
              </TabsContent>

              <TabsContent value='hedera' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <SwarmSettings />
                </motion.div>
              </TabsContent>

              <TabsContent value='llm' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <LLMSettings />
                </motion.div>
              </TabsContent>

              <TabsContent value='advanced' className='mt-0'>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <AdvancedSettings />
                </motion.div>
              </TabsContent>
            </CardContent>
          </Tabs>

          <div className='border-t border-gray-200 dark:border-gray-700 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
            <div className='w-full sm:w-auto'>
              {configNeverSaved && isConfigValid && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='flex items-center gap-2'
                >
                  <div className='w-2 h-2 rounded-full bg-yellow-500 animate-pulse' />
                  <Typography variant='caption' color='muted'>
                    <span role='status' aria-live='polite'>
                      Configuration has never been saved. Click Save to persist
                      your settings.
                    </span>
                  </Typography>
                </motion.div>
              )}
              {hasChanges && !configNeverSaved && isConfigValid && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='flex items-center gap-2'
                >
                  <div className='w-2 h-2 rounded-full bg-green-500 animate-pulse' />
                  <Typography variant='caption' color='muted'>
                    <span role='status' aria-live='polite'>
                      Configuration will auto-save in 2 seconds...
                    </span>
                  </Typography>
                </motion.div>
              )}
              {hasChanges && !isConfigValid && (
                <Typography
                  variant='caption'
                  className='text-red-600 dark:text-red-400'
                >
                  <span role='status' aria-live='polite'>
                    Please complete all required fields
                  </span>
                </Typography>
              )}
            </div>
            <div className='flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto'>
              <Button
                variant='outline'
                onClick={handleCancel}
                disabled={!hasChanges}
                className='w-full sm:w-auto'
                aria-label='Cancel changes'
              >
                Cancel
              </Button>
              <Button
                variant='default'
                onClick={handleSaveConfiguration}
                className='w-full sm:w-auto'
                aria-label='Save configuration'
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
