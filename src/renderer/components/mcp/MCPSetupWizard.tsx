import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  FiServer,
  FiDatabase,
  FiGithub,
  FiHardDrive,
  FiArrowRight,
  FiCheck,
  FiInfo,
} from 'react-icons/fi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui';
import { Input } from '../ui';
import { Label } from '../ui/label';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';
import { MCPServerType, MCPServerFormData, MCPServerConfigType } from '../../types/mcp';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface MCPSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MCPServerFormData) => Promise<void>;
  editingServer?: {
    name: string;
    type: MCPServerType;
    config: Record<string, unknown>;
  };
}

interface FormData {
  name: string;
  type: MCPServerType;
  rootPath?: string;
  allowedPaths?: string;
  excludePaths?: string;
  readOnly?: boolean;
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  path?: string;
  command?: string;
  args?: string;
  env?: string;
  cwd?: string;
}

const serverTypes = [
  {
    type: 'filesystem' as MCPServerType,
    name: 'Filesystem',
    description: 'Access local files and directories',
    icon: <FiHardDrive className='w-6 h-6' />,
    requiredFields: ['rootPath'],
    optionalFields: ['allowedPaths', 'excludePaths', 'readOnly'],
  },
  {
    type: 'github' as MCPServerType,
    name: 'GitHub',
    description: 'Interact with GitHub repositories',
    icon: <FiGithub className='w-6 h-6' />,
    requiredFields: ['token', 'owner', 'repo'],
    optionalFields: ['branch'],
  },
  {
    type: 'postgres' as MCPServerType,
    name: 'PostgreSQL',
    description: 'Connect to PostgreSQL databases',
    icon: <FiDatabase className='w-6 h-6' />,
    requiredFields: ['host', 'port', 'database', 'username', 'password'],
    optionalFields: ['ssl'],
  },
  {
    type: 'sqlite' as MCPServerType,
    name: 'SQLite',
    description: 'Access SQLite database files',
    icon: <FiDatabase className='w-6 h-6' />,
    requiredFields: ['path'],
    optionalFields: [],
  },
  {
    type: 'custom' as MCPServerType,
    name: 'Custom',
    description: 'Run custom MCP server commands',
    icon: <FiServer className='w-6 h-6' />,
    requiredFields: ['command'],
    optionalFields: ['args', 'env', 'cwd'],
  },
];

enum WizardStep {
  SelectType = 0,
  BasicInfo = 1,
  Configuration = 2,
  Review = 3,
}

/**
 * Enhanced MCP Server Setup Wizard with guided configuration
 */
export const MCPSetupWizard: React.FC<MCPSetupWizardProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingServer,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    WizardStep.SelectType
  );
  const [selectedType, setSelectedType] = useState<MCPServerType>(
    editingServer?.type || 'filesystem'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: editingServer
      ? {
          name: editingServer.name,
          type: editingServer.type,
          ...editingServer.config,
        }
      : {
          type: 'filesystem',
        },
  });

  const selectedServerType = serverTypes.find((st) => st.type === selectedType);

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    if (currentStep < WizardStep.Review) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > WizardStep.SelectType) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    setValidationErrors({});

    switch (currentStep) {
      case WizardStep.SelectType:
        return true;

      case WizardStep.BasicInfo: {
        const nameValid = await trigger('name');
        if (!nameValid) {
          setValidationErrors({ name: 'Server name is required' });
        }
        return nameValid;
      }

      case WizardStep.Configuration: {
        if (!selectedServerType) return false;

        const errors: Record<string, string> = {};
        let isValid = true;

        for (const field of selectedServerType.requiredFields) {
          const value = getValues(field as keyof FormData);
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors[field] = `${field} is required`;
            isValid = false;
          }
        }

        if (selectedType === 'postgres') {
          const port = getValues('port');
          if (
            port &&
            (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535)
          ) {
            errors.port = 'Port must be between 1 and 65535';
            isValid = false;
          }
        }

        setValidationErrors(errors);
        return isValid;
      }

      default:
        return true;
    }
  };

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const config: Record<string, unknown> = {};

      switch (data.type) {
        case 'filesystem':
          config.rootPath = data.rootPath;
          if (data.allowedPaths)
            config.allowedPaths = data.allowedPaths
              .split(',')
              .map((p) => p.trim());
          if (data.excludePaths)
            config.excludePaths = data.excludePaths
              .split(',')
              .map((p) => p.trim());
          if (data.readOnly !== undefined) config.readOnly = data.readOnly;
          break;

        case 'github':
          config.token = data.token;
          config.owner = data.owner;
          config.repo = data.repo;
          if (data.branch) config.branch = data.branch;
          break;

        case 'postgres':
          config.host = data.host;
          config.port = Number(data.port);
          config.database = data.database;
          config.username = data.username;
          config.password = data.password;
          if (data.ssl !== undefined) config.ssl = data.ssl;
          break;

        case 'sqlite':
          config.path = data.path;
          break;

        case 'custom':
          config.command = data.command;
          if (data.args) config.args = data.args.split(' ');
          if (data.env) {
            config.env = {};
            data.env.split(',').forEach((envVar) => {
              const [key, value] = envVar.split('=');
              if (key && value) (config.env as Record<string, string>)[key.trim()] = value.trim();
            });
          }
          if (data.cwd) config.cwd = data.cwd;
          break;
      }

      await onSubmit({
        name: data.name,
        type: data.type,
        config: config as unknown as MCPServerConfigType,
      });

      reset();
      setCurrentStep(WizardStep.SelectType);
      onClose();
    } catch (_error) {
      // Error handled by parent component
    } finally {
      setIsSubmitting(false);
    }
  };

/**
 * Step indicator component
 */
const StepIndicator: React.FC<{ currentStep: WizardStep }> = ({ currentStep }) => (
  <div className='flex items-center justify-center mb-8'>
    {[0, 1, 2, 3].map((step) => (
      <React.Fragment key={step}>
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all',
            currentStep >= step
              ? 'bg-brand-blue text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          )}
        >
          {currentStep > step ? <FiCheck className='w-5 h-5' /> : step + 1}
        </div>
        {step < 3 && (
          <div
            className={cn(
              'w-16 h-1 mx-2 transition-all',
              currentStep > step
                ? 'bg-brand-blue'
                : 'bg-gray-200 dark:bg-gray-700'
            )}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

/**
 * Select server type step component
 */
const SelectTypeStep: React.FC<{
  serverTypes: typeof serverTypes;
  selectedType: MCPServerType;
  setSelectedType: (type: MCPServerType) => void;
  setValue: (field: keyof FormData, value: unknown) => void;
}> = ({ serverTypes, selectedType, setSelectedType, setValue }) => (
  <div className='space-y-4'>
    <Typography variant='h6' className='mb-4'>
      Select Server Type
    </Typography>
    <div className='grid gap-3'>
      {serverTypes.map((serverType) => (
        <button
          key={serverType.type}
          type='button'
          onClick={() => {
            setSelectedType(serverType.type);
            setValue('type', serverType.type);
          }}
          className={cn(
            'p-4 rounded-lg border-2 transition-all text-left',
            'hover:border-brand-blue hover:bg-brand-blue/5',
            selectedType === serverType.type
              ? 'border-brand-blue bg-brand-blue/10'
              : 'border-gray-200 dark:border-gray-700'
          )}
        >
          <div className='flex items-start gap-4'>
            <div className='p-2 rounded-lg bg-gray-100 dark:bg-gray-800'>
              {serverType.icon}
            </div>
            <div className='flex-1'>
              <Typography
                variant='body1'
                className='font-semibold mb-1'
              >
                {serverType.name}
              </Typography>
              <Typography variant='caption' color='muted'>
                {serverType.description}
              </Typography>
            </div>
          </div>
        </button>
      ))}
    </div>
  </div>
);

/**
 * Basic info step component
 */
const BasicInfoStep: React.FC<{
  register: ReturnType<typeof useForm<FormData>>['register'];
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors'];
  validationErrors: Record<string, string>;
}> = ({ register, errors, validationErrors }) => (
  <div className='space-y-4'>
    <Typography variant='h6' className='mb-4'>
      Basic Information
    </Typography>
    <div>
      <Label htmlFor='name'>
        Server Name
        <Typography variant='caption' className='text-red-500 ml-1'>*</Typography>
      </Label>
      <Input
        id='name'
        {...register('name', { required: 'Server name is required' })}
        placeholder='e.g., My GitHub Server'
        className={cn(
          'mt-1',
          (errors.name || validationErrors.name) && 'border-red-500'
        )}
      />
      {(errors.name || validationErrors.name) && (
        <Typography variant='caption' className='text-red-500 mt-1'>
          {errors.name?.message || validationErrors.name}
        </Typography>
      )}
      <Typography variant='caption' color='muted' className='mt-1'>
        Choose a descriptive name to identify this server
      </Typography>
    </div>
  </div>
);

/**
 * Configuration step component
 */
const ConfigurationStep: React.FC<{
  selectedServerType: typeof selectedServerType;
  configFields: React.ReactElement;
}> = ({ selectedServerType, configFields }) => (
  <div className='space-y-4'>
    <Typography variant='h6' className='mb-4'>
      {selectedServerType?.name} Configuration
    </Typography>
    {configFields}
  </div>
);

/**
 * Review step component
 */
const ReviewStep: React.FC<{
  watch: ReturnType<typeof useForm<FormData>>['watch'];
  selectedServerType: typeof selectedServerType;
  configSummary: React.ReactElement[];
}> = ({ watch, selectedServerType, configSummary }) => (
  <div className='space-y-4'>
    <Typography variant='h6' className='mb-4'>
      Review Configuration
    </Typography>
    <div className='space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg'>
      <div>
        <Typography variant='caption' color='muted'>
          Server Name
        </Typography>
        <Typography variant='body1' className='font-medium'>
          {watch('name')}
        </Typography>
      </div>
      <div>
        <Typography variant='caption' color='muted'>
          Server Type
        </Typography>
        <Typography variant='body1' className='font-medium'>
          {selectedServerType?.name}
        </Typography>
      </div>
      <div>
        <Typography variant='caption' color='muted'>
          Configuration
        </Typography>
        <div className='mt-1 space-y-1'>{configSummary}</div>
      </div>
    </div>
  </div>
);

/**
 * Configuration fields renderer component
 */
const ConfigFieldsRenderer: React.FC<{
  selectedType: MCPServerType;
  register: ReturnType<typeof useForm<FormData>>['register'];
  validationErrors: Record<string, string>;
}> = ({ selectedType, register, validationErrors }) => {
  switch (selectedType) {
    case 'filesystem':
      return (
        <>
          <div>
            <Label htmlFor='rootPath'>
              Root Path
              <span className='text-red-500 ml-1'>*</span>
            </Label>
            <Input
              id='rootPath'
              {...register('rootPath')}
              placeholder='/path/to/directory'
              className={cn(
                'mt-1',
                validationErrors.rootPath && 'border-red-500'
              )}
            />
            {validationErrors.rootPath && (
              <Typography variant='caption' className='text-red-500 mt-1'>
                {validationErrors.rootPath}
              </Typography>
            )}
          </div>
          <div>
            <Label htmlFor='allowedPaths'>
              Allowed Paths (optional)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <FiInfo className='inline-block w-4 h-4 ml-1 text-gray-400' />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Comma-separated list of allowed paths</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              id='allowedPaths'
              {...register('allowedPaths')}
              placeholder='/allowed/path1, /allowed/path2'
              className='mt-1'
            />
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='readOnly'
              {...register('readOnly')}
              className='rounded border-gray-300 dark:border-gray-600'
            />
            <Label htmlFor='readOnly' className='cursor-pointer'>
              Read-only access
            </Label>
          </div>
        </>
      );

    case 'github':
      return (
        <>
          <div>
            <Label htmlFor='token'>
              GitHub Token
              <span className='text-red-500 ml-1'>*</span>
            </Label>
            <Input
              id='token'
              type='password'
              {...register('token')}
              placeholder='ghp_...'
              className={cn(
                'mt-1',
                validationErrors.token && 'border-red-500'
              )}
            />
            {validationErrors.token && (
              <Typography variant='caption' className='text-red-500 mt-1'>
                {validationErrors.token}
              </Typography>
            )}
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='owner'>
                Owner
                <span className='text-red-500 ml-1'>*</span>
              </Label>
              <Input
                id='owner'
                {...register('owner')}
                placeholder='username or org'
                className={cn(
                  'mt-1',
                  validationErrors.owner && 'border-red-500'
                )}
              />
            </div>
            <div>
              <Label htmlFor='repo'>
                Repository
                <span className='text-red-500 ml-1'>*</span>
              </Label>
              <Input
                id='repo'
                {...register('repo')}
                placeholder='repository-name'
                className={cn(
                  'mt-1',
                  validationErrors.repo && 'border-red-500'
                )}
              />
            </div>
          </div>
          <div>
            <Label htmlFor='branch'>Branch (optional)</Label>
            <Input
              id='branch'
              {...register('branch')}
              placeholder='main'
              className='mt-1'
            />
          </div>
        </>
      );

    case 'postgres':
      return (
        <>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='host'>
                Host
                <span className='text-red-500 ml-1'>*</span>
              </Label>
              <Input
                id='host'
                {...register('host')}
                placeholder='localhost'
                className={cn(
                  'mt-1',
                  validationErrors.host && 'border-red-500'
                )}
              />
            </div>
            <div>
              <Label htmlFor='port'>
                Port
                <span className='text-red-500 ml-1'>*</span>
              </Label>
              <Input
                id='port'
                type='number'
                {...register('port')}
                placeholder='5432'
                className={cn(
                  'mt-1',
                  validationErrors.port && 'border-red-500'
                )}
              />
              {validationErrors.port && (
                <Typography variant='caption' className='text-red-500 mt-1'>
                  {validationErrors.port}
                </Typography>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor='database'>
              Database
              <span className='text-red-500 ml-1'>*</span>
            </Label>
            <Input
              id='database'
              {...register('database')}
              placeholder='mydb'
              className={cn(
                'mt-1',
                validationErrors.database && 'border-red-500'
              )}
            />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='username'>
                Username
                <span className='text-red-500 ml-1'>*</span>
              </Label>
              <Input
                id='username'
                {...register('username')}
                placeholder='postgres'
                className={cn(
                  'mt-1',
                  validationErrors.username && 'border-red-500'
                )}
              />
            </div>
            <div>
              <Label htmlFor='password'>
                Password
                <span className='text-red-500 ml-1'>*</span>
              </Label>
              <Input
                id='password'
                type='password'
                {...register('password')}
                className={cn(
                  'mt-1',
                  validationErrors.password && 'border-red-500'
                )}
              />
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='ssl'
              {...register('ssl')}
              className='rounded border-gray-300 dark:border-gray-600'
            />
            <Label htmlFor='ssl' className='cursor-pointer'>
              Use SSL connection
            </Label>
          </div>
        </>
      );

    case 'sqlite':
      return (
        <div>
          <Label htmlFor='path'>
            Database Path
            <span className='text-red-500 ml-1'>*</span>
          </Label>
          <Input
            id='path'
            {...register('path')}
            placeholder='/path/to/database.db'
            className={cn('mt-1', validationErrors.path && 'border-red-500')}
          />
          {validationErrors.path && (
            <Typography variant='caption' className='text-red-500 mt-1'>
              {validationErrors.path}
            </Typography>
          )}
        </div>
      );

    case 'custom':
      return (
        <>
          <div>
            <Label htmlFor='command'>
              Command
              <span className='text-red-500 ml-1'>*</span>
            </Label>
            <Input
              id='command'
              {...register('command')}
              placeholder='npx @modelcontextprotocol/server'
              className={cn(
                'mt-1',
                validationErrors.command && 'border-red-500'
              )}
            />
            {validationErrors.command && (
              <Typography variant='caption' className='text-red-500 mt-1'>
                {validationErrors.command}
              </Typography>
            )}
          </div>
          <div>
            <Label htmlFor='args'>Arguments (optional)</Label>
            <Input
              id='args'
              {...register('args')}
              placeholder='--port 3000 --verbose'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='env'>
              Environment Variables (optional)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <FiInfo className='inline-block w-4 h-4 ml-1 text-gray-400' />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Comma-separated KEY=VALUE pairs</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              id='env'
              {...register('env')}
              placeholder='NODE_ENV=production, API_KEY=secret'
              className='mt-1'
            />
          </div>
          <div>
            <Label htmlFor='cwd'>Working Directory (optional)</Label>
            <Input
              id='cwd'
              {...register('cwd')}
              placeholder='/path/to/working/directory'
              className='mt-1'
            />
          </div>
        </>
      );
  
    default:
      return null;
  }
};

/**
 * Config summary component
 */
const ConfigSummary: React.FC<{
  selectedType: MCPServerType;
  values: FormData;
}> = ({ selectedType, values }) => {
  const items: React.ReactElement[] = [];

  switch (selectedType) {
    case 'filesystem':
      if (values.rootPath) {
        items.push(
          <div key='rootPath'>
            <Typography variant='caption' className='font-mono'>
              Root: {values.rootPath}
            </Typography>
          </div>
        );
      }
      if (values.readOnly) {
        items.push(
          <div key='readOnly'>
            <Typography
              variant='caption'
              className='text-yellow-600 dark:text-yellow-400'
            >
              Read-only mode enabled
            </Typography>
          </div>
        );
      }
      break;

    case 'github':
      if (values.owner && values.repo) {
        items.push(
          <div key='repo'>
            <Typography variant='caption' className='font-mono'>
              Repository: {values.owner}/{values.repo}
            </Typography>
          </div>
        );
      }
      if (values.branch) {
        items.push(
          <div key='branch'>
            <Typography variant='caption' className='font-mono'>
              Branch: {values.branch}
            </Typography>
          </div>
        );
      }
      break;

    case 'postgres':
      if (values.host && values.database) {
        items.push(
          <div key='connection'>
            <Typography variant='caption' className='font-mono'>
              {values.username}@{values.host}:{values.port || 5432}/
              {values.database}
            </Typography>
          </div>
        );
      }
      if (values.ssl) {
        items.push(
          <div key='ssl'>
            <Typography
              variant='caption'
              className='text-green-600 dark:text-green-400'
            >
              SSL enabled
            </Typography>
          </div>
        );
      }
      break;

    case 'sqlite':
      if (values.path) {
        items.push(
          <div key='path'>
            <Typography variant='caption' className='font-mono'>
              Path: {values.path}
            </Typography>
          </div>
        );
      }
      break;

    case 'custom':
      if (values.command) {
        items.push(
          <div key='command'>
            <Typography variant='caption' className='font-mono'>
              Command: {values.command}
            </Typography>
          </div>
        );
      }
      break;
  }

  return <>{items}</>;
};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className='py-6'>
            <StepIndicator currentStep={currentStep} />
            <div className='min-h-[300px]'>
              {currentStep === WizardStep.SelectType && (
                <SelectTypeStep
                  serverTypes={serverTypes}
                  selectedType={selectedType}
                  setSelectedType={setSelectedType}
                  setValue={setValue}
                />
              )}
              {currentStep === WizardStep.BasicInfo && (
                <BasicInfoStep
                  register={register}
                  errors={errors}
                  validationErrors={validationErrors}
                />
              )}
              {currentStep === WizardStep.Configuration && (
                <ConfigurationStep
                  selectedServerType={selectedServerType}
                  configFields={<ConfigFieldsRenderer 
                    selectedType={selectedType}
                    register={register}
                    validationErrors={validationErrors}
                  />}
                />
              )}
              {currentStep === WizardStep.Review && (
                <ReviewStep
                  watch={watch}
                  selectedServerType={selectedServerType}
                  configSummary={[
                    <ConfigSummary
                      key='summary'
                      selectedType={selectedType}
                      values={getValues()}
                    />
                  ]}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <div className='flex justify-between w-full'>
              <Button
                type='button'
                variant='outline'
                onClick={
                  currentStep === WizardStep.SelectType ? onClose : handleBack
                }
                disabled={isSubmitting}
              >
                {currentStep === WizardStep.SelectType ? 'Cancel' : 'Back'}
              </Button>

              <div className='flex gap-2'>
                {currentStep < WizardStep.Review ? (
                  <Button
                    type='button'
                    onClick={handleNext}
                    disabled={isSubmitting}
                  >
                    Next
                    <FiArrowRight className='w-4 h-4 ml-2' />
                  </Button>
                ) : (
                  <Button type='submit' disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving...'
                      : editingServer
                      ? 'Update Server'
                      : 'Add Server'}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
