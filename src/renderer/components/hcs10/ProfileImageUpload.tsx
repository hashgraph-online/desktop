import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';

interface ProfileImageUploadProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_FORMATS = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

/**
 * Profile image upload component with drag-and-drop
 */
export function ProfileImageUpload({
  value,
  onChange,
  disabled = false,
}: ProfileImageUploadProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Handle file drop/selection
   */
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploadError(null);

      if (acceptedFiles.length === 0) {
        return;
      }

      const file = acceptedFiles[0];

      if (file.size > MAX_FILE_SIZE) {
        setUploadError('Image size must be less than 5MB');
        return;
      }

      try {
        setIsUploading(true);

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          onChange(base64);
          setIsUploading(false);
        };
        reader.onerror = () => {
          setUploadError('Failed to read image file');
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        setUploadError('Failed to process image');
        setIsUploading(false);
      }
    },
    [onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: 1,
    disabled: disabled || isUploading,
    multiple: false,
  });

  /**
   * Remove uploaded image
   */
  const handleRemove = () => {
    onChange(undefined);
    setUploadError(null);
  };

  return (
    <div className='space-y-2'>
      {value ? (
        <div className='relative group'>
          <div className='relative w-32 h-32 rounded-lg overflow-hidden border-2 border-border'>
            <img
              src={value}
              alt='Profile'
              className='w-full h-full object-cover'
            />
            {!disabled && (
              <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleRemove}
                  className='text-white hover:text-white hover:bg-white/20'
                >
                  <X className='h-4 w-4 mr-1' />
                  Remove
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors',
            isDragActive && 'border-primary bg-primary/5',
            disabled && 'opacity-50 cursor-not-allowed',
            !isDragActive && !disabled && 'hover:border-primary/50'
          )}
        >
          <input {...getInputProps()} />
          <div className='flex flex-col items-center justify-center text-center space-y-2'>
            <div className='p-3 bg-muted rounded-full'>
              {isUploading ? (
                <Loader2 className='h-8 w-8 animate-spin text-primary' />
              ) : (
                <Upload className='h-8 w-8 text-muted-foreground' />
              )}
            </div>
            <div className='space-y-1'>
              <Typography variant='body1' className='font-medium'>
                {isDragActive
                  ? 'Drop image here'
                  : 'Click or drag image to upload'}
              </Typography>
              <Typography
                variant='body2'
                className='text-sm text-muted-foreground'
              >
                PNG, JPG, GIF or WebP up to 5MB
              </Typography>
            </div>
          </div>
        </div>
      )}

      {uploadError && (
        <Typography variant='body2' className='text-sm text-destructive'>
          {uploadError}
        </Typography>
      )}
    </div>
  );
}
