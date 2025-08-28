import React, { useEffect, useState, useRef, useMemo } from 'react';
import { BlockLoader, Logger } from '@hashgraphonline/standards-sdk';
import { cn } from '../../lib/utils';
import { FiX, FiLink } from 'react-icons/fi';
import Typography from '../ui/Typography';
import { motion } from 'framer-motion';
import { useConfigStore } from '../../stores/configStore';

const logger = new Logger({ module: 'HashLinkBlockRenderer' });

const FALLBACK_TEMPLATE = `<div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm w-full">
  <div class="flex items-center gap-3 mb-4">
    <div class="w-6 h-6 bg-blue-500 rounded flex-shrink-0"></div>
    <div class="min-w-0 flex-1">
      <h3 class="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">{{name}}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-400">by {{creator}}</p>
    </div>
  </div>
  <div class="pt-2 border-t border-slate-200 dark:border-slate-700">
    <p class="text-xs text-slate-600 dark:text-slate-400">Topic: {{topicId}} | Network: {{network}}</p>
  </div>
</div>`;

interface HashLinkBlock {
  blockId: string;
  hashLink: string;
  template: string;
  attributes: Record<string, any>;
}

interface HashLinkBlockRendererProps {
  hashLinkBlock: HashLinkBlock;
  className?: string;
}

/**
 * Generic renderer for HCS-12 HashLink blocks
 * Fetches templates from the blockchain and renders them with simple variable substitution
 * Templates are expected to be self-contained with their own JavaScript and CSS
 */
const HashLinkBlockRenderer: React.FC<HashLinkBlockRendererProps> = ({
  hashLinkBlock,
  className,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedContent, setRenderedContent] = useState<string | null>(null);
  const { config } = useConfigStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const hasRenderedRef = useRef(false);

  const blockId = hashLinkBlock.blockId;
  const template = hashLinkBlock.template;
  const network = config?.hedera?.network === 'mainnet' ? 'mainnet' : 'testnet';
  
  const attributesKey = useMemo(() => {
    return JSON.stringify(hashLinkBlock.attributes);
  }, [hashLinkBlock.attributes]);

  useEffect(() => {
    if (hasRenderedRef.current && renderedContent) {
      logger.info('Skipping re-render, content already loaded');
      return;
    }

    const renderHashLinkBlock = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        const logger = new Logger({
          module: 'HashLinkRenderer',
          level: 'info',
        });

        const blockLoader = new BlockLoader(network, logger);

        let templateContent = template;

        const isBlockIdTemplate = templateContent?.match(/^0\.0\.\d+$/);

        if (isBlockIdTemplate) {
          try {
            logger.info(
              `Fetching template from blockchain: ${templateContent}`
            );
            const blockData = await blockLoader.loadBlock(templateContent);
            if (blockData.template) {
              templateContent = blockData.template;
              logger.info('Template fetched successfully from blockchain');
            } else {
              throw new Error('No template found in block data');
            }
          } catch (loadError) {
            logger.error('Failed to load template from blockchain:', loadError);
            setRenderError(
              `Failed to load template: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`
            );
            return;
          }
        } else if (!templateContent || templateContent.trim() === '') {
          templateContent = FALLBACK_TEMPLATE;
          logger.info('Using fallback template');
        }

        let finalHtml = templateContent;
        if (finalHtml && finalHtml.includes('{{')) {
          Object.entries(hashLinkBlock.attributes).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            finalHtml = finalHtml?.replace(regex, String(value || ''));
          });
        }

        logger.info('Template rendered successfully', {
          templateLength: finalHtml?.length,
          attributeCount: Object.keys(hashLinkBlock.attributes).length,
        });

        setRenderedContent(finalHtml);
        hasRenderedRef.current = true;
      } catch (error) {
        logger.error('Template rendering failed:', error);
        setRenderError(
          error instanceof Error ? error.message : 'Unknown rendering error'
        );
      } finally {
        setIsLoading(false);
      }
    };

    renderHashLinkBlock();
  }, [blockId, template, network, attributesKey]);

  const scriptsExecutedRef = useRef(false);

  useEffect(() => {
    if (renderedContent && contentRef.current && !scriptsExecutedRef.current) {
      logger.info('Executing scripts in HashLink block');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderedContent;
      const scripts = tempDiv.querySelectorAll('script');

      logger.info(`Found ${scripts.length} script tags in template`);

      scripts.forEach((script, index) => {
        const newScript = document.createElement('script');

        Array.from(script.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });

        try {
          newScript.textContent = script.textContent || '';
          contentRef.current?.appendChild(newScript);
          logger.info(`Script ${index + 1} executed successfully`);

          setTimeout(() => {
            newScript.remove();
          }, 0);
        } catch (error) {
          logger.error(`Failed to execute script ${index + 1}:`, error);
        }
      });
      
      scriptsExecutedRef.current = true;
    }
  }, [renderedContent]);

  if (isLoading) {
    return (
      <div
        className={cn(
          'mt-3 border rounded-lg overflow-hidden bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200/30 dark:border-purple-700/30 p-6',
          className
        )}
      >
        <div className='flex items-center justify-center'>
          <div className='flex items-center gap-3'>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className='w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full'
            />
            <Typography
              variant='caption'
              className='text-purple-700 dark:text-purple-300'
            >
              Loading HashLink block...
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  if (renderError) {
    return (
      <div
        className={cn(
          'mt-3 border rounded-lg overflow-hidden bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-950/30 dark:to-orange-950/30 border-red-200/30 dark:border-red-700/30 p-4',
          className
        )}
      >
        <div className='flex items-center gap-3'>
          <div className='w-6 h-6 rounded-full bg-red-500 flex items-center justify-center'>
            <FiX className='w-3 h-3 text-white' />
          </div>
          <div>
            <Typography
              variant='caption'
              className='font-semibold text-red-700 dark:text-red-300'
            >
              HashLink Block Error
            </Typography>
            <Typography
              variant='caption'
              className='text-red-600 dark:text-red-400 block text-xs'
            >
              {renderError}
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  if (!renderedContent) {
    return (
      <div
        className={cn(
          'mt-3 border rounded-lg overflow-hidden bg-gradient-to-br from-gray-50/50 to-gray-100/50 dark:from-gray-950/30 dark:to-gray-900/30 border-gray-200/30 dark:border-gray-700/30 p-4',
          className
        )}
      >
        <Typography
          variant='caption'
          className='text-gray-600 dark:text-gray-400'
        >
          No content available for HashLink block
        </Typography>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mt-3 border rounded-lg overflow-hidden bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200/30 dark:border-purple-700/30',
        className
      )}
    >
      <div className='flex items-center justify-between p-3 bg-white/50 dark:bg-gray-800/50 border-b border-purple-200/20 dark:border-purple-700/20'>
        <div className='flex items-center gap-2'>
          <div className='w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center'>
            <FiLink className='w-3 h-3 text-white' />
          </div>
          <Typography
            variant='caption'
            className='font-semibold text-purple-700 dark:text-purple-300'
          >
            HCS-12 HashLink Block
          </Typography>
          <div className='px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 rounded-full'>
            <Typography
              variant='caption'
              className='text-xs font-mono text-purple-700 dark:text-purple-300'
            >
              {hashLinkBlock.blockId}
            </Typography>
          </div>
        </div>
      </div>

      <div
        ref={contentRef}
        className='hashlink-content'
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </div>
  );
};

export default React.memo(HashLinkBlockRenderer, (prevProps, nextProps) => {
  return (
    prevProps.hashLinkBlock.blockId === nextProps.hashLinkBlock.blockId &&
    prevProps.hashLinkBlock.template === nextProps.hashLinkBlock.template &&
    JSON.stringify(prevProps.hashLinkBlock.attributes) === JSON.stringify(nextProps.hashLinkBlock.attributes) &&
    prevProps.className === nextProps.className
  );
});
