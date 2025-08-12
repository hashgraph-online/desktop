import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormPersistence } from '../../hooks/useFormPersistence';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import Typography from '../ui/Typography';
import { AgentLogoSelector } from './AgentLogoSelector';
import { CapabilitiesSelector } from './CapabilitiesSelector';
import { ProgressBar } from './ProgressBar';
import {
  type HCS10ProfileFormData,
  HCS10ProfileSchema,
} from '../../../shared/schemas/hcs10';
import { 
  Loader2, 
  User, 
  Bot, 
  Sparkles,
  Globe,
  Twitter,
  Github,
  ChevronRight
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';

interface ProfileRegistrationFormProps {
  onSubmit: (data: HCS10ProfileFormData) => void | Promise<void>;
  isSubmitting?: boolean;
  existingData?: Partial<HCS10ProfileFormData>;
  progress?: {
    message: string;
    percent: number;
    stage?: string;
  };
  network?: 'mainnet' | 'testnet';
}

/**
 * Form component for HCS-10 profile registration
 */
export function ProfileRegistrationForm({
  onSubmit,
  isSubmitting = false,
  existingData,
  progress,
  network = 'testnet',
}: ProfileRegistrationFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<HCS10ProfileFormData>({
    resolver: zodResolver(HCS10ProfileSchema),
    defaultValues: {
      name: existingData?.name || '',
      description: existingData?.description || '',
      profileType: existingData?.profileType || 'aiAgent',
      alias: existingData?.alias || '',
      creator: existingData?.creator || '',
      version: existingData?.version || '1.0.0',
      agentType: existingData?.agentType || 'manual',
      capabilities: existingData?.capabilities || [],
      socials: existingData?.socials || {
        twitter: '',
        github: '',
        website: '',
      },
      profileImage: existingData?.profileImage || undefined,
      logo: existingData?.logo || '',
      feeConfiguration: existingData?.feeConfiguration || undefined,
      customProperties: existingData?.customProperties || {},
    },
  });

  const capabilities = watch('capabilities');
  const socials = watch('socials');
  const logo = watch('logo');
  const profileType = watch('profileType');
  const name = watch('name');
  const description = watch('description');
  const creator = watch('creator');
  const alias = watch('alias');

  const { saveToStorage, clearPersistedData } = useFormPersistence(
    'hcs10_profile_form',
    watch,
    setValue,
    ['name', 'description', 'creator', 'alias', 'profileType', 'agentType', 'capabilities', 'socials', 'logo', 'profileImage']
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      saveToStorage();
    }, 1000);

    return () => clearTimeout(timer);
  }, [name, description, creator, alias, profileType, watch('agentType'), capabilities, socials, logo, saveToStorage]);

  /**
   * Handle form submission with persistence cleanup
   */
  const handleFormSubmit = useCallback(async (data: HCS10ProfileFormData) => {
    try {
      await onSubmit(data);
      clearPersistedData();
    } catch (error) {
      throw error;
    }
  }, [onSubmit, clearPersistedData]);

  /**
   * Handle profile type change
   */
  const handleProfileTypeChange = useCallback(
    (value: 'person' | 'aiAgent') => {
      setValue('profileType', value);
      if (value === 'person') {
        setValue('agentType', undefined);
        setValue('capabilities', []);
      }
    },
    [setValue]
  );

  /**
   * Handle social links change
   */
  const handleSocialChange = useCallback(
    (key: 'twitter' | 'github' | 'website', value: string) => {
      setValue(`socials.${key}` as any, value);
    },
    [setValue]
  );

  /**
   * Handle logo change from AgentLogoSelector
   */
  const handleLogoChange = useCallback(
    (value: string) => {
      setValue('logo', value);
      setValue('profileImage', value);
    },
    [setValue]
  );

  /**
   * Check if current step is valid
   */
  const isStepValid = useCallback((step: number) => {
    switch (step) {
      case 1:
        return name?.length >= 3 && 
               description?.length >= 10 && 
               creator?.length >= 2 && 
               alias?.length >= 3 && 
               alias?.length <= 20 && 
               /^[a-zA-Z0-9_-]+$/.test(alias || '');
      case 2:
        if (profileType === 'person') return true;
        return capabilities?.length > 0 && capabilities.length <= 5;
      case 3:
        return true;
      default:
        return false;
    }
  }, [name, description, creator, alias, profileType, capabilities]);

  /**
   * Check if form is valid
   */
  const isFormValid = React.useMemo(() => {
    const basicValid = name?.length >= 3 && 
                       description?.length >= 10 && 
                       creator?.length >= 2 && 
                       alias?.length >= 3 && 
                       alias?.length <= 20 && 
                       /^[a-zA-Z0-9_-]+$/.test(alias || '');
    
    if (profileType === 'person') {
      return basicValid;
    } else {
      const capabilitiesValid = capabilities?.length > 0 && capabilities.length <= 5;
      return basicValid && capabilitiesValid;
    }
  }, [name, description, creator, alias, profileType, capabilities]);

  const handleNextStep = () => {
    if (currentStep < totalSteps && isStepValid(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-6'>

      {progress && (
        <ProgressBar
          message={progress.message}
          percent={progress.percent}
          stage={progress.stage}
        />
      )}


      <div className='flex items-center justify-between mb-8'>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={cn(
              'flex items-center',
              step < 3 && 'flex-1'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                currentStep >= step
                  ? 'bg-gradient-to-br from-[#5599fe] to-[#48df7b] text-white shadow-lg shadow-[#48df7b]/25'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {step}
            </div>
            {step < 3 && (
              <div className='flex-1 h-0.5 mx-2 relative overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn(
                    'absolute inset-0 bg-gradient-to-r from-[#5599fe] to-[#48df7b] transition-transform duration-500',
                    currentStep > step ? 'translate-x-0' : '-translate-x-full'
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>


      {currentStep === 1 && (
        <div className='space-y-6 animate-in fade-in-0 slide-in-from-right-10 duration-300'>
          <div className='text-center mb-6'>
            <Typography variant='h2' className='text-2xl font-semibold mb-2 bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent'>
              Let's start with the basics
            </Typography>
            <Typography variant='body1' className='text-muted-foreground'>
              Tell us about yourself or your agent
            </Typography>
          </div>


          <div className='grid grid-cols-2 gap-4'>
            <button
              type='button'
              onClick={() => handleProfileTypeChange('person')}
              className={cn(
                'p-6 rounded-xl border-2 transition-all hover:shadow-md relative overflow-hidden',
                profileType === 'person'
                  ? 'border-[#5599fe]/50 bg-gradient-to-br from-[#5599fe]/10 to-[#48df7b]/10'
                  : 'border-border hover:border-muted-foreground'
              )}
            >
              <User className={cn(
                'h-8 w-8 mb-3 mx-auto transition-colors',
                profileType === 'person' ? 'text-[#5599fe]' : 'text-muted-foreground'
              )} />
              <Typography variant='h4' className='font-medium mb-1'>
                Personal Profile
              </Typography>
              <Typography variant='body1' className='text-xs text-muted-foreground'>
                For individuals
              </Typography>
            </button>

            <button
              type='button'
              onClick={() => handleProfileTypeChange('aiAgent')}
              className={cn(
                'p-6 rounded-xl border-2 transition-all hover:shadow-md relative overflow-hidden',
                profileType === 'aiAgent'
                  ? 'border-[#48df7b]/50 bg-gradient-to-br from-[#48df7b]/10 to-[#5599fe]/10'
                  : 'border-border hover:border-muted-foreground'
              )}
            >
              <Bot className={cn(
                'h-8 w-8 mb-3 mx-auto transition-colors',
                profileType === 'aiAgent' ? 'text-[#48df7b]' : 'text-muted-foreground'
              )} />
              <Typography variant='h4' className='font-medium mb-1'>
                AI Agent Profile
              </Typography>
              <Typography variant='body1' className='text-xs text-muted-foreground'>
                For AI assistants
              </Typography>
            </button>
          </div>


          <div className='space-y-4'>
            <div>
              <Label htmlFor='name' className='text-sm font-medium'>
                {profileType === 'person' ? 'Your Name' : 'Agent Name'} *
              </Label>
              <Input
                id='name'
                placeholder={profileType === 'person' ? 'John Smith' : 'CodeAssistant'}
                disabled={isSubmitting}
                {...register('name')}
                className={cn(
                  'mt-1.5',
                  errors.name && 'border-destructive'
                )}
              />
              {errors.name && (
                <Typography variant='body1' className='text-xs text-destructive mt-1'>
                  {errors.name.message}
                </Typography>
              )}
            </div>

            <div>
              <Label htmlFor='creator' className='text-sm font-medium'>
                Organization *
              </Label>
              <Input
                id='creator'
                placeholder='Your Company'
                disabled={isSubmitting}
                {...register('creator')}
                className={cn(
                  'mt-1.5',
                  errors.creator && 'border-destructive'
                )}
              />
              {errors.creator && (
                <Typography variant='body1' className='text-xs text-destructive mt-1'>
                  {errors.creator.message}
                </Typography>
              )}
            </div>

            <div>
              <Label htmlFor='description' className='text-sm font-medium'>
                {profileType === 'person' ? 'Bio' : 'Description'} *
              </Label>
              <Textarea
                id='description'
                placeholder={
                  profileType === 'person'
                    ? 'Tell us about yourself...'
                    : 'Describe what your agent does...'
                }
                rows={3}
                disabled={isSubmitting}
                {...register('description')}
                className={cn(
                  'mt-1.5 resize-none',
                  errors.description && 'border-destructive'
                )}
              />
              {errors.description && (
                <Typography variant='body1' className='text-xs text-destructive mt-1'>
                  {errors.description.message}
                </Typography>
              )}
            </div>

            <div>
              <Label htmlFor='alias' className='text-sm font-medium'>
                Username *
              </Label>
              <Input
                id='alias'
                placeholder={profileType === 'person' ? 'john_smith' : 'code_assistant'}
                disabled={isSubmitting}
                {...register('alias')}
                className={cn(
                  'mt-1.5',
                  errors.alias && 'border-destructive'
                )}
              />
              {errors.alias && (
                <Typography variant='body1' className='text-xs text-destructive mt-1'>
                  {errors.alias.message}
                </Typography>
              )}
              {!errors.alias && (
                <Typography variant='body1' className='text-[10px] text-muted-foreground/70 mt-0.5'>
                  3-20 characters • Letters, numbers, underscores, hyphens
                </Typography>
              )}
            </div>
          </div>
        </div>
      )}


      {currentStep === 2 && (
        <div className='space-y-6 animate-in fade-in-0 slide-in-from-right-10 duration-300'>
          <div className='text-center mb-6'>
            <Typography variant='h2' className='text-2xl font-semibold mb-2 bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent'>
              Customize your profile
            </Typography>
            <Typography variant='body1' className='text-muted-foreground'>
              Add details that make you unique
            </Typography>
          </div>


          <div className='space-y-3'>
            <Label className='text-sm font-medium'>
              Profile Picture <span className='text-muted-foreground'>(optional)</span>
            </Label>
            <div className='p-4 bg-muted/30 rounded-lg border'>
              <AgentLogoSelector
                onChange={handleLogoChange}
                formData={logo || ''}
                network={network}
              />
            </div>
          </div>


          {profileType === 'aiAgent' && (
            <>
              <div>
                <Label className='text-sm font-medium'>Agent Type</Label>
                <Controller
                  name='agentType'
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className='mt-1.5'>
                        <SelectValue placeholder='Select agent type' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='autonomous'>
                          <div className='flex items-center gap-2'>
                            <Sparkles className='h-4 w-4' />
                            Autonomous
                          </div>
                        </SelectItem>
                        <SelectItem value='manual'>
                          <div className='flex items-center gap-2'>
                            <User className='h-4 w-4' />
                            Manual
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label className='text-sm font-medium mb-3'>
                  Capabilities *
                </Label>
                <Controller
                  name='capabilities'
                  control={control}
                  render={({ field }) => (
                    <CapabilitiesSelector
                      value={field.value || []}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                      error={errors.capabilities?.message}
                    />
                  )}
                />
                {errors.capabilities && (
                  <Typography variant='body1' className='text-xs text-destructive mt-2'>
                    {errors.capabilities.message}
                  </Typography>
                )}
              </div>
            </>
          )}
        </div>
      )}


      {currentStep === 3 && (
        <div className='space-y-6 animate-in fade-in-0 slide-in-from-right-10 duration-300'>
          <div className='text-center mb-6'>
            <Typography variant='h2' className='text-2xl font-semibold mb-2 bg-gradient-to-r from-[#a679f0] via-[#5599fe] to-[#48df7b] bg-clip-text text-transparent'>
              Connect your socials
            </Typography>
            <Typography variant='body1' className='text-muted-foreground'>
              Help others find you online (optional)
            </Typography>
          </div>

          <div className='space-y-4'>
            <div>
              <Label htmlFor='website' className='text-sm font-medium flex items-center gap-2'>
                <Globe className='h-4 w-4' />
                Website
              </Label>
              <Input
                id='website'
                placeholder='https://yourwebsite.com'
                disabled={isSubmitting}
                value={socials?.website || ''}
                onChange={(e) => handleSocialChange('website', e.target.value)}
                className='mt-1.5'
              />
            </div>

            <div>
              <Label htmlFor='twitter' className='text-sm font-medium flex items-center gap-2'>
                <Twitter className='h-4 w-4' />
                Twitter/X
              </Label>
              <Input
                id='twitter'
                placeholder='https://twitter.com/username'
                disabled={isSubmitting}
                value={socials?.twitter || ''}
                onChange={(e) => handleSocialChange('twitter', e.target.value)}
                className='mt-1.5'
              />
            </div>

            <div>
              <Label htmlFor='github' className='text-sm font-medium flex items-center gap-2'>
                <Github className='h-4 w-4' />
                GitHub
              </Label>
              <Input
                id='github'
                placeholder='https://github.com/username'
                disabled={isSubmitting}
                value={socials?.github || ''}
                onChange={(e) => handleSocialChange('github', e.target.value)}
                className='mt-1.5'
              />
            </div>
          </div>


          <div className='mt-8 p-4 bg-gradient-to-br from-[#5599fe]/5 via-[#48df7b]/5 to-[#a679f0]/5 rounded-lg border border-[#48df7b]/20'>
            <Typography variant='h4' className='text-sm font-medium mb-3'>
              Profile Summary
            </Typography>
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Type:</span>
                <span className='font-medium'>
                  {profileType === 'person' ? 'Personal' : 'AI Agent'}
                </span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Name:</span>
                <span className='font-medium'>{name || 'Not set'}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Organization:</span>
                <span className='font-medium'>{creator || 'Not set'}</span>
              </div>
              {profileType === 'aiAgent' && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Capabilities:</span>
                  <span className='font-medium'>{capabilities?.length || 0} selected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      <div className='flex justify-between pt-6 border-t'>
        {currentStep > 1 ? (
          <Button
            type='button'
            variant='outline'
            onClick={handlePreviousStep}
            disabled={isSubmitting}
          >
            Previous
          </Button>
        ) : (
          <div />
        )}

        {currentStep < totalSteps ? (
          <Button
            type='button'
            onClick={handleNextStep}
            disabled={!isStepValid(currentStep) || isSubmitting}
            className='bg-gradient-to-r from-[#5599fe] to-[#48df7b] hover:from-[#4488ed] hover:to-[#3dce6a] text-white border-0'
          >
            Next
            <ChevronRight className='h-4 w-4 ml-1' />
          </Button>
        ) : (
          <Button
            type='submit'
            disabled={isSubmitting || !isFormValid}
            className='min-w-[120px] bg-gradient-to-r from-[#48df7b] via-[#5599fe] to-[#a679f0] hover:from-[#3dce6a] hover:via-[#4488ed] hover:to-[#9168df] text-white border-0'
          >
            {isSubmitting ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Registering...
              </>
            ) : (
              'Register Profile'
            )}
          </Button>
        )}
      </div>


      <Controller
        name='capabilities'
        control={control}
        render={({ field }) => (
          <input
            type='hidden'
            {...field}
            value={field.value?.join(',') || ''}
          />
        )}
      />
    </form>
  );
}