import React, { useRef } from 'react';
import { Button } from '../ui/Button';
import { FiPaperclip, FiAlertCircle, FiFile, FiX } from 'react-icons/fi';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '../../lib/utils';

/**
 * Chat input composer with attachments and submit controls.
 */
export type ChatComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  connected: boolean;
  submitting: boolean;
  fileError: string | null;
  files: File[];
  onFileAdd: (files: FileList) => void;
  onFileRemove: (index: number) => void;
};

export function ChatComposer(props: ChatComposerProps) {
  const {
    value,
    onChange,
    onSubmit,
    connected,
    submitting,
    fileError,
    files,
    onFileAdd,
    onFileRemove,
  } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
        {fileError ? (
          <Alert className='mb-3 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'>
            <FiAlertCircle className='h-4 w-4 text-orange-600 dark:text-orange-400' />
            <AlertDescription className='text-orange-800 dark:text-orange-200'>
              {fileError}
            </AlertDescription>
          </Alert>
        ) : null}

        {files.length > 0 ? (
          <div className='mb-3 flex flex-wrap gap-2'>
            {files.map((file, index) => (
              <div
                key={index}
                className='inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm'
              >
                <FiFile className='w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0' />
                <span className='truncate max-w-[200px] text-gray-900 dark:text-gray-100 font-medium'>
                  {file.name}
                </span>
                <span className='text-xs text-gray-600 dark:text-gray-400'>
                  {file.size > 1024 * 1024
                    ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                    : `${(file.size / 1024).toFixed(1)}KB`}
                </span>
                <button
                  onClick={() => onFileRemove(index)}
                  className='ml-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
                  aria-label={`Remove ${file.name}`}
                >
                  <FiX className='w-4 h-4' />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className='flex gap-4 items-start'>
          <div className='flex-1 relative'>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder={
                connected
                  ? 'Message your assistant...'
                  : 'Connect to start chatting...'
              }
              disabled={!connected || submitting}
              rows={1}
              className={cn(
                'w-full px-6 py-4 pr-14 rounded-2xl resize-none',
                'min-h-[56px] max-h-[200px]',
                'bg-gray-50/80 dark:bg-gray-800/60 backdrop-blur-md',
                'border border-gray-200/60 dark:border-gray-700/60',
                'focus:outline-none focus:ring-1 focus:ring-blue-500/10 focus:border-gray-300 dark:focus:border-gray-600 focus:bg-white dark:focus:bg-gray-800',
                'placeholder:text-gray-500 dark:placeholder:text-gray-400',
                'text-gray-900 dark:text-white text-base',
                'transition-all duration-300 ease-out',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-lg shadow-gray-200/20 dark:shadow-gray-900/20'
              )}
              style={{
                height: 'auto',
                overflowY: value.split('\n').length > 4 ? 'auto' : 'hidden',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected || submitting}
              variant='ghost'
              size='icon'
              className='absolute right-3 top-3 h-9 w-9 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 rounded-xl transition-colors duration-200'
            >
              <FiPaperclip className='w-4 h-4' />
            </Button>
            <div
              className={cn(
                'absolute bottom-3 right-14 text-xs tabular-nums pointer-events-none font-medium',
                value.length > 1800 && 'text-orange-500',
                value.length > 1950 && 'text-red-500',
                value.length <= 1800 && 'text-gray-400 dark:text-gray-500'
              )}
            >
              {value.length}/2000
            </div>
          </div>
          <Button
            onClick={onSubmit}
            disabled={
              !connected || submitting || (!value.trim() && files.length === 0)
            }
            variant='default'
            size='default'
            className='px-6 py-4 bg-hgo-blue hover:bg-hgo-blue-dark text-white border-0 h-[56px] w-[56px] rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 ease-out flex items-center justify-center'
          >
            →
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type='file'
          multiple
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              onFileAdd(files);
            }

            e.target.value = '';
          }}
          className='hidden'
          accept='*/*'
        />
    </div>
  );
}

export default ChatComposer;
