import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Typography from '../ui/Typography';
import { ShellWindow } from './ShellWindow';
import { SHELL_WINDOWS } from './ShellContext';
import { MediaLibrary } from '../media/MediaLibrary';
import { useInscriptionJobs, type InscriptionJob } from '../../hooks/useInscriptionJobs';
import { useConfigStore } from '../../stores/configStore';
import { cn } from '../../lib/utils';

const normalizeTopic = (topic: string): string => {
  return topic.replace(/^hcs:\/\/(1\/)?/i, '').replace(/^1\//, '');
};

const buildHcsUrl = (topic: string): string => {
  const normalized = normalizeTopic(topic);
  return `hcs://1/${normalized}`;
};

const ShellMediaWindow: React.FC = () => {
  const { jobs, loading, error, hasLoaded, loadJobs, network } = useInscriptionJobs();
  const { config } = useConfigStore();
  const isDark = (config?.advanced?.theme ?? 'light') === 'dark';
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLoaded) {
      void loadJobs();
    }
  }, [hasLoaded, loadJobs]);

  useEffect(() => {
    if (!copiedUrl) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopiedUrl(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [copiedUrl]);

  const handleSelect = useCallback(async (job: InscriptionJob) => {
    const topicCandidate = job.topic || job.imageTopic;
    if (!topicCandidate) {
      return;
    }
    const hcsUrl = buildHcsUrl(topicCandidate);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(hcsUrl).catch(() => undefined);
    }
    setCopiedUrl(hcsUrl);
  }, []);


  return (
    <ShellWindow windowKey='media' definition={SHELL_WINDOWS.media} defaultExpanded>
      <div
        className={cn(
          'flex h-full flex-col gap-6 px-6 py-6 transition-colors duration-300',
          isDark ? 'bg-[#050b1a]' : 'bg-gray-100'
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-3 rounded-2xl border px-6 py-5 shadow-md transition-colors duration-300',
            isDark ? 'border-white/10 bg-[#101d3f]' : 'border-gray-200 bg-white'
          )}
        >
          <Typography variant='h4' className={cn('text-xl font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Media Library
          </Typography>
          <Typography variant='body2' className={cn('text-sm', isDark ? 'text-white/80' : 'text-gray-600')}>
            Browse your inscriptions, copy topic IDs, and reuse assets across desktop programs.
          </Typography>
          {copiedUrl ? (
            <Alert
              className={cn(
                'mt-3 max-w-lg border text-sm font-medium break-all',
                isDark
                  ? 'border-orange-400/50 bg-orange-500/20 text-orange-100'
                  : 'border-orange-400 bg-orange-50 text-orange-800'
              )}
            >
              <AlertTitle className='text-xs font-semibold uppercase tracking-wide'>Copied to clipboard</AlertTitle>
              <AlertDescription>{copiedUrl}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <div
          className={cn(
            'flex-1 min-h-0 rounded-2xl border shadow-md transition-colors duration-300',
            isDark ? 'border-white/10 bg-[#0f1b39]' : 'border-gray-200 bg-white'
          )}
        >
          <MediaLibrary
            jobs={jobs}
            isLoading={loading}
            error={error}
            hasLoaded={hasLoaded}
            network={network}
            onRefresh={loadJobs}
            onSelect={handleSelect}
            emptyMessage='No media files available yet. Create inscriptions to see them here.'
            className='h-full'
          />
        </div>
      </div>
    </ShellWindow>
  );
};

export default ShellMediaWindow;
