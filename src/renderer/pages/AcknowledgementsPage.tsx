import React from 'react';
import { motion } from 'framer-motion';
import Typography from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { getPublicAssetPath } from '../utils/assets';
import { daoLogos } from '../assets/logos';
import {
  HiHeart,
  HiArrowTopRightOnSquare,
  HiCodeBracket,
  HiCube,
  HiCommandLine,
  HiDocumentText,
  HiUserGroup,
  HiAcademicCap,
} from 'react-icons/hi2';

const AcknowledgementsPage: React.FC = () => {
  const coreAcknowledgements = [
    {
      name: 'Hiero JavaScript SDK',
      description:
        'The official JavaScript/TypeScript SDK for interacting with Hedera Hashgraphs',
      link: 'https://github.com/hashgraph/hedera-sdk-js',
      icon: HiCommandLine,
      gradient: 'from-purple-variant-700 to-purple-variant-500',
    },
    {
      name: 'Hedera Agent Kit',
      description:
        "The foundational toolkit that powers HashgraphOnline's interaction with the Hedera Hashgraph",
      link: 'https://github.com/hashgraph/hedera-agent-kit',
      icon: HiCube,
      gradient: 'from-hgo-purple to-hgo-blue',
    },
    {
      name: 'Hashgraph Online Standards SDK',
      description:
        'Implementation of HCS standards including HCS-1, HCS-2, HCS-10, and HCS-20',
      link: 'https://github.com/hashgraphonline/standards-sdk',
      icon: HiCodeBracket,
      gradient: 'from-hgo-blue to-hgo-green',
    },
    {
      name: 'HCS Improvement Proposals',
      description:
        'The standards that enable decentralized agent communication and inscription on Hedera',
      link: 'https://github.com/hashgraphonline/hcs-improvement-proposals',
      icon: HiDocumentText,
      gradient: 'from-hgo-green to-hgo-blue',
    },
  ];

  const standards = [
    {
      name: 'HCS-1',
      description:
        'Inscription Standard - Enables data inscription on Hedera Consensus Service',
      color: 'text-purple-500',
    },
    {
      name: 'HCS-2',
      description:
        'Registry Management - Decentralized data storage and retrieval',
      color: 'text-blue-500',
    },
    {
      name: 'HCS-10',
      description:
        'AI Agent Communication - Trustless peer-to-peer messaging protocol',
      color: 'text-green-500',
    },
    {
      name: 'HCS-20',
      description: 'Fungible Tick Standard - Token ticker inscriptions on HCS',
      color: 'text-orange-500',
    },
  ];

  const technologies = [
    {
      category: 'Core Technologies',
      items: [
        { name: 'LangChain' },
        { name: 'OpenAI' },
        { name: 'Model Context Protocol' },
        { name: 'Electron Log' },
      ],
    },
    {
      category: 'Frontend',
      items: [
        { name: 'React' },
        { name: 'Electron' },
        { name: 'Tailwind CSS' },
        { name: 'Framer Motion' },
      ],
    },
    {
      category: 'UI Components',
      items: [
        { name: 'Radix UI' },
        { name: 'React Icons' },
        { name: 'Lucide React' },
        { name: 'React Hook Form' },
      ],
    },
  ];

  const daoMembers = [
    {
      name: 'Bonzo Finance',
      specialty: 'DeFi Lending Protocol',
      description:
        'The Liquidity Layer of Hedera — an open source, non-custodial lending protocol based on Aave',
      website: 'https://bonzo.finance',
      gradient: 'from-indigo-500 to-purple-600',
      logo: 'Bonzo_Dark.png',
    },
    {
      name: 'Builder Labs',
      specialty: 'Venture Studio',
      description:
        'Venture studio focused on Web3 solutions, with an emphasis on Hedera',
      website: 'https://buidlerlabs.io',
      gradient: 'from-blue-500 to-indigo-600',
      logo: 'Buidler Labs.png',
    },
    {
      name: 'HashPack',
      specialty: 'Leading Hedera Wallet',
      description:
        'The leading wallet on Hedera and gateway to services and assets across the entire ecosystem',
      website: 'https://www.hashpack.app',
      gradient: 'from-purple-500 to-pink-600',
      logo: 'Hashpack.png',
    },
    {
      name: 'Hashgate',
      specialty: 'Payment Gateway',
      description:
        'Reliable non-custodial payment gateway, combining speed, security, and simplicity',
      website: 'https://hashgate.io',
      gradient: 'from-emerald-500 to-green-600',
      logo: 'Hashgate.png',
    },
    {
      name: 'Hgraph',
      specialty: 'Mirror Node Infrastructure',
      description:
        'Trusted software engineering firm and Hedera mirror node provider',
      website: 'https://arkhia.io',
      gradient: 'from-sky-500 to-blue-600',
      logo: 'HGRAPH.png',
    },
    {
      name: 'LaunchBadge',
      specialty: 'Software Engineering',
      description:
        'Software engineering company dedicated to fostering excellence at the cutting edge of technology',
      website: 'https://dragonglassio.com',
      gradient: 'from-orange-500 to-amber-600',
      logo: 'Launchbadge.png',
    },
    {
      name: 'Neuron',
      specialty: 'Machine-to-Machine Commerce',
      description:
        'Creating a world where machines buy from machines, facilitating a new era of agentic abundance',
      website: 'https://asystemicnext.com',
      gradient: 'from-sky-500 to-blue-600',
      logo: 'Neuron.png',
    },
    {
      name: 'SentX',
      specialty: 'Leading NFT Marketplace',
      description:
        'The leading NFT Marketplace on Hedera to buy, sell, and discover digital collectibles',
      website: 'https://kabila.app',
      gradient: 'from-slate-600 to-slate-700',
      logo: 'SentX.png',
    },
    {
      name: 'KiloScribe',
      specialty: 'On-Graph File Storage',
      description:
        'Effortless storage and retrieval of on-graph files - empowering developers, creators, and influencers',
      website: 'https://hashscan.io',
      gradient: 'from-violet-500 to-purple-600',
      logo: 'Kiloscribe_Dark.png',
    },
    {
      name: 'Turtlemoon',
      specialty: 'Web3 Platforms',
      description:
        'Creating web 3 platforms, services, and applications using Hedera',
      website: 'https://trust.enterprises',
      gradient: 'from-cyan-500 to-teal-600',
      logo: 'Turtlemoon.png',
    },
  ];

  const community = [
    {
      name: 'Hashgraph Online',
      role: 'Project Maintainer',
      description:
        'A consortium of leading Hashgraph organizations within the Hedera ecosystem',
      link: 'https://www.hederaeducation.org',
      icon: HiUserGroup,
    },
    {
      name: 'Hedera Community',
      role: 'Ecosystem Support',
      description:
        'The broader Hedera developer community providing feedback and contributions',
      link: 'https://hedera.com/developers',
      icon: HiAcademicCap,
    },
  ];

  return (
    <div className='flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 relative overflow-auto'>

      <div className='absolute inset-0 opacity-[0.01] dark:opacity-[0.02] pointer-events-none'>
        <motion.div
          className='absolute inset-0'
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(85, 153, 254, 0.1) 35px, rgba(85, 153, 254, 0.1) 70px)`,
            backgroundSize: '200% 200%',
          }}
        />
      </div>

      <div className='min-h-screen bg-background relative'>
        <div className='container mx-auto px-6 py-8 max-w-6xl'>

          <div className='mb-8 text-center'>
            <Typography
              variant='h1'
              className='text-3xl font-bold mb-4 bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green bg-clip-text text-transparent'
            >
              Acknowledgements
            </Typography>
            <Typography
              variant='body1'
              color='muted'
              className='max-w-2xl mx-auto'
            >
              HashgraphOnline is built on the shoulders of giants. We're
              grateful to the open-source community and the Hedera ecosystem for
              making this project possible.
            </Typography>
          </div>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className='mb-12'
          >
            <Typography variant='h2' className='text-2xl font-bold mb-6 text-center bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green bg-clip-text text-transparent'>
              Core Dependencies
            </Typography>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              {coreAcknowledgements.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className='p-5 hover:shadow-lg transition-all duration-300 group h-full'>
                    <div className='flex flex-col h-full items-center text-center'>
                      <div
                        className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 mb-3',
                          `bg-gradient-to-br ${item.gradient}`
                        )}
                      >
                        <item.icon className='w-6 h-6 text-white' />
                      </div>
                      <Typography variant='h6' className='font-bold mb-2'>
                        {item.name}
                      </Typography>
                      <Typography
                        variant='body2'
                        color='muted'
                        className='mb-3 flex-1'
                      >
                        {item.description}
                      </Typography>
                      <a
                        href={item.link}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition-colors'
                      >
                        View Project{' '}
                        <HiArrowTopRightOnSquare className='w-4 h-4' />
                      </a>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className='mb-12'
          >
            <Typography variant='h2' className='text-2xl font-bold mb-6 text-center bg-gradient-to-r from-hgo-green via-hgo-blue to-hgo-purple bg-clip-text text-transparent'>
              Hashgraph Consensus Standards
            </Typography>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {standards.map((standard, index) => (
                <motion.div
                  key={standard.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className='p-5 hover:shadow-lg transition-all duration-300'>
                    <div className='flex items-center gap-3 mb-2'>
                      <Typography
                        variant='h6'
                        className={cn('font-bold', standard.color)}
                      >
                        {standard.name}
                      </Typography>
                      <Badge variant='outline' className='text-xs'>
                        Standard
                      </Badge>
                    </div>
                    <Typography variant='body2' color='muted'>
                      {standard.description}
                    </Typography>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className='mb-12'
          >
            <Typography variant='h2' className='text-2xl font-bold mb-6 text-center bg-gradient-to-r from-hgo-blue via-hgo-green to-hgo-purple bg-clip-text text-transparent'>
              Technologies Used
            </Typography>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              {technologies.map((category, categoryIndex) => (
                <motion.div
                  key={category.category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: categoryIndex * 0.1 }}
                >
                  <Card className='p-5 h-full'>
                    <Typography variant='h6' className='font-bold mb-4'>
                      {category.category}
                    </Typography>
                    <div className='space-y-2'>
                      {category.items.map((item) => (
                        <div key={item.name} className='flex items-center'>
                          <Typography variant='body2'>{item.name}</Typography>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className='mb-12'
          >
            <Typography variant='h2' className='text-2xl font-bold mb-6 text-center bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green bg-clip-text text-transparent'>
              Hashgraph Online DAO Members
            </Typography>
            <Typography variant='body1' color='muted' className='mb-6 text-center max-w-3xl mx-auto'>
              The following organizations are pioneering members of the
              Hashgraph Online DAO, building the core infrastructure and
              applications that power the ecosystem.
            </Typography>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {daoMembers.map((member, index) => (
                <motion.div
                  key={member.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className='p-6 hover:shadow-lg transition-all duration-300 group h-full'>
                    <div className='flex flex-col h-full'>
                      <div className='flex items-start gap-4 mb-4'>
                        <div
                          className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 p-2'
                          )}
                        >
                          <img
                            src={daoLogos[member.logo]}
                            alt={`${member.name} logo`}
                            className='w-full h-full object-contain'
                          />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <Typography variant='h6' className='font-bold mb-1'>
                            {member.name}
                          </Typography>
                          <Badge variant='outline' className='text-xs'>
                            {member.specialty}
                          </Badge>
                        </div>
                      </div>
                      <Typography
                        variant='body2'
                        color='muted'
                        className='mb-4 flex-1'
                      >
                        {member.description}
                      </Typography>
                      <a
                        href={member.website}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition-colors'
                      >
                        Visit Website{' '}
                        <HiArrowTopRightOnSquare className='w-4 h-4' />
                      </a>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className='mb-12'
          >
            <Typography variant='h2' className='text-2xl font-bold mb-6 text-center bg-gradient-to-r from-hgo-green via-hgo-purple to-hgo-blue bg-clip-text text-transparent'>
              Community & Contributors
            </Typography>
            <div className='space-y-4'>
              {community.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className='p-6 hover:shadow-lg transition-all duration-300'>
                    <div className='flex items-start gap-4'>
                      <div className='w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md'>
                        <item.icon className='w-6 h-6 text-white' />
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-3 mb-2'>
                          <Typography variant='h6' className='font-bold'>
                            {item.name}
                          </Typography>
                          <Badge variant='secondary' className='text-xs'>
                            {item.role}
                          </Badge>
                        </div>
                        <Typography
                          variant='body2'
                          color='muted'
                          className='mb-3'
                        >
                          {item.description}
                        </Typography>
                        <a
                          href={item.link}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition-colors'
                        >
                          Visit Website{' '}
                          <HiArrowTopRightOnSquare className='w-4 h-4' />
                        </a>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className='mb-12'
          >
            <Card className='p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800'>
              <div className='text-center'>
                <Typography variant='h5' className='font-bold mb-4'>
                  Open Source License
                </Typography>
                <Typography variant='body1' color='muted' className='mb-6'>
                  HashgraphOnline is released under the Apache License 2.0,
                  promoting open collaboration and innovation in the Hedera
                  ecosystem.
                </Typography>
                <div className='flex justify-center gap-4'>
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={() =>
                      window.open(
                        'https://opensource.org/licenses/MIT',
                        '_blank'
                      )
                    }
                  >
                    <HiDocumentText className='w-4 h-4' />
                    View License
                  </Button>
                  <Button
                    variant='gradient'
                    size='sm'
                    onClick={() =>
                      window.open(
                        'https://github.com/hashgraphonline/hashgraph-online',
                        '_blank'
                      )
                    }
                  >
                    <HiCodeBracket className='w-4 h-4' />
                    View Source
                  </Button>
                </div>
              </div>
            </Card>
          </motion.section>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className='text-center pb-8'
          >
            <Typography variant='body2' color='muted'>
              Made with <HiHeart className='inline w-4 h-4 text-pink-500' /> by
              Hashgraph Online
            </Typography>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AcknowledgementsPage;
