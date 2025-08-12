import React, { useState } from 'react';
import { UpdateNotification, UpdateDialog } from './ui';
import { useUpdater } from '../hooks/useUpdater';
import { Button } from './ui/Button';

/**
 * Update Manager Component - Example implementation
 *
 * This component demonstrates how to integrate the update system into your app.
 * You can customize the behavior and UI to match your application's design.
 */
export const UpdateManager: React.FC = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [showNotification, setShowNotification] = useState(true);

  const {
    updateState,
    updateInfo,
    progress,
    error,
    currentVersion,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
    openRepository,
  } = useUpdater();

  const shouldShowNotification =
    showNotification &&
    (updateState === 'available' ||
      updateState === 'downloading' ||
      updateState === 'downloaded' ||
      updateState === 'error');

  const handleDismissNotification = () => {
    setShowNotification(false);
    dismissUpdate();
  };

  const handleShowDialog = () => {
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

  return (
    <>
      {shouldShowNotification && (
        <UpdateNotification
          updateState={updateState as any}
          updateInfo={updateInfo || undefined}
          progress={progress || undefined}
          error={error || undefined}
          onDownload={downloadUpdate}
          onInstall={installUpdate}
          onDismiss={handleDismissNotification}
          onViewReleases={openRepository}
        />
      )}

      <UpdateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        updateState={
          (updateState === 'idle' ? 'not-available' : updateState) as any
        }
        updateInfo={updateInfo || undefined}
        progress={progress || undefined}
        error={error || undefined}
        currentVersion={currentVersion}
        onDownload={downloadUpdate}
        onInstall={installUpdate}
        onViewReleases={openRepository}
        onCheckForUpdates={checkForUpdates}
      />

      <div className='fixed bottom-4 right-4 space-y-2'>
        <Button
          variant='outline'
          size='sm'
          onClick={checkForUpdates}
          disabled={updateState === 'checking'}
        >
          {updateState === 'checking' ? 'Checking...' : 'Check for Updates'}
        </Button>

        <Button variant='ghost' size='sm' onClick={handleShowDialog}>
          Update Settings
        </Button>
      </div>
    </>
  );
};
