import type { InscriptionJob } from '../../hooks/useInscriptionJobs';

export type ViewMode = 'icons' | 'list' | 'columns';
export type SortField = 'name' | 'type';
export type SortOrder = 'asc' | 'desc';
export type FilterType = 'all' | 'image' | 'video' | 'audio' | 'text' | 'code' | 'json';

export interface MediaItem {
  id: string;
  topic: string;
  name: string;
  mimeType: string | null;
  type: string | null;
  network: 'mainnet' | 'testnet';
  createdAt: Date | null;
  url: string;
}

export const normalizeTopic = (topic: string): string => {
  return topic.replace(/^hcs:\/\/(1\/)?/i, '').replace(/^1\//, '').trim();
};

export const getMediaType = (mimeType: string | null, filename: string): FilterType => {
  const mime = mimeType?.toLowerCase() ?? '';
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(extension)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension)) {
    return 'audio';
  }
  if (mime === 'application/json' || extension === 'json') {
    return 'json';
  }
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt'];
  if (mime.startsWith('text/') && codeExtensions.includes(extension)) {
    return 'code';
  }
  if (codeExtensions.includes(extension)) {
    return 'code';
  }
  if (mime.startsWith('text/') || ['txt', 'md', 'csv', 'log'].includes(extension)) {
    return 'text';
  }
  return 'all';
};

export const mapToMediaItem = (job: InscriptionJob, network: 'mainnet' | 'testnet'): MediaItem => {
  const topic = normalizeTopic(job.imageTopic || job.topic);
  const displayName = job.name?.trim().length ? job.name : topic || 'Untitled';
  const createdAt = job.createdAt ? new Date(job.createdAt) : null;
  return {
    id: job.id,
    topic,
    name: displayName,
    mimeType: job.mimeType ?? null,
    type: job.type ?? null,
    network,
    createdAt,
    url: `https://kiloscribe.com/api/inscription-cdn/${topic}?network=${network}`,
  };
};
