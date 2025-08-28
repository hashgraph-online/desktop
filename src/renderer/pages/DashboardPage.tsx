import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Typography from '../components/ui/Typography';
import {
  HiChatBubbleBottomCenterText,
  HiServerStack,
  HiPuzzlePiece,
  HiUserCircle,
  HiCog6Tooth,
  HiQuestionMarkCircle,
  HiHeart,
  HiArrowRight,
} from 'react-icons/hi2';
import { cn } from '../lib/utils';

interface DashboardCard {
  id: string;
  path: string;
  label: string;
  icon: React.ElementType;
  description: string;
  gradient: string;
  iconBg: string;
  category: 'primary' | 'secondary';
}

const dashboardCards: DashboardCard[] = [
  {
    id: 'chat',
    path: '/chat',
    label: 'Agent Chat',
    icon: HiChatBubbleBottomCenterText,
    description:
      'Have conversations with your AI assistant powered by advanced language models',
    gradient: 'from-purple-600 to-hgo-purple',
    iconBg: 'from-purple-600 to-hgo-purple',
    category: 'primary',
  },
  {
    id: 'mcp',
    path: '/mcp',
    label: 'MCP Servers',
    icon: HiServerStack,
    description:
      'Connect and manage extensions that give your assistant new capabilities',
    gradient: 'from-green-600 to-hgo-green',
    iconBg: 'from-green-600 to-hgo-green',
    category: 'primary',
  },
  {
    id: 'plugins',
    path: '/plugins',
    label: 'Plugins',
    icon: HiPuzzlePiece,
    description:
      'Browse and install plugins to extend functionality and add new features',
    gradient: 'from-blue-500 to-hgo-blue',
    iconBg: 'from-blue-500 to-hgo-blue',
    category: 'primary',
  },
  {
    id: 'hcs10',
    path: '/hcs10-profile',
    label: 'My Profile',
    icon: HiUserCircle,
    description:
      'Manage your Hedera profile and customize your identity on the network',
    gradient: 'from-blue-600 to-blue-800',
    iconBg: 'from-blue-600 to-blue-800',
    category: 'primary',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    icon: HiCog6Tooth,
    description:
      'Configure your workspace, API keys, and application preferences',
    gradient: 'from-gray-500 to-gray-600',
    iconBg: 'from-gray-500 to-gray-600',
    category: 'secondary',
  },
  {
    id: 'help',
    path: '/help',
    label: 'Help & Docs',
    icon: HiQuestionMarkCircle,
    description:
      'Get support, read documentation, and learn how to use all features',
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'from-blue-500 to-indigo-600',
    category: 'secondary',
  },
  {
    id: 'acknowledgements',
    path: '/acknowledgements',
    label: 'Acknowledgements',
    icon: HiHeart,
    description:
      'View credits, open source licenses, and contributors to this project',
    gradient: 'from-pink-500 to-rose-600',
    iconBg: 'from-pink-500 to-rose-600',
    category: 'secondary',
  },
];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const primaryCards = dashboardCards.filter(
    (card) => card.category === 'primary'
  );
  const secondaryCards = dashboardCards.filter(
    (card) => card.category === 'secondary'
  );

  const handleCardClick = (path: string) => {
    if (path === '/help') {
      window.open('https://docs.hashgraphonline.com', '_blank');
    } else {
      navigate(path);
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative overflow-hidden'>
      <div className='absolute inset-0 overflow-hidden pointer-events-none'>
        <motion.div
          className='absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-hgo-purple/10 to-hgo-blue/10 rounded-full blur-3xl'
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className='absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-hgo-green/10 to-hgo-blue/10 rounded-full blur-3xl'
          animate={{
            x: [0, -50, 0],
            y: [0, -30, 0],
            scale: [1.1, 1, 1.1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-hgo-blue/5 to-hgo-purple/5 rounded-full blur-3xl'
          animate={{
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      <div className='absolute inset-0 opacity-[0.02] dark:opacity-[0.015] pointer-events-none'>
        <motion.div
          className='absolute inset-0'
          animate={{
            backgroundPosition: ['0px 0px', '40px 40px'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(85, 153, 254, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(85, 153, 254, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className='absolute inset-0 pointer-events-none'>
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className='absolute w-1 h-1 bg-gradient-to-br from-hgo-blue to-hgo-purple rounded-full opacity-30'
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + i * 12}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              x: [-10, 10, -10],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className='text-center mb-12'
        >
          <Typography variant='h1' className='font-bold text-5xl mb-4'>
            <span className='bg-gradient-to-r from-blue-600 to-green-600 dark:from-hgo-blue dark:to-hgo-green bg-clip-text text-transparent'>
              Your personal decentralized AI assistant.
            </span>
          </Typography>
          <Typography
            variant='body1'
            color='muted'
            className='max-w-2xl mx-auto'
          >
            Chat with AI, manage extensions, and explore blockchain
            capabilities.
          </Typography>
        </motion.div>

        <div className='space-y-8'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              {primaryCards.map((card, index) => {
                const Icon = card.icon;

                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCardClick(card.path)}
                    className='group relative cursor-pointer'
                  >
                    <div
                      className='absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl'
                      style={{
                        background: `linear-gradient(to bottom right, ${
                          card.gradient.includes('from-[')
                            ? card.gradient
                                .split(' ')[0]
                                .replace('from-[', '')
                                .replace(']', '')
                            : 'transparent'
                        }, ${
                          card.gradient.includes('to-[')
                            ? card.gradient
                                .split(' ')[1]
                                .replace('to-[', '')
                                .replace(']', '')
                            : 'transparent'
                        })`,
                        opacity: 0.2,
                      }}
                    />

                    <div className='relative h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300 group-hover:border-gray-300 dark:group-hover:border-gray-700 group-hover:shadow-xl'>
                      <div className='p-6'>
                        <div
                          className={cn(
                            'w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br transition-all duration-300 group-hover:scale-110 shadow-lg',
                            card.iconBg
                          )}
                        >
                          <Icon className='w-7 h-7 text-white' />
                        </div>

                        <Typography
                          variant='h6'
                          className='font-semibold mb-2 flex items-center gap-2'
                        >
                          {card.label}
                          <HiArrowRight className='w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300' />
                        </Typography>

                        <Typography
                          variant='body2'
                          color='muted'
                          className='line-clamp-2'
                        >
                          {card.description}
                        </Typography>
                      </div>

                      <div
                        className={cn(
                          'h-1 w-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                          card.gradient
                        )}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Typography
              variant='h6'
              className='font-semibold mb-4 text-gray-700 dark:text-gray-300 text-center'
            >
              Resources & Support
            </Typography>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
              {secondaryCards.map((card, index) => {
                const Icon = card.icon;

                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCardClick(card.path)}
                    className='group relative cursor-pointer'
                  >
                    <div className='relative h-full bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-300 group-hover:bg-white dark:group-hover:bg-gray-900 group-hover:border-gray-300 dark:group-hover:border-gray-700 group-hover:shadow-lg'>
                      <div className='p-5 flex items-start gap-4'>
                        <div
                          className={cn(
                            'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br transition-all duration-300 group-hover:scale-110 shadow-md',
                            card.iconBg
                          )}
                        >
                          <Icon className='w-6 h-6 text-white' />
                        </div>

                        <div className='flex-1 min-w-0'>
                          <div className='font-semibold flex items-center gap-2 text-xs sm:text-sm md:text-base font-normal text-gray-900 dark:text-white'>
                            {card.label}
                            <HiArrowRight className='w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300' />
                          </div>

                          <div className='text-xs font-normal text-gray-600 dark:text-gray-400 line-clamp-2'>
                            {card.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className='mt-12 text-center'
        >
          <Typography variant='caption' color='muted'>
            Powered by Hedera Hashgraph • Built with love by the HashgraphOnline
            team
          </Typography>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
