import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Typography from '../components/ui/Typography';
import { HiWrenchScrewdriver, HiArrowRight } from 'react-icons/hi2';
import { HiDatabase } from 'react-icons/hi';
import { cn } from '../lib/utils';

interface ToolCard {
  id: string;
  path: string;
  label: string;
  icon: React.ElementType;
  description: string;
  gradient: string;
  iconBg: string;
  status: 'available' | 'coming_soon';
}

const toolCards: ToolCard[] = [
  {
    id: 'entity-manager',
    path: '/builder/entity-manager',
    label: 'Entity Manager',
    icon: HiDatabase,
    description:
      'View and manage on-chain entities created by tools with search, filtering, and bulk operations',
    gradient: 'from-blue-500 to-purple-500',
    iconBg: 'from-blue-500 to-purple-500',
    status: 'available',
  },
  {
    id: 'block-tester',
    path: '/builder/block-tester',
    label: 'Block Tester',
    icon: HiWrenchScrewdriver,
    description:
      'Test and preview HashLink blocks before deploying to the Hedera network',
    gradient: 'from-orange-500 to-red-500',
    iconBg: 'from-orange-500 to-red-500',
    status: 'available',
  },
];

/**
 * ToolsPage component displays available development tools
 */
const ToolsPage: React.FC = () => {
  const navigate = useNavigate();

  const handleCardClick = (tool: ToolCard) => {
    if (tool.status === 'available') {
      navigate(tool.path);
    }
  };

  return (
    <div className='flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-black/50'>
      <div className='max-w-7xl mx-auto p-6 space-y-8'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className='text-center space-y-4'
        >
          <Typography
            variant='h1'
            className='text-4xl font-bold bg-gradient-to-r from-[#5599fe] to-[#a679f0] bg-clip-text text-transparent'
          >
            Development Tools
          </Typography>
          <Typography
            variant='body1'
            className='text-gray-600 dark:text-gray-300 max-w-2xl mx-auto'
          >
            Powerful tools to help you build, test, and deploy on the Hedera
            network
          </Typography>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'
        >
          {toolCards.map((tool, index) => (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
              onClick={() => handleCardClick(tool)}
              className={cn(
                'group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800/50',
                'border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl',
                'shadow-lg hover:shadow-2xl transition-all duration-300',
                'hover:scale-[1.02] hover:-translate-y-1',
                tool.status === 'available'
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-60'
              )}
            >
              <div className='absolute inset-0 opacity-[0.03] dark:opacity-[0.05]'>
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} blur-3xl`}
                />
              </div>

              <div className='relative p-6 space-y-4'>
                <div className='flex items-start justify-between'>
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      'bg-gradient-to-br shadow-lg transition-transform duration-300',
                      'group-hover:scale-110 group-hover:rotate-3',
                      tool.iconBg
                    )}
                  >
                    <tool.icon className='w-6 h-6 text-white' />
                  </div>

                  {tool.status === 'available' && (
                    <HiArrowRight className='w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100' />
                  )}
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <Typography
                      variant='h3'
                      noMargin
                      className='text-gray-900 dark:text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-[#5599fe] group-hover:to-[#a679f0] group-hover:bg-clip-text transition-all duration-300'
                    >
                      {tool.label}
                    </Typography>
                    {tool.status === 'coming_soon' && (
                      <span className='px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded-full'>
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <Typography
                    variant='body2'
                    className='text-gray-600 dark:text-gray-300 leading-relaxed'
                  >
                    {tool.description}
                  </Typography>
                </div>
              </div>

              <div
                className={cn(
                  'absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300',
                  `bg-gradient-to-r ${tool.gradient}`,
                  'opacity-0 group-hover:opacity-100'
                )}
              />
            </motion.div>
          ))}
        </motion.div>

        {toolCards.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className='text-center py-16 space-y-4'
          >
            <HiWrenchScrewdriver className='w-16 h-16 mx-auto text-gray-300 dark:text-gray-600' />
            <Typography
              variant='h3'
              className='text-gray-500 dark:text-gray-400'
            >
              More tools coming soon
            </Typography>
            <Typography
              variant='body2'
              className='text-gray-400 dark:text-gray-500'
            >
              We're constantly working on new development tools to help you
              build on Hedera
            </Typography>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ToolsPage;
