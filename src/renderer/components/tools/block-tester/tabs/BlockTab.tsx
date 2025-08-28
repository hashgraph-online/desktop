import React, { useState } from 'react';
import { HiCube, HiXMark, HiDocumentDuplicate, HiPencil, HiTrash, HiEllipsisVertical } from 'react-icons/hi2';
import { Button } from '../../../ui/Button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../../../ui/dropdown-menu';
import { cn } from '../../../../lib/utils';
import { WorkingBlock } from '../../../../types/block-tester.types';
import { Logger } from '@hashgraphonline/standards-sdk';

const logger = new Logger({ module: 'BlockTab' });

/**
 * Props for the BlockTab component
 */
export interface BlockTabProps {
  block: WorkingBlock;
  index: number;
  isActive: boolean;
  isDirty: boolean;
  onClick: () => void;
  onClose?: () => void;
  onDuplicate: () => void;
}

/**
 * Individual block tab component with context menu and dirty state
 */
const BlockTab: React.FC<BlockTabProps> = ({
  block,
  index,
  isActive,
  isDirty,
  onClick,
  onClose,
  onDuplicate
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div className="flex items-center">
      {/* Main tab */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 cursor-pointer select-none",
          "hover:bg-accent/50 transition-colors min-w-0 max-w-[180px]",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isActive && "bg-background border-b-2 border-b-primary",
          !isActive && "text-muted-foreground"
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role="tab"
        aria-selected={isActive}
        aria-controls={`block-panel-${block.id}`}
        tabIndex={isActive ? 0 : -1}
      >
        {/* Block icon */}
        <HiCube className="w-4 h-4 flex-shrink-0" />
        
        {/* Block name with dirty indicator */}
        <span className="text-sm font-medium truncate">
          {block.name}
          {isDirty && "*"}
        </span>
        
        {/* Dirty state dot indicator */}
        {isDirty && (
          <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
        )}
      </div>

      {/* Tab actions */}
      <div className="flex items-center border-r">
        {/* Context menu dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 p-0 hover:bg-accent flex-shrink-0"
              aria-label={`${block.name} options`}
            >
              <HiEllipsisVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent 
            align="end" 
            className="z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md p-1 min-w-[180px]"
            sideOffset={5}
          >
            <DropdownMenuItem onClick={onDuplicate}>
              <HiDocumentDuplicate className="w-4 h-4 mr-2" />
              Duplicate Block
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={() => {
                // TODO: Implement rename functionality
                logger.info('Rename block', { blockId: block.id });
              }}
            >
              <HiPencil className="w-4 h-4 mr-2" />
              Rename Block
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {onClose && (
              <DropdownMenuItem 
                onClick={onClose}
                className="text-destructive focus:text-destructive"
              >
                <HiTrash className="w-4 h-4 mr-2" />
                Close Block
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Close button */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label={`Close ${block.name}`}
          >
            <HiXMark className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default BlockTab;