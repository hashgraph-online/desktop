import {
  ipcMain,
  IpcMainInvokeEvent,
  BrowserWindow,
  webContents,
} from 'electron';
import { IPCResponse } from '../../shared/schemas';
import {
  HCS10ProfileFormData,
  HCS10ProfileSchema,
} from '../../shared/schemas/hcs10';
import { HCS10RegistrationService } from '../services/hcs10-registration-service';
import { Logger } from '../utils/logger';
import { RegistrationProgressData } from '@hashgraphonline/standards-sdk';

let progressListener:
  | ((progressData: RegistrationProgressData & { timestamp: string }) => void)
  | null = null;

/**
 * Sets up HCS-10 specific IPC handlers for profile registration with real-time progress updates
 */
export function setupHCS10Handlers(): void {
  const logger = new Logger({ module: 'HCS10Handlers' });
  const registrationService = HCS10RegistrationService.getInstance();

  if (progressListener) {
    registrationService.removeListener(
      'registrationProgress',
      progressListener
    );
  }

  progressListener = (
    progressData: RegistrationProgressData & { timestamp: string }
  ) => {
    const allContents = webContents.getAllWebContents();
    logger.debug(`Broadcasting to ${allContents.length} webContents`);

    BrowserWindow.getAllWindows().forEach((window) => {
      const contents = window.webContents;
      if (!contents.isDestroyed() && window.isVisible()) {
        contents.send('hcs10:registrationProgress', progressData);
      }
    });

    logger.debug('Progress broadcast sent', {
      stage: progressData.stage,
      progressPercent: progressData.progressPercent,
    });
  };

  registrationService.on('registrationProgress', progressListener);

  /**
   * Handler for registering HCS-10 profile
   */
  ipcMain.handle(
    'hcs10:registerProfile',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        logger.info('HCS10 profile registration requested');

        const profileData = data as HCS10ProfileFormData;
        logger.info('Profile data received', {
          name: profileData.name,
          profileType: profileData.profileType,
          hasProfileImage:
            !!profileData.profileImage || !!profileData.profileImageFile,
          capabilitiesCount:
            profileData.profileType === 'aiAgent'
              ? profileData.capabilities?.length || 0
              : 'N/A',
          socialsCount: profileData.socials
            ? Object.keys(profileData.socials).filter(
                (k) =>
                  profileData.socials![k as keyof typeof profileData.socials]
              ).length
            : 0,
        });

        logger.info(
          '🚀 Starting HCS10 registration with direct SDK functions and progress tracking'
        );

        const initialProgress: RegistrationProgressData & {
          timestamp: string;
        } = {
          stage: 'preparing',
          message: 'Initializing HCS-10 registration...',
          progressPercent: 0,
          timestamp: new Date().toISOString(),
        };

        webContents.getAllWebContents().forEach((contents) => {
          if (!contents.isDestroyed()) {
            contents.send('hcs10:registrationProgress', initialProgress);
          }
        });

        const result = await registrationService.registerProfile(profileData);

        logger.info('HCS10 profile registered successfully', {
          accountId: result.accountId,
          transactionId: result.transactionId,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('HCS10 profile registration failed:', error);

        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to register HCS10 profile',
        };
      }
    }
  );

  /**
   * Handler for validating HCS10 profile data
   */
  ipcMain.handle(
    'hcs10:validateProfile',
    async (event: IpcMainInvokeEvent, data: unknown): Promise<IPCResponse> => {
      try {
        const result = HCS10ProfileSchema.safeParse(data);

        if (!result.success) {
          const errors = result.error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          }));

          return {
            success: true,
            data: {
              valid: false,
              errors,
            },
          };
        }

        return {
          success: true,
          data: { valid: true },
        };
      } catch (_) {
        return {
          success: false,
          error: 'Validation failed',
        };
      }
    }
  );

  /**
   * Handler for getting registered HCS10 profiles
   */
  ipcMain.handle(
    'hcs10:getProfiles',
    async (_: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        const profiles = await registrationService.getRegisteredProfiles();
        return {
          success: true,
          data: profiles,
        };
      } catch (error) {
        logger.error('Failed to get HCS10 profiles:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to get profiles',
        };
      }
    }
  );

  /**
   * Handler for getting registration progress
   */
  ipcMain.handle(
    'hcs10:getRegistrationProgress',
    async (
      event: IpcMainInvokeEvent,
      profileName: string
    ): Promise<IPCResponse> => {
      try {
        const progress =
          await registrationService.getRegistrationProgress(profileName);
        return {
          success: true,
          data: progress,
        };
      } catch (error) {
        logger.error('Failed to get registration progress:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to get progress',
        };
      }
    }
  );

  /**
   * Handler for checking if registration is in progress
   */
  ipcMain.handle(
    'hcs10:isRegistrationInProgress',
    async (
      event: IpcMainInvokeEvent,
      profileName: string
    ): Promise<IPCResponse> => {
      try {
        const inProgress =
          await registrationService.isRegistrationInProgress(profileName);
        return {
          success: true,
          data: { inProgress },
        };
      } catch (error) {
        logger.error('Failed to check registration progress:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to check progress',
        };
      }
    }
  );

  /**
   * Handler for cancelling HCS-10 profile registration
   */
  ipcMain.handle(
    'hcs10:cancelRegistration',
    async (_: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        logger.info('HCS10 profile registration cancellation requested');

        await registrationService.cancelRegistration();

        return {
          success: true,
          data: { message: 'Registration cancelled successfully' },
        };
      } catch (error) {
        logger.error('Failed to cancel registration:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to cancel registration',
        };
      }
    }
  );

  /**
   * Handler for clearing all HCS-10 registration states
   */
  ipcMain.handle(
    'hcs10:clearAllStates',
    async (_: IpcMainInvokeEvent): Promise<IPCResponse> => {
      try {
        logger.info('Clear all HCS10 registration states requested');

        await registrationService.clearAllRegistrationStates();

        return {
          success: true,
          data: { message: 'All registration states cleared successfully' },
        };
      } catch (error) {
        logger.error('Failed to clear all registration states:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to clear registration states',
        };
      }
    }
  );

  /**
   * Handler for retrieving HCS-10 profile
   */
  ipcMain.handle(
    'hcs10:retrieveProfile',
    async (
      event: IpcMainInvokeEvent,
      accountId: string,
      network?: 'mainnet' | 'testnet'
    ): Promise<IPCResponse> => {
      try {
        logger.info('HCS10 profile retrieval requested', {
          accountId,
          network,
        });

        const result = await registrationService.retrieveProfile(
          accountId,
          network
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        logger.error('Failed to retrieve HCS10 profile:', error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve profile',
        };
      }
    }
  );

  logger.info('HCS10 IPC handlers initialized with progress tracking support');
}
