import React from 'react';
import { motion } from 'framer-motion';
import Typography from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { FiAlertCircle } from 'react-icons/fi';

export type ClearChatDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ClearChatDialog(props: ClearChatDialogProps) {
  const { isOpen, onCancel, onConfirm } = props;
  if (!isOpen) {
    return null;
  }
  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className='bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800'>
        <div className='flex items-start gap-4'>
          <div className='w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0'>
            <FiAlertCircle className='w-5 h-5 text-red-600 dark:text-red-400' />
          </div>
          <div className='flex-1'>
            <Typography variant='h6' className='font-semibold text-gray-900 dark:text-white mb-2'>
              Clear Chat History?
            </Typography>
            <Typography variant='body2' color='muted' className='mb-6'>
              Are you sure you want to clear the chat? This action cannot be reversed and all messages will be permanently deleted.
            </Typography>
            <div className='flex gap-3 justify-end'>
              <Button variant='ghost' onClick={onCancel} className='px-4 py-2'>
                Cancel
              </Button>
              <Button variant='destructive' onClick={onConfirm} className='px-4 py-2 bg-red-600 hover:bg-red-700 text-white'>
                Clear Chat
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


