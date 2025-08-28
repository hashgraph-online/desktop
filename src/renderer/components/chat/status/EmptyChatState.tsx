import React from 'react';
import { motion } from 'framer-motion';
import Typography from '../../ui/Typography';
import { FiMessageSquare } from 'react-icons/fi';
import AnimatedSuggestions from '../headers/AnimatedSuggestions';

export type EmptyChatStateProps = {
  onSelectSuggestion: (value: string) => void;
};

export default function EmptyChatState(props: EmptyChatStateProps) {
  const { onSelectSuggestion } = props;

  return (
    <div className='h-full flex items-center justify-center p-12 lg:p-16'>
      <div className='text-center space-y-8 max-w-3xl relative z-10 pt-12'>
        <motion.div
          className='absolute -top-16 -right-24 w-80 h-80 bg-gradient-to-br from-hgo-purple/8 to-hgo-blue/6 rounded-full blur-3xl'
          animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.12, 0.06], rotate: [0, 180, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className='absolute -bottom-16 -left-24 w-80 h-80 bg-gradient-to-br from-hgo-green/8 to-hgo-green-light/6 rounded-full blur-3xl'
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.06, 0.12, 0.06], rotate: [360, 180, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
        <motion.div
          className='absolute top-1/3 -right-32 w-64 h-64 bg-gradient-to-br from-blue-variant-300/60 to-hgo-blue/40 rounded-full blur-3xl'
          animate={{ scale: [1, 1.3, 1], opacity: [0.04, 0.08, 0.04], x: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        <motion.div
          className='w-20 h-20 bg-gradient-to-br from-hgo-purple/90 to-hgo-blue/90 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/20 ring-1 ring-white/10'
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          whileHover={{ scale: 1.1, boxShadow: '0 25px 50px rgba(166, 121, 240, 0.4)', transition: { duration: 0.3 } }}
        >
          <FiMessageSquare className='w-10 h-10 text-white' />
        </motion.div>
        <div className='space-y-4'>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
            <Typography variant='body1' color='muted' className='text-lg leading-relaxed max-w-2xl mx-auto'>
              I can help you with Hedera Hashgraph operations, HCS-1 inscriptions, HCS-20 ticks, account management, NFT minting, smart contracts, and more.
            </Typography>
          </motion.div>
        </div>

        <AnimatedSuggestions onSelect={onSelectSuggestion} />
      </div>
    </div>
  );
}


