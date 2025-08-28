import React, { useState } from 'react';
import { 
  HiDocumentArrowDown,
  HiDocumentArrowUp,
  HiGlobeAlt,
  HiCodeBracket,
  HiCheckCircle,
  HiExclamationTriangle,
  HiInformationCircle,
  HiBookOpen,
  HiFolder
} from 'react-icons/hi2';
import { Button } from '../../../ui/Button';
import Typography from '../../../ui/Typography';
import { useBlockTesterStore } from '../../../../stores/blockTesterStore';
import { cn } from '../../../../lib/utils';
import { Logger } from '@hashgraphonline/standards-sdk';

const logger = new Logger({ module: 'DevTools' });

interface DevToolsProps {
  className?: string;
}

/**
 * Development tools component for block testing, validation, export, and import
 * Integrates with desktop file operations and provides template library access
 */
const DevTools: React.FC<DevToolsProps> = ({ className }) => {
  const {
    currentBlock,
    exportBlock,
    importBlock,
    validateBlock,
    errors,
    addError
  } = useBlockTesterStore();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  const templateExamples = [
    {
      id: 'card-basic',
      name: 'Basic Card',
      description: 'Simple card layout with title and content',
      category: 'layout',
      template: `<div class="max-w-sm mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
  <div class="px-6 py-4">
    <div class="font-bold text-xl mb-2">{{title}}</div>
    <p class="text-gray-700 text-base">{{description}}</p>
  </div>
</div>`,
      attributes: {
        title: { schema: { type: 'string', label: 'Card Title' }, value: 'Card Title' },
        description: { schema: { type: 'textarea', label: 'Description' }, value: 'Card description goes here.' }
      }
    },
    {
      id: 'button-cta',
      name: 'Call to Action Button',
      description: 'Styled button with hover effects',
      category: 'interactive',
      template: `<button class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl">
  {{buttonText}}
</button>`,
      attributes: {
        buttonText: { schema: { type: 'string', label: 'Button Text' }, value: 'Click Me' }
      }
    },
    {
      id: 'alert-info',
      name: 'Information Alert',
      description: 'Informational alert with icon',
      category: 'ui',
      template: `<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <div class="flex">
    <div class="flex-shrink-0">
      <svg class="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
      </svg>
    </div>
    <div class="ml-3">
      <h3 class="text-sm font-medium text-blue-800">{{title}}</h3>
      <div class="mt-2 text-sm text-blue-700">
        <p>{{message}}</p>
      </div>
    </div>
  </div>
</div>`,
      attributes: {
        title: { schema: { type: 'string', label: 'Alert Title' }, value: 'Information' },
        message: { schema: { type: 'textarea', label: 'Alert Message' }, value: 'This is an informational alert message.' }
      }
    }
  ];

  const handleExport = async (format: 'json' | 'html' | 'hcs-1') => {
    if (!currentBlock) {
      addError({
        type: 'export',
        source: 'export',
        message: 'No block to export'
      });
      return;
    }

    try {
      setIsExporting(true);
      
      if (typeof window !== 'undefined' && (window as any).electronAPI?.showSaveDialog) {
        const filters = {
          json: [{ name: 'JSON Files', extensions: ['json'] }],
          html: [{ name: 'HTML Files', extensions: ['html'] }],
          'hcs-1': [{ name: 'HCS-1 Files', extensions: ['json'] }]
        };

        const result = await (window as any).electronAPI.showSaveDialog({
          filters: filters[format],
          defaultPath: `${currentBlock.name || 'block'}.${format === 'hcs-1' ? 'hcs1.json' : format}`
        });

        if (!result.canceled && result.filePath) {
          const exportedContent = exportBlock(format);
          await (window as any).electronAPI.writeFile(result.filePath, exportedContent);
          
          if ((window as any).electronAPI?.showNotification) {
            (window as any).electronAPI.showNotification({
              type: 'success',
              title: 'Export Successful',
              message: `Block exported to ${result.filePath}`
            });
          }
        }
      } else {
        const exportedContent = exportBlock(format);
        const blob = new Blob([exportedContent], { 
          type: format === 'html' ? 'text/html' : 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentBlock.name || 'block'}.${format === 'hcs-1' ? 'hcs1.json' : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      logger.error('Export failed', { error: error.message });
      addError({
        type: 'export',
        source: 'export',
        message: `Export failed: ${error.message}`
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      
      if (typeof window !== 'undefined' && (window as any).electronAPI?.showOpenDialog) {
        const result = await (window as any).electronAPI.showOpenDialog({
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          const fileContent = await (window as any).electronAPI.readFile(result.filePaths[0]);
          importBlock(fileContent);
          
          if ((window as any).electronAPI?.showNotification) {
            (window as any).electronAPI.showNotification({
              type: 'success',
              title: 'Import Successful',
              message: 'Block imported successfully'
            });
          }
        }
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const content = e.target?.result as string;
                importBlock(content);
              } catch (error) {
                logger.error('Import failed', { error: error.message });
                addError({
                  type: 'import',
                  source: 'import',
                  message: `Import failed: ${error.message}`
                });
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      }
    } catch (error) {
      logger.error('Import failed', { error: error.message });
      addError({
        type: 'import',
        source: 'import',
        message: `Import failed: ${error.message}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  const loadTemplateExample = (template: typeof templateExamples[0]) => {
    const blockAttributes: Record<string, any> = {};
    Object.entries(template.attributes).forEach(([key, attr]) => {
      blockAttributes[key] = attr.schema;
    });

    const newBlock = {
      id: `example-${template.id}-${Date.now()}`,
      name: template.name,
      title: template.name,
      description: template.description,
      category: template.category as any,
      template: template.template,
      templateSource: {
        type: 'inline' as const,
        value: template.template,
      },
      attributes: blockAttributes,
      actions: {},
      keywords: [] as string[],
      created: new Date(),
      modified: new Date(),
    };

    useBlockTesterStore.getState().setBlock(newBlock);
    useBlockTesterStore.getState().updateTemplate(template.template);
    useBlockTesterStore.getState().updateAttributes(template.attributes);
  };

  const validation = validateBlock();
  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Export/Import Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HiFolder className="w-4 h-4 text-muted-foreground" />
          <Typography variant="h4" className="text-sm font-semibold" noMargin>
            File Operations
          </Typography>
        </div>
        
        <div className="space-y-4 pl-6">
          {/* Export Options */}
          <div>
            <Typography variant="body2" className="font-medium mb-2 text-muted-foreground" noMargin>
              Export Block
            </Typography>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => handleExport('json')} 
                variant="outline" 
                size="sm"
                disabled={!currentBlock || isExporting}
                className="gap-2"
              >
                <HiDocumentArrowDown className="w-3.5 h-3.5" />
                JSON
              </Button>
              
              <Button 
                onClick={() => handleExport('html')} 
                variant="outline" 
                size="sm"
                disabled={!currentBlock || isExporting}
                className="gap-2"
              >
                <HiCodeBracket className="w-3.5 h-3.5" />
                HTML
              </Button>
              
              <Button 
                onClick={() => handleExport('hcs-1')} 
                variant="outline" 
                size="sm"
                disabled={!currentBlock || isExporting}
                className="gap-2"
              >
                <HiGlobeAlt className="w-3.5 h-3.5" />
                HCS-1
              </Button>
            </div>
          </div>

          {/* Import Button */}
          <div>
            <Typography variant="body2" className="font-medium mb-2 text-muted-foreground" noMargin>
              Import Block
            </Typography>
            <Button 
              onClick={handleImport} 
              variant="outline" 
              size="sm"
              disabled={isImporting}
              className="gap-2"
            >
              <HiDocumentArrowUp className="w-3.5 h-3.5" />
              {isImporting ? 'Importing...' : 'Import JSON'}
            </Button>
          </div>
        </div>
      </div>

      {/* Validation Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HiCheckCircle className="w-4 h-4 text-muted-foreground" />
          <Typography variant="h4" className="text-sm font-semibold" noMargin>
            Block Validation
          </Typography>
        </div>
        
        <div className="pl-6">
          {!hasErrors && !hasWarnings ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <HiCheckCircle className="w-4 h-4" />
              <Typography variant="body2" className="font-medium" noMargin>
                Block is valid
              </Typography>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Errors */}
              {hasErrors && (
                <div>
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                    <HiExclamationTriangle className="w-4 h-4" />
                    <Typography variant="body2" className="font-medium" noMargin>
                      {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
                    </Typography>
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {validation.errors.slice(0, 3).map((error, index) => (
                      <div key={index} className="text-xs text-red-600 dark:text-red-400">
                        <span className="font-medium">{error.field}:</span> {error.message}
                      </div>
                    ))}
                    {validation.errors.length > 3 && (
                      <Typography variant="caption" className="text-muted-foreground" noMargin>
                        +{validation.errors.length - 3} more
                      </Typography>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {hasWarnings && (
                <div>
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-2">
                    <HiInformationCircle className="w-4 h-4" />
                    <Typography variant="body2" className="font-medium" noMargin>
                      {validation.warnings.length} Warning{validation.warnings.length !== 1 ? 's' : ''}
                    </Typography>
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {validation.warnings.slice(0, 3).map((warning, index) => (
                      <div key={index} className="text-xs text-yellow-600 dark:text-yellow-400">
                        <span className="font-medium">{warning.field}:</span> {warning.message}
                        {warning.suggestion && (
                          <div className="text-xs opacity-75 ml-2">
                            → {warning.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                    {validation.warnings.length > 3 && (
                      <Typography variant="caption" className="text-muted-foreground" noMargin>
                        +{validation.warnings.length - 3} more
                      </Typography>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Template Library */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiBookOpen className="w-4 h-4 text-muted-foreground" />
            <Typography variant="h4" className="text-sm font-semibold" noMargin>
              Template Library
            </Typography>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplateLibrary(!showTemplateLibrary)}
            className="text-xs"
          >
            {showTemplateLibrary ? 'Hide' : 'Show'}
          </Button>
        </div>
        
        {showTemplateLibrary && (
          <div className="space-y-2 pl-6">
            {templateExamples.map((template) => (
              <button
                key={template.id}
                className="w-full p-3 text-left rounded-lg hover:bg-accent/50 transition-colors group"
                onClick={() => loadTemplateExample(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Typography variant="body2" className="font-medium group-hover:text-primary transition-colors" noMargin>
                      {template.name}
                    </Typography>
                    <Typography variant="caption" className="text-muted-foreground" noMargin>
                      {template.description}
                    </Typography>
                    <div className="mt-1">
                      <span className="inline-block px-1.5 py-0.5 bg-muted rounded text-xs">
                        {template.category}
                      </span>
                    </div>
                  </div>
                  <Typography variant="caption" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" noMargin>
                    Load →
                  </Typography>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DevTools;