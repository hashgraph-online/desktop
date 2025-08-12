import React, { useState } from 'react';
import { FiInfo, FiBook, FiTool, FiZap, FiShield, FiDatabase, FiGlobe, FiChevronRight, FiExternalLink, FiHelpCircle } from 'react-icons/fi';
import Typography from '../ui/Typography';
import { Button } from '../ui/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface MCPInfoPanelProps {
  serverCount: number;
  activeCount: number;
  totalTools: number;
}

export const MCPInfoPanel: React.FC<MCPInfoPanelProps> = ({
  serverCount,
  activeCount,
  totalTools,
}) => {
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);

  return (
    <>
      <div className="space-y-4">

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="h-0.5 bg-[#5599fe]" />
          <div className="p-4">
            <Typography variant="h6" className="font-medium text-sm mb-3">
              Statistics
            </Typography>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Typography variant="body2" className="text-xs text-muted-foreground">
                  Total Servers
                </Typography>
                <Typography variant="body2" className="text-xs font-medium">
                  {serverCount}
                </Typography>
              </div>
              <div className="flex justify-between items-center">
                <Typography variant="body2" className="text-xs text-muted-foreground">
                  Active
                </Typography>
                <Typography variant="body2" className="text-xs font-medium text-[#5599fe]">
                  {activeCount}
                </Typography>
              </div>
              <div className="flex justify-between items-center">
                <Typography variant="body2" className="text-xs text-muted-foreground">
                  Total Tools
                </Typography>
                <Typography variant="body2" className="text-xs font-medium">
                  {totalTools}
                </Typography>
              </div>
            </div>
          </div>
        </div>



      </div>


      <Dialog open={showDetailedInfo} onOpenChange={setShowDetailedInfo}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Understanding MCP Servers</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            <section>
              <Typography variant="h6" className="font-semibold mb-2">
                What are MCP Servers?
              </Typography>
              <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                Model Context Protocol (MCP) servers are specialized programs that provide AI assistants with 
                structured access to external tools and data sources. They act as secure bridges between the AI 
                model and various systems, enabling capabilities like file manipulation, web browsing, database 
                queries, and API interactions.
              </Typography>
            </section>

            <section>
              <Typography variant="h6" className="font-semibold mb-2">
                How Do They Work?
              </Typography>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold">1</span>
                  </div>
                  <div>
                    <Typography variant="body2" className="font-medium">Connect</Typography>
                    <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                      Enable a server to establish a connection between your AI and the external system.
                    </Typography>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold">2</span>
                  </div>
                  <div>
                    <Typography variant="body2" className="font-medium">Discover Tools</Typography>
                    <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                      The server exposes specific tools (functions) that the AI can call to perform actions.
                    </Typography>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 h-8 w-8 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold">3</span>
                  </div>
                  <div>
                    <Typography variant="body2" className="font-medium">Execute</Typography>
                    <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                      When needed, the AI calls these tools to complete tasks, receiving structured responses.
                    </Typography>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <Typography variant="h6" className="font-semibold mb-2">
                Common Server Types
              </Typography>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FiDatabase className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <Typography variant="body2" className="font-medium">Filesystem</Typography>
                  </div>
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    Access local files and directories on your computer.
                  </Typography>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FiGlobe className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <Typography variant="body2" className="font-medium">Web Browser</Typography>
                  </div>
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    Navigate websites and extract information.
                  </Typography>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FiTool className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <Typography variant="body2" className="font-medium">Code Execution</Typography>
                  </div>
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    Run scripts, commands, and code snippets.
                  </Typography>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <FiShield className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <Typography variant="body2" className="font-medium">API Integration</Typography>
                  </div>
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    Connect to external services and APIs.
                  </Typography>
                </div>
              </div>
            </section>

            <section>
              <Typography variant="h6" className="font-semibold mb-2">
                Security & Privacy
              </Typography>
              <Typography variant="body2" className="text-gray-600 dark:text-gray-400 mb-2">
                MCP servers are designed with security in mind:
              </Typography>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <FiChevronRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    <strong>Sandboxed Execution:</strong> Servers run in isolated environments
                  </Typography>
                </li>
                <li className="flex items-start gap-2">
                  <FiChevronRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    <strong>Permission Control:</strong> You control which servers are enabled
                  </Typography>
                </li>
                <li className="flex items-start gap-2">
                  <FiChevronRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    <strong>Transparent Operations:</strong> All tool usage is logged and visible
                  </Typography>
                </li>
                <li className="flex items-start gap-2">
                  <FiChevronRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                    <strong>Local Processing:</strong> Data stays on your machine unless explicitly shared
                  </Typography>
                </li>
              </ul>
            </section>

            <section>
              <Typography variant="h6" className="font-semibold mb-2">
                Getting Started
              </Typography>
              <div className="space-y-2">
                <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                  1. <strong>Browse Available Servers:</strong> Click the "Browse" tab to see pre-configured servers
                </Typography>
                <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                  2. <strong>Add a Server:</strong> Install from the catalog or configure a custom server
                </Typography>
                <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                  3. <strong>Configure Settings:</strong> Some servers need API keys or paths configured
                </Typography>
                <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                  4. <strong>Enable & Test:</strong> Toggle the server on and test the connection
                </Typography>
                <Typography variant="body2" className="text-gray-600 dark:text-gray-400">
                  5. <strong>Start Using:</strong> The AI will automatically use available tools when needed
                </Typography>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};