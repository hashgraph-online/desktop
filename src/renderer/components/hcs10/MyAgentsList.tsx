import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ExternalLink, Calendar, Activity, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/badge';
import { useHCS10Store, useHCS10Profiles } from '../../stores/hcs10Store';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../lib/utils';

interface MyAgentsListProps {
  className?: string;
}

/**
 * Component to display registered HCS-10 agents
 */
export function MyAgentsList({ className }: MyAgentsListProps) {
  const navigate = useNavigate();
  const { loadProfiles, isLoading, error } = useHCS10Store();
  const profiles = useHCS10Profiles();

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <CardTitle>My Agent Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='h-20 bg-gray-100/50 dark:bg-white/5 rounded-xl animate-pulse' />
            <div className='h-20 bg-gray-100/50 dark:bg-white/5 rounded-xl animate-pulse' />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardHeader>
          <CardTitle>My Agent Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography variant='body1' className='text-destructive'>
            Failed to load agents: {error}
          </Typography>{' '}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex-1 min-w-0'>
            <CardTitle className='text-lg sm:text-xl'>
              My Agent Profile
            </CardTitle>
          </div>
          <Button
            size='sm'
            variant='outline'
            onClick={() => navigate('/hcs10-profile')}
            className='w-full sm:w-auto shrink-0'
          >
            <Plus className='h-4 w-4 mr-1' />
            <span className='hidden sm:inline'>Update Profile</span>
            <span className='sm:hidden'>Update</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {profiles.length === 0 ? (
          <div className='text-center py-12'>
            <div className='p-4 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-full w-fit mx-auto mb-4'>
              <User className='h-12 w-12 text-primary' />
            </div>
            <Typography variant='h6' className='mb-2'>
              No profile registered yet
            </Typography>
            <Typography
              variant='body2'
              className='text-muted-foreground mb-6 max-w-sm mx-auto'
            >
              Get started by registering your AI agent profile on the Hedera
              network
            </Typography>
            <Button onClick={() => navigate('/hcs10-profile')} size='lg'>
              <Plus className='h-5 w-5 mr-2' />
              Register Profile
            </Button>
          </div>
        ) : (
          <div>
            {(() => {
              const profile = profiles[0];
              return (
                <div
                  className='p-4 sm:p-6 rounded-2xl border border-gray-200/50 dark:border-white/[0.06] bg-white/80 dark:bg-black/40 backdrop-blur-sm hover:border-[#5599fe]/50 dark:hover:border-[#5599fe]/50 transition-all duration-200 cursor-pointer group hover:shadow-lg hover:shadow-[#5599fe]/10 dark:hover:shadow-[#5599fe]/20'
                  onClick={() => {
                    navigate('/hcs10-profile');
                  }}
                >
                  <div className='flex flex-col sm:flex-row sm:items-start gap-4'>
                    {profile.profileImage ? (
                      <img
                        src={profile.profileImage}
                        alt={profile.name}
                        className='w-16 h-16 sm:w-12 sm:h-12 rounded-xl object-cover flex-shrink-0'
                      />
                    ) : (
                      <div className='w-16 h-16 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#5599fe]/20 to-[#a679f0]/20 dark:from-[#5599fe]/30 dark:to-[#a679f0]/30 flex items-center justify-center flex-shrink-0 backdrop-blur-sm'>
                        <User className='h-8 w-8 sm:h-6 sm:w-6 text-[#5599fe] dark:text-[#5599fe]' />
                      </div>
                    )}

                    <div className='flex-1 min-w-0 space-y-3'>
                      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <Typography
                            variant='body1'
                            className='font-semibold text-base sm:text-sm'
                          >
                            {profile.name}
                          </Typography>
                          <Badge
                            variant={
                              profile.status === 'active'
                                ? 'default'
                                : 'secondary'
                            }
                            className='text-xs'
                          >
                            {profile.status}
                          </Badge>
                        </div>
                        <ExternalLink className='h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0' />
                      </div>

                      <Typography
                        variant='body2'
                        className='text-muted-foreground line-clamp-2'
                      >
                        {profile.description}
                      </Typography>

                      <div className='flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-sm text-muted-foreground'>
                        <span className='flex items-center gap-1.5'>
                          <Activity className='h-4 w-4' />
                          {profile.capabilities.length} capabilities
                        </span>
                        <span className='flex items-center gap-1.5'>
                          <Calendar className='h-4 w-4' />
                          {formatDistanceToNow(profile.registeredAt, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      <div className='bg-gray-100/30 dark:bg-white/5 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-gray-200/50 dark:border-white/[0.06]'>
                        <Typography
                          variant='caption'
                          className='font-mono text-gray-600 dark:text-gray-400 break-all text-[10px]'
                        >
                          {profile.accountId}
                        </Typography>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
