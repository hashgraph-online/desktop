import React, { useCallback } from 'react';
import Typography from '../ui/Typography';
import { Button } from '../ui/Button';
import { FiUserPlus, FiRefreshCw } from 'react-icons/fi';

interface ConnectionRequest {
  id: string;
  sequence_number: number;
  requesting_account_id: string;
  memo?: string;
}

interface ConnectionRequestItemProps {
  request: ConnectionRequest;
  actionLoading: Record<string, boolean>;
  onAccept: (request: ConnectionRequest) => void;
  onReject: (request: ConnectionRequest) => void;
}

/**
 * Displays a connection request in the sidebar
 */
const ConnectionRequestItem = React.memo<ConnectionRequestItemProps>(
  ({ request, actionLoading, onAccept, onReject }) => {
    const actionId = `accept_${request.sequence_number}`;
    const rejectId = `reject_${request.sequence_number}`;

    const handleAccept = useCallback(() => {
      onAccept(request);
    }, [request, onAccept]);

    const handleReject = useCallback(() => {
      onReject(request);
    }, [request, onReject]);

    return (
      <div className='group flex items-center gap-2 p-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'>
        <div className='w-6 h-6 rounded-md bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shrink-0'>
          <FiUserPlus className='w-3 h-3' />
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-center justify-between'>
            <Typography
              variant='caption'
              className='font-medium text-amber-900 dark:text-amber-100 truncate text-xs'
            >
              Connection Request
            </Typography>
          </div>
          <Typography
            variant='caption'
            className='text-amber-700 dark:text-amber-300 truncate block text-[10px]'
          >
            From: {request.requesting_account_id}
          </Typography>
          {request.memo && (
            <Typography
              variant='caption'
              className='text-amber-600 dark:text-amber-400 truncate block text-[10px]'
            >
              {request.memo}
            </Typography>
          )}

          <div className='flex gap-1 mt-1'>
            <Button
              size='sm'
              variant='default'
              onClick={handleAccept}
              disabled={actionLoading[actionId]}
              className='text-[10px] h-4 px-1.5 py-0'
            >
              {actionLoading[actionId] ? (
                <FiRefreshCw className='w-2 h-2 animate-spin' />
              ) : (
                'Accept'
              )}
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={handleReject}
              disabled={actionLoading[rejectId]}
              className='text-[10px] h-4 px-1.5 py-0'
            >
              {actionLoading[rejectId] ? (
                <FiRefreshCw className='w-2 h-2 animate-spin' />
              ) : (
                'Reject'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ConnectionRequestItem.displayName = 'ConnectionRequestItem';

export default ConnectionRequestItem;