import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  HiExclamationTriangle,
  HiEye
} from 'react-icons/hi2';
import Typography from '../../../ui/Typography';
import { useBlockTesterStore } from '../../../../stores/blockTesterStore';
import { useConfigStore } from '../../../../stores/configStore';
import { AttributeSchema } from '../../../../types/block-tester.types';
import { cn } from '../../../../lib/utils';
import PreviewControls from './PreviewControls';
import * as Handlebars from 'handlebars';
import { Logger } from '@hashgraphonline/standards-sdk';

interface BlockPreviewProps {
  className?: string;
}

const logger = new Logger({ module: 'BlockPreviewDirect' });

const BlockPreviewDirect: React.FC<BlockPreviewProps> = ({ className }) => {
  const {
    currentBlock,
    template,
    attributes,
    actions: _actions,
    previewMode,
    addError
  } = useBlockTesterStore();
  
  const { config } = useConfigStore();
  const isDarkMode = config?.advanced?.theme === 'dark';

  const [renderedContent, setRenderedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [_lastRefresh, __setLastRefresh] = useState(Date.now());
  const contentRef = useRef<HTMLDivElement>(null);
  const scriptsExecutedRef = useRef(false);

  const getViewportDimensions = (mode: string) => {
    switch (mode) {
      case 'mobile':
        return { width: 375, height: 667 };
      case 'tablet':
        return { width: 768, height: 1024 };
      case 'desktop':
      default:
        return { width: 1200, height: 800 };
    }
  };

  const processTemplate = useCallback((templateStr: string, attributeValues: Record<string, unknown>) => {
    try {
      const template = Handlebars.compile(templateStr);
      
      const context = {
        content: 'Sample content',
        ...attributeValues
      };
      
      const rendered = template(context);
      
      return rendered;
    } catch (error: unknown) {
      logger.error('Handlebars template processing error:', error);
      throw new Error(`Template processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  const generatePreviewContent = useCallback(async () => {
    if (!currentBlock || !template) {
      setRenderedContent('');
      return;
    }

    try {
      setIsLoading(true);

      const attributeValues = Object.entries(attributes).reduce((acc, [key, attr]) => {
        const attrData = attr as { schema?: AttributeSchema; value?: unknown; defaultValue?: unknown };
        acc[key] = attrData.value || attrData.defaultValue || '';
        return acc;
      }, {} as Record<string, unknown>);

      const processedContent = processTemplate(template, attributeValues);

      setRenderedContent(processedContent);
      scriptsExecutedRef.current = false;
    } catch (error: unknown) {
      logger.error('Preview generation error:', error);
      addError({
        type: 'preview',
        source: 'preview',
        message: `Preview generation failed: ${error instanceof Error ? error.message : String(error)}`
      });

      setRenderedContent(`
        <div class="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <h2 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Preview Error</h2>
          <p class="text-red-600 dark:text-red-400">${error instanceof Error ? error.message : String(error)}</p>
        </div>
      `);
    } finally {
      setIsLoading(false);
    }
  }, [currentBlock, template, attributes, isDarkMode, processTemplate, addError]);

  const debounce = (func: (...args: unknown[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: unknown[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const debouncedGenerate = useCallback(
    debounce(generatePreviewContent, 300),
    [generatePreviewContent]
  );

  useEffect(() => {
    debouncedGenerate();
  }, [template, attributes, currentBlock, previewMode, isDarkMode, debouncedGenerate]);

  useEffect(() => {
    if (renderedContent && contentRef.current && !scriptsExecutedRef.current) {
      logger.info('Executing scripts in block preview');
      
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
          const scriptContent = script.textContent || '';
          const wrappedScript = `
            (function() {
              'use strict';
              try {
                ${scriptContent}
              } catch (error) {
                logger.error('Script execution error in block preview:', error);
              }
            })();
          `;
          newScript.textContent = wrappedScript;
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

  const handleRefresh = () => {
    __setLastRefresh(Date.now());
    generatePreviewContent();
  };

  const handleOpenInNewWindow = () => {
    if (renderedContent) {
      const fullHTML = `
        <!DOCTYPE html>
        <html lang="en" class="${isDarkMode ? 'dark' : ''}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Block Preview - ${currentBlock?.name || 'Untitled'}</title>
          <script src="https:
        </head>
        <body class="${isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}">
          <div class="p-4">
            ${renderedContent}
          </div>
        </body>
        </html>
      `;
      
      const newWindow = window.open('', '_blank', 'width=1200,height=800');
      if (newWindow) {
        newWindow.document.write(fullHTML);
        newWindow.document.close();
      }
    }
  };

  const { width, height } = getViewportDimensions(previewMode);

  if (!currentBlock) {
    return (
      <div className={cn("h-full flex flex-col items-center justify-center text-center p-4", className)}>
        <div className="w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
          <HiEye className="w-8 h-8 text-white" />
        </div>
        <Typography variant="h3" noMargin>
          No Block Preview
        </Typography>
        <Typography variant="body2" className="text-muted-foreground mt-2" noMargin>
          Select or create a block to see the live preview
        </Typography>
      </div>
    );
  }

  if (!template.trim()) {
    return (
      <div className={cn("h-full flex flex-col items-center justify-center text-center p-4", className)}>
        <HiExclamationTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <Typography variant="h4" noMargin>
          Empty Template
        </Typography>
        <Typography variant="body2" className="text-muted-foreground mt-2" noMargin>
          Add content to your template to see the preview
        </Typography>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{previewMode}</span>
          <span>•</span>
          <span>{width} × {height}px</span>
          {isLoading && (
            <>
              <span>•</span>
              <span>Updating...</span>
            </>
          )}
        </div>
        <PreviewControls 
          onRefresh={handleRefresh} 
          onOpenInNewWindow={handleOpenInNewWindow}
          isLoading={isLoading}
        />
      </div>
      
      <div className="flex-1 overflow-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        <div className="flex items-start justify-center min-h-full p-6">
          <div 
            ref={contentRef}
            className={cn(
              "bg-white dark:bg-gray-900 shadow-lg rounded-lg overflow-auto",
              previewMode === 'mobile' && "max-w-sm",
              previewMode === 'tablet' && "max-w-3xl",
              previewMode === 'desktop' && "w-full max-w-none"
            )}
            style={{ 
              width: previewMode === 'desktop' ? '100%' : Math.min(width, window.innerWidth - 100),
              height: previewMode === 'desktop' ? 'auto' : Math.min(height, window.innerHeight - 200),
              minHeight: previewMode === 'desktop' ? '400px' : '400px'
            }}
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        </div>
      </div>
    </div>
  );
};

export default BlockPreviewDirect;