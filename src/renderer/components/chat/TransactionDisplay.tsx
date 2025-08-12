import React, { useState } from 'react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { FiCheck, FiX, FiCopy, FiExternalLink } from 'react-icons/fi';
import { cn } from '../../lib/utils';

interface TransactionDisplayProps {
  transactionBytes?: string;
  transactionId?: string;
  scheduleId?: string;
  onApprove?: () => void;
  onReject?: () => void;
  className?: string;
}

/**
 * Component to display transaction bytes and approval buttons
 */
export const TransactionDisplay: React.FC<TransactionDisplayProps> = ({
  transactionBytes,
  transactionId,
  scheduleId,
  onApprove,
  onReject,
  className
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (transactionBytes) {
      await navigator.clipboard.writeText(transactionBytes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!transactionBytes && !transactionId && !scheduleId) return null;

  return (
    <div className={cn(
      "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-2",
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <Typography variant="body2" className="font-semibold">
          Transaction Details
        </Typography>
        {transactionBytes && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2"
          >
            {copied ? (
              <FiCheck className="w-4 h-4 text-green-500" />
            ) : (
              <FiCopy className="w-4 h-4" />
            )}
            <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        )}
      </div>

      {transactionBytes && (
        <div className="mb-4">
          <div className="mb-1">
            <Typography variant="caption" color="secondary" className="block">
              Transaction Bytes:
            </Typography>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 font-mono text-xs break-all">
            {transactionBytes.substring(0, 100)}...
          </div>
        </div>
      )}

      {transactionId && (
        <div className="mb-4">
          <div className="mb-1">
            <Typography variant="caption" color="secondary" className="block">
              Transaction ID:
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono">{transactionId}</code>
            <a
              href={`https://hashscan.io/testnet/transaction/${transactionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-blue hover:text-brand-purple"
            >
              <FiExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {scheduleId && (
        <div className="mb-4">
          <div className="mb-1">
            <Typography variant="caption" color="secondary" className="block">
              Schedule ID:
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono">{scheduleId}</code>
            <a
              href={`https://hashscan.io/testnet/schedule/${scheduleId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-blue hover:text-brand-purple"
            >
              <FiExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {onApprove && onReject && (
        <div className="flex gap-2 mt-4">
          <Button
            onClick={onApprove}
            size="sm"
            className="flex-1"
            variant="default"
          >
            <FiCheck className="w-4 h-4 mr-1" />
            Sign & Execute
          </Button>
          <Button
            onClick={onReject}
            size="sm"
            className="flex-1"
            variant="outline"
          >
            <FiX className="w-4 h-4 mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
};

export default TransactionDisplay;