import React from 'react';
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationItem } from './NotificationItem';
import { AnimatePresence } from 'framer-motion';

/**
 * Container for displaying notifications
 */
export const NotificationContainer: React.FC = () => {
  const notifications = useNotificationStore((state) => state.notifications);

  return (
    <div
      className="fixed top-4 right-4 z-50 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};