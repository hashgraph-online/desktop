import React from 'react';
import { motion } from 'framer-motion';
import Typography from '../../ui/Typography';

/**
 * Centered loader shown while HCS-10 conversation is loading.
 */
export function LoadingConversation() {
  return (
    <div className='h-full flex items-center justify-center p-12 lg:p-16'>
      <div className='text-center space-y-6 max-w-lg animate-fade-in'>
        <div className='w-20 h-20 bg-gradient-to-br from-hgo-purple to-hgo-blue rounded-2xl flex items-center justify-center mx-auto'>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <div className='w-10 h-10 rounded-full border-2 border-white border-t-transparent' />
          </motion.div>
        </div>
        <div className='space-y-3'>
          <Typography variant='h3' gradient className='font-bold'>
            Loading Conversation
          </Typography>
          <Typography
            variant='body1'
            color='muted'
            className='max-w-md mx-auto'
          >
            Fetching messages from the HCS-10 topic...
          </Typography>
        </div>
      </div>
    </div>
  );
}

export default LoadingConversation;
