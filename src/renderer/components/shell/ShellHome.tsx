import React, { useMemo, useCallback, KeyboardEvent } from 'react';
import {
  HiChatBubbleBottomCenterText,
  HiGlobeAlt,
  HiMagnifyingGlass,
  HiServerStack,
  HiLink,
  HiWrenchScrewdriver,
  HiPuzzlePiece,
  HiUserCircle,
  HiCog6Tooth,
  HiQuestionMarkCircle,
  HiHeart,
  HiPhoto,
} from 'react-icons/hi2';
import { FiTool, FiSend } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { motion } from 'framer-motion';
import Typography from '../ui/Typography';
import Logo from '../ui/Logo';
import { useShellNavigation } from './useShellNavigation';
import moonscapeLogo from '../../../../assets/moonscape-logo.png';
import kiloscribeLogo from '../../../../assets/logos/Kiloscribe.png';
import bonzoLogo from '../../../../assets/logos/Bonzo.png';
import hgraphLogo from '../../../../assets/logos/HGRAPH.png';
import sentxLogo from '../../../../assets/logos/SentX.png';
import SaucerSwapLogo from '../brand/SaucerSwapLogo';
import { useConfigStore } from '../../stores/configStore';
import { cn } from '../../lib/utils';

interface DesktopProgram {
  id: string;
  label: string;
  description: string;
  route: string;
  accent: string;
  icon: IconType;
  external?: boolean;
  imageSrc?: string;
  logoComponent?: React.ComponentType<{ className?: string }>;
}

interface DesktopProgramGroup {
  id: string;
  title: string;
  programs: DesktopProgram[];
}

const CORE_PROGRAMS: DesktopProgramGroup[] = [
  {
    id: 'core',
    title: 'Core Programs',
    programs: [
      {
        id: 'chat',
        label: 'Chat Agent',
        description: 'Converse with your assistant.',
        route: '/chat',
        accent: 'from-brand-blue via-brand-purple to-brand-blue',
        icon: HiChatBubbleBottomCenterText,
      },
      {
        id: 'browser',
        label: 'Moonscape',
        description: 'Browse the decentralized web.',
        route: '/browser',
        accent: 'from-brand-green via-brand-blue to-brand-purple',
        icon: HiGlobeAlt,
        imageSrc: moonscapeLogo,
      },
      {
        id: 'media-library',
        label: 'Media Library',
        description: 'Review your stored inscriptions.',
        route: '/media',
        accent: 'from-brand-purple via-brand-blue to-brand-green',
        icon: HiPhoto,
      },
      {
        id: 'bookmark-kiloscribe',
        label: 'KiloScribe',
        description: 'HOL publishing & storage.',
        route: `/browser?target=${encodeURIComponent('https://hedera.kiloscribe.com')}`,
        accent: 'from-brand-blue via-brand-purple to-brand-green',
        icon: HiGlobeAlt,
        imageSrc: kiloscribeLogo,
      },
      {
        id: 'bookmark-saucerswap',
        label: 'SaucerSwap',
        description: 'Trade on Hedera DeFi.',
        route: `/browser?target=${encodeURIComponent('https://saucerswap.finance')}`,
        accent: 'from-brand-green via-brand-blue to-brand-purple',
        icon: HiGlobeAlt,
        logoComponent: SaucerSwapLogo,
      },
      {
        id: 'bookmark-bonzo',
        label: 'Bonzo Finance',
        description: 'Lend and borrow assets.',
        route: `/browser?target=${encodeURIComponent('https://bonzo.finance')}`,
        accent: 'from-hol-gold via-brand-purple to-brand-blue',
        icon: HiGlobeAlt,
        imageSrc: bonzoLogo,
      },
      {
        id: 'bookmark-hgraph',
        label: 'hGraph.io',
        description: 'Explore Hedera data.',
        route: `/browser?target=${encodeURIComponent('https://hgraph.com')}`,
        accent: 'from-brand-purple via-brand-blue to-brand-green',
        icon: HiGlobeAlt,
        imageSrc: hgraphLogo,
      },
      {
        id: 'bookmark-sentx',
        label: 'SentX',
        description: 'Access Hedera services.',
        route: `/browser?target=${encodeURIComponent('https://sentx.io')}`,
        accent: 'from-brand-blue via-brand-green to-brand-purple',
        icon: HiGlobeAlt,
        imageSrc: sentxLogo,
      }
    ],
  },
  {
    id: 'explore',
    title: 'Explore HOL',
    programs: [
      {
        id: 'discover',
        label: 'Discover',
        description: 'Find agents and templates.',
        route: '/discover',
        accent: 'from-brand-blue via-brand-purple to-brand-blue',
        icon: HiMagnifyingGlass,
      },
      {
        id: 'connections',
        label: 'Connections',
        description: 'Manage live sessions.',
        route: '/connections',
        accent: 'from-brand-green via-brand-blue to-brand-purple',
        icon: HiLink,
      },
      {
        id: 'mcp',
        label: 'MCP Servers',
        description: 'Configure MCP access.',
        route: '/mcp',
        accent: 'from-brand-purple via-brand-blue to-brand-green',
        icon: HiServerStack,
      },
      {
        id: 'plugins',
        label: 'Plugins',
        description: 'Extend with integrations.',
        route: '/plugins',
        accent: 'from-brand-blue via-brand-purple to-brand-green',
        icon: HiPuzzlePiece,
      },
      {
        id: 'tools',
        label: 'Tools',
        description: 'Developer utilities.',
        route: '/tools',
        accent: 'from-hol-gold via-brand-purple to-brand-blue',
        icon: FiTool,
      },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    programs: [
      {
        id: 'profile',
        label: 'My Profile',
        description: 'Update your identity.',
        route: '/hcs10-profile',
        accent: 'from-brand-purple via-brand-blue to-brand-purple',
        icon: HiUserCircle,
      },
      {
        id: 'settings',
        label: 'Settings',
        description: 'Configure HOL Desktop.',
        route: '/settings',
        accent: 'from-brand-blue via-brand-green to-brand-blue',
        icon: HiCog6Tooth,
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & Community',
    programs: [
      {
        id: 'help',
        label: 'Help & Docs',
        description: 'Guides and troubleshooting.',
        route: '/help',
        accent: 'from-brand-blue via-brand-purple to-brand-blue',
        icon: HiQuestionMarkCircle,
      },
      {
        id: 'acknowledgements',
        label: 'Acknowledgements',
        description: 'Credits & licenses.',
        route: '/acknowledgements',
        accent: 'from-brand-purple via-brand-blue to-brand-green',
        icon: HiHeart,
      },
      {
        id: 'telegram',
        label: 'Telegram',
        description: 'Join the community chat.',
        route: 'https://t.me/hashgraphonline',
        accent: 'from-brand-green via-brand-blue to-brand-purple',
        icon: FiSend,
        external: true,
      },
    ],
  },
];

const isActivationKey = (event: KeyboardEvent<HTMLButtonElement>): boolean => {
  return event.key === 'Enter' || event.key === ' ';
};

const DesktopIcon: React.FC<{
  program: DesktopProgram;
  onOpen(program: DesktopProgram): void;
  isDark: boolean;
}> = ({ program, onOpen, isDark }) => {
  const handleOpen = useCallback(() => {
    onOpen(program);
  }, [onOpen, program]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (isActivationKey(event)) {
        event.preventDefault();
        handleOpen();
      }
    },
    [handleOpen]
  );

  const Icon = program.icon;
  const LogoComponent = program.logoComponent;
  const iconColor = (() => {
    switch (program.id) {
      case 'chat':
        return isDark ? 'text-blue-300' : 'text-blue-500';
      case 'browser':
        return isDark ? 'text-emerald-300' : 'text-emerald-500';
      case 'media-library':
        return isDark ? 'text-purple-300' : 'text-purple-500';
      case 'bookmark-kiloscribe':
        return isDark ? 'text-indigo-300' : 'text-indigo-500';
      case 'bookmark-saucerswap':
        return isDark ? 'text-emerald-300' : 'text-emerald-500';
      case 'bookmark-bonzo':
        return isDark ? 'text-orange-300' : 'text-orange-500';
      case 'bookmark-hgraph':
        return isDark ? 'text-cyan-300' : 'text-cyan-500';
      case 'bookmark-sentx':
        return isDark ? 'text-pink-300' : 'text-pink-500';
      case 'discover':
        return isDark ? 'text-sky-300' : 'text-sky-500';
      case 'connections':
        return isDark ? 'text-teal-300' : 'text-teal-500';
      case 'mcp':
        return isDark ? 'text-violet-300' : 'text-violet-500';
      case 'plugins':
        return isDark ? 'text-fuchsia-300' : 'text-fuchsia-500';
      case 'tools':
        return isDark ? 'text-amber-300' : 'text-amber-500';
      case 'profile':
        return isDark ? 'text-lime-300' : 'text-lime-500';
      case 'settings':
        return isDark ? 'text-slate-200' : 'text-slate-600';
      case 'help':
        return isDark ? 'text-sky-300' : 'text-sky-500';
      case 'acknowledgements':
        return isDark ? 'text-rose-300' : 'text-rose-500';
      case 'telegram':
        return isDark ? 'text-sky-300' : 'text-sky-500';
      default:
        return isDark ? 'text-gray-200' : 'text-gray-600';
    }
  })();

  return (
    <motion.button
      type='button'
      onClick={handleOpen}
      onDoubleClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-14 flex-col items-center gap-2 rounded-2xl p-2.5 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        isDark
          ? 'hover:bg-white/10 focus-visible:ring-white/35 focus-visible:ring-offset-gray-900'
          : 'hover:bg-white focus-visible:ring-blue-500/30 focus-visible:ring-offset-white text-brand-ink/80'
      )}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.97 }}
      aria-label={program.label}
    >
      <div
        className={cn(
          'relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200 border',
          isDark
            ? 'bg-white/12 border-white/25 shadow-md shadow-black/35 backdrop-blur-sm'
            : 'bg-white border-gray-200 shadow-sm shadow-gray-300/40 group-hover:shadow-lg'
        )}
      >
        {program.imageSrc ? (
          <img
            src={program.imageSrc}
            alt={`${program.label} icon`}
            className='h-10 w-10 object-contain'
            draggable={false}
          />
        ) : LogoComponent ? (
          <LogoComponent className='h-10 w-10' />
        ) : (
          <Icon className={cn('h-7 w-7 transition-colors duration-200', iconColor)} aria-hidden='true' />
        )}
      </div>

      <Typography
        variant='caption'
        className={cn(
          'text-[11px] font-medium tracking-wide transition-colors duration-200 leading-tight text-center',
          isDark ? 'text-gray-200' : 'text-brand-ink/75'
        )}
        style={{ fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif' }}
      >
        {program.label}
      </Typography>
    </motion.button>
  );
};

const DesktopIconGroup: React.FC<{
  group: DesktopProgramGroup;
  onOpen(program: DesktopProgram): void;
  isDark: boolean;
}> = ({ group, onOpen, isDark }) => {
  return (
    <div className='flex flex-col gap-5'>
      <Typography
        variant='h3'
        className='text-xs font-semibold uppercase tracking-[0.24em] text-brand-ink/45 dark:text-white/45'
        noMargin
      >
        {group.title}
      </Typography>
      <div className='grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-7 gap-x-4 gap-y-5 justify-items-start place-items-start'>
        {group.programs.map((program) => (
          <DesktopIcon key={program.id} program={program} onOpen={onOpen} isDark={isDark} />
        ))}
      </div>
    </div>
  );
};

const ShellHome: React.FC = () => {
  const { open } = useShellNavigation();
  const { config } = useConfigStore();
  const isDark = (config?.advanced?.theme ?? 'light') === 'dark';

  const programGroups = useMemo(() => CORE_PROGRAMS, []);

  const handleOpen = useCallback(
    (program: DesktopProgram) => {
      if (program.external) {
        window.open(program.route, '_blank', 'noopener,noreferrer');
        return;
      }
      open(program.route);
    },
    [open]
  );

  return (
    <div
      className={cn(
        'min-h-full w-full flex-col gap-10 px-10 pb-20 pt-6 transition-all duration-500',
        isDark ? 'text-white' : 'text-brand-ink/80'
      )}
    >
      <div className='flex flex-col items-center gap-2'>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className='flex flex-col items-center gap-2'
        >
          <Logo variant='icon' size='lg' />
          <Typography
            variant='h1'
            className={cn(
              'text-5xl md:text-[3.5rem] font-bold tracking-tight transition-colors duration-500',
              'bg-gradient-to-r from-brand-blue via-brand-purple to-brand-green bg-clip-text text-transparent',
              'dark:from-white dark:via-blue-200 dark:to-purple-200'
            )}
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            HOL Desktop
          </Typography>
          <div
            data-testid='shell-status-line'
            className='mt-1 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-brand-ink/50 dark:text-white/50'
          >
            <span>Hashgraph Online</span>
            <span className='text-brand-blue'>•</span>
            <span>Operating Shell</span>
          </div>
        </motion.div>
      </div>

      <div className='flex flex-col gap-10'>
        {programGroups.map((group, index) => (
          <motion.div
            key={group.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: index * 0.2 }}
          >
            <DesktopIconGroup group={group} onOpen={handleOpen} isDark={isDark} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ShellHome;
