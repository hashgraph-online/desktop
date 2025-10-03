import React, { useState } from 'react';
import { FiFile, FiImage, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';

interface AttachmentDisplayProps {
  attachments: Array<{
    name: string;
    data: string;
    type: string;
    size: number;
  }>;
  onImageClick?: (imageData: string, imageName: string) => void;
}

/**
 * Component to display message attachments with proper file type handling
 * Supports images with preview and click handling for modal display
 */
const AttachmentDisplay: React.FC<AttachmentDisplayProps> = ({
  attachments,
  onImageClick,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const decodeBase64 = (base64Data: string): string => {
    try {
      return atob(base64Data);
    } catch {
      return base64Data;
    }
  };

  return (
    <div className='mt-3 space-y-2'>
      {attachments.map((attachment, index) => {
        const sizeStr =
          attachment.size > 1024 * 1024
            ? `${(attachment.size / (1024 * 1024)).toFixed(1)}MB`
            : `${(attachment.size / 1024).toFixed(1)}KB`;

        const isImage = attachment.type.startsWith('image/');
        const isJson = attachment.type === 'application/json' || attachment.name.endsWith('.json');
        const isExpanded = expandedIndex === index;

        return (
          <div key={index}>
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700/30',
                (isImage && onImageClick) || isJson
                  ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  : ''
              )}
              onClick={() => {
                if (isImage && onImageClick) {
                  onImageClick(
                    `data:${attachment.type};base64,${attachment.data}`,
                    attachment.name
                  );
                } else if (isJson) {
                  setExpandedIndex(isExpanded ? null : index);
                }
              }}
            >
              <div className='flex-shrink-0'>
                {isImage ? (
                  <FiImage className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                ) : (
                  <FiFile className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                )}
              </div>
              <div className='flex-1 min-w-0'>
                <Typography
                  variant='caption'
                  className='font-medium text-blue-700 dark:text-blue-300 truncate block'
                >
                  {attachment.name}
                </Typography>
                <Typography
                  variant='caption'
                  className='text-gray-500 dark:text-gray-400 text-xs'
                >
                  {sizeStr} • {attachment.type}
                </Typography>
              </div>
              {isImage && (
                <div className='flex-shrink-0 w-12 h-12 rounded overflow-hidden border border-gray-200 dark:border-gray-700'>
                  <img
                    src={`data:${attachment.type};base64,${attachment.data}`}
                    alt={attachment.name}
                    className='w-full h-full object-cover'
                    loading='lazy'
                  />
                </div>
              )}
              {isJson && (
                <div className='flex-shrink-0'>
                  {isExpanded ? (
                    <FiChevronUp className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                  ) : (
                    <FiChevronDown className='w-4 h-4 text-gray-500 dark:text-gray-400' />
                  )}
                </div>
              )}
            </div>
            {isJson && isExpanded && (
              <div className='mt-2 p-3 rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-700'>
                <pre className='text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-words'>
                  {JSON.stringify(JSON.parse(decodeBase64(attachment.data)), null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AttachmentDisplay;
