import { useCallback } from 'react';
import { Button } from '../../ui/Button';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  connected: boolean;
  submitting: boolean;
  fileError: string | null;
  files: File[];
  onFileAdd: (files: FileList) => void;
  onFileRemove: (index: number) => void;
}

const MoonscapeComposer: React.FC<ComposerProps> = (props) => {
  const { value, onChange, onSubmit, connected, submitting } = props;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );

  return (
    <div className='flex flex-col gap-3 sm:flex-row sm:items-stretch'>
      <div className='flex-1'>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Ask me about this page...'
          disabled={!connected || submitting}
          rows={1}
          className='w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-colors focus:border-purple-500 dark:focus:border-purple-400'
          style={{
            minHeight: '44px',
            maxHeight: '160px',
          }}
        />
      </div>
      <Button
        type='button'
        onClick={onSubmit}
        disabled={submitting || !value.trim() || !connected}
        className='flex-shrink-0 h-[44px] sm:h-auto sm:min-h-[44px] sm:self-stretch px-5 sm:px-6 bg-gradient-to-r from-purple-500 to-orange-500 hover:from-purple-600 hover:to-orange-600 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center'
      >
        Send
      </Button>
    </div>
  );
};

export default MoonscapeComposer;
