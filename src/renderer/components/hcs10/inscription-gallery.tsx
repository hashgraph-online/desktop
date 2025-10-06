import React, { useCallback } from 'react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Loader2, FileWarning, Image as ImageIcon } from 'lucide-react';
import type { InscriptionJob } from '../../hooks/useInscriptionJobs';

interface InscriptionGalleryPanelProps {
  title: string;
  jobs: InscriptionJob[];
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  network: 'mainnet' | 'testnet';
  onRefresh: () => void;
  onSelect: (job: InscriptionJob) => void;
  actionLabel?: (job: InscriptionJob) => string;
  emptyMessage?: string;
  className?: string;
}

interface InscriptionGalleryGridProps {
  jobs: InscriptionJob[];
  network: 'mainnet' | 'testnet';
  onSelect: (job: InscriptionJob) => void;
  actionLabel?: (job: InscriptionJob) => string;
}

const resolveDisplayName = (job: InscriptionJob): string => {
  if (job.name && job.name.trim().length > 0) {
    return job.name.trim();
  }
  if (job.topic) {
    return job.topic;
  }
  if (job.imageTopic) {
    return job.imageTopic;
  }
  return 'Stored inscription';
};

export const InscriptionGalleryGrid: React.FC<InscriptionGalleryGridProps> = ({
  jobs,
  network,
  onSelect,
  actionLabel,
}) => {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {jobs.map((job) => {
        const previewTopic = job.imageTopic || job.topic;
        const displayName = resolveDisplayName(job);
        const timestampLabel = job.createdAt ? job.createdAt.toLocaleString() : '';
        const topicDisplay = job.topic || job.imageTopic || '';
        const label = actionLabel ? actionLabel(job) : `Use ${displayName}`;

        return (
          <article
            key={job.id}
            className='flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3 shadow-lg shadow-black/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl'
          >
            <div className='relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-muted'>
              {previewTopic ? (
                <img
                  src={`https://kiloscribe.com/api/inscription-cdn/${previewTopic}?network=${network}`}
                  alt={displayName}
                  className='h-full w-full object-cover'
                />
              ) : (
                <ImageIcon className='h-10 w-10 text-muted-foreground' />
              )}
            </div>
            <div className='space-y-1'>
              <Typography variant='body2' className='font-medium truncate'>
                {displayName}
              </Typography>
              {timestampLabel ? (
                <Typography variant='caption' className='text-muted-foreground'>
                  {timestampLabel}
                </Typography>
              ) : null}
              {topicDisplay ? (
                <Typography variant='caption' className='text-muted-foreground truncate'>
                  {topicDisplay}
                </Typography>
              ) : null}
            </div>
            <Button type='button' variant='outline' onClick={() => onSelect(job)} className='justify-center'>
              {label}
            </Button>
          </article>
        );
      })}
    </div>
  );
};

export const InscriptionGalleryPanel: React.FC<InscriptionGalleryPanelProps> = ({
  title,
  jobs,
  isLoading,
  error,
  hasLoaded,
  network,
  onRefresh,
  onSelect,
  actionLabel,
  emptyMessage = 'No inscriptions found yet.',
  className,
}) => {
  const showEmptyState = hasLoaded && jobs.length === 0 && !isLoading && !error;

  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <section className={className}>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <Typography variant='subtitle1' className='font-semibold'>
          {title}
        </Typography>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={isLoading}
          className='flex items-center gap-2'
        >
          {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

  [...] 
      {error ? (
        <div className='mt-4'>
          <Alert variant='destructive'>
            <FileWarning className='h-4 w-4' />
            <AlertTitle>Unable to load inscriptions</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {isLoading && jobs.length === 0 ? (
        <div className='mt-4 flex items-center gap-2 text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' />
          <Typography variant='body2' className='text-muted-foreground'>
            Loading your inscriptions…
          </Typography>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <div className='mt-4'>
          <InscriptionGalleryGrid
            jobs={jobs}
            network={network}
            onSelect={onSelect}
            actionLabel={actionLabel}
          />
        </div>
      ) : null}

      {showEmptyState ? (
        <Typography variant='body2' className='mt-4 text-muted-foreground'>
          {emptyMessage}
        </Typography>
      ) : null}
    </section>
  );
};

export default InscriptionGalleryPanel;
