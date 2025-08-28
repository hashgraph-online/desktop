import { act, renderHook } from '@testing-library/react'
import { useNotificationStore } from '../../src/renderer/stores/notificationStore'
import { factories } from '../utils/testHelpers'

describe('notificationStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.clearNotifications()
    })
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('addNotification', () => {
    it('should add notification with generated id and timestamp', () => {
      const { result } = renderHook(() => useNotificationStore())
      const testNotification = factories.notification({
        title: 'Test Success',
        type: 'success',
      })

      act(() => {
        result.current.addNotification({
          title: testNotification.title,
          type: testNotification.type,
        })
      })

      expect(result.current.notifications).toHaveLength(1)
      const notification = result.current.notifications[0]
      expect(notification.title).toBe('Test Success')
      expect(notification.type).toBe('success')
      expect(notification.id).toMatch(/^notif-\d+-[a-z0-9]+$/)
      expect(notification.timestamp).toBeInstanceOf(Date)
      expect(notification.duration).toBe(5000)
    })

    it('should use custom duration when provided', () => {
      const { result } = renderHook(() => useNotificationStore())

      act(() => {
        result.current.addNotification({
          title: 'Custom Duration',
          type: 'info',
          duration: 10000,
        })
      })

      const notification = result.current.notifications[0]
      expect(notification.duration).toBe(10000)
    })

    it('should auto-remove notification after duration', async () => {
      jest.useFakeTimers()
      const { result } = renderHook(() => useNotificationStore())

      act(() => {
        result.current.addNotification({
          title: 'Auto Remove',
          type: 'info',
          duration: 1000,
        })
      })

      expect(result.current.notifications).toHaveLength(1)

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(result.current.notifications).toHaveLength(0)
    })

    it('should not auto-remove when duration is 0', () => {
      jest.useFakeTimers()
      const { result } = renderHook(() => useNotificationStore())

      act(() => {
        result.current.addNotification({
          title: 'Persistent',
          type: 'error',
          duration: 0,
        })
      })

      expect(result.current.notifications).toHaveLength(1)

      act(() => {
        jest.advanceTimersByTime(10000)
      })

      expect(result.current.notifications).toHaveLength(1)
    })
  })

  describe('removeNotification', () => {
    it('should remove specific notification by id', () => {
      const { result } = renderHook(() => useNotificationStore())

      act(() => {
        result.current.addNotification({ title: 'First', type: 'info' })
        result.current.addNotification({ title: 'Second', type: 'success' })
      })

      const notifications = result.current.notifications
      expect(notifications).toHaveLength(2)

      act(() => {
        result.current.removeNotification(notifications[0].id)
      })

      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.notifications[0].title).toBe('Second')
    })

    it('should handle removing non-existent notification', () => {
      const { result } = renderHook(() => useNotificationStore())

      act(() => {
        result.current.addNotification({ title: 'Test', type: 'info' })
      })

      expect(result.current.notifications).toHaveLength(1)

      act(() => {
        result.current.removeNotification('non-existent-id')
      })

      expect(result.current.notifications).toHaveLength(1)
    })
  })

  describe('clearNotifications', () => {
    it('should remove all notifications', () => {
      const { result } = renderHook(() => useNotificationStore())

      act(() => {
        result.current.addNotification({ title: 'First', type: 'info' })
        result.current.addNotification({ title: 'Second', type: 'success' })
        result.current.addNotification({ title: 'Third', type: 'warning' })
      })

      expect(result.current.notifications).toHaveLength(3)

      act(() => {
        result.current.clearNotifications()
      })

      expect(result.current.notifications).toHaveLength(0)
    })
  })

  describe('notification types', () => {
    it('should handle all notification types', () => {
      const { result } = renderHook(() => useNotificationStore())
      const types = ['success', 'error', 'info', 'warning'] as const

      types.forEach((type, _index) => {
        act(() => {
          result.current.addNotification({
            title: `${type} notification`,
            type,
          })
        })
      })

      expect(result.current.notifications).toHaveLength(4)
      types.forEach((type, index) => {
        expect(result.current.notifications[index].type).toBe(type)
      })
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple rapid additions', () => {
      const { result } = renderHook(() => useNotificationStore())

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addNotification({
            title: `Notification ${i}`,
            type: 'info',
          })
        }
      })

      expect(result.current.notifications).toHaveLength(5)
      result.current.notifications.forEach((notification, index) => {
        expect(notification.title).toBe(`Notification ${index}`)
      })
    })
  })
})