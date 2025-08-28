import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  FiServer,
  FiDatabase,
  FiGithub,
  FiHardDrive,
  FiSettings,
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
import { Textarea } from '../ui/textarea';
import Typography from '../ui/Typography';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';
import {
  AddMCPServerProps,
  MCPServerType,
  MCPServerFormData,
  MCPServerConfigType,
} from '../../types/mcp';
import { MCPServerFormValidator, FieldError } from '../../lib/mcp-validation';
import { FiAlertCircle } from 'react-icons/fi';

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
    icon: <FiHardDrive className='w-5 h-5' />,
  },
  {
    type: 'github' as MCPServerType,
    name: 'GitHub',
    description: 'Interact with GitHub repositories',
    icon: <FiGithub className='w-5 h-5' />,
  },
  {
    type: 'postgres' as MCPServerType,
    name: 'PostgreSQL',
    description: 'Connect to PostgreSQL databases',
    icon: <FiDatabase className='w-5 h-5' />,
  },
  {
    type: 'sqlite' as MCPServerType,
    name: 'SQLite',
    description: 'Access SQLite database files',
    icon: <FiDatabase className='w-5 h-5' />,
  },
  {
    type: 'custom' as MCPServerType,
    name: 'Custom',
    description: 'Run custom MCP server commands',
    icon: <FiServer className='w-5 h-5' />,
  },
];

/**
 * Helper component to display field requirements
 */
const FieldRequirement: React.FC<{ requirement: string }> = ({
  requirement,
}) => {
  if (!requirement) return null;

  return (
    <div className='flex items-start gap-1 mt-1'>
      <FiInfo className='w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0' />
      <Typography
        variant='caption'
        className='text-gray-500 dark:text-gray-400'
      >
        {requirement}
      </Typography>
    </div>
  );
};

/**
 * Modal component for adding/editing MCP servers
 * @param props - Add server props including modal state and handlers
 * @returns Modal with form for server configuration
 */
export interface AddMCPServerPropsExtended extends AddMCPServerProps {
  template?: {
    name: string;
    type: MCPServerType;
    config: Record<string, any>;
    requirements?: string[];
  };
}

export const AddMCPServer: React.FC<AddMCPServerPropsExtended> = ({
  isOpen,
  onClose,
  onSubmit,
  editingServer,
  template,
}) => {
  const [selectedType, setSelectedType] = useState<MCPServerType>('filesystem');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [fieldRequirements, setFieldRequirements] = useState<
    Record<string, string>
  >({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      type: 'filesystem',
      readOnly: false,
      ssl: false,
      port: 5432,
    },
  });

  const watchedType = watch('type');

  useEffect(() => {
    setSelectedType(watchedType);
    const requirements =
      MCPServerFormValidator.getAllFieldRequirements(watchedType);
    setFieldRequirements(requirements);
    setValidationErrors({});
  }, [watchedType]);

  useEffect(() => {
    if (editingServer) {
      const formData: any = {
        name: editingServer.name,
        type: editingServer.type,
        ...editingServer.config,
      };

      if (
        editingServer.type === 'custom' &&
        editingServer.config.type === 'custom' &&
        editingServer.config.env
      ) {
        formData.env = Object.entries(editingServer.config.env)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
      }

      if (
        editingServer.type === 'custom' &&
        editingServer.config.type === 'custom' &&
        editingServer.config.args
      ) {
        formData.args = editingServer.config.args.join(' ');
      }

      reset(formData);
      setSelectedType(editingServer.type);
    } else if (template) {
      const templateData: any = {
        name: template.name,
        type: template.type,
        ...template.config,
      };

      if (template.type === 'custom' && template.config?.env) {
        templateData.env = Object.entries(template.config.env)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
      }

      if (template.type === 'custom' && template.config?.args) {
        templateData.args = template.config.args.join(' ');
      }

      if (templateData.rootPath === '$HOME') {
        templateData.rootPath =
          process.env.HOME || process.env.USERPROFILE || '';
      }

      reset(templateData);
      setSelectedType(template.type);
    } else {
      reset({
        name: '',
        type: 'filesystem',
        readOnly: false,
        ssl: false,
        port: 5432,
      });
      setSelectedType('filesystem');
    }
  }, [editingServer, template, reset]);

  /**
   * Validate a single field in real-time
   */
  const validateField = (field: string, value: unknown) => {
    const validators =
      MCPServerFormValidator.getValidationHelpers(selectedType);
    const defaultValidators =
      MCPServerFormValidator.getValidationHelpers('filesystem');

    let error: FieldError | null = null;

    if (field === 'name') {
      error = defaultValidators.validateField(field, value);
    } else {
      error = validators.validateField(field, value);
    }

    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error.message;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  };

  /**
   * Handle field blur to trigger validation
   */
  const handleFieldBlur = (field: string) => {
    const value = getValues(field as keyof FormData);
    validateField(field, value);
  };

  const handleFormSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const allErrors = MCPServerFormValidator.validateAllFields(
        data.type,
        data
      );
      if (allErrors.length > 0) {
        const errorMap: Record<string, string> = {};
        allErrors.forEach((error) => {
          errorMap[error.field] = error.message;
        });
        setValidationErrors(errorMap);
        setIsSubmitting(false);
        return;
      }
      const config: Record<string, any> = { type: data.type };

      switch (data.type) {
        case 'filesystem':
          config.rootPath = data.rootPath;
          if (data.allowedPaths) {
            config.allowedPaths = data.allowedPaths
              .split(',')
              .map((p) => p.trim());
          }
          if (data.excludePaths) {
            config.excludePaths = data.excludePaths
              .split(',')
              .map((p) => p.trim());
          }
          config.readOnly = data.readOnly;
          break;

        case 'github':
          config.token = data.token;
          config.owner = data.owner;
          config.repo = data.repo;
          config.branch = data.branch || 'main';
          break;

        case 'postgres':
          config.host = data.host;
          config.port = data.port || 5432;
          config.database = data.database;
          config.username = data.username;
          config.password = data.password;
          config.ssl = data.ssl;
          break;

        case 'sqlite':
          config.path = data.path;
          config.readOnly = data.readOnly;
          break;

        case 'custom':
          config.command = data.command;
          if (data.args) {
            config.args = data.args.split(' ').filter((arg) => arg.trim());
          }
          if (data.env) {
            config.env = data.env.split('\n').reduce(
              (acc, line) => {
                const [key, value] = line.split('=', 2);
                if (key && value) {
                  acc[key.trim()] = value.trim();
                }
                return acc;
              },
              {} as Record<string, string>
            );
          }
          config.cwd = data.cwd;
          break;
      }

      const formData: MCPServerFormData = {
        name: data.name,
        type: data.type,
        config: config as MCPServerConfigType,
      };

      await onSubmit(formData);
      onClose();
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

/**
 * Filesystem configuration fields component
 */
const FilesystemConfigFields: React.FC<{
  register: any;
  errors: any;
  validationErrors: Record<string, string>;
  fieldRequirements: Record<string, string>;
  handleFieldBlur: (field: string) => void;
}> = ({ register, errors, validationErrors, fieldRequirements, handleFieldBlur }) => (
  <div className='space-y-4'>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Root Path
      </label>
      <Input
        placeholder='/path/to/directory'
        {...register('rootPath', { required: 'Root path is required' })}
        onBlur={() => handleFieldBlur('rootPath')}
        className={cn(
          validationErrors.rootPath &&
            'border-red-500 focus:border-red-500'
        )}
      />
      {(errors.rootPath || validationErrors.rootPath) && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.rootPath?.message || validationErrors.rootPath}
        </Typography>
      )}
      <FieldRequirement requirement={fieldRequirements.rootPath} />
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Allowed Paths (comma-separated, optional)
      </label>
      <Input
        placeholder='/allowed/path1, /allowed/path2'
        {...register('allowedPaths')}
      />
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Exclude Paths (comma-separated, optional)
      </label>
      <Input
        placeholder='/exclude/path1, /exclude/path2'
        {...register('excludePaths')}
      />
    </div>
    <label className='flex items-center gap-2'>
      <input
        type='checkbox'
        {...register('readOnly')}
        className='rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500'
      />
      <Typography variant='body1'>Read-only access</Typography>
    </label>
  </div>
);

/**
 * GitHub configuration fields component
 */
const GitHubConfigFields: React.FC<{
  register: any;
  errors: any;
  validationErrors: Record<string, string>;
  fieldRequirements: Record<string, string>;
  handleFieldBlur: (field: string) => void;
}> = ({ register, errors, validationErrors, fieldRequirements, handleFieldBlur }) => (
  <div className='space-y-4'>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Personal Access Token
      </label>
      <Input
        type='password'
        placeholder='ghp_xxxxxxxxxxxxxxxxxxxx'
        {...register('token', { required: 'GitHub token is required' })}
        onBlur={() => handleFieldBlur('token')}
        className={cn(
          validationErrors.token &&
            'border-red-500 focus:border-red-500'
        )}
      />
      {(errors.token || validationErrors.token) && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.token?.message || validationErrors.token}
        </Typography>
      )}
      <FieldRequirement requirement={fieldRequirements.token} />
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Repository Owner
      </label>
      <Input
        placeholder='octocat'
        {...register('owner', {
          required: 'Repository owner is required',
        })}
      />
      {errors.owner && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.owner.message}
        </Typography>
      )}
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Repository Name
      </label>
      <Input
        placeholder='Hello-World'
        {...register('repo', {
          required: 'Repository name is required',
        })}
      />
      {errors.repo && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.repo.message}
        </Typography>
      )}
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Branch (optional)
      </label>
      <Input placeholder='main' {...register('branch')} />
    </div>
  </div>
);

/**
 * PostgreSQL configuration fields component
 */
const PostgresConfigFields: React.FC<{
  register: any;
  errors: any;
}> = ({ register, errors }) => (
  <div className='space-y-4'>
    <div className='grid grid-cols-2 gap-4'>
      <div className='space-y-1'>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
          Host
        </label>
        <Input
          placeholder='localhost'
          {...register('host', { required: 'Host is required' })}
        />
        {errors.host && (
          <Typography
            variant='caption'
            className='text-red-600 dark:text-red-400'
          >
            {errors.host.message}
          </Typography>
        )}
      </div>
      <div className='space-y-1'>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
          Port
        </label>
        <Input
          type='number'
          placeholder='5432'
          {...register('port', {
            required: 'Port is required',
            min: { value: 1, message: 'Port must be greater than 0' },
            max: {
              value: 65535,
              message: 'Port must be less than 65536',
            },
          })}
        />
        {errors.port && (
          <Typography
            variant='caption'
            className='text-red-600 dark:text-red-400'
          >
            {errors.port.message}
          </Typography>
        )}
      </div>
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Database Name
      </label>
      <Input
        placeholder='mydatabase'
        {...register('database', {
          required: 'Database name is required',
        })}
      />
      {errors.database && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.database.message}
        </Typography>
      )}
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Username
      </label>
      <Input
        placeholder='postgres'
        {...register('username', { required: 'Username is required' })}
      />
      {errors.username && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.username.message}
        </Typography>
      )}
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Password
      </label>
      <Input
        type='password'
        placeholder='••••••••'
        {...register('password', { required: 'Password is required' })}
      />
      {errors.password && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.password.message}
        </Typography>
      )}
    </div>
    <label className='flex items-center gap-2'>
      <input
        type='checkbox'
        {...register('ssl')}
        className='rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500'
      />
      <Typography variant='body1'>Use SSL connection</Typography>
    </label>
  </div>
);

/**
 * SQLite configuration fields component
 */
const SqliteConfigFields: React.FC<{
  register: any;
  errors: any;
}> = ({ register, errors }) => (
  <div className='space-y-4'>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Database Path
      </label>
      <Input
        placeholder='/path/to/database.db'
        {...register('path', { required: 'Database path is required' })}
      />
      {errors.path && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.path.message}
        </Typography>
      )}
    </div>
    <label className='flex items-center gap-2'>
      <input
        type='checkbox'
        {...register('readOnly')}
        className='rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500'
      />
      <Typography variant='body1'>Read-only access</Typography>
    </label>
  </div>
);

/**
 * Custom configuration fields component
 */
const CustomConfigFields: React.FC<{
  register: any;
  errors: any;
}> = ({ register, errors }) => (
  <div className='space-y-4'>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Command
      </label>
      <Input
        placeholder='@your-org/mcp-server or /path/to/server.js'
        {...register('command', { required: 'Command is required' })}
      />
      {errors.command && (
        <Typography
          variant='caption'
          className='text-red-600 dark:text-red-400'
        >
          {errors.command.message}
        </Typography>
      )}
      <div className='mt-1'>
        <Typography variant='caption' color='muted' className='block'>
          Enter an npm package name (e.g., @your-org/mcp-server) to run
          with npx, or a full path to a local executable
        </Typography>
      </div>
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Arguments (space-separated, optional)
      </label>
      <Input
        placeholder='--port 3000 --verbose'
        {...register('args')}
      />
    </div>
    <div>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
        Environment Variables (optional)
      </label>
      <Textarea
        placeholder='NODE_ENV=production&#10;PORT=3000'
        rows={3}
        {...register('env')}
      />
    </div>
    <div className='space-y-1'>
      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
        Working Directory (optional)
      </label>
      <Input
        placeholder='/path/to/working/directory'
        {...register('cwd')}
      />
    </div>
  </div>
);

/**
 * Configuration fields container component
 */
const ConfigFields: React.FC<{
  selectedType: MCPServerType;
  register: any;
  errors: any;
  validationErrors: Record<string, string>;
  fieldRequirements: Record<string, string>;
  handleFieldBlur: (field: string) => void;
}> = ({ selectedType, register, errors, validationErrors, fieldRequirements, handleFieldBlur }) => {
  switch (selectedType) {
    case 'filesystem':
      return <FilesystemConfigFields register={register} errors={errors} validationErrors={validationErrors} fieldRequirements={fieldRequirements} handleFieldBlur={handleFieldBlur} />;
    case 'github':
      return <GitHubConfigFields register={register} errors={errors} validationErrors={validationErrors} fieldRequirements={fieldRequirements} handleFieldBlur={handleFieldBlur} />;
    case 'postgres':
      return <PostgresConfigFields register={register} errors={errors} />;
    case 'sqlite':
      return <SqliteConfigFields register={register} errors={errors} />;
    case 'custom':
      return <CustomConfigFields register={register} errors={errors} />;
    default:
      return null;
  }
};

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className='sm:max-w-lg max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>
            {(() => {
              if (editingServer) return 'Edit MCP Server';
              if (template) return `Quick Install: ${template.name}`;
              return 'Add MCP Server';
            })()}
          </DialogTitle>
        </DialogHeader>

        {template?.requirements && template.requirements.length > 0 && (
          <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4'>
            <div className='flex items-start gap-2'>
              <FiAlertCircle className='w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
              <div>
                <div className='mb-2'>
                  <Typography
                    variant='body1'
                    className='font-medium text-blue-900 dark:text-blue-100'
                  >
                    Setup Requirements
                  </Typography>
                </div>
                <ul className='space-y-1'>
                  {template.requirements.map((req, index) => (
                    <li key={index} className='flex items-start gap-2'>
                      <span className='text-blue-600 dark:text-blue-400 mt-0.5'>
                        •
                      </span>
                      <Typography
                        variant='caption'
                        className='text-blue-800 dark:text-blue-200'
                      >
                        {req}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className='overflow-y-auto max-h-[calc(90vh-8rem)]'>
          <form id='mcp-server-form' onSubmit={handleSubmit(handleFormSubmit)} className='space-y-6'>
          <div className='space-y-4'>
            <div className='space-y-1'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Server Name
              </label>
              <Input
                placeholder='My MCP Server'
                {...register('name', { required: 'Server name is required' })}
                onBlur={() => handleFieldBlur('name')}
                className={cn(
                  validationErrors.name && 'border-red-500 focus:border-red-500'
                )}
              />
              {(errors.name || validationErrors.name) && (
                <Typography
                  variant='caption'
                  className='text-red-600 dark:text-red-400'
                >
                  {errors.name?.message || validationErrors.name}
                </Typography>
              )}
              <FieldRequirement requirement={fieldRequirements.name} />
            </div>

            <div className='space-y-1'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                Server Type
              </label>
              <Select
                value={selectedType}
                onValueChange={(value) => {
                  setValue('type', value as MCPServerType);
                  setSelectedType(value as MCPServerType);
                }}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue>
                    {(() => {
                      const selected = serverTypes.find(
                        (t) => t.type === selectedType
                      );
                      return selected ? (
                        <div className='flex items-center gap-2'>
                          {selected.icon}
                          <span>{selected.name}</span>
                        </div>
                      ) : (
                        'Select a server type'
                      );
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {serverTypes.map(({ type, name, description, icon }) => (
                    <SelectItem key={type} value={type}>
                      <div className='flex items-center gap-2'>
                        {icon}
                        <div>
                          <div className='font-medium'>{name}</div>
                          <div className='text-xs text-gray-500 dark:text-gray-400'>
                            {description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ConfigFields 
              selectedType={selectedType}
              register={register}
              errors={errors}
              validationErrors={validationErrors}
              fieldRequirements={fieldRequirements}
              handleFieldBlur={handleFieldBlur}
            />
          </div>
          </form>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type='submit' form='mcp-server-form' disabled={isSubmitting}>
            {(() => {
              if (isSubmitting) return 'Saving...';
              if (editingServer) return 'Update Server';
              return 'Add Server';
            })()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
