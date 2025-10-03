import React from 'react';
import { Button } from '../ui/Button';
import { FiDollarSign } from 'react-icons/fi';

interface AgentProfile {
  accountId: string;
  profile?: {
    display_name?: string;
    alias?: string;
  };
  metadata?: {
    display_name?: string;
    alias?: string;
  };
}

interface ConnectionConfirmDialogProps {
  isOpen: boolean;
  agent: AgentProfile | null;
  isConnecting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared confirmation dialog for HCS-10 agent connection requests
 * Displays transaction costs and agent information with proper accessibility
 */
export const ConnectionConfirmDialog: React.FC<ConnectionConfirmDialogProps> = ({
  isOpen,
  agent,
  isConnecting,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !agent) return null;

  const displayName = agent.profile?.display_name || 
                      agent.profile?.alias || 
                      agent.metadata?.display_name || 
                      agent.metadata?.alias || 
                      'Unknown Agent';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/70"
        onClick={onCancel}
        aria-label="Close dialog"
      />
      
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6" role="dialog" aria-labelledby="modal-title">
        <div className="mb-6">
          <h2 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            Connection Request
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Confirm transaction to connect with this agent
          </p>
        </div>
        
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Connecting to</div>
          <div className="font-medium text-gray-900 dark:text-white">
            {displayName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
            {agent.accountId}
          </div>
        </div>

        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <FiDollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white mb-2">
                Transaction Fee
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                ~$0.01 USD
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Hedera network fee for topic creation and messages
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isConnecting}
          >
            {isConnecting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Connecting...</span>
              </div>
            ) : (
              'Connect'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionConfirmDialog;