import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HiCube, 
  HiCodeBracket, 
  HiEye,
  HiSparkles,
  HiCog,
  HiBeaker,
  HiDocumentText,
  HiPlus
} from 'react-icons/hi2';
import Typography from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { 
  useBlockTesterStore,
  useBlocks,
  useActiveBlockIndex,
  useCurrentBlock,
  useBlockStates
} from '../stores/blockTesterStore';
import { cn } from '../lib/utils';
import BlockEditor from '../components/tools/block-tester/editors/BlockEditor';
import BlockPreview from '../components/tools/block-tester/preview/BlockPreviewDirect';
import DevTools from '../components/tools/block-tester/panels/DevTools';
import { ScrollArea } from '../components/ui/scroll-area';
import BlockTabs from '../components/tools/block-tester/tabs/BlockTabs';
import { useBlockTesterKeyboard } from '../hooks/useBlockTesterKeyboard';

const BlockTesterPage: React.FC = () => {
  const { 
    createBlock,
    duplicateBlock,
    closeBlock,
    switchToBlock,
    reorderBlocks,
    validateActiveBlock,
    errors,
    previewMode,
    isLoading 
  } = useBlockTesterStore();
  
  const blocks = useBlocks();
  const activeBlockIndex = useActiveBlockIndex();
  const currentBlock = useCurrentBlock();
  const blockStates = useBlockStates();

  const [showDevTools, setShowDevTools] = useState(false);
  const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor');

  useEffect(() => {
    if (blocks.length === 0) {
      createBlock();
    }
  }, []);
  
  const validation = validateActiveBlock();
  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  useBlockTesterKeyboard({
    onNextTab: () => {
      if (blocks.length > 1) {
        const nextIndex = (activeBlockIndex + 1) % blocks.length;
        switchToBlock(nextIndex);
      }
    },
    onPrevTab: () => {
      if (blocks.length > 1) {
        const prevIndex = activeBlockIndex === 0 ? blocks.length - 1 : activeBlockIndex - 1;
        switchToBlock(prevIndex);
      }
    },
    onCloseTab: () => {
      if (blocks.length > 1 && activeBlockIndex >= 0) {
        closeBlock(activeBlockIndex);
      }
    },
    onNewTab: () => {
      createBlock();
    },
    onDuplicateTab: () => {
      if (activeBlockIndex >= 0) {
        duplicateBlock(activeBlockIndex);
      }
    },
    onSwitchToTab: (index: number) => {
      switchToBlock(index);
    },
    totalTabs: blocks.length,
    isEnabled: true
  });

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-hgo-blue to-hgo-green rounded-lg flex items-center justify-center flex-shrink-0">
              <HiCube className="w-4 h-4 text-white" />
            </div>
            <Typography variant="h1" className="text-xl font-bold" noMargin>
              Block Tester
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => createBlock()}
              className="gap-2"
            >
              <HiPlus className="w-4 h-4" />
              New Block
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDevTools(!showDevTools)}
              className={cn("gap-2", showDevTools && "bg-accent")}
            >
              <HiCog className="w-4 h-4" />
              DevTools
            </Button>
          </div>
        </div>
      </div>

      {/* Block tabs - show only when blocks exist */}
      {blocks.length > 0 && (
        <BlockTabs
          blocks={blocks}
          activeIndex={activeBlockIndex}
          blockStates={blockStates}
          onTabSwitch={switchToBlock}
          onTabClose={closeBlock}
          onTabCreate={createBlock}
          onTabDuplicate={duplicateBlock}
          onTabReorder={reorderBlocks}
        />
      )}

      <div className="flex-1 flex gap-4 p-6 min-h-0">
        <div className="flex-[2] min-w-0">
          {currentBlock ? (
            <BlockEditor className="h-full" />
          ) : (
            <div className="h-full flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg">
              <div className="text-center">
                <HiDocumentText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                <Typography variant="h3" className="text-muted-foreground" noMargin>
                  Create your first block
                </Typography>
                <Typography variant="body2" className="text-muted-foreground/70 mt-2" noMargin>
                  Click "New Block" to start building
                </Typography>
                <Button
                  onClick={() => createBlock()}
                  className="mt-4 gap-2"
                  variant="default"
                >
                  <HiPlus className="w-4 h-4" />
                  Create Block
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-[3] min-w-0">
          <div className="h-full bg-background border rounded-lg overflow-hidden">
            {currentBlock ? (
              <BlockPreview />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <HiEye className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <Typography variant="body2" className="text-muted-foreground" noMargin>
                    No preview available
                  </Typography>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDevTools && (
          <motion.div
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 200 }}
            exit={{ opacity: 0, y: 20, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t"
          >
            <div className="p-4 h-full overflow-auto">
              <DevTools />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BlockTesterPage;