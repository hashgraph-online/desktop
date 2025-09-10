import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  HiExclamationTriangle,
  HiEye
} from 'react-icons/hi2';
import Typography from '../../../ui/Typography';
import { useBlockTesterStore } from '../../../../stores/blockTesterStore';
import { useConfigStore } from '../../../../stores/configStore';
import { cn } from '../../../../lib/utils';
import PreviewControls from './PreviewControls';
import * as Handlebars from 'handlebars';
import { Logger } from '@hashgraphonline/standards-sdk';

const logger = new Logger({ module: 'BlockPreview' });

interface BlockPreviewProps {
  className?: string;
}

/**
 * Secure block preview component with iframe sandboxing
 * Renders block templates with attribute substitution in a safe environment
 */
const BlockPreview: React.FC<BlockPreviewProps> = ({ className }) => {
  const {
    currentBlock,
    template,
    attributes,
    actions,
    previewMode,
    addError
  } = useBlockTesterStore();
  
  const { config } = useConfigStore();
  const isDarkMode = config?.advanced?.theme === 'dark';

  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [_lastRefresh, setLastRefresh] = useState(Date.now());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-log') {
        const { level, message, data } = event.data;
        switch (level) {
          case 'debug':
            logger.debug(`Preview: ${message}`, data);
            break;
          case 'info':
            logger.info(`Preview: ${message}`, data);
            break;
          case 'warn':
            logger.warn(`Preview: ${message}`, data);
            break;
          case 'error':
            logger.error(`Preview: ${message}`, data);
            break;
          default:
            logger.info(`Preview: ${message}`, data);
        }
      }
    };

    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, []);

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
    } catch (error) {
      logger.error('Handlebars template processing error', { error: error.message });
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }, []);

  const generatePreviewHTML = useCallback(async () => {
    if (!currentBlock || !template) {
      setPreviewContent('');
      return;
    }

    try {
      setIsLoading(true);

      const attributeValues: Record<string, unknown> = {};
      Object.entries(attributes).forEach(([key, data]) => {
        if (data && typeof data === 'object' && 'value' in data) {
          attributeValues[key] = data.value;
        } else {
          attributeValues[key] = data;
        }
      });

      const processedContent = processTemplate(template, attributeValues);

      const fullHTML = `
        <!DOCTYPE html>
        <html lang="en" class="${isDarkMode ? 'dark' : ''}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Block Preview - ${currentBlock.title || currentBlock.name}</title>
          <style>
            /* Reset and base styles */
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body { 
              margin: 0; 
              padding: 16px; 
              min-height: 100vh;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
              font-size: 14px;
              line-height: 1.5;
              ${isDarkMode ? 'background-color: #0a0a0a; color: #ffffff;' : 'background-color: #ffffff; color: #000000;'}
            }
            
            /* Custom viewport styles based on preview mode */
            .preview-container {
              max-width: 100%;
              margin: 0 auto;
            }
            
            /* Essential Tailwind-like utility classes */
            .p-4 { padding: 1rem; }
            .p-6 { padding: 1.5rem; }
            .m-4 { margin: 1rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mt-4 { margin-top: 1rem; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            
            .flex { display: flex; }
            .inline-flex { display: inline-flex; }
            .block { display: block; }
            .inline-block { display: inline-block; }
            .hidden { display: none; }
            
            .items-center { align-items: center; }
            .items-start { align-items: flex-start; }
            .items-end { align-items: flex-end; }
            .justify-center { justify-content: center; }
            .justify-between { justify-content: space-between; }
            .justify-start { justify-content: flex-start; }
            .justify-end { justify-content: flex-end; }
            
            .flex-col { flex-direction: column; }
            .flex-row { flex-direction: row; }
            .flex-wrap { flex-wrap: wrap; }
            .flex-1 { flex: 1 1 0%; }
            
            .w-full { width: 100%; }
            .h-full { height: 100%; }
            .max-w-full { max-width: 100%; }
            .min-h-screen { min-height: 100vh; }
            
            .bg-white { background-color: ${isDarkMode ? '#1f2937' : '#ffffff'}; }
            .bg-gray-50 { background-color: ${isDarkMode ? '#111827' : '#f9fafb'}; }
            .bg-gray-100 { background-color: ${isDarkMode ? '#1f2937' : '#f3f4f6'}; }
            .bg-gray-200 { background-color: ${isDarkMode ? '#374151' : '#e5e7eb'}; }
            .bg-gray-300 { background-color: ${isDarkMode ? '#4b5563' : '#d1d5db'}; }
            .bg-blue-500 { background-color: #3b82f6; }
            .bg-green-500 { background-color: #10b981; }
            .bg-red-500 { background-color: #ef4444; }
            .bg-yellow-500 { background-color: #f59e0b; }
            
            .text-black { color: ${isDarkMode ? '#ffffff' : '#000000'}; }
            .text-white { color: #ffffff; }
            .text-gray-600 { color: ${isDarkMode ? '#d1d5db' : '#4b5563'}; }
            .text-gray-700 { color: ${isDarkMode ? '#e5e7eb' : '#374151'}; }
            .text-gray-800 { color: ${isDarkMode ? '#f3f4f6' : '#1f2937'}; }
            .text-gray-900 { color: ${isDarkMode ? '#f9fafb' : '#111827'}; }
            .text-blue-600 { color: #2563eb; }
            .text-green-600 { color: #059669; }
            .text-red-600 { color: #dc2626; }
            
            .border { border: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}; }
            .border-gray-200 { border-color: ${isDarkMode ? '#374151' : '#e5e7eb'}; }
            .border-gray-300 { border-color: ${isDarkMode ? '#4b5563' : '#d1d5db'}; }
            .rounded { border-radius: 0.25rem; }
            .rounded-md { border-radius: 0.375rem; }
            .rounded-lg { border-radius: 0.5rem; }
            
            .shadow { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); }
            .shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
            
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            
            .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
            .text-base { font-size: 1rem; line-height: 1.5rem; }
            .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
            .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
            .text-2xl { font-size: 1.5rem; line-height: 2rem; }
            .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
            
            .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
            .gap-4 { gap: 1rem; }
            .gap-2 { gap: 0.5rem; }
            
            /* Button styles */
            .btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 0.375rem;
              font-weight: 500;
              transition: all 0.2s;
              cursor: pointer;
              border: none;
            }
            .btn-primary {
              background-color: #3b82f6;
              color: #ffffff;
              padding: 0.5rem 1rem;
            }
            .btn-primary:hover {
              background-color: #2563eb;
            }
            .btn-secondary {
              background-color: ${isDarkMode ? '#374151' : '#f3f4f6'};
              color: ${isDarkMode ? '#ffffff' : '#1f2937'};
              padding: 0.5rem 1rem;
            }
            .btn-secondary:hover {
              background-color: ${isDarkMode ? '#4b5563' : '#e5e7eb'};
            }
            
            /* Form elements */
            .input {
              width: 100%;
              padding: 0.5rem 0.75rem;
              border: 1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
              border-radius: 0.375rem;
              background-color: ${isDarkMode ? '#1f2937' : '#ffffff'};
              color: ${isDarkMode ? '#ffffff' : '#1f2937'};
            }
            .input:focus {
              outline: none;
              border-color: #3b82f6;
              box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
            }
            
            /* Custom HGO colors */
            .bg-hgo-purple { background-color: #a679f0; }
            .bg-hgo-blue { background-color: #5599fe; }
            .bg-hgo-green { background-color: #48df7b; }
            .text-hgo-purple { color: #a679f0; }
            .text-hgo-blue { color: #5599fe; }
            .text-hgo-green { color: #48df7b; }
            .border-hgo-purple { border-color: #a679f0; }
            .border-hgo-blue { border-color: #5599fe; }
            .border-hgo-green { border-color: #48df7b; }
            
            /* Responsive utilities */
            @media (min-width: 640px) {
              .sm\\:block { display: block; }
              .sm\\:hidden { display: none; }
              .sm\\:text-lg { font-size: 1.125rem; line-height: 1.75rem; }
            }
            
            @media (min-width: 768px) {
              .md\\:block { display: block; }
              .md\\:hidden { display: none; }
              .md\\:flex { display: flex; }
              .md\\:text-xl { font-size: 1.25rem; line-height: 1.75rem; }
            }
            
            @media (min-width: 1024px) {
              .lg\\:block { display: block; }
              .lg\\:hidden { display: none; }
              .lg\\:flex { display: flex; }
              .lg\\:text-2xl { font-size: 1.5rem; line-height: 2rem; }
            }
          </style>
        </head>
        <body>
          <div class="preview-container" id="block-content">
            ${processedContent}
          </div>
          
          <script>
            (function() {
              'use strict';
              
              function postLog(level, message, data) {
                try {
                  window.parent.postMessage({
                    type: 'preview-log',
                    level: level,
                    message: message,
                    data: data,
                    timestamp: Date.now()
                  }, '*');
                } catch (err) {
                  console[level](message, data);
                }
              }
              
              window.alert = function() { postLog('info', 'Alert blocked in preview'); };
              window.confirm = function() { postLog('info', 'Confirm blocked in preview'); return false; };
              window.prompt = function() { postLog('info', 'Prompt blocked in preview'); return null; };
              
              window.open = function() { postLog('info', 'Window.open blocked in preview'); };
              
              document.addEventListener('click', function(e) {
                postLog('debug', 'Preview interaction', { target: e.target.tagName, className: e.target.className });
                
                try {
                  window.parent.postMessage({
                    type: 'preview-interaction',
                    target: e.target.tagName,
                    className: e.target.className,
                    timestamp: Date.now()
                  }, '*');
                } catch (err) {
                }
              });
              
              document.addEventListener('click', function(e) {
                const actionElements = document.querySelectorAll('[data-action]');
                for (let element of actionElements) {
                  if (element.contains(e.target)) {
                    postLog('info', 'Action triggered', { action: element.dataset.action });
                    break;
                  }
                }
              });
              
              postLog('info', 'Block preview loaded successfully');
              postLog('debug', 'Preview context', { 
                attributes: ${JSON.stringify(attributeValues)}, 
                actions: ${JSON.stringify(Object.keys(actions))} 
              });
            })();
          </script>
        </body>
        </html>
      `;

      setPreviewContent(fullHTML);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Preview generation error', { error: errorMessage });
      addError({
        type: 'preview',
        source: 'preview',
        message: `Preview generation failed: ${errorMessage}`
      });

      setPreviewContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview Error</title>
          <style>
            body { 
              font-family: system-ui; 
              padding: 20px; 
              background: #fee; 
              color: #a00;
            }
          </style>
        </head>
        <body>
          <h2>Preview Error</h2>
          <p>${errorMessage}</p>
          <pre>${template || 'No template'}</pre>
        </body>
        </html>
      `);
    } finally {
      setIsLoading(false);
    }
  }, [currentBlock, template, attributes, actions, isDarkMode, processTemplate, addError]);

  const debouncedGenerate = useCallback(() => {
    const debounced = debounce(generatePreviewHTML, 300);
    debounced();
  }, [generatePreviewHTML]);

  useEffect(() => {
    debouncedGenerate();
  }, [template, attributes, currentBlock, previewMode, isDarkMode, debouncedGenerate]);

  const handleRefresh = () => {
    setLastRefresh(Date.now());
    generatePreviewHTML();
  };

  const handleOpenInNewWindow = () => {
    if (previewContent) {
      const newWindow = window.open('', '_blank', 'width=1200,height=800');
      if (newWindow) {
        newWindow.document.write(previewContent);
        newWindow.document.close();
      }
    }
  };

  const { width, height } = getViewportDimensions(previewMode);

  if (!currentBlock) {
    return (
      <div className={cn("h-full flex flex-col items-center justify-center text-center p-8", className)}>
        <div className="w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
          <HiEye className="w-8 h-8 text-white" />
        </div>
        <Typography variant="h3" className="text-xl font-bold mb-2" noMargin>
          No Block Preview
        </Typography>
        <Typography variant="body1" className="text-muted-foreground mb-4" noMargin>
          Select or create a block to see the live preview
        </Typography>
      </div>
    );
  }

  if (!template.trim()) {
    return (
      <div className={cn("h-full flex flex-col", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiEye className="w-5 h-5" />
            <Typography variant="h4" noMargin>Preview</Typography>
          </div>
          <PreviewControls onRefresh={handleRefresh} onOpenInNewWindow={handleOpenInNewWindow} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border rounded-lg">
          <HiExclamationTriangle className="w-12 h-12 text-yellow-500 mb-4" />
          <Typography variant="h4" className="font-bold mb-2" noMargin>
            Empty Template
          </Typography>
          <Typography variant="body1" className="text-muted-foreground" noMargin>
            Add content to your template to see the preview
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex items-center justify-between mb-4">
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

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 border rounded-lg">
        <div className="flex items-center justify-center min-h-full p-4">
          <div 
            className="bg-white shadow-lg transition-all duration-300 overflow-hidden"
            style={{ 
              width: Math.min(width, window.innerWidth - 100), 
              height: Math.min(height, window.innerHeight - 200),
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: '8px'
            }}
          >
            {isLoading && (
              <div className="absolute inset-0 bg-black/5 flex items-center justify-center z-10">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            <iframe
              ref={iframeRef}
              srcDoc={previewContent}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="Block Preview"
              loading="lazy"
              onLoad={() => setIsLoading(false)}
              onError={(e) => {
                logger.error('Preview iframe error', { event: e });
                addError({
                  type: 'preview',
                  source: 'iframe',
                  message: 'Preview failed to load'
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Utility debounce function for preview updates
 */
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export default BlockPreview;