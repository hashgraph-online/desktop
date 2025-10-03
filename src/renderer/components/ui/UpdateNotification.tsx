import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiRefreshCw, FiCheckCircle, FiAlertCircle, FiX, FiExternalLink } from 'react-icons/fi';
import { Button } from './Button';
import { Card } from './Card';
import Typography from './Typography';
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

interface UpdateNotificationProps {
  updateState: 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available' | null;
  updateInfo?: UpdateInfo;
  progress?: UpdateProgress;
  error?: { message: string; stack?: string };
  onDownload?: () => void;
  onInstall?: () => void;
  onDismiss?: () => void;
  onViewReleases?: () => void;
  className?: string;
}

/**
 * Update notification component that displays the current update status
 * and provides actions for downloading and installing updates
 */
export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  updateState,
  updateInfo,
  progress,
  error,
  onDownload,
  onInstall,
  onDismiss,
  onViewReleases,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!updateState || updateState === 'not-available') {
    return null;
  }

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

  const getStateIcon = () => {
    switch (updateState) {
      case 'checking':
        return <FiRefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'available':
        return <FiDownload className="w-5 h-5 text-green-500" />;
      case 'downloading':
        return <FiDownload className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'downloaded':
        return <FiCheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <FiAlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStateTitle = () => {
    switch (updateState) {
      case 'checking':
        return 'Checking for updates...';
      case 'available':
        return `Update available: v${updateInfo?.version}`;
      case 'downloading':
        return 'Downloading update...';
      case 'downloaded':
        return 'Update ready to install';
      case 'error':
        return 'Update failed';
      default:
        return '';
    }
  };

  const getStateMessage = () => {
    switch (updateState) {
      case 'checking':
        return 'Please wait while we check for the latest version.';
      case 'available':
        return 'A new version is available. Would you like to download it?';
      case 'downloading':
        return progress 
          ? `${progress.percent}% • ${formatSpeed(progress.bytesPerSecond)} • ${formatBytes(progress.transferred)} of ${formatBytes(progress.total)}`
          : 'Preparing download...';
      case 'downloaded':
        return 'The update has been downloaded and is ready to install. The app will restart to apply the update.';
      case 'error':
        return error?.message || 'An error occurred while checking for updates.';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={cn("fixed top-4 right-4 z-50 max-w-md", className)}
      >
        <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border shadow-xl">
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                {getStateIcon()}
                <div className="flex-1">
                  <Typography variant="body2" className="font-semibold">
                    {getStateTitle()}
                  </Typography>
                  <Typography variant="caption" color="secondary" className="mt-1">
                    {getStateMessage()}
                  </Typography>
                </div>
              </div>
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDismiss}
                  className="h-6 w-6 text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-4 h-4" />
                </Button>
              )}
            </div>


            {updateState === 'downloading' && progress && (
              <div className="mt-3">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}


            {updateInfo?.releaseNotes && updateState === 'available' && (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs"
                >
                  {isExpanded ? 'Hide' : 'Show'} release notes
                </Button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden"
                    >
                      <Typography variant="caption" className="whitespace-pre-wrap">
                        {updateInfo.releaseNotes}
                      </Typography>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}


            <div className="flex items-center justify-end space-x-2 mt-4">
              {onViewReleases && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewReleases}
                  className="text-xs"
                >
                  <FiExternalLink className="w-3 h-3 mr-1" />
                  View Releases
                </Button>
              )}

              {updateState === 'available' && onDownload && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onDownload}
                  className="text-xs"
                >
                  <FiDownload className="w-3 h-3 mr-1" />
                  Download
                </Button>
              )}

              {updateState === 'downloaded' && onInstall && (
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={onInstall}
                  className="text-xs"
                >
                  <FiRefreshCw className="w-3 h-3 mr-1" />
                  Install & Restart
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};