import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import Typography from '../components/ui/Typography';
import { ProfileRegistrationForm } from '../components/hcs10/ProfileRegistrationForm';
import { RegistrationStatusDialog } from '../components/hcs10/RegistrationStatusDialog';
import { useHCS10Store } from '../stores/hcs10Store';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type {
  HCS10ProfileFormData,
  HCS10ProfileResponse,
} from '../../shared/schemas/hcs10';
import type { RegistrationProgressData } from '@hashgraphonline/standards-sdk';

export function HCS10ProfileRegistration() {
  const navigate = useNavigate();
  const { addProfile, profiles } = useHCS10Store();
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationResult, setRegistrationResult] =
    useState<HCS10ProfileResponse | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(
    null
  );
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [existingProfile, setExistingProfile] = useState<
    Partial<HCS10ProfileFormData> | undefined
  >();
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  const [registrationProgress, setRegistrationProgress] = useLocalStorage<{
    message: string;
    percent: number;
    stage?: string;
    state?: unknown;
    timestamp?: string;
  }>('hcs10-registration-progress', {
    message: '',
    percent: 0,
  });
  const [agentCreationState, setAgentCreationState, clearAgentCreationState] =
    useLocalStorage<unknown>('hcs10-agent-creation-state', null);

  const [progress, setProgress] = useState<{
    message: string;
    percent: number;
    stage?: string;
  }>({ message: '', percent: 0 });

  /**
   * Check for existing profiles and fetch profile data
   */
  const fetchExistingProfile = useCallback(async () => {
    try {
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        setHasExistingProfile(true);

        const storeFormData: Partial<HCS10ProfileFormData> = {
          name: profile.name,
          description: profile.description,
          capabilities: profile.capabilities,
          profileImage: profile.profileImage,
          logo: profile.profileImage,
          feeConfiguration: profile.feeConfiguration,
          socials: profile.socials || {
            twitter: '',
            github: '',
            website: '',
          },
          profileType: 'aiAgent',
          agentType: 'manual',
          creator: '',
          alias: '',
          version: '1.0.0',
          customProperties: {},
        };

        setExistingProfile(storeFormData);
      } else {
        setHasExistingProfile(false);
      }
    } catch (error) {}
  }, [profiles]);

  /**
   * Initialize existing profile data
   */
  useEffect(() => {
    fetchExistingProfile();
  }, [fetchExistingProfile]);

  /**
   * Clear cancelled/failed state on mount
   */
  useEffect(() => {
    if (
      registrationProgress.stage === 'cancelled' ||
      registrationProgress.stage === 'failed'
    ) {
      const clearedProgress = {
        message: '',
        percent: 0,
      };
      setProgress(clearedProgress);
      setRegistrationProgress(clearedProgress);
      setIsRegistering(false);
      setRegistrationError(null);
      setRegistrationResult(null);
      setShowStatusDialog(false);
    }
  }, []);

  /**
   * Set up IPC listener for real-time progress updates
   */
  useEffect(() => {
    const handleProgressUpdate = (progressData: any) => {
      const updatedProgress = {
        message: progressData.message || `Stage: ${progressData.stage}`,
        percent: progressData.progressPercent || 0,
        stage: progressData.stage,
        timestamp: progressData.timestamp,
      };

      setProgress(updatedProgress);
      setRegistrationProgress(updatedProgress);

      if (progressData.details?.state) {
        setAgentCreationState(progressData.details.state);
      }
    };

    const unsubscribe = window.electron.on(
      'hcs10:registrationProgress',
      handleProgressUpdate
    );

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Load existing progress on component mount (only if valid in-progress state)
   */
  useEffect(() => {
    if (
      registrationProgress.percent > 0 &&
      registrationProgress.stage !== 'cancelled' &&
      registrationProgress.stage !== 'failed'
    ) {
      setProgress({
        message: registrationProgress.message,
        percent: registrationProgress.percent,
        stage: registrationProgress.stage,
      });
    }
  }, []);

  /**
   * Check for in-progress registration on mount
   */
  useEffect(() => {
    const checkInProgressRegistration = async () => {
      if (existingProfile?.name) {
        try {
          const result = await window.electron.invoke(
            'hcs10:isRegistrationInProgress',
            existingProfile.name
          );
          if (result.success && result.data?.inProgress) {
            const progressResult = await window.electron.invoke(
              'hcs10:getRegistrationProgress',
              existingProfile.name
            );
            if (progressResult.success && progressResult.data) {
              const state = progressResult.data;
              setProgress({
                message: `Resuming registration from ${state.currentStage}...`,
                percent: state.completedPercentage || 0,
                stage: state.currentStage,
              });
              setAgentCreationState(state);
              setIsRegistering(true);
              setShowStatusDialog(true);
            }
          }
        } catch (error) {}
      }
    };

    checkInProgressRegistration();
  }, [existingProfile?.name]);

  /**
   * Handle form submission with real-time progress tracking
   */
  const handleSubmit = async (submittedFormData: HCS10ProfileFormData) => {
    setIsRegistering(true);
    setRegistrationError(null);
    setShowStatusDialog(true);

    const initialProgress = {
      message: 'Preparing registration...',
      percent: 0,
      timestamp: new Date().toISOString(),
    };
    setProgress(initialProgress);
    setRegistrationProgress(initialProgress);

    try {
      const registrationData: Record<string, unknown> = {
        ...submittedFormData,
      };

      if (
        submittedFormData.logo &&
        submittedFormData.logo.startsWith('data:')
      ) {
        const mimeMatch = submittedFormData.logo.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const extension = mimeType.split('/')[1] || 'png';

        registrationData.profileImageFile = {
          data: submittedFormData.logo,
          name: `profile.${extension}`,
          type: mimeType,
        };
        delete registrationData.logo;
      } else if (
        submittedFormData.logo &&
        submittedFormData.logo.startsWith('hcs://')
      ) {
        registrationData.profileImage = submittedFormData.logo;
        delete registrationData.logo;
      }

      const result = await window.electron.invoke(
        'hcs10:registerProfile',
        registrationData
      );

      if (result.success && result.data) {
        setRegistrationResult(result.data);

        addProfile({
          id: `profile-${Date.now()}`,
          accountId: result.data.accountId,
          name: submittedFormData.name,
          description: submittedFormData.description,
          capabilities: submittedFormData.capabilities,
          socials: submittedFormData.socials,
          profileImage:
            submittedFormData.logo || submittedFormData.profileImage,
          feeConfiguration: submittedFormData.feeConfiguration,
          registeredAt: new Date(),
          lastUpdated: new Date(),
          status: 'active',
        });

        clearAgentCreationState();
      } else {
        const failedProgress = {
          message: 'Registration failed',
          percent: 0,
          stage: 'failed',
          timestamp: new Date().toISOString(),
        };
        setProgress(failedProgress);
        setRegistrationProgress(failedProgress);
        setRegistrationError(result.error || 'Registration failed');
      }
    } catch (error) {
      const catchFailedProgress = {
        message: 'Registration failed',
        percent: 0,
        stage: 'failed',
        timestamp: new Date().toISOString(),
      };
      setProgress(catchFailedProgress);
      setRegistrationProgress(catchFailedProgress);
      setRegistrationError(
        error instanceof Error ? error.message : 'Registration failed'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  /**
   * Handle dialog close
   */
  const handleCloseDialog = () => {
    setShowStatusDialog(false);

    if (isRegistering) {
      (async () => {
        try {
          await window.electron.invoke('hcs10:cancelRegistration');

          clearAgentCreationState();

          setIsRegistering(false);
          setRegistrationError(null);

          const clearedProgress = {
            message: '',
            percent: 0,
          };
          setProgress(clearedProgress);
          setRegistrationProgress(clearedProgress);
        } catch (error) {
          clearAgentCreationState();
          setIsRegistering(false);
          setRegistrationError(null);

          const clearedProgress = {
            message: '',
            percent: 0,
          };
          setProgress(clearedProgress);
          setRegistrationProgress(clearedProgress);
        }
      })();
    } else if (registrationResult) {
      navigate('/');
    }

    setTimeout(() => {
      setRegistrationResult(null);
      setRegistrationError(null);
    }, 300);
  };

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-6 py-8 max-w-6xl'>
        <div className='mb-8'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => navigate('/')}
            className='mb-3 -ml-2'
          >
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Home
          </Button>

          <Typography
            variant='h1'
            className='text-3xl font-bold bg-gradient-to-r from-hgo-purple via-hgo-blue to-hgo-green bg-clip-text text-transparent'
          >
            Profile Registration
          </Typography>

          <Typography variant='body1' className='text-muted-foreground'>
            {hasExistingProfile
              ? 'Update your existing profile on the Hedera Hashgraph. Your changes will replace the current profile information.'
              : 'Register your profile on the Hedera Hashgraph to enable discovery and interaction with AI agents'}
          </Typography>

          {(registrationProgress.percent > 0 ||
            Boolean(agentCreationState)) && (
            <div className='mt-3 p-3 bg-muted/50 rounded-lg'>
              <div className='flex items-center justify-between'>
                <Typography
                  variant='body1'
                  className='text-sm text-muted-foreground'
                >
                  Previous registration detected
                </Typography>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={async () => {
                    try {
                      await window.electron.invoke('hcs10:clearAllStates');

                      clearAgentCreationState();
                      setRegistrationProgress({
                        message: '',
                        percent: 0,
                      });
                      setProgress({
                        message: '',
                        percent: 0,
                      });
                      setRegistrationError(null);
                      setRegistrationResult(null);
                    } catch (error) {}
                  }}
                  className='text-xs'
                >
                  Clear Progress
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className='bg-card rounded-xl border'>
          <div className='p-8'>
            <ProfileRegistrationForm
              onSubmit={handleSubmit}
              isSubmitting={isRegistering}
              existingData={existingProfile}
              progress={
                progress.percent >= 0 && progress.message ? progress : undefined
              }
              network={'testnet'}
            />
          </div>
        </div>

        <RegistrationStatusDialog
          isOpen={showStatusDialog}
          onClose={handleCloseDialog}
          isRegistering={isRegistering}
          result={registrationResult}
          error={registrationError}
          progress={
            progress.percent >= 0 && progress.message ? progress : undefined
          }
        />
      </div>
    </div>
  );
}
