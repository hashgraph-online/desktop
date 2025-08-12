import React from 'react';
import { Link2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import Typography from '../ui/Typography';
import { SOCIAL_PLATFORMS } from '../../../shared/schemas/hcs10';

interface SocialLinksManagerProps {
  value?: {
    twitter?: string;
    github?: string;
    website?: string;
  };
  onChange: (value: {
    twitter?: string;
    github?: string;
    website?: string;
  }) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * Simple form for managing social links
 */
export function SocialLinksManager({
  value = {},
  onChange,
  disabled = false,
}: SocialLinksManagerProps) {
  const handleChange = (
    platform: 'twitter' | 'github' | 'website',
    url: string
  ) => {
    onChange({
      ...value,
      [platform]: url || undefined,
    });
  };

  return (
    <div className='space-y-4'>
      <div className='space-y-3'>
        {SOCIAL_PLATFORMS.map((platform) => (
          <div key={platform.value}>
            <Label htmlFor={`social-${platform.value}`} className='text-sm'>
              {platform.label}
            </Label>
            <Input
              id={`social-${platform.value}`}
              type='text'
              value={value[platform.value as keyof typeof value] || ''}
              onChange={(e) =>
                handleChange(
                  platform.value as keyof typeof value,
                  e.target.value
                )
              }
              placeholder={platform.placeholder}
              disabled={disabled}
              className='mt-1'
            />
          </div>
        ))}
      </div>

      <div className='flex items-center gap-2 text-muted-foreground'>
        <Link2 className='h-4 w-4' />
        <Typography variant='body1' className='text-sm'>
          Add social links to help users connect with you
        </Typography>
      </div>
    </div>
  );
}
