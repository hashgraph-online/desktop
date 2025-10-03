import React, { useState } from 'react';
import {
  FiExternalLink,
  FiCheck,
  FiCopy,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import Typography from './Typography';
import { Button } from './Button';

interface ApiKeyGuideProps {
  provider: 'openai' | 'anthropic';
  onClose?: () => void;
}

interface StepProps {
  stepNumber: number;
  title: string;
  isCompleted?: boolean;
  children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({
  stepNumber,
  title,
  isCompleted = false,
  children,
}) => {
  return (
    <div className='flex space-x-4'>
      <div className='flex-shrink-0'>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            isCompleted ? 'bg-green-500 text-white' : 'bg-brand-blue text-white'
          }`}
        >
          {isCompleted ? <FiCheck className='w-4 h-4' /> : stepNumber}
        </div>
      </div>
      <div className='flex-1'>
        <div className='mb-2'>
          <Typography variant='h6' className='font-semibold'>
            {title}
          </Typography>
        </div>
        <div className='text-gray-600 dark:text-gray-300'>{children}</div>
      </div>
    </div>
  );
};

const OpenAIGuide: React.FC = () => {
  const [showApiKey, setShowApiKey] = useState(false);

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('sk-your-api-key-here');
  };

  return (
    <div className='space-y-8'>
      <Step stepNumber={1} title='Create an OpenAI Account'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            First, you'll need to create an account with OpenAI if you don't
            already have one.
          </Typography>
          <a
            href='https://platform.openai.com/signup'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-dark underline'
          >
            <span>Sign up for OpenAI</span>
            <FiExternalLink className='w-4 h-4' />
          </a>
          <Typography variant='caption' color='muted'>
            You'll need to verify your email address and phone number.
          </Typography>
        </div>
      </Step>

      <Step stepNumber={2} title='Add Billing Information'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            OpenAI requires a payment method to use their API. Don't worry - you
            only pay for what you use, and new accounts get $5 in free credits.
          </Typography>
          <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
            <Typography
              variant='caption'
              className='text-blue-800 dark:text-blue-200'
            >
              💡 <strong>Tip:</strong> Set up usage limits in your billing
              settings to avoid unexpected charges. You can set a monthly limit
              as low as $5.
            </Typography>
          </div>
          <a
            href='https://platform.openai.com/account/billing'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-dark underline'
          >
            <span>Go to Billing Settings</span>
            <FiExternalLink className='w-4 h-4' />
          </a>
        </div>
      </Step>

      <Step stepNumber={3} title='Generate Your API Key'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            Navigate to the API Keys section and create a new key.
          </Typography>
          <div className='space-y-2'>
            <a
              href='https://platform.openai.com/api-keys'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-dark underline'
            >
              <span>Open API Keys Page</span>
              <FiExternalLink className='w-4 h-4' />
            </a>
            <div className='ml-4 space-y-1'>
              <Typography variant='caption' color='muted'>
                1. Click "Create new secret key"
              </Typography>
              <Typography variant='caption' color='muted'>
                2. Give it a descriptive name (e.g., "Hedera Agent")
              </Typography>
              <Typography variant='caption' color='muted'>
                3. Copy the key immediately - you won't see it again!
              </Typography>
            </div>
          </div>
        </div>
      </Step>

      <Step stepNumber={4} title='Copy Your API Key'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            Your API key will look like this:
          </Typography>
          <div className='bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 font-mono text-sm'>
            <div className='flex items-center justify-between'>
              <span
                className={
                  showApiKey
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400'
                }
              >
                {showApiKey
                  ? 'sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890'
                  : 'sk-•••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </span>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                >
                  {showApiKey ? (
                    <FiEyeOff className='w-4 h-4' />
                  ) : (
                    <FiEye className='w-4 h-4' />
                  )}
                </button>
                <button
                  onClick={handleCopyApiKey}
                  className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                >
                  <FiCopy className='w-4 h-4' />
                </button>
              </div>
            </div>
          </div>
          <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
            <Typography
              variant='caption'
              className='text-yellow-800 dark:text-yellow-200'
            >
              ⚠️ <strong>Important:</strong> Keep your API key secure! Never
              share it publicly or commit it to version control. This app stores
              it securely in your system keychain.
            </Typography>
          </div>
        </div>
      </Step>

      <Step stepNumber={5} title='Paste the Key Below'>
        <Typography variant='body1'>
          Now paste your API key in the "API Key" field below. The app will
          validate it and test the connection for you.
        </Typography>
      </Step>
    </div>
  );
};

const AnthropicGuide: React.FC = () => {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className='space-y-8'>
      <Step stepNumber={1} title='Create an Anthropic Account'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            Sign up for an Anthropic account to access Claude's API.
          </Typography>
          <a
            href='https://console.anthropic.com/account'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-dark underline'
          >
            <span>Sign up for Anthropic</span>
            <FiExternalLink className='w-4 h-4' />
          </a>
          <Typography variant='caption' color='muted'>
            You'll need to verify your email address and phone number.
          </Typography>
        </div>
      </Step>

      <Step stepNumber={2} title='Add Credits to Your Account'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            Anthropic uses a prepaid credit system. You'll need to purchase
            credits before you can use the API.
          </Typography>
          <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
            <Typography
              variant='caption'
              className='text-blue-800 dark:text-blue-200'
            >
              💡 <strong>Tip:</strong> Start with $20-50 in credits. Claude 3.5
              Haiku is very cost-effective for most tasks.
            </Typography>
          </div>
          <a
            href='https://console.anthropic.com/account/billing'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-dark underline'
          >
            <span>Add Credits</span>
            <FiExternalLink className='w-4 h-4' />
          </a>
        </div>
      </Step>

      <Step stepNumber={3} title='Generate Your API Key'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            Create a new API key from the Anthropic console.
          </Typography>
          <div className='space-y-2'>
            <a
              href='https://console.anthropic.com/settings/keys'
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-dark underline'
            >
              <span>Open API Keys Page</span>
              <FiExternalLink className='w-4 h-4' />
            </a>
            <div className='ml-4 space-y-1'>
              <Typography variant='caption' color='muted'>
                1. Click "Create Key"
              </Typography>
              <Typography variant='caption' color='muted'>
                2. Give it a name (e.g., "Hedera Agent")
              </Typography>
              <Typography variant='caption' color='muted'>
                3. Copy the key immediately - you won't see it again!
              </Typography>
            </div>
          </div>
        </div>
      </Step>

      <Step stepNumber={4} title='Copy Your API Key'>
        <div className='space-y-3'>
          <Typography variant='body1'>
            Your Anthropic API key will look like this:
          </Typography>
          <div className='bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 font-mono text-sm'>
            <div className='flex items-center justify-between'>
              <span
                className={
                  showApiKey
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400'
                }
              >
                {showApiKey
                  ? 'sk-ant-api03-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890'
                  : 'sk-ant-•••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
              </span>
              <div className='flex items-center space-x-2'>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                >
                  {showApiKey ? (
                    <FiEyeOff className='w-4 h-4' />
                  ) : (
                    <FiEye className='w-4 h-4' />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4'>
            <Typography
              variant='caption'
              className='text-yellow-800 dark:text-yellow-200'
            >
              ⚠️ <strong>Important:</strong> Anthropic API keys start with
              "sk-ant-". Keep your key secure and never share it publicly.
            </Typography>
          </div>
        </div>
      </Step>

      <Step stepNumber={5} title='Paste the Key Below'>
        <Typography variant='body1'>
          Now paste your API key in the "API Key" field below. The app will
          validate it and test the connection for you.
        </Typography>
      </Step>
    </div>
  );
};

export const ApiKeyGuide: React.FC<ApiKeyGuideProps> = ({
  provider,
  onClose,
}) => {
  return (
    <div className='max-w-4xl mx-auto'>
      <div className='mb-6'>
        <div className='flex items-center justify-between mb-4'>
          <Typography variant='h4' className='flex items-center space-x-2'>
            <span>🔑</span>
            <span>
              How to Get Your {provider === 'openai' ? 'OpenAI' : 'Anthropic'}{' '}
              API Key
            </span>
          </Typography>
          {onClose && (
            <Button variant='outline' onClick={onClose}>
              Close Guide
            </Button>
          )}
        </div>
        <Typography variant='body1' color='muted' className='max-w-2xl'>
          Follow these step-by-step instructions to get your API key. Don't
          worry - it's easier than it looks!
        </Typography>
      </div>

      <div className='bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6'>
        {provider === 'openai' ? <OpenAIGuide /> : <AnthropicGuide />}
      </div>

      <div className='mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4'>
        <div className='flex items-start space-x-3'>
          <div className='flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center'>
            <FiCheck className='w-4 h-4 text-white' />
          </div>
          <div>
            <Typography
              variant='body1'
              className='font-semibold text-green-800 dark:text-green-200 mb-1'
            >
              Need Help?
            </Typography>
            <Typography
              variant='caption'
              className='text-green-700 dark:text-green-300'
            >
              If you run into any issues, check the{' '}
              {provider === 'openai' ? 'OpenAI' : 'Anthropic'} documentation or
              contact their support team. Most issues are related to billing
              setup or account verification.
            </Typography>
          </div>
        </div>
      </div>
    </div>
  );
};
