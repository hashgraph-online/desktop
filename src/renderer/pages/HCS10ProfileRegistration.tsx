import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import Typography from '../components/ui/Typography';
import { ProfileRegistrationForm } from '../components/hcs10/ProfileRegistrationForm';
import { RegistrationStatusDialog } from '../components/hcs10/RegistrationStatusDialog';
import { useWalletStore } from '../stores/walletStore';
import {
  BrowserHCSClient,
  AgentBuilder,
  PersonBuilder,
  AIAgentCapability,
} from '@hashgraphonline/standards-sdk';
import { useInscribe } from '../hooks/useInscribe';
import { walletService } from '../services/walletService';
import { Buffer } from 'buffer';
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
  const wallet = useWalletStore();
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

  const { inscribe } = useInscribe();

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

    const unsubscribe = window?.desktop?.on(
      'hcs10_registration_progress',
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
          const result = await window?.desktop?.invoke(
            'hcs10_is_registration_in_progress',
            { profileName: existingProfile.name }
          );
          if (result.success && result.data?.inProgress) {
            const progressResult = await window?.desktop?.invoke(
              'hcs10_get_registration_progress',
              { profileName: existingProfile.name }
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

      /** Pre-inscribe avatar (two-step) to avoid signer receipt issues */
      let preInscribePfpTopicId: string | undefined;
      if (submittedFormData.logo?.startsWith('data:')) {
        const match = submittedFormData.logo.match(
          /^data:([^;]+);base64,(.*)$/
        );
        if (match && wallet.accountId && wallet.network) {
          const mime = match[1];
          const base64 = match[2];
          const ext = (mime.split('/')[1] || 'png').toLowerCase();
          const fileName = `profile.${ext}`;

          const buffer = Buffer.from(base64, 'base64');
          const inscription = await inscribe(
            {
              type: 'buffer',
              buffer,
              fileName,
              mimeType: mime,
            },
            { waitMaxAttempts: 200 },
            (data) => {
              const updated = {
                message: data?.message || 'Inscribing profile image...',
                percent: Math.min(95, Number(data?.progressPercent) || 0),
                stage: data?.stage,
                timestamp: new Date().toISOString(),
              };
              setProgress(updated);
              setRegistrationProgress(updated);
            }
          );

          if (!inscription?.topic_id) {
            throw new Error('Avatar inscription did not complete');
          }
          preInscribePfpTopicId = inscription.topic_id;
        }
      }

      let result: {
        success: boolean;
        data?: HCS10ProfileResponse;
        error?: string;
      };
      if (wallet.isConnected) {
        const hwc = walletService.getSDK();
        const client = new BrowserHCSClient({
          network: wallet.network as 'mainnet' | 'testnet',
          hwc,
        });
        let createSuccess = false;
        let createError: string | undefined;
        if (submittedFormData.profileType === 'person') {
          const pBuilder = new PersonBuilder()
            .setName(submittedFormData.name)
            .setAlias(submittedFormData.alias)
            .setBio(submittedFormData.description);

          const socials = submittedFormData.socials || {};
          if (socials.twitter) pBuilder.addSocial('twitter', socials.twitter);
          if (socials.github) pBuilder.addSocial('github', socials.github);
          if (socials.website) pBuilder.addSocial('website', socials.website);

          if (preInscribePfpTopicId) {
            pBuilder.setExistingProfilePicture(preInscribePfpTopicId);
          } else if (
            submittedFormData.logo &&
            submittedFormData.logo.startsWith('hcs://')
          ) {
            const topicId = submittedFormData.logo.replace(
              /^hcs:\/\/[0-9]+\//,
              ''
            );
            pBuilder.setExistingProfilePicture(topicId);
          }

          const resp = await client.create(pBuilder, {
            progressCallback: (p: {
              message?: string;
              progressPercent?: number;
              stage?: string;
              details?: unknown;
            }) => {
              const updated = {
                message: p.message || 'Working...',
                percent: Math.min(99, p.progressPercent || 0),
                stage: p.stage,
                timestamp: new Date().toISOString(),
              };
              setProgress(updated);
              setRegistrationProgress(updated);
            },
            updateAccountMemo: true,
          });

          createSuccess = Boolean((resp as any)?.success);
          createError = (resp as any)?.error;
        } else {
          /** Build AI Agent and register with guarded registry */
          const aBuilder = new AgentBuilder()
            .setNetwork(wallet.network as 'mainnet' | 'testnet')
            .setName(submittedFormData.name)
            .setAlias(submittedFormData.alias)
            .setBio(submittedFormData.description)
            .setType(
              submittedFormData.agentType === 'autonomous'
                ? 'autonomous'
                : 'manual'
            )
            .setCreator(submittedFormData.creator);

          const caps = (submittedFormData.capabilities || []).map((tag) => {
            switch (tag) {
              case 'text-generation':
                return AIAgentCapability.TEXT_GENERATION;
              case 'data-integration':
                return AIAgentCapability.DATA_INTEGRATION;
              case 'analytics':
                return AIAgentCapability.MARKET_INTELLIGENCE;
              case 'automation':
                return AIAgentCapability.WORKFLOW_AUTOMATION;
              case 'natural-language':
                return AIAgentCapability.LANGUAGE_TRANSLATION;
              case 'image-generation':
                return AIAgentCapability.IMAGE_GENERATION;
              case 'code-generation':
                return AIAgentCapability.CODE_GENERATION;
              case 'translation':
                return AIAgentCapability.LANGUAGE_TRANSLATION;
              case 'summarization':
                return AIAgentCapability.SUMMARIZATION_EXTRACTION;
              case 'api-integration':
                return AIAgentCapability.API_INTEGRATION;
              default:
                return AIAgentCapability.TEXT_GENERATION;
            }
          });
          aBuilder.setCapabilities(caps);

          const socials = submittedFormData.socials || {};
          if (socials.twitter) aBuilder.addSocial('twitter', socials.twitter);
          if (socials.github) aBuilder.addSocial('github', socials.github);
          if (socials.website) aBuilder.addSocial('website', socials.website);

          if (preInscribePfpTopicId) {
            aBuilder.setExistingProfilePicture(preInscribePfpTopicId);
          } else if (
            submittedFormData.logo &&
            submittedFormData.logo.startsWith('hcs://')
          ) {
            const topicId = submittedFormData.logo.replace(
              /^hcs:\/\/[0-9]+\//,
              ''
            );
            aBuilder.setExistingProfilePicture(topicId);
          }

          const resp = await client.create(aBuilder, {
            progressCallback: (p: {
              message?: string;
              progressPercent?: number;
              stage?: string;
              details?: unknown;
            }) => {
              const updated = {
                message: p.message || 'Working...',
                percent: Math.min(99, p.progressPercent || 0),
                stage: p.stage,
                timestamp: new Date().toISOString(),
              };
              setProgress(updated);
              setRegistrationProgress(updated);
            },
          });
          createSuccess = Boolean(resp?.success);
          createError = resp?.error;
        }

        const createResp = { success: createSuccess, error: createError } as {
          success: boolean;
          error?: string;
        };
        if (createResp?.success) {
          result = {
            success: true,
            data: {
              success: true,
              accountId: wallet.accountId!,
              transactionId: 'submitted',
              timestamp: new Date().toISOString(),
              profileUrl: undefined,
              metadata: {
                name: submittedFormData.name,
                description: submittedFormData.description,
                capabilities:
                  submittedFormData.profileType === 'aiAgent'
                    ? submittedFormData.capabilities
                    : [],
                socials: submittedFormData.socials,
                profileImage:
                  submittedFormData.logo || submittedFormData.profileImage,
                feeConfiguration: submittedFormData.feeConfiguration,
              },
            },
          };
        } else {
          result = {
            success: false,
            error: createResp?.error || 'Registration failed',
          };
        }
      } else {
        result = await window?.desktop?.invoke('hcs10_register_profile', {
          profileData: registrationData,
        });
      }

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
          await window?.desktop?.invoke('hcs10_cancel_registration');

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
                      await window?.desktop?.invoke('hcs10_clear_all_states');

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
