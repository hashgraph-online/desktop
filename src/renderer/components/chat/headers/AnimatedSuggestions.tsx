import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Typography from '../../ui/Typography';
import { FiCpu, FiCode, FiShield, FiMessageSquare } from 'react-icons/fi';
import { cn } from '../../../lib/utils';

/**
 * Rotating suggestion card with typewriter animation.
 */
export type AnimatedSuggestionsProps = {
  onSelect: (text: string) => void;
};

export function AnimatedSuggestions(props: AnimatedSuggestionsProps) {
  const { onSelect } = props;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const suggestions = [
    {
      icon: FiCpu,
      text: 'Inscribe this poem...',
      color: 'from-purple-500/70 to-purple-600/70',
    },
    {
      icon: FiCode,
      text: "What's the price of HBAR?",
      color: 'from-blue-500/70 to-blue-600/70',
    },
    {
      icon: FiShield,
      text: 'Send 1 HBAR to 0.0.800',
      color: 'from-green-500/70 to-green-600/70',
    },
    {
      icon: FiMessageSquare,
      text: 'Create an NFT collection',
      color: 'from-indigo-500/70 to-indigo-600/70',
    },
  ];

  const currentSuggestion = suggestions[currentIndex];
  const Icon = currentSuggestion.icon;

  useEffect(() => {
    const targetText = currentSuggestion.text;
    let currentText = '';
    let charIndex = 0;
    setIsTyping(true);
    setDisplayText('');
    const typing = setInterval(() => {
      if (charIndex < targetText.length) {
        currentText += targetText[charIndex];
        setDisplayText(currentText);
        charIndex++;
      } else {
        clearInterval(typing);
        setIsTyping(false);
      }
    }, 50);
    return () => clearInterval(typing);
  }, [currentIndex, currentSuggestion.text]);

  useEffect(() => {
    if (!isTyping) {
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % suggestions.length);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isTyping, suggestions.length]);

  return (
    <div className='mt-8 flex flex-col items-center gap-4'>
      <Typography
        variant='caption'
        color='muted'
        className='text-xs uppercase tracking-wider'
      >
        Try asking
      </Typography>
      <motion.button
        key={currentIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onSelect(currentSuggestion.text)}
        className='relative px-6 py-5 bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl transition-all min-w-[320px] max-w-md group'
      >
        <div className='flex items-center gap-4'>
          <AnimatePresence mode='wait'>
            <motion.div
              key={`icon-${currentIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className={cn(
                'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg flex-shrink-0',
                currentSuggestion.color
              )}
            >
              <Icon className='w-5 h-5 text-white' />
            </motion.div>
          </AnimatePresence>
          <div className='flex-1 text-left'>
            <Typography
              variant='body1'
              className='text-gray-900 dark:text-white font-medium leading-tight'
            >
              {displayText}
              {isTyping && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className='inline-block w-0.5 h-4 bg-gray-600 dark:bg-gray-400 ml-0.5 align-middle'
                />
              )}
            </Typography>
          </div>
        </div>
      </motion.button>
    </div>
  );
}

export default AnimatedSuggestions;
