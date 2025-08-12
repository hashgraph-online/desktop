import React from 'react';
import { cn } from '../../lib/utils';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { Button } from './Button';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'typescript',
  showLineNumbers = false,
  className,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div className={cn('relative group', className)}>
      <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
        <Button
          variant='ghost'
          size='icon'
          onClick={handleCopy}
          className='h-8 w-8 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
        >
          {copied ? (
            <FiCheck className='w-4 h-4 text-green-400' />
          ) : (
            <FiCopy className='w-4 h-4 text-gray-300' />
          )}
        </Button>
      </div>

      <div className='overflow-x-auto bg-gray-900 dark:bg-gray-950 rounded-lg p-4'>
        {language && (
          <div className='text-xs text-gray-400 mb-2'>{language}</div>
        )}
        <pre className='text-sm'>
          <code className='text-gray-100'>
            {showLineNumbers
              ? lines.map((line, index) => (
                  <div key={index} className='table-row'>
                    <span className='table-cell pr-4 text-gray-500 select-none text-right'>
                      {index + 1}
                    </span>
                    <span className='table-cell'>{line || '\n'}</span>
                  </div>
                ))
              : code}
          </code>
        </pre>
      </div>
    </div>
  );
};
