import { useCallback, useState } from 'react';

export type UseFileAttachmentsResult = {
  files: File[];
  fileError: string | null;
  addFiles: (files: FileList) => void;
  removeFile: (index: number) => void;
  reset: () => void;
  toBase64: (file: File) => Promise<string>;
};

/**
 * Manages chat file attachments with validation and helpers.
 */
export function useFileAttachments(limit: number = 5, maxSizeMb: number = 10): UseFileAttachmentsResult {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const addFiles = useCallback((fileList: FileList) => {
    setFileError(null);
    const tooLarge: string[] = [];
    const accepted: File[] = [];
    const current = files.slice();

    Array.from(fileList).forEach((file) => {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxSizeMb) {
        tooLarge.push(file.name);
        return;
      }
      if (current.length + accepted.length >= limit) {
        return;
      }
      accepted.push(file);
    });

    if (tooLarge.length > 0) {
      setFileError(`File${tooLarge.length > 1 ? 's' : ''} too large (max ${maxSizeMb}MB): ${tooLarge.join(', ')}`);
      setTimeout(() => setFileError(null), 5000);
    }

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
    }
  }, [files, limit, maxSizeMb]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reset = useCallback(() => {
    setFiles([]);
    setFileError(null);
  }, []);

  const toBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {

      if (!file || file.size === 0) {
        reject(new Error('File is empty or unavailable'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result;
          if (typeof result !== 'string' || !result) {
            reject(new Error('Failed to read file as data URL'));
            return;
          }
          
          const base64 = result.split(',')[1];
          if (!base64) {
            reject(new Error('Invalid file format - could not extract base64 data'));
            return;
          }
          
          resolve(base64);
        } catch (error) {
          reject(new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('FileReader error - file may be corrupted or inaccessible'));
      };
      
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      
      try {
        reader.readAsDataURL(file);
      } catch (error) {
        reject(new Error(`Failed to initiate file reading: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }, []);

  return { files, fileError, addFiles, removeFile, reset, toBase64 };
}

export default useFileAttachments;
