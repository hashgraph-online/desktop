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
import { useWalletStore } from '../../stores/walletStore';
import { Progress } from '../ui/Progress';

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
  const walletNetwork = useWalletStore((s) => s.network) as 'mainnet' | 'testnet' | null;
  const stageKey = (progress?.stage || '').toLowerCase();
  const stageText =
    stageKey === 'preparing'
      ? 'Preparing'
      : stageKey === 'submitting'
      ? 'Submitting'
      : stageKey === 'confirming'
      ? 'Confirming'
      : stageKey === 'verifying'
      ? 'Verifying'
      : stageKey === 'completed'
      ? 'Completed'
      : undefined;

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
      const selectedNetwork = walletNetwork || 'testnet';
      const explorerUrl = `https://hashscan.io/${selectedNetwork === 'testnet' ? 'testnet/' : ''}transaction/${result.transactionId}`;
      window?.desktop?.openExternal(explorerUrl);
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
            <div className='flex flex-col items-center gap-4 py-6'>
              <Loader2 className='h-6 w-6 animate-spin text-primary' />
              <div className='text-center space-y-1 px-4'>
                <Typography variant='body1' className='font-medium text-foreground'>
                  {progress?.message || 'Creating your agent profile on Hedera'}
                </Typography>
                {stageText && (
                  <Typography variant='caption' className='text-muted-foreground'>
                    {stageText}
                  </Typography>
                )}
              </div>
              <div className='w-full max-w-sm px-4'>
                <div className='flex justify-between mb-1'>
                  <Typography variant='caption' className='text-muted-foreground'>Progress</Typography>
                  <Typography variant='caption' className='text-foreground'>
                    {Math.max(0, Math.min(progress?.percent ?? 0, 100))}%
                  </Typography>
                </div>
                <Progress
                  value={Math.max(1, Math.min(progress?.percent ?? 1, 100))}
                  variant='hgo'
                  size='md'
                  animated
                />
              </div>
              <Typography variant='caption' className='text-muted-foreground px-4'>
                This may take a few moments
              </Typography>
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
                <Typography variant='h4' className='font-medium text-foreground'>
                  Your agent has been successfully registered!
                </Typography>
                <Typography variant='body2' className='text-muted-foreground'>
                  Your agent is now discoverable on the Hedera Hashgraph
                </Typography>
              </div>

              <div className='space-y-3'>
                <div className='p-3 bg-muted/50 rounded-lg'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex-1 min-w-0 space-y-1'>
                      <Typography variant='body2' className='text-muted-foreground'>
                        Agent Account ID
                      </Typography>
                      <Typography variant='body2' className='font-mono font-medium break-all text-foreground'>
                        {result.accountId}
                      </Typography>
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
                <Typography variant='h4' className='font-medium text-foreground'>
                  Registration Failed
                </Typography>
                <div className='max-w-full overflow-hidden'>
                  <Typography variant='body2' className='text-muted-foreground break-words'>
                    {error}
                  </Typography>
                  {error?.includes('does not have a valid HCS-11 memo') && (
                    <Typography variant='body2' className='text-muted-foreground mt-2'>
                      This account already has an HCS-10 agent registered. Try
                      closing this dialog and using the Reset button to clear
                      the registration state and try again.
                    </Typography>
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
