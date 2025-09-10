import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useNotificationStore, type Notification, type NotificationType } from '../../../src/renderer/stores/notificationStore';

/**
 * Comprehensive tests for notificationStore
 * Tests all store methods, state management, and edge cases
 */

describe('NotificationStore', () => {
  beforeEach(() => {
    act(() => {
      useNotificationStore.getState().clearNotifications();
    });
    
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial state', () => {
    test('should have empty notifications array initially', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      expect(result.current.notifications).toEqual([]);
    });
  });

  describe('addNotification', () => {
    test('should add notification with all required fields', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'Test Success',
          message: 'Test message',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      
      const notification = result.current.notifications[0];
      expect(notification.type).toBe('success');
      expect(notification.title).toBe('Test Success');
      expect(notification.message).toBe('Test message');
      expect(notification.id).toMatch(/^notif-\d+-[a-z0-9]+$/);
      expect(notification.timestamp).toBeInstanceOf(Date);
      expect(notification.duration).toBe(5000); // default duration
    });

    test('should add notification without message', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Info Title',
        });
      });

      const notification = result.current.notifications[0];
      expect(notification.title).toBe('Info Title');
      expect(notification.message).toBeUndefined();
    });

    test('should add notification with custom duration', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'warning',
          title: 'Warning',
          duration: 3000,
        });
      });

      const notification = result.current.notifications[0];
      expect(notification.duration).toBe(3000);
    });

    test('should add multiple notifications', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'First',
        });
        result.current.addNotification({
          type: 'error',
          title: 'Second',
        });
        result.current.addNotification({
          type: 'info',
          title: 'Third',
        });
      });

      expect(result.current.notifications).toHaveLength(3);
      expect(result.current.notifications[0].title).toBe('First');
      expect(result.current.notifications[1].title).toBe('Second');
      expect(result.current.notifications[2].title).toBe('Third');
    });

    test('should generate unique IDs for each notification', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'First',
        });
        result.current.addNotification({
          type: 'success',
          title: 'Second',
        });
      });

      const [first, second] = result.current.notifications;
      expect(first.id).not.toBe(second.id);
      expect(first.id).toMatch(/^notif-\d+-[a-z0-9]+$/);
      expect(second.id).toMatch(/^notif-\d+-[a-z0-9]+$/);
    });

    test('should handle all notification types', () => {
      const { result } = renderHook(() => useNotificationStore());
      const types: NotificationType[] = ['success', 'error', 'info', 'warning'];
      
      types.forEach(type => {
        act(() => {
          result.current.addNotification({
            type,
            title: `${type} notification`,
          });
        });
      });

      expect(result.current.notifications).toHaveLength(4);
      types.forEach((type, index) => {
        expect(result.current.notifications[index].type).toBe(type);
      });
    });

    test('should auto-remove notification after duration', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'Auto remove',
          duration: 1000,
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('should auto-remove with default duration', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'Default duration',
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('should use default duration when duration is 0 (falsy)', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'error',
          title: 'Uses default',
          duration: 0,
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].duration).toBe(5000);

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('should not auto-remove notification with negative duration', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Negative duration',
          duration: -1000,
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.notifications).toHaveLength(1);
    });

    test('should handle mixed auto-remove durations', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'Quick remove',
          duration: 1000,
        });
        result.current.addNotification({
          type: 'error',
          title: 'Slower remove',
          duration: 3000,
        });
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe('Slower remove');

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe('removeNotification', () => {
    test('should remove notification by ID', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'First',
        });
        result.current.addNotification({
          type: 'error',
          title: 'Second',
        });
      });

      const firstId = result.current.notifications[0].id;
      
      act(() => {
        result.current.removeNotification(firstId);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe('Second');
    });

    test('should handle removing non-existent ID gracefully', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'Exists',
        });
      });

      expect(result.current.notifications).toHaveLength(1);

      act(() => {
        result.current.removeNotification('non-existent-id');
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe('Exists');
    });

    test('should handle removing from empty store', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      expect(result.current.notifications).toHaveLength(0);

      act(() => {
        result.current.removeNotification('any-id');
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('should remove only the specified notification from multiple', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'First',
        });
        result.current.addNotification({
          type: 'error',
          title: 'Second',
        });
        result.current.addNotification({
          type: 'info',
          title: 'Third',
        });
      });

      const secondId = result.current.notifications[1].id;
      
      act(() => {
        result.current.removeNotification(secondId);
      });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications[0].title).toBe('First');
      expect(result.current.notifications[1].title).toBe('Third');
    });
  });

  describe('clearNotifications', () => {
    test('should clear all notifications', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'First',
        });
        result.current.addNotification({
          type: 'error',
          title: 'Second',
        });
        result.current.addNotification({
          type: 'info',
          title: 'Third',
        });
      });

      expect(result.current.notifications).toHaveLength(3);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('should handle clearing empty store', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      expect(result.current.notifications).toHaveLength(0);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('should clear all notifications regardless of duration', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'Auto remove',
          duration: 1000,
        });
        result.current.addNotification({
          type: 'error',
          title: 'Long duration',
          duration: 10000,
        });
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe('Complex scenarios', () => {
    test('should handle rapid add/remove operations', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addNotification({
            type: i % 2 === 0 ? 'success' : 'error',
            title: `Notification ${i}`,
          });
        }
      });

      expect(result.current.notifications).toHaveLength(10);

      const idsToRemove = result.current.notifications
        .filter((_, index) => index % 2 === 0)
        .map(n => n.id);

      act(() => {
        idsToRemove.forEach(id => {
          result.current.removeNotification(id);
        });
      });

      expect(result.current.notifications).toHaveLength(5);
      result.current.notifications.forEach(notification => {
        expect(notification.type).toBe('error');
      });
    });

    test('should handle auto-removal race conditions', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'success',
          title: 'Quick removal',
          duration: 1000,
        });
      });

      const notificationId = result.current.notifications[0].id;

      act(() => {
        result.current.removeNotification(notificationId);
      });

      expect(result.current.notifications).toHaveLength(0);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    test('should maintain notification order', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      const titles = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
      
      act(() => {
        titles.forEach(title => {
          result.current.addNotification({
            type: 'info',
            title,
          });
        });
      });

      expect(result.current.notifications).toHaveLength(5);
      result.current.notifications.forEach((notification, index) => {
        expect(notification.title).toBe(titles[index]);
      });
    });

    test('should handle timestamp generation correctly', () => {
      const { result } = renderHook(() => useNotificationStore());
      const startTime = Date.now();
      
      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Timestamp test',
        });
      });

      const notification = result.current.notifications[0];
      const notificationTime = notification.timestamp.getTime();
      
      expect(notificationTime).toBeGreaterThanOrEqual(startTime);
      expect(notificationTime).toBeLessThanOrEqual(Date.now());
    });

    test('should handle edge case with empty title', () => {
      const { result } = renderHook(() => useNotificationStore());
      
      act(() => {
        result.current.addNotification({
          type: 'info',
          title: '',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe('');
    });

    test('should handle very long titles and messages', () => {
      const { result } = renderHook(() => useNotificationStore());
      const longTitle = 'A'.repeat(1000);
      const longMessage = 'B'.repeat(2000);
      
      act(() => {
        result.current.addNotification({
          type: 'info',
          title: longTitle,
          message: longMessage,
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].title).toBe(longTitle);
      expect(result.current.notifications[0].message).toBe(longMessage);
    });
  });
});