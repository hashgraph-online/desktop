import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertTriangle,
  FiCheck,
  FiLock,
  FiSearch,
  FiX,
  FiGlobe,
  FiZap,
  FiShield,
  FiCode
} from 'react-icons/fi';
import { KNS } from '@kabuto-sh/ns';
import Typography from '../ui/Typography';
import { Input } from '../ui/input';
import { useWalletStore } from '../../stores/walletStore';
import { cn } from '../../lib/utils';
import { Terminal } from '../ui/Terminal';
import { AnimatedBackground } from '../ui/AnimatedBackground';
import { TransformCard } from '../ui/TransformCard';
import { HashgraphConsensus } from '../ui/HashgraphConsensus';

type DomainStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'registering'
  | 'registered'
  | 'error';

type DomainPricing = {
  usd: number;
  hbar: number;
};

const SEARCH_DEBOUNCE_MS = 500;
const QUICK_SUGGESTIONS: string[] = ['orbit', 'hashgraph', 'agentx', 'stardust', 'hol'];

interface SetupStep {
  title: string;
  detail: string;
}

const SETUP_STEPS: readonly SetupStep[] = [
  {
    title: 'Secure your membership handle',
    detail: 'Register your .bit domain to gain access to exclusive Hashgraph Online features.',
  },
  {
    title: 'Connect and build',
    detail: 'Deploy AI agents, list dApps, and access the full HCS ecosystem.',
  },
  {
    title: 'Unlock premium features',
    detail: 'Access custom themes, early features, and Bitcoin App Store listing.',
  },
];

const parseHbarValue = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = value.split(' ')[0];
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const derived = (value as { toString: () => string }).toString();
    const numeric = derived.split(' ')[0];
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

interface AvailabilityBadgeProps {
  status: DomainStatus;
  error: string;
  pricing: DomainPricing | null;
}

const AvailabilityBadge: React.FC<AvailabilityBadgeProps> = ({
  status,
  error,
  pricing,
}) => {
  if (status === 'idle') {
    return null;
  }

  const tone: Record<DomainStatus, string> = {
    idle: '',
    checking: 'border border-blue-500/50 dark:border-blue-400/50 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    available: 'border border-green-500/50 dark:border-green-400/50 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    unavailable: 'border border-red-500/50 dark:border-red-400/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    registering: 'border border-purple-500/50 dark:border-purple-400/50 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    registered: 'border border-green-500/50 dark:border-green-400/50 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    error: 'border border-yellow-500/50 dark:border-yellow-400/50 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  };

  const label: Record<DomainStatus, string> = {
    idle: '',
    checking: '// Querying KNS registry...',
    available: '✓ AVAILABLE',
    unavailable: '✗ TAKEN',
    registering: 'REGISTERING...',
    registered: 'REGISTERED',
    error: error || 'ERROR',
  };

  const renderIcon = () => {
    if (status === 'available' || status === 'registered') {
      return <FiCheck className='h-4 w-4' />;
    }
    if (status === 'unavailable') {
      return <FiX className='h-4 w-4' />;
    }
    if (status === 'error') {
      return <FiAlertTriangle className='h-4 w-4' />;
    }
    if (status === 'checking' || status === 'registering') {
      return (
        <motion.div
          className='h-4 w-4 border-2 border-current border-t-transparent rounded-full'
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      className='space-y-3'
    >
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-sm backdrop-blur-sm',
        tone[status]
      )}>
        {renderIcon()}
        <span className="flex-1">{label[status]}</span>

        {status === 'available' && pricing && (
          <div className='flex items-center gap-2 text-xs'>
            <span className="text-green-600 dark:text-green-300">${pricing.usd.toFixed(2)}</span>
            <span className="text-slate-500 dark:text-gray-500">•</span>
            <span className="text-green-600 dark:text-green-300">{pricing.hbar.toFixed(4)} ℏ</span>
          </div>
        )}
      </div>

      {/* Progress indicator for checking/registering */}
      {(status === 'checking' || status === 'registering') && (
        <motion.div
          className="h-1 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden"
        >
          <motion.div
            className={cn(
              "h-full rounded-full",
              status === 'checking' ? "bg-blue-500 dark:bg-blue-400" : "bg-purple-500 dark:bg-purple-400"
            )}
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
          />
        </motion.div>
      )}
    </motion.div>
  );
};

interface RegisterButtonProps {
  status: DomainStatus;
  canSubmit: boolean;
  onRegister(): void;
  isConnected: boolean;
}

const RegisterButton: React.FC<RegisterButtonProps> = ({
  status,
  canSubmit,
  onRegister,
  isConnected,
}) => {
  const handleClick = useCallback(() => {
    onRegister();
  }, [onRegister]);

  const isRegistering = status === 'registering';
  const isUnavailable = status === 'unavailable';
  const isRegistered = status === 'registered';
  const isAvailable = status === 'available';
  const isDisabled = !canSubmit || isRegistering || isUnavailable || isRegistered;

  const getButtonContent = () => {
    if (isRegistering) {
      return (
        <>
          <motion.div
            className='h-5 w-5 border-2 border-white/40 border-t-white rounded-full'
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <span className="font-mono">EXECUTING...</span>
        </>
      );
    }

    if (isRegistered) {
      return (
        <>
          <FiCheck className='h-5 w-5' />
          <span className="font-mono">DOMAIN SECURED</span>
        </>
      );
    }

    if (isUnavailable) {
      return (
        <>
          <FiX className='h-5 w-5' />
          <span className="font-mono">UNAVAILABLE</span>
        </>
      );
    }

    if (!isConnected) {
      return (
        <>
          <FiLock className='h-5 w-5' />
          <span className="font-mono">CONNECT WALLET</span>
        </>
      );
    }

    if (isAvailable) {
      return (
        <>
          <FiZap className='h-5 w-5' />
          <span className="font-mono">REGISTER DOMAIN</span>
        </>
      );
    }

    return (
      <>
        <FiSearch className='h-5 w-5' />
        <span className="font-mono">ENTER DOMAIN</span>
      </>
    );
  };

  const getButtonStyle = () => {
    if (isRegistered) {
      return 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 border-green-400/50 text-white';
    }
    if (isUnavailable) {
      return 'bg-gradient-to-r from-gray-700 to-gray-600 border-gray-500/50 text-gray-300 cursor-not-allowed';
    }
    if (!isConnected) {
      return 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-blue-400/50 text-white';
    }
    if (isAvailable) {
      return 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 border-green-400/50 text-white shadow-lg shadow-green-500/20';
    }
    return 'bg-gradient-to-r from-gray-700 to-gray-600 border-gray-500/50 text-gray-400 cursor-not-allowed';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <motion.button
        type='button'
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          'w-full flex items-center justify-center gap-3 px-8 py-4 rounded-lg border-2 font-bold text-lg transition-all duration-300 backdrop-blur-sm',
          getButtonStyle(),
          !isDisabled && 'hover:scale-[1.02] hover:shadow-xl'
        )}
        whileHover={!isDisabled ? { scale: 1.02 } : {}}
        whileTap={!isDisabled ? { scale: 0.98 } : {}}
        aria-label={isConnected ? 'Register domain' : 'Connect wallet'}
      >
        {getButtonContent()}
      </motion.button>
    </motion.div>
  );
};

const SuccessBanner: React.FC = () => (
  <div className="bg-gradient-to-br from-green-900/90 via-gray-900/95 to-green-900/90 border border-green-400/50 rounded-2xl shadow-2xl backdrop-blur-sm hover:scale-[1.02] transition-all duration-700">
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: "spring" }}
      className='px-8 py-10 text-center'
    >
      {/* Animated Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 200 }}
        className='mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-400 text-white shadow-lg shadow-green-500/30 mb-6'
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 2, delay: 0.5 }}
        >
          <FiCheck className='h-8 w-8' />
        </motion.div>
      </motion.div>

      {/* Success Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-4"
      >
        <Typography
          variant='h3'
          className='font-mono font-black text-green-400 text-2xl lg:text-3xl'
          noMargin
        >
          DOMAIN_SECURED
        </Typography>

        <div className="space-y-2">
          <Typography
            variant='caption'
            className='font-mono text-sm text-green-300/80 uppercase tracking-wider'
            noMargin
          >
            // Status: Active
          </Typography>
          <Typography
            variant='body1'
            className='text-gray-300 leading-relaxed'
            noMargin
          >
            Your <span className="text-green-400 font-mono">.bit</span> identity is now on-chain and ready for configuration.
          </Typography>
        </div>

        {/* Animated progress bars */}
        <div className="space-y-2 mt-6">
          <div className="flex justify-between text-xs text-green-400 font-mono">
            <span>Identity Setup</span>
            <span>100%</span>
          </div>
          <motion.div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, delay: 0.8, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Particle effects */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 8 }).map((_, index) => (
          <motion.div
            key={index}
            className="absolute w-1 h-1 bg-green-400 rounded-full"
            initial={{
              x: "50%",
              y: "50%",
              opacity: 0,
            }}
            animate={{
              x: `${50 + (Math.cos(index * 45 * Math.PI / 180) * 50)}%`,
              y: `${50 + (Math.sin(index * 45 * Math.PI / 180) * 50)}%`,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              delay: 1 + index * 0.1,
              ease: "easeOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  </div>
);

export const BitDomainRegistration: React.FC = () => {
  const isConnected = useWalletStore((state) => state.isConnected);
  const network = useWalletStore((state) => state.network);
  const connect = useWalletStore((state) => state.connect);
  const accountId = useWalletStore((state) => state.accountId);
  const walletService = useWalletStore((state) => state.service);

  const [domainInput, setDomainInput] = useState('');
  const [status, setStatus] = useState<DomainStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [pricing, setPricing] = useState<DomainPricing | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [copied, setCopied] = useState(false);

  const kns = useMemo(() => new KNS({ network: network === 'mainnet' ? 'mainnet' : 'testnet' }), [network]);
  const latestQueryRef = useRef<string>('');

  useEffect(() => {
    let isActive = true;

    const applySigner = async () => {
      if (!isConnected) {
        return;
      }
      const signer = await walletService.getSigner();
      if (signer && isActive) {
        kns.setSigner(signer);
      }
    };

    void applySigner();

    return () => {
      isActive = false;
    };
  }, [accountId, isConnected, kns, walletService, network]);

  const checkAvailability = useCallback(
    async (value: string) => {
      latestQueryRef.current = value;
      setStatus('checking');
      setErrorMessage('');
      setPricing(null);

      try {
        await kns.getName(`${value}.bit`);
        if (latestQueryRef.current === value) {
          setStatus('unavailable');
        }
      } catch (cause) {
        if (latestQueryRef.current !== value) {
          return;
        }
        if (isNameNotFoundError(cause)) {
          try {
            const [usd, hbarRaw] = await Promise.all([
              kns.getRegisterPriceUsd(`${value}.bit`),
              kns.getRegisterPriceHbar(`${value}.bit`),
            ]);
            if (latestQueryRef.current !== value) {
              return;
            }
            setPricing({
              usd: Number(usd),
              hbar: parseHbarValue(hbarRaw),
            });
            setStatus('available');
          } catch {
            setErrorMessage('Unable to fetch pricing. Try again shortly.');
            setStatus('error');
          }
          return;
        }
        setErrorMessage('Unable to verify domain availability.');
        setStatus('error');
      }
    },
    [kns]
  );

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.trim().toLowerCase();
    setDomainInput(nextValue);
    setErrorMessage('');
    if (!nextValue) {
      setStatus('idle');
      setPricing(null);
      latestQueryRef.current = '';
      return;
    }
    setStatus('checking');
  }, []);

  useEffect(() => {
    if (!domainInput) {
      return;
    }
    const timer = window.setTimeout(() => {
      void checkAvailability(domainInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [domainInput, checkAvailability]);

  const handleRegister = useCallback(async () => {
    if (!domainInput || status !== 'available') {
      return;
    }
    setErrorMessage('');
    if (!isConnected) {
      await connect();
      return;
    }
    try {
      setStatus('registering');
      setShowTerminal(true);
      const signer = await walletService.getSigner();
      if (!signer) {
        setErrorMessage('Wallet signer unavailable. Reconnect and try again.');
        setStatus('error');
        return;
      }
      kns.setSigner(signer);
      await kns.registerName(`${domainInput}.hh`, { years: 1 });
      setStatus('registered');
    } catch {
      setErrorMessage('Domain registration failed. Please retry.');
      setStatus('error');
    }
  }, [connect, domainInput, isConnected, kns, status, walletService]);

  const handleSuggestionSelect = useCallback(
    (value: string) => {
      if (!value) {
        return;
      }
      latestQueryRef.current = value;
      setDomainInput(value);
      setErrorMessage('');
      setPricing(null);
      setStatus('checking');
      void checkAvailability(value);
    },
    [checkAvailability]
  );

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(`register ${domainInput}.bit --network=${network}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full h-full overflow-auto">
      {/* Animated Background - Using shell theme colors */}
      <div className="fixed inset-0 w-full h-full">
        <AnimatedBackground
          variant="blobs"
          colors={['blue-500', 'purple-500', 'green-500']}
          intensity="high"
          opacity={0.08}
        />
      </div>

      {/* Hashgraph Consensus Network Background */}
      <div className="fixed inset-0 w-full h-full opacity-5">
        <HashgraphConsensus animated={true} />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.03)_0%,transparent_65%)]" />

      {/* Main Content - Scrollable container */}
      <div className="relative w-full min-h-screen z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start lg:items-center min-h-screen p-8 lg:p-16 pb-20 max-w-none">

          {/* Left Side - Hero Content */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className="space-y-6">
              <div className="text-xs font-mono text-green-600 dark:text-green-400 uppercase tracking-[0.3em] mb-4">
                <span className="text-slate-500 dark:text-gray-400">//</span> IDENTITY_PROTOCOL
              </div>

              <Typography
                variant="h1"
                className="text-4xl lg:text-5xl xl:text-6xl font-mono font-black leading-tight tracking-tight text-slate-900 dark:text-white"
              >
                claim your{' '}
                <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 bg-clip-text text-transparent">
                  .bit
                </span>
                <br />
                <span className="text-slate-700 dark:text-gray-300">identity_</span>
              </Typography>

              <Typography
                variant="body1"
                color="muted"
                className="text-lg lg:text-xl leading-relaxed max-w-2xl text-slate-600 dark:text-gray-300"
              >
                Your membership handle for the{' '}
                <Typography
                  variant="body1"
                  as="span"
                  className="text-green-600 dark:text-green-400 font-semibold font-mono"
                >
                  Hashgraph Online
                </Typography>
                {' '}ecosystem. Unlock exclusive access and features.
              </Typography>
            </div>

            {/* Terminal-Style Search Interface */}
            <div className="bg-white/95 dark:bg-gray-900/95 border border-green-500/30 dark:border-green-400/30 shadow-2xl rounded-2xl backdrop-blur-sm transition-all duration-300 hover:shadow-3xl hover:border-green-500/50 dark:hover:border-green-400/50">
              <div className="p-6 space-y-4">
                {/* Terminal Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse delay-100" />
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse delay-200" />
                  </div>
                  <Typography
                    variant="caption"
                    className="text-sm font-mono text-slate-600 dark:text-gray-300 flex-1 text-center"
                  >
                    bit-domain-registrar.sh
                  </Typography>
                  <FiCode className="text-slate-500 dark:text-gray-400" />
                </div>

                {/* Search Input */}
                <div className="space-y-3">
                  <div className="text-xs font-mono text-slate-500 dark:text-gray-400 uppercase tracking-wide">
                    $ search --domain .bit --network {network}
                  </div>

                  <div className="relative">
                    <div className="flex items-center gap-3 bg-slate-100 dark:bg-black/50 rounded-lg border border-slate-300 dark:border-gray-700/50 px-4 py-3 focus-within:border-green-500 dark:focus-within:border-green-400/50 transition-colors">
                      <FiSearch className="text-green-600 dark:text-green-400 h-5 w-5" />
                      <Input
                        value={domainInput}
                        onChange={handleInputChange}
                        placeholder="enter-domain-name"
                        className="flex-1 bg-transparent border-0 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-gray-500 font-mono text-lg focus-visible:ring-0"
                      />
                      <div className="text-slate-500 dark:text-gray-400 font-mono text-lg font-medium">
                        .bit
                      </div>
                    </div>

                    {/* Typing Indicator */}
                    {status === 'checking' && (
                      <motion.div
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-green-600 dark:bg-green-400 rounded-full" />
                          <div className="w-1 h-1 bg-green-600 dark:bg-green-400 rounded-full" />
                          <div className="w-1 h-1 bg-green-600 dark:bg-green-400 rounded-full" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Status Display */}
                <AvailabilityBadge status={status} error={errorMessage} pricing={pricing} />

                {/* Quick Suggestions */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-slate-500 dark:text-gray-400">
                    // Quick suggestions:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SUGGESTIONS.map((suggestion) => (
                      <motion.button
                        key={suggestion}
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className="px-3 py-1 bg-slate-200 dark:bg-gray-800/50 hover:bg-slate-300 dark:hover:bg-gray-700/50 border border-slate-300 dark:border-gray-600/30 rounded-md text-sm font-mono text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {suggestion}.bit
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <RegisterButton
              status={status}
              onRegister={handleRegister}
              canSubmit={Boolean(domainInput)}
              isConnected={isConnected}
            />
          </motion.div>

          {/* Right Side - Visual Effects & Info */}
          <motion.div
            className="space-y-8 lg:sticky lg:top-8"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Success Banner */}
            {status === 'registered' && <SuccessBanner />}

            {/* Terminal Output */}
            <AnimatePresence>
              {(showTerminal || status === 'registering' || status === 'registered') && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative"
                >
                  <Terminal title="bit-registrar.log">
                    <Terminal.Line
                      command={`register ${domainInput}.bit --network=${network}`}
                      clickable
                      onClick={handleCopyCommand}
                    />
                    {status === 'registering' && (
                      <>
                        <Terminal.Line output="Connecting to wallet..." type="output" />
                        <Terminal.Line output="Preparing HCS transaction..." type="output" />
                        <Terminal.Line output="Submitting to Hedera Hashgraph..." type="output" />
                      </>
                    )}
                    {status === 'registered' && (
                      <>
                        <Terminal.Line output="Domain registered successfully!" type="output" />
                        <Terminal.Line output={`${domainInput}.bit is now yours`} type="output" />
                        <Terminal.Line output="// Ready to configure your identity" type="comment" />
                      </>
                    )}
                  </Terminal>

                  <AnimatePresence>
                    {copied && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-md text-sm font-medium shadow-lg"
                      >
                        Copied!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Feature Cards */}
            <div className="grid gap-6">
              {SETUP_STEPS.map((step, index) => (
                <TransformCard
                  key={step.title}
                  rotation={index % 2 === 0 ? "rotate-[0.5deg]" : "rotate-[-0.5deg]"}
                  background="bg-white/95 dark:bg-gray-900/80"
                  border="border border-slate-200 dark:border-gray-700/50"
                  shadow="lg"
                  className="p-6 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white font-mono font-bold text-sm">
                        {index + 1}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Typography
                        variant="body2"
                        className="font-semibold text-slate-900 dark:text-white font-mono"
                        noMargin
                      >
                        {step.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        className="text-slate-600 dark:text-gray-400 leading-relaxed"
                      >
                        {step.detail}
                      </Typography>
                    </div>
                    <div className="flex-shrink-0">
                      {index === 0 && <FiShield className="text-blue-500 dark:text-blue-400 w-5 h-5" />}
                      {index === 1 && <FiZap className="text-yellow-500 dark:text-yellow-400 w-5 h-5" />}
                      {index === 2 && <FiGlobe className="text-green-500 dark:text-green-400 w-5 h-5" />}
                    </div>
                  </div>
                </TransformCard>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const isNameNotFoundError = (cause: unknown): boolean => {
  if (cause instanceof Error && cause.name === 'NameNotFoundError') {
    return true;
  }
  if (cause && typeof cause === 'object' && 'name' in cause) {
    const { name } = cause as { name: unknown };
    return name === 'NameNotFoundError';
  }
  return false;
};
