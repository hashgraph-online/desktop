import React from 'react';
import Typography from '../../ui/Typography';
import { cn } from '../../../lib/utils';
import { useWalletStore } from '../../../stores/walletStore';
import type { ChatSession } from '../../../../main/db/schema';
import {
  FiPlus,
  FiTrash2,
  FiClock,
  FiWifi,
  FiWifiOff,
  FiShield,
  FiUser,
  FiUsers,
  FiChevronDown,
} from 'react-icons/fi';

/**
 * Top header with session selector and network indicators.
 */
export type ChatHeaderProps = {
  mode: 'personal' | 'hcs10';
  isConnected: boolean;
  statusText: string;
  networkLabel: string;
  accountSuffix: string;
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  isLoadingSessions: boolean;
  isSelectorOpen: boolean;
  onToggleSelector: () => void;
  onCreateSession: () => void;
  onSelectSession: (session: ChatSession) => void;
  onRequestDeleteSession: (sessionId: string) => void;
};

function getDisplayInfo(
  session: ChatSession,
  currentSession: ChatSession | null
) {
  const isHcs = session.mode === 'hcs10';
  const name = session.name;
  const subtitle = isHcs ? `HCS-10: ${session.topicId}` : 'Personal Assistant';
  const isActive = currentSession ? currentSession.id === session.id : false;
  const lastUsed = (session.lastMessageAt || session.updatedAt) as Date;
  return { name, subtitle, isHcs, isActive, lastUsed };
}

export default function ChatHeader(props: ChatHeaderProps) {
  const {
    mode,
    isConnected,
    statusText,
    networkLabel,
    accountSuffix,
    sessions,
    currentSession,
    isLoadingSessions,
    isSelectorOpen,
    onToggleSelector,
    onCreateSession,
    onSelectSession,
    onRequestDeleteSession,
  } = props;

  return (
    <header className='h-14 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/30 dark:border-gray-800/30 flex items-center px-3 sm:px-4 lg:px-6 relative z-20 shadow-sm shadow-gray-200/10 dark:shadow-gray-900/20'>
      <div className='w-full flex items-center justify-between gap-6'>
        <div className='flex items-center gap-3 sm:gap-4 flex-shrink-0'>
          <div className='relative'>
            <button
              onClick={onToggleSelector}
              className='flex items-center gap-3 px-3 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-200'
              disabled={isLoadingSessions}
            >
              <div className='flex items-center gap-2'>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    mode === 'personal' ? 'bg-blue-500' : 'bg-purple-500'
                  )}
                />
                {mode === 'personal' ? (
                  <FiUser className='w-4 h-4 text-blue-500 dark:text-blue-300' />
                ) : (
                  <FiUsers className='w-4 h-4 text-purple-600 dark:text-purple-400' />
                )}
              </div>
              <div className='flex flex-col items-start min-w-0'>
                <Typography
                  variant='caption'
                  className={cn(
                    'text-xs font-medium leading-none',
                    mode === 'personal'
                      ? 'text-blue-600 dark:text-blue-200'
                      : 'text-purple-700 dark:text-purple-300'
                  )}
                >
                  {mode === 'personal' ? 'Personal' : 'HCS-10'}
                </Typography>
                <Typography
                  variant='caption'
                  className='font-semibold text-gray-900 dark:text-gray-100 max-w-[140px] truncate mt-0.5 leading-none'
                >
                  {currentSession
                    ? currentSession.name
                    : mode === 'personal'
                      ? 'No session selected'
                      : 'No agent selected'}
                </Typography>
              </div>
              <FiChevronDown className='w-3 h-3 text-gray-500 flex-shrink-0' />
            </button>
            {isSelectorOpen ? (
              <>
                <div
                  className='fixed inset-0 z-60'
                  onClick={onToggleSelector}
                />
                <div className='absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl z-70 py-1 max-h-96 overflow-y-auto'>
                  <button
                    onClick={onCreateSession}
                    className='w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700'
                  >
                    <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center'>
                      <FiPlus className='w-4 h-4 text-white' />
                    </div>
                    <div className='flex-1 text-left'>
                      <Typography variant='caption' className='font-medium'>
                        New Session
                      </Typography>
                      <Typography
                        variant='caption'
                        className='text-gray-500 dark:text-gray-400 text-xs block'
                      >
                        Create a new chat session
                      </Typography>
                    </div>
                  </button>
                  {sessions.length > 0 ? (
                    <>
                      {['personal', 'hcs10'].map((group) => {
                        const groupSessions = sessions
                          .filter(
                            (s) => s.mode === (group as 'personal' | 'hcs10')
                          )
                          .sort(
                            (a, b) =>
                              new Date(
                                (b.lastMessageAt || b.updatedAt) as Date
                              ).getTime() -
                              new Date(
                                (a.lastMessageAt || a.updatedAt) as Date
                              ).getTime()
                          );
                        if (groupSessions.length === 0) return null;
                        return (
                          <div key={group} className='mb-2'>
                            <div className='px-3 py-1 mt-1'>
                              <Typography
                                variant='caption'
                                className='text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider'
                              >
                                {group === 'personal'
                                  ? 'Personal Sessions'
                                  : 'HCS-10 Sessions'}
                              </Typography>
                            </div>
                            {groupSessions.map((session) => {
                              const d = getDisplayInfo(session, currentSession);
                              const iconBg = d.isHcs
                                ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                                : 'bg-gradient-to-br from-blue-500 to-blue-600';
                              return (
                                <div
                                  key={session.id}
                                  className='relative group'
                                >
                                  <button
                                    onClick={() => onSelectSession(session)}
                                    className={cn(
                                      'w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                                      d.isActive &&
                                        'bg-blue-50 dark:bg-blue-950/50'
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center',
                                        iconBg
                                      )}
                                    >
                                      {d.isHcs ? (
                                        <FiUsers className='w-4 h-4 text-white' />
                                      ) : (
                                        <FiUser className='w-4 h-4 text-white' />
                                      )}
                                    </div>
                                    <div className='flex-1 text-left min-w-0'>
                                      <Typography
                                        variant='caption'
                                        className='font-medium truncate'
                                      >
                                        {d.name}
                                      </Typography>
                                      <div className='flex items-center gap-2'>
                                        <Typography
                                          variant='caption'
                                          className='text-gray-500 dark:text-gray-400 text-xs truncate'
                                        >
                                          {d.subtitle}
                                        </Typography>
                                        <Typography
                                          variant='caption'
                                          className='text-gray-400 dark:text-gray-500 text-xs'
                                        >
                                          <FiClock className='w-3 h-3 inline mr-1' />
                                          {new Date(
                                            d.lastUsed
                                          ).toLocaleDateString()}
                                        </Typography>
                                      </div>
                                    </div>
                                    {d.isActive ? (
                                      <div className='w-2 h-2 bg-blue-500 rounded-full' />
                                    ) : null}
                                  </button>
                                  <button
                                    onClick={() =>
                                      onRequestDeleteSession(session.id)
                                    }
                                    className='absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-all'
                                  >
                                    <FiTrash2 className='w-3 h-3 text-red-500' />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className='px-3 py-4 text-center'>
                      <Typography
                        variant='caption'
                        className='text-gray-500 dark:text-gray-400'
                      >
                        No sessions yet. Create your first session!
                      </Typography>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className='flex items-center gap-3 sm:gap-4 flex-shrink-0'>
          <div className='flex items-center gap-2 px-2.5 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm text-sm'>
            {isConnected ? (
              <FiWifi className='w-4 h-4 text-hgo-green' />
            ) : (
              <FiWifiOff className='w-4 h-4 text-gray-400' />
            )}
            <Typography
              variant='caption'
              className='font-semibold hidden sm:inline'
            >
              {networkLabel}
            </Typography>
          </div>
          {(() => {
            const s = useWalletStore.getState();
            const label = s.isConnected
              ? `${s.network} · ${s.accountId?.slice(-6) || '—'}`
              : 'Disconnected';
            return (
              <div className='hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm text-sm'>
                <FiShield className={s.isConnected ? 'w-4 h-4 text-hgo-purple' : 'w-4 h-4 text-gray-400'} />
                <Typography variant='caption' className='font-semibold'>
                  {label}
                </Typography>
              </div>
            );
          })()}
          <div className='hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-lg border border-gray-200/40 dark:border-gray-700/40 shadow-sm text-sm'>
            <FiShield className='w-4 h-4 text-hgo-purple' />
            <Typography variant='caption' className='font-semibold'>
              {accountSuffix}
            </Typography>
          </div>
          <div className='flex items-center gap-2'>
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                isConnected ? 'bg-hgo-green' : 'bg-gray-400'
              )}
            />
            <Typography variant='caption' color='muted' className='font-medium'>
              {statusText}
            </Typography>
          </div>
        </div>
      </div>
    </header>
  );
}
