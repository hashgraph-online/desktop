import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Typography from '../components/ui/Typography';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import {
  FiMessageSquare,
  FiServer,
  FiPackage,
  FiArrowRight,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { MyAgentsList } from '../components/hcs10/MyAgentsList';

interface HomePageProps {}

interface FeatureCard {
  icon: React.ElementType;
  title: string;
  description: string;
  color: 'purple' | 'blue' | 'green' | 'orange';
  link: string;
}

const HomePage: React.FC<HomePageProps> = () => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);

  const features: FeatureCard[] = [
    {
      icon: FiMessageSquare,
      title: 'Chat',
      description: 'Talk to the conversational agent',
      color: 'purple',
      link: '/chat',
    },
    {
      icon: FiServer,
      title: 'MCP Servers',
      description: 'Configure Model Context Protocol servers',
      color: 'blue',
      link: '/mcp',
    },
    {
      icon: FiPackage,
      title: 'Plugins',
      description: 'Install and manage agent plugins',
      color: 'green',
      link: '/plugins',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className='component-group animate-fade-in relative overflow-hidden'>

      <div className='absolute inset-0 opacity-[0.02] dark:opacity-[0.05] pointer-events-none'>
        <div
          className='absolute inset-0 animate-gradient'
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(166, 121, 240, 0.1) 35px, rgba(166, 121, 240, 0.1) 70px)`,
            backgroundSize: '200% 200%',
          }}
        />
      </div>


      <div className='absolute inset-0 pointer-events-none'>
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className='absolute w-2 h-2 bg-gradient-to-r from-hgo-purple to-hgo-blue rounded-full opacity-40'
            animate={{
              x: [0, 100, -50, 0],
              y: [0, -100, 50, 0],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              delay: i * 0.5,
            }}
            style={{
              left: `${20 + i * 30}%`,
              top: `${10 + i * 25}%`,
            }}
          />
        ))}
      </div>


      <motion.div
        className='absolute top-10 right-10 w-48 h-48 bg-hgo-purple/10 rounded-full blur-3xl'
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className='absolute bottom-10 left-10 w-48 h-48 bg-hgo-green/10 rounded-full blur-3xl'
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />

      <div className='stack-md relative z-10'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography
            variant='h2'
            className='font-bold text-4xl md:text-5xl animate-gradient bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green bg-clip-text text-transparent font-mono'
            style={{ backgroundSize: '200% 200%' }}
          >
            HashgraphOnline
          </Typography>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className='space-y-1'
        >
          <Typography
            variant='subtitle1'
            className='font-mono text-gray-600 dark:text-gray-400'
          >
            {'>'} Open Agents for Everyone.
          </Typography>
          <Typography
            variant='caption'
            className='font-mono text-green-500 dark:text-green-400 animate-pulse'
          >
            {'>'} Status: READY | Network: HEDERA | Mode: AUTONOMOUS
          </Typography>
        </motion.div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 grid-container-lg relative z-10'>
        {features.map((feature, index) => {
          const Icon = feature.icon;
          const colorClasses = {
            purple: 'from-hgo-purple to-hgo-blue',
            blue: 'from-hgo-blue to-hgo-green',
            green: 'from-hgo-green to-hgo-blue',
            orange: 'from-hgo-blue to-hgo-purple',
          };
          const isActive = activeFeature === index;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
              className='group cursor-pointer'
              onClick={() => navigate(feature.link)}
              onMouseEnter={() => setActiveFeature(index)}
            >
              <Card
                className={cn(
                  'relative bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm border transition-all duration-300 overflow-hidden',
                  isActive
                    ? 'border-hgo-blue/50 shadow-2xl shadow-hgo-blue/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl'
                )}
              >
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500',
                    `bg-gradient-to-br ${colorClasses[feature.color]}`
                  )}
                  style={{ opacity: isActive ? 0.05 : undefined }}
                />

                <CardContent className='p-6'>
                  <div className='flex items-center gap-3 mb-3'>
                    <div className='relative'>
                      <div
                        className={cn(
                          'absolute inset-0 rounded-xl blur-xl opacity-30 group-hover:opacity-50 transition-all duration-500',
                          `bg-gradient-to-br ${colorClasses[feature.color]}`
                        )}
                      />
                      <div
                        className={cn(
                          'relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500',
                          'group-hover:scale-110',
                          `bg-gradient-to-br ${colorClasses[feature.color]}`
                        )}
                      >
                        <Icon className='w-6 h-6 text-white' />
                      </div>
                    </div>
                    <Typography
                      variant='h5'
                      className='font-semibold group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-hgo-blue group-hover:to-hgo-purple group-hover:bg-clip-text transition-all duration-300'
                    >
                      {feature.title}
                    </Typography>
                  </div>
                  <div className='mb-4'>
                    <Typography
                      variant='body2'
                      color='muted'
                      className='group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300'
                    >
                      {feature.description}
                    </Typography>
                  </div>
                  <div className='flex items-center gap-2 text-hgo-blue dark:text-hgo-blue'>
                    <span className='text-sm font-medium'>Open</span>
                    <FiArrowRight className='w-4 h-4 transition-transform group-hover:translate-x-1' />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className='mt-8 relative z-10'>
        <MyAgentsList />
      </div>
    </div>
  );
};

export default HomePage;
