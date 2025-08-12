import React, { useState } from 'react';
import { FiX, FiTool, FiInfo, FiCheck, FiCircle, FiChevronRight, FiChevronDown, FiSearch } from 'react-icons/fi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { Card } from '../ui/Card';
import { MCPServerTool } from '../../types/mcp';

interface MCPToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  tools: MCPServerTool[];
}

interface ParameterInfo {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  default?: any;
  enum?: string[];
}

const parseJsonSchema = (schema: any): ParameterInfo[] => {
  if (!schema || !schema.properties) return [];
  
  const required = schema.required || [];
  const parameters: ParameterInfo[] = [];
  
  Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
    parameters.push({
      name,
      type: prop.type || 'unknown',
      description: prop.description,
      required: required.includes(name),
      default: prop.default,
      enum: prop.enum
    });
  });
  
  return parameters;
};

const getTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'string': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
    case 'number': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
    case 'boolean': return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20';
    case 'array': return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20';
    case 'object': return 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20';
    default: return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20';
  }
};

export const MCPToolsModal: React.FC<MCPToolsModalProps> = ({
  isOpen,
  onClose,
  serverName,
  tools
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const filteredTools = tools.filter(tool => 
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleToolExpansion = (index: number) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTools(newExpanded);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" showCloseButton={false}>

        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <FiTool className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {serverName} Tools
                </DialogTitle>
                <Typography variant="body2" color="muted">
                  {filteredTools.length} of {tools.length} tools
                </Typography>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX className="w-5 h-5" />
            </Button>
          </div>


          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </DialogHeader>


        <div className="flex-1 overflow-y-auto space-y-3">
          {filteredTools.map((tool, index) => {
            const parameters = parseJsonSchema(tool.inputSchema);
            const requiredParams = parameters.filter(p => p.required);
            const optionalParams = parameters.filter(p => !p.required);
            const isExpanded = expandedTools.has(index);

            return (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">

                <div 
                  className="p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                  onClick={() => toggleToolExpansion(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <FiChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <FiChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <Typography variant="h6" className="font-mono text-primary-600 dark:text-primary-400 truncate">
                            {tool.name}
                          </Typography>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded-full text-gray-600 dark:text-gray-400">
                            {parameters.length} param{parameters.length !== 1 ? 's' : ''}
                          </span>
                          {requiredParams.length > 0 && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-xs rounded-full text-red-700 dark:text-red-400">
                              {requiredParams.length} required
                            </span>
                          )}
                        </div>
                      </div>
                      <Typography variant="body2" className="text-gray-600 dark:text-gray-400 line-clamp-2">
                        {tool.description}
                      </Typography>
                    </div>
                  </div>
                </div>


                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    {parameters.length > 0 ? (
                      <div className="p-4 space-y-4">

                        {requiredParams.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <FiCheck className="w-4 h-4 text-red-500" />
                              <Typography variant="body2" className="font-semibold text-red-700 dark:text-red-400">
                                Required Parameters
                              </Typography>
                            </div>
                            <div className="space-y-2">
                              {requiredParams.map((param, paramIndex) => (
                                <div key={paramIndex} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-red-200 dark:border-red-800/30">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Typography variant="body2" className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                                          {param.name}
                                        </Typography>
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(param.type)}`}>
                                          {param.type}
                                        </span>
                                      </div>
                                      {param.description && (
                                        <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-1">
                                          {param.description}
                                        </Typography>
                                      )}
                                      {param.enum && (
                                        <Typography variant="caption" className="text-gray-500 dark:text-gray-500">
                                          Options: <span className="font-mono">{param.enum.join(', ')}</span>
                                        </Typography>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}


                        {optionalParams.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <FiCircle className="w-4 h-4 text-gray-500" />
                              <Typography variant="body2" className="font-semibold text-gray-700 dark:text-gray-300">
                                Optional Parameters
                              </Typography>
                            </div>
                            <div className="space-y-2">
                              {optionalParams.map((param, paramIndex) => (
                                <div key={paramIndex} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <Typography variant="body2" className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                                          {param.name}
                                        </Typography>
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(param.type)}`}>
                                          {param.type}
                                        </span>
                                        {param.default !== undefined && (
                                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
                                            default: <span className="font-mono">{String(param.default)}</span>
                                          </span>
                                        )}
                                      </div>
                                      {param.description && (
                                        <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-1">
                                          {param.description}
                                        </Typography>
                                      )}
                                      {param.enum && (
                                        <Typography variant="caption" className="text-gray-500 dark:text-gray-500">
                                          Options: <span className="font-mono">{param.enum.join(', ')}</span>
                                        </Typography>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <FiInfo className="w-4 h-4" />
                        <Typography variant="body2">
                          No parameters required for this tool
                        </Typography>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredTools.length === 0 && (
            <div className="text-center py-8">
              <FiSearch className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <Typography variant="body1" color="muted">
                No tools found matching "{searchTerm}"
              </Typography>
            </div>
          )}
        </div>


        <div className="flex-shrink-0 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <Typography variant="caption" color="muted">
              Click on any tool to expand and view its parameters
            </Typography>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};