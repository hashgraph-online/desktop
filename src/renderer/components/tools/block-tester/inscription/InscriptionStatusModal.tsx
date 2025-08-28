import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { Button } from '../../../ui/Button';
import Typography from '../../../ui/Typography';
import { CopyField } from '../../../ui/CopyField';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../ui/dialog';
import {
  useInscriptionState,
  useResetInscriptionState,
} from '../../../../stores/blockTesterStore';

interface LoadingStateProps {
  message: string;
}

/**
 * Loading state component for inscription process
 */
const LoadingState: React.FC<LoadingStateProps> = ({ message }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className='text-center space-y-4'
  >
    <div className='w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin' />
    <div>
      <Typography variant='h4' noMargin>
        {message}
      </Typography>
      <Typography variant='body2' className='text-muted-foreground mt-2'>
        This may take a few moments...
      </Typography>
    </div>
  </motion.div>
);

interface SuccessStateProps {
  inscriptionResult: {
    topicId: string;
    hashLink: string;
    transactionId?: string;
  } | null;
  onOpenExplorer: () => void;
}

/**
 * Success state component for successful inscription
 */
const SuccessState: React.FC<SuccessStateProps> = ({
  inscriptionResult,
  onOpenExplorer,
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className='space-y-4'
  >
    <div className='w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center'>
      <HiCheckCircle className='w-10 h-10 text-green-600 dark:text-green-400' />
    </div>

    {inscriptionResult && (
      <div className='space-y-4'>
        <CopyField
          label='Topic ID'
          value={inscriptionResult.topicId}
        />

        <CopyField
          label='HashLink'
          value={inscriptionResult.hashLink}
        />

        {inscriptionResult.transactionId && (
          <CopyField
            label='Transaction ID'
            value={inscriptionResult.transactionId}
          />
        )}

        <Button onClick={onOpenExplorer} variant='outline' className='w-full'>
          <HiArrowTopRightOnSquare className='w-4 h-4 mr-2' />
          View on HashScan
        </Button>
      </div>
    )}
  </motion.div>
);

interface ErrorStateProps {
  errorMessage: string;
}

/**
 * Error state component for inscription failures
 */
const ErrorState: React.FC<ErrorStateProps> = ({ errorMessage }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className='text-center space-y-4'
  >
    <div className='w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center'>
      <HiExclamationTriangle className='w-10 h-10 text-red-600 dark:text-red-400' />
    </div>

    <div>
      <Typography
        variant='h4'
        noMargin
        className='text-red-600 dark:text-red-400'
      >
        Inscription Failed
      </Typography>
      <div className='mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left'>
        <Typography variant='body2' className='text-red-800 dark:text-red-200'>
          {errorMessage}
        </Typography>
      </div>
    </div>
  </motion.div>
);

/**
 * Modal for displaying inscription status and results
 */
const InscriptionStatusModal: React.FC = () => {
  const { inscriptionStatus, inscriptionResult, inscriptionError } =
    useInscriptionState();
  const resetInscriptionState = useResetInscriptionState();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (
      inscriptionStatus === 'validating' ||
      inscriptionStatus === 'submitting'
    ) {
      setIsOpen(true);
    } else if (inscriptionStatus === 'success' && inscriptionResult) {
      setIsOpen(true);
    } else if (
      inscriptionStatus === 'error' &&
      inscriptionError &&
      inscriptionError.trim()
    ) {
      setIsOpen(true);
    }
  }, [inscriptionStatus, inscriptionError, inscriptionResult]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      resetInscriptionState();
    }, 150);
  }, [resetInscriptionState]);

  const handleOpenHashExplorer = useCallback(() => {
    if (inscriptionResult?.topicId) {
      const explorerUrl = `https://hashscan.io/testnet/topic/${inscriptionResult.topicId}`;
      window.open(explorerUrl, '_blank');
    }
  }, [inscriptionResult]);

  const isProcessing =
    inscriptionStatus === 'validating' || inscriptionStatus === 'submitting';
  const isSuccess = inscriptionStatus === 'success';

  return (
    <Dialog open={isOpen} onOpenChange={isProcessing ? undefined : handleClose}>
      <DialogContent className='sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'>
        <DialogHeader>
          <DialogTitle className='text-center'>
            {isSuccess
              ? 'Inscription Complete'
              : isProcessing
                ? 'Inscribing Block'
                : 'Inscription Failed'}
          </DialogTitle>
          {!isSuccess && (
            <DialogDescription className='text-center text-muted-foreground'>
              {isProcessing
                ? 'Please wait while your block is being inscribed'
                : 'An error occurred during inscription'}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className='py-6'>
          {inscriptionStatus === 'validating' && (
            <LoadingState message='Validating Block Data' />
          )}

          {inscriptionStatus === 'submitting' && (
            <LoadingState message='Inscribing to Hedera' />
          )}

          {inscriptionStatus === 'success' && (
            <SuccessState
              inscriptionResult={inscriptionResult}
              onOpenExplorer={handleOpenHashExplorer}
            />
          )}

          {inscriptionStatus === 'error' && (
            <ErrorState
              errorMessage={
                inscriptionError ||
                'An unknown error occurred during inscription.'
              }
            />
          )}
        </div>

        {!isProcessing && (
          <DialogFooter>
            <Button onClick={handleClose} className='w-full'>
              {isSuccess ? 'Done' : 'Close'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InscriptionStatusModal;
