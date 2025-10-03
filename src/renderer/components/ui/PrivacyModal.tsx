import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from './dialog';
import { Button } from './Button';
import { FiShield, FiCheck, FiX, FiLock, FiChevronDown } from 'react-icons/fi';
import Typography from './Typography';
import { useLegalStore } from '../../stores/legalStore';
import { processMarkdown } from '../../utils/markdownProcessor';
import { motion, AnimatePresence } from 'framer-motion';

interface PrivacyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Privacy Policy modal component for displaying and accepting privacy policy
 */
export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  open,
  onOpenChange,
  onAccept,
  onDecline,
}) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const legalAcceptance = useLegalStore((state) => state.legalAcceptance);
  const privacyContent = useLegalStore((state) => state.privacyContent);
  const isLoading = useLegalStore((state) => state.isLoadingContent);
  const loadLegalContent = useLegalStore((state) => state.loadContent);
  const hasLoadedContent = useLegalStore((state) => state.hasLoadedContent);

  useEffect(() => {
    if (!open || hasLoadedContent) {
      return;
    }
    void loadLegalContent();
  }, [open, hasLoadedContent, loadLegalContent]);

  useEffect(() => {
    if (open) {
      setHasScrolledToBottom(false);
    }
  }, [open]);


  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const hasScrolledToEnd =
      element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
    setHasScrolledToBottom(hasScrolledToEnd);
  };

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  const handleDecline = () => {
    onDecline();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='!max-w-none w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0' showCloseButton={false} transparentOverlay={true}>
        {/* Clean header */}
        <div className='bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center'>
              <FiLock className='w-6 h-6 text-gray-700 dark:text-gray-300' />
            </div>
            <div>
              <Typography
                variant='h3'
                className='font-bold text-gray-900 dark:text-white'
              >
                Privacy Policy
              </Typography>
              <Typography
                variant='body2'
                className='text-gray-600 dark:text-gray-400'
              >
                Learn how we protect and handle your personal information
              </Typography>
            </div>
          </div>
        </div>

        <div className='flex-1 overflow-hidden flex flex-col p-6'>
          {isLoading ? (
            <div className='flex-1 flex items-center justify-center'>
              <div className='text-center'>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  className='w-12 h-12 border-3 border-[#48df7b] border-t-transparent rounded-full mx-auto mb-3'
                />
                <Typography variant='body2' color='secondary'>
                  Loading Privacy Policy...
                </Typography>
              </div>
            </div>
          ) : (
            <>
              <div
                className='flex-1 overflow-y-auto px-6 py-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-inner'
                onScroll={handleScroll}
              >
                <div
                  className='prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-gray-900 dark:prose-headings:text-white
                    prose-p:text-gray-700 dark:prose-p:text-gray-300
                    prose-strong:text-gray-900 dark:prose-strong:text-white
                    prose-a:text-[#5599fe] prose-a:no-underline hover:prose-a:underline'
                  dangerouslySetInnerHTML={{
                    __html: processMarkdown(privacyContent),
                  }}
                />
              </div>

              <AnimatePresence>
                {!hasScrolledToBottom && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className='flex items-center justify-center gap-2 py-3'
                  >
                    <motion.div
                      animate={{ y: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <FiChevronDown className='w-5 h-5 text-gray-400' />
                    </motion.div>
                    <Typography
                      variant='caption'
                      className='text-gray-500 dark:text-gray-400'
                    >
                      Scroll to read the complete policy
                    </Typography>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <div className='p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800'>
          <div className='flex justify-between items-center gap-4'>
            <div className='flex items-center gap-2'>
              {legalAcceptance.privacyAccepted && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className='flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg'
                >
                  <FiCheck className='w-4 h-4 text-green-600 dark:text-green-400' />
                  <Typography
                    variant='caption'
                    className='text-green-700 dark:text-green-300 font-medium'
                  >
                    Previously accepted
                  </Typography>
                </motion.div>
              )}
            </div>

            <div className='flex gap-3'>
              <Button
                variant='secondary'
                onClick={handleDecline}
                className='flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20'
              >
                <FiX className='w-4 h-4' />
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                disabled={!hasScrolledToBottom && !isLoading}
                variant='default'
                className='flex items-center gap-2 min-w-[140px]'
              >
                <FiCheck className='w-4 h-4' />
                Accept Policy
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
