import React from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiXCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi';
import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import Typography from '../ui/Typography';
import { cn } from '../../lib/utils';

interface NotificationItemProps {
  notification: Notification;
}

/**
 * Individual notification item component
 */
export const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
  const removeNotification = useNotificationStore((state) => state.removeNotification);

/**
 * Notification icon component
 */
const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
  switch (type) {
    case 'success':
      return (
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <FiCheckCircle className="w-4 h-4 text-white" />
        </div>
      );
    case 'error':
      return (
        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
          <FiXCircle className="w-4 h-4 text-white" />
        </div>
      );
    case 'warning':
      return (
        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
          <FiAlertTriangle className="w-4 h-4 text-white" />
        </div>
      );
    case 'info':
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <FiInfo className="w-4 h-4 text-white" />
        </div>
      );
  }
};

/**
 * Get background color class based on notification type
 */
const getBackgroundColor = (type: Notification['type']): string => {
  switch (type) {
    case 'success':
      return 'bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20';
    case 'error':
      return 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20';
    case 'warning':
      return 'bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20';
    case 'info':
    default:
      return 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20';
  }
};

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "pointer-events-auto mb-3 backdrop-blur-sm rounded-2xl shadow-xl border p-4 min-w-[320px] max-w-md",
        getBackgroundColor(notification.type)
      )}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className={cn(
            "p-2 rounded-lg shadow-sm",
            notification.type === 'success' && "bg-emerald-100 dark:bg-emerald-800/50",
            notification.type === 'error' && "bg-red-100 dark:bg-red-800/50",
            notification.type === 'warning' && "bg-amber-100 dark:bg-amber-800/50",
            notification.type === 'info' && "bg-blue-100 dark:bg-blue-800/50"
          )}>
            <NotificationIcon type={notification.type} />
          </div>
        </div>
        <div className="ml-3 flex-1">
          <Typography variant="body2" className="font-semibold">
            {notification.title}
          </Typography>
          {notification.message && (
            <div className="mt-2">
              <Typography variant="caption" color="secondary" className="leading-relaxed whitespace-pre-line">
                {notification.message}
              </Typography>
            </div>
          )}
        </div>
        <button
          onClick={() => removeNotification(notification.id)}
          className="ml-4 flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
          aria-label="Dismiss notification"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};