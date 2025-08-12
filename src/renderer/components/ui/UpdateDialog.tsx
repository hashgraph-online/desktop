import React, { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { FiDownload, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiExternalLink, FiClock, FiTag } from 'react-icons/fi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './Button';
import Typography from './Typography';
import { Badge } from './badge';
import { cn } from '../../lib/utils';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateState: 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available' | null;
  updateInfo?: UpdateInfo;
  progress?: UpdateProgress;
  error?: { message: string; stack?: string };
  currentVersion?: string;
  onDownload?: () => void;
  onInstall?: () => void;
  onViewReleases?: () => void;
  onCheckForUpdates?: () => void;
}

/**
 * Detailed update dialog component for managing app updates
 */
export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  open,
  onOpenChange,
  updateState,
  updateInfo,
  progress,
  error,
  currentVersion = '1.0.0',
  onDownload,
  onInstall,
  onViewReleases,
  onCheckForUpdates
}) => {
  const [showFullNotes, setShowFullNotes] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const formatReleaseDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'PPP');
    } catch {
      return dateString;
    }
  };

  const getStateIcon = () => {
    switch (updateState) {
      case 'checking':
        return <FiRefreshCw className="w-6 h-6 text-blue-500 animate-spin" />;
      case 'available':
        return <FiDownload className="w-6 h-6 text-green-500" />;
      case 'downloading':
        return <FiDownload className="w-6 h-6 text-blue-500 animate-pulse" />;
      case 'downloaded':
        return <FiCheckCircle className="w-6 h-6 text-green-500" />;
      case 'error':
        return <FiAlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <FiRefreshCw className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStateTitle = () => {
    switch (updateState) {
      case 'checking':
        return 'Checking for Updates';
      case 'available':
        return 'Update Available';
      case 'downloading':
        return 'Downloading Update';
      case 'downloaded':
        return 'Ready to Install';
      case 'error':
        return 'Update Error';
      case 'not-available':
        return 'You\'re Up to Date';
      default:
        return 'App Updates';
    }
  };

  const getStateDescription = () => {
    switch (updateState) {
      case 'checking':
        return 'Checking for the latest version...';
      case 'available':
        return `Version ${updateInfo?.version} is available for download.`;
      case 'downloading':
        return 'Downloading the latest update. This may take a few minutes.';
      case 'downloaded':
        return 'The update has been downloaded and is ready to install.';
      case 'error':
        return error?.message || 'An error occurred while checking for updates.';
      case 'not-available':
        return `You're running the latest version (v${currentVersion}).`;
      default:
        return 'Manage application updates and view release information.';
    }
  };

  const truncateText = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            {getStateIcon()}
            <div>
              <DialogTitle>{getStateTitle()}</DialogTitle>
              <DialogDescription className="mt-1">
                {getStateDescription()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <FiTag className="w-4 h-4 text-gray-500" />
              <div>
                <Typography variant="body2" className="font-medium">Current Version</Typography>
                <Typography variant="caption" color="secondary">v{currentVersion}</Typography>
              </div>
            </div>
            {updateInfo && (
              <div className="text-right">
                <Typography variant="body2" className="font-medium">Latest Version</Typography>
                <div className="flex items-center space-x-2">
                  <Typography variant="caption" color="secondary">v{updateInfo.version}</Typography>
                  <Badge variant="secondary" className="text-xs">New</Badge>
                </div>
              </div>
            )}
          </div>


          {updateInfo && updateState === 'available' && (
            <div className="p-3 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <FiClock className="w-4 h-4 text-gray-500" />
                <Typography variant="body2" className="font-medium">
                  Released on {formatReleaseDate(updateInfo.releaseDate)}
                </Typography>
              </div>
              
              {updateInfo.releaseNotes && (
                <div>
                  <Typography variant="caption" color="secondary" className="block mb-2">
                    Release Notes:
                  </Typography>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <Typography variant="caption" className="whitespace-pre-wrap">
                      {showFullNotes 
                        ? updateInfo.releaseNotes 
                        : truncateText(updateInfo.releaseNotes)
                      }
                    </Typography>
                    {updateInfo.releaseNotes.length > 200 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFullNotes(!showFullNotes)}
                        className="mt-2 text-xs p-0 h-auto"
                      >
                        {showFullNotes ? 'Show less' : 'Show more'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


          {updateState === 'downloading' && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatSpeed(progress.bytesPerSecond)}</span>
                <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
              </div>
            </div>
          )}


          {updateState === 'error' && error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <Typography variant="body2" className="font-medium text-red-800 dark:text-red-200 mb-1">
                Error Details
              </Typography>
              <Typography variant="caption" className="text-red-600 dark:text-red-300">
                {error.message}
              </Typography>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center space-x-2 w-full">
            {onViewReleases && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewReleases}
                className="mr-auto"
              >
                <FiExternalLink className="w-4 h-4 mr-2" />
                View All Releases
              </Button>
            )}

            {updateState === 'not-available' && onCheckForUpdates && (
              <Button variant="outline" onClick={onCheckForUpdates}>
                <FiRefreshCw className="w-4 h-4 mr-2" />
                Check Again
              </Button>
            )}

            {updateState === 'available' && onDownload && (
              <Button variant="default" onClick={onDownload}>
                <FiDownload className="w-4 h-4 mr-2" />
                Download Update
              </Button>
            )}

            {updateState === 'downloaded' && onInstall && (
              <Button variant="gradient" onClick={onInstall}>
                <FiRefreshCw className="w-4 h-4 mr-2" />
                Install & Restart
              </Button>
            )}

            {updateState === 'error' && onCheckForUpdates && (
              <Button variant="outline" onClick={onCheckForUpdates}>
                <FiRefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};