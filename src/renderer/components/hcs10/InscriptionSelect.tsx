import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import Typography from '../ui/Typography';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Upload, X, Image as ImageIcon, FileWarning } from 'lucide-react';
import { cn } from '../../lib/utils';

interface InscriptionSelectProps {
  onChange: (hcsUrl: string) => void;
  formData?: string | null;
  introMessage: string;
  warningMessage: string;
  network: string;
  messageEnabled: boolean;
  uploadMessage?: string;
}

/**
 * InscriptionSelect component for selecting HCS-11 inscribed files
 * Simplified version for the conversational agent app
 */
export function InscriptionSelect({
  onChange,
  formData,
  introMessage,
  warningMessage,
  network = 'testnet',
  messageEnabled = true,
  uploadMessage,
}: InscriptionSelectProps) {
  const [manualTopicId, setManualTopicId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ACCEPTED_FORMATS = {
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
  };

  /**
   * Handle manual topic ID submission
   */
  const handleManualTopicIdSubmit = useCallback(() => {
    if (manualTopicId.trim()) {
      const formattedUrl = manualTopicId.startsWith('hcs://1/')
        ? manualTopicId
        : `hcs://1/${manualTopicId}`;
      onChange(formattedUrl);
      setManualTopicId('');
    }
  }, [manualTopicId, onChange]);

  /**
   * Handle file selection for upload
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadError(null);

      if (file.size > MAX_FILE_SIZE) {
        setUploadError('Image size must be less than 5MB');
        return;
      }

      if (!Object.keys(ACCEPTED_FORMATS).includes(file.type)) {
        setUploadError(
          'Please select a valid image file (PNG, JPG, GIF, or WebP)'
        );
        return;
      }

      setSelectedFile(file);
      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) {
          setUploadError('Failed to read file data');
          setIsUploading(false);
          return;
        }
        onChange(dataUrl);
        setIsUploading(false);
        setUploadError(null);
      };
      reader.onerror = () => {
        setUploadError('Failed to read file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  /**
   * Handle inscribe button click
   */
  const handleInscribeClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handle file deletion
   */
  const handleDeleteFile = useCallback(() => {
    onChange('');
    setSelectedFile(null);
    setUploadError(null);
  }, [onChange]);

  const isExistingPfp = formData && formData.startsWith('hcs://1/');
  const isDataUrl = formData && formData.startsWith('data:');
  const pfpTopicId = isExistingPfp ? formData.replace('hcs://1/', '') : '';

  return (
    <div className='space-y-4'>
      <Typography variant='body2' className='text-sm text-muted-foreground'>
        {introMessage}
      </Typography>

      <div className='flex gap-2'>
        <div className='flex-1'>
          <Input
            placeholder='Enter Topic ID (e.g., 0.0.12345)'
            value={manualTopicId}
            onChange={(e) => setManualTopicId(e.target.value)}
            className='w-full'
          />
        </div>
        <Button
          type='button'
          onClick={handleManualTopicIdSubmit}
          disabled={!manualTopicId.trim()}
          className='whitespace-nowrap'
        >
          Use Topic ID
        </Button>
      </div>

      <div className='flex gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={handleInscribeClick}
          disabled={isUploading}
          className='flex items-center gap-2'
        >
          <Upload className='h-4 w-4' />
          {isUploading ? 'Uploading...' : uploadMessage || 'Upload New Image'}
        </Button>
        <input
          type='file'
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept='image/*'
          style={{ display: 'none' }}
        />
      </div>

      {!formData && messageEnabled && (
        <Alert variant='destructive'>
          <FileWarning className='h-4 w-4' />
          <AlertTitle>No File Selected</AlertTitle>
          <AlertDescription>{warningMessage}</AlertDescription>
        </Alert>
      )}

      {uploadError && (
        <Alert variant='destructive'>
          <FileWarning className='h-4 w-4' />
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {formData && formData !== '' ? (
        <div className='mt-4'>
          <div className='relative group max-w-64'>
            <div className='relative w-32 h-32 rounded-lg overflow-hidden border-2 border-border bg-muted'>
              {isDataUrl ? (
                <>
                  <img
                    src={formData}
                    alt='Profile'
                    className='w-full h-full object-cover'
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement?.classList.add(
                        'bg-muted',
                        'flex',
                        'items-center',
                        'justify-center'
                      );
                      if (target.parentElement) {
                        target.parentElement.innerHTML =
                          '<div class="text-muted-foreground text-xs">Failed to load image</div>';
                      }
                    }}
                  />
                  <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                    {isUploading && (
                      <div className='bg-black/50 text-white text-xs px-2 py-1 rounded'>
                        Processing...
                      </div>
                    )}
                  </div>
                </>
              ) : pfpTopicId ? (
                <img
                  src={`https://kiloscribe.com/api/inscription-cdn/${pfpTopicId}?network=${network}`}
                  alt='Profile'
                  className='w-full h-full object-cover'
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement?.classList.add(
                      'bg-muted',
                      'flex',
                      'items-center',
                      'justify-center'
                    );
                    if (target.parentElement) {
                      target.parentElement.innerHTML =
                        '<div class="text-muted-foreground text-xs">Image not found</div>';
                    }
                  }}
                />
              ) : (
                <div className='w-full h-full bg-muted flex items-center justify-center'>
                  <ImageIcon className='h-8 w-8 text-muted-foreground' />
                </div>
              )}
              <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={handleDeleteFile}
                  className='text-white hover:text-white hover:bg-white/20'
                >
                  <X className='h-4 w-4 mr-1' />
                  Remove
                </Button>
              </div>
            </div>
            <div className='mt-2'>
              <Typography
                variant='caption'
                className='text-xs text-muted-foreground'
              >
                {selectedFile
                  ? `Selected: ${selectedFile.name} (${(
                      selectedFile.size / 1024
                    ).toFixed(1)}KB)`
                  : isDataUrl
                  ? 'New image (will be inscribed on registration)'
                  : `Topic: ${pfpTopicId || 'Unknown'}`}
              </Typography>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
