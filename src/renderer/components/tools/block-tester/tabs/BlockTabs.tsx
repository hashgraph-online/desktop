import React, { useRef, useState, useEffect } from 'react';
import { HiPlus, HiChevronDown } from 'react-icons/hi2';
import { Button } from '../../../ui/Button';
import { ScrollArea } from '../../../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '../../../ui/dropdown-menu';
import { cn } from '../../../../lib/utils';
import { WorkingBlock } from '../../../../types/block-tester.types';
import BlockTab from './BlockTab';

/**
 * Props for the BlockTabs component
 */
export interface BlockTabsProps {
  blocks: WorkingBlock[];
  activeIndex: number;
  blockStates: Record<string, { isDirty: boolean }>;
  onTabSwitch: (index: number) => void;
  onTabClose: (index: number) => void;
  onTabCreate: () => void;
  onTabDuplicate: (index: number) => void;
  onTabReorder: (fromIndex: number, toIndex: number) => void;
  className?: string;
}

/**
 * Block tabs component with tab strip interface
 * Supports overflow handling and tab management
 */
const BlockTabs: React.FC<BlockTabsProps> = ({
  blocks,
  activeIndex,
  blockStates,
  onTabSwitch,
  onTabClose,
  onTabCreate,
  onTabDuplicate,
  onTabReorder,
  className
}) => {
  const [showOverflow, setShowOverflow] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (tabsRef.current) {
        const container = tabsRef.current;
        const isOverflowing = container.scrollWidth > container.clientWidth;
        setShowOverflow(isOverflowing);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    
    return () => {
      window.removeEventListener('resize', checkOverflow);
    };
  }, [blocks.length]);

  const getOverflowedTabs = () => {
    return blocks.map((block, index) => ({ block, index }));
  };

  return (
    <div className={cn("flex items-center border-b bg-background", className)}>
      {/* Scrollable tab container */}
      <ScrollArea className="flex-1">
        <div 
          ref={tabsRef} 
          className="flex items-center min-w-0"
          role="tablist"
          aria-label="Block tabs"
        >
          {blocks.map((block, index) => (
            <BlockTab
              key={block.id}
              block={block}
              index={index}
              isActive={index === activeIndex}
              isDirty={blockStates[block.id]?.isDirty || false}
              onClick={() => onTabSwitch(index)}
              onClose={blocks.length > 1 ? () => onTabClose(index) : undefined}
              onDuplicate={() => onTabDuplicate(index)}
            />
          ))}
        </div>
      </ScrollArea>
      
      {/* Overflow dropdown */}
      {showOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-shrink-0 px-2 border-r"
              aria-label="View overflowed tabs"
            >
              <HiChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-48 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md p-1"
            sideOffset={5}
          >
            {getOverflowedTabs().map(({ block, index }) => (
              <DropdownMenuItem
                key={block.id}
                onClick={() => onTabSwitch(index)}
                className={cn(
                  "flex items-center gap-2",
                  index === activeIndex && "bg-accent"
                )}
              >
                <span className="truncate">{block.name}</span>
                {blockStates[block.id]?.isDirty && (
                  <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      {/* New tab button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onTabCreate}
        className="flex-shrink-0 px-2"
        aria-label="Create new block"
      >
        <HiPlus className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default BlockTabs;