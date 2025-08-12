import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { HCS10ProfileResponse } from '../../../shared/schemas/hcs10';
import { cn } from '../../lib/utils';

interface RegistrationStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isRegistering: boolean;
  result: HCS10ProfileResponse | null;
  error: string | null;
  progress?: {
    message: string;
    percent: number;
    stage?: string;
  };
}

/**
 * Dialog showing registration progress and results
 */
export function RegistrationStatusDialog({
  isOpen,
  onClose,
  isRegistering,
  result,
  error,
  progress,
}: RegistrationStatusDialogProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleCopyAccountId = () => {
    if (result?.accountId) {
      navigator.clipboard.writeText(result.accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewOnExplorer = () => {
    if (result?.transactionId) {
      const network = 'mainnet';
      const explorerUrl = `https://hashscan.io/${network}/transaction/${result.transactionId}`;
      window.electron.openExternal(explorerUrl);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className='sm:max-w-lg' showCloseButton={true}>
        <DialogHeader className='pb-4'>
          <DialogTitle className='text-xl text-center'>
            {isRegistering && 'Registering Agent Profile'}
            {result && 'Registration Successful'}
            {error && 'Registration Failed'}
          </DialogTitle>
        </DialogHeader>

        <div className='py-4'>
          {isRegistering && (
            <div className='flex flex-col items-center space-y-6 py-6'>
              <Loader2 className='h-12 w-12 animate-spin text-primary' />
              <div className='text-center space-y-3'>
                <p className='font-medium text-base text-foreground'>
                  {progress?.message ||
                    'Creating your agent profile on the Hedera Hashgraph...'}
                </p>
                {progress?.stage && (
                  <p className='text-xs text-muted-foreground uppercase tracking-wider'>
                    Stage: {progress.stage}
                  </p>
                )}
                {progress?.percent !== undefined && progress.percent > 0 && (
                  <div className='w-full max-w-sm mx-auto'>
                    <div className='flex justify-between text-sm mb-1'>
                      <span className='text-muted-foreground'>Progress</span>
                      <span className='text-foreground'>
                        {progress.percent}%
                      </span>
                    </div>
                    <div className='w-full bg-muted rounded-full h-2'>
                      <div
                        className='bg-primary h-2 rounded-full transition-all duration-300 ease-out'
                        style={{ width: `${Math.min(progress.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                <p className='text-sm text-muted-foreground'>
                  This may take a few moments
                </p>
              </div>
            </div>
          )}

          {result && !isRegistering && (
            <div className='space-y-4'>
              <div className='flex justify-center mb-4'>
                <div className='p-3 bg-green-500/10 rounded-full'>
                  <CheckCircle2 className='h-12 w-12 text-green-500' />
                </div>
              </div>

              <div className='text-center space-y-3 mb-6'>
                <h3 className='font-medium text-lg text-foreground'>
                  Your agent has been successfully registered!
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Your agent is now discoverable on the Hedera Hashgraph
                </p>
              </div>

              <div className='space-y-3'>
                <div className='p-3 bg-muted/50 rounded-lg'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex-1 min-w-0 space-y-1'>
                      <p className='text-sm text-muted-foreground'>
                        Agent Account ID
                      </p>
                      <p className='font-mono font-medium break-all text-foreground'>
                        {result.accountId}
                      </p>
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={handleCopyAccountId}
                      className='shrink-0'
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className='h-4 w-4 mr-1' />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className='h-4 w-4 mr-1' />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {result.transactionId && (
                  <Button
                    variant='outline'
                    className='w-full'
                    onClick={handleViewOnExplorer}
                  >
                    <ExternalLink className='h-4 w-4 mr-2' />
                    View on HashScan
                  </Button>
                )}
              </div>
            </div>
          )}

          {error && !isRegistering && (
            <div className='space-y-4'>
              <div className='flex justify-center mb-4'>
                <div className='p-3 bg-destructive/10 rounded-full'>
                  <XCircle className='h-12 w-12 text-destructive' />
                </div>
              </div>

              <div className='text-center space-y-3'>
                <h3 className='font-medium text-lg text-foreground'>
                  Registration Failed
                </h3>
                <div className='max-w-full overflow-hidden'>
                  <p className='text-sm text-muted-foreground break-words'>
                    {error}
                  </p>
                  {error?.includes('does not have a valid HCS-11 memo') && (
                    <p className='text-sm text-muted-foreground mt-2'>
                      This account already has an HCS-10 agent registered. Try
                      closing this dialog and using the Reset button to clear
                      the registration state and try again.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {isRegistering ? (
            <Button
              variant='outline'
              onClick={() => {
                onClose();
              }}
              className='w-full'
              type='button'
            >
              Cancel
            </Button>
          ) : (
            <Button
              onClick={() => {
                onClose();
              }}
              className={cn(result && 'w-full')}
              type='button'
            >
              {result ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
