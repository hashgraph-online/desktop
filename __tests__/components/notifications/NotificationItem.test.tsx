import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotificationItem } from '../../../src/renderer/components/notifications/NotificationItem'
import { useNotificationStore } from '../../../src/renderer/stores/notificationStore'
import { factories } from '../../utils/testHelpers'

/**
 * Mock the notification store
 */
jest.mock('../../../src/renderer/stores/notificationStore', () => ({
  useNotificationStore: jest.fn(),
}))

/**
 * Mock framer-motion to simplify testing
 */
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, role, ...props }: any) => (
      <div className={className} role={role} {...props}>
        {children}
      </div>
    ),
  },
}))

/**
 * Mock Typography component
 */
jest.mock('../../../src/renderer/components/ui/Typography', () => ({
  __esModule: true,
  default: ({ children, variant, color, className }: any) => (
    <span className={`typography ${variant} ${color} ${className || ''}`}>
      {children}
    </span>
  ),
}))

describe('NotificationItem', () => {
  const mockRemoveNotification = jest.fn()

  beforeEach(() => {
    ;(useNotificationStore as jest.Mock).mockReturnValue(mockRemoveNotification)
    jest.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render notification with title', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      expect(screen.getByText('Test Notification')).toBeInTheDocument()
    })

    it('should render notification with title and message', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        message: 'This is a test message',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      expect(screen.getByText('Test Notification')).toBeInTheDocument()
      expect(screen.getByText('This is a test message')).toBeInTheDocument()
    })

    it('should render notification without message when message is not provided', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        message: undefined,
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      expect(screen.getByText('Test Notification')).toBeInTheDocument()
      expect(screen.queryByText('This is a test message')).not.toBeInTheDocument()
    })
  })

  describe('notification types and icons', () => {
    const testCases = [
      { type: 'success' as const, expectedColor: 'text-green-500', expectedBorder: 'border-green-500' },
      { type: 'error' as const, expectedColor: 'text-red-500', expectedBorder: 'border-red-500' },
      { type: 'warning' as const, expectedColor: 'text-yellow-500', expectedBorder: 'border-yellow-500' },
      { type: 'info' as const, expectedColor: 'text-blue-500', expectedBorder: 'border-blue-500' },
    ]

    testCases.forEach(({ type, expectedColor, expectedBorder }) => {
      it(`should render ${type} notification with correct icon and styling`, () => {
        const notification = factories.notification({
          title: `${type} notification`,
          type,
        })

        const { container } = render(<NotificationItem notification={notification} />)

        const icon = container.querySelector(`.${expectedColor}`)
        expect(icon).toBeInTheDocument()

        const notificationContainer = container.querySelector(`.${expectedBorder}`)
        expect(notificationContainer).toBeInTheDocument()
      })
    })

    it('should default to info type when type is not recognized', () => {
      const notification = {
        ...factories.notification(),
        type: 'unknown' as any,
      }

      const { container } = render(<NotificationItem notification={notification} />)

      const icon = container.querySelector('.text-blue-500')
      expect(icon).toBeInTheDocument()

      const notificationContainer = container.querySelector('.border-blue-500')
      expect(notificationContainer).toBeInTheDocument()
    })
  })

  describe('dismiss functionality', () => {
    it('should have dismiss button', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      const dismissButton = screen.getByRole('button', { name: /dismiss notification/i })
      expect(dismissButton).toBeInTheDocument()
    })

    it('should call removeNotification when dismiss button is clicked', () => {
      const notification = factories.notification({
        id: 'test-notification-123',
        title: 'Test Notification',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      const dismissButton = screen.getByRole('button', { name: /dismiss notification/i })
      fireEvent.click(dismissButton)

      expect(mockRemoveNotification).toHaveBeenCalledWith('test-notification-123')
      expect(mockRemoveNotification).toHaveBeenCalledTimes(1)
    })

    it('should have correct aria-label for accessibility', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      const dismissButton = screen.getByLabelText('Dismiss notification')
      expect(dismissButton).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have proper role attribute', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      const alertElement = screen.getByRole('alert')
      expect(alertElement).toBeInTheDocument()
    })

    it('should be keyboard accessible', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      const dismissButton = screen.getByRole('button', { name: /dismiss notification/i })
      
      dismissButton.focus()
      expect(document.activeElement).toBe(dismissButton)
    })
  })

  describe('styling and layout', () => {
    it('should have correct base classes', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        type: 'info',
      })

      const { container } = render(<NotificationItem notification={notification} />)
      const notificationElement = container.firstChild as HTMLElement

      expect(notificationElement).toHaveClass('pointer-events-auto')
      expect(notificationElement).toHaveClass('mb-3')
      expect(notificationElement).toHaveClass('bg-white')
      expect(notificationElement).toHaveClass('dark:bg-gray-800')
      expect(notificationElement).toHaveClass('rounded-lg')
      expect(notificationElement).toHaveClass('shadow-lg')
      expect(notificationElement).toHaveClass('border-l-4')
      expect(notificationElement).toHaveClass('p-4')
      expect(notificationElement).toHaveClass('min-w-[320px]')
      expect(notificationElement).toHaveClass('max-w-md')
    })

    it('should have proper flexbox layout', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        message: 'Test message',
        type: 'info',
      })

      const { container } = render(<NotificationItem notification={notification} />)

      const flexContainer = container.querySelector('.flex.items-start')
      expect(flexContainer).toBeInTheDocument()

      const iconContainer = container.querySelector('.flex-shrink-0')
      expect(iconContainer).toBeInTheDocument()

      const contentContainer = container.querySelector('.flex-1')
      expect(contentContainer).toBeInTheDocument()
    })
  })

  describe('content layout', () => {
    it('should have proper spacing between elements', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        message: 'Test message',
        type: 'info',
      })

      const { container } = render(<NotificationItem notification={notification} />)

      expect(container.querySelector('.ml-3')).toBeInTheDocument()
      expect(container.querySelector('.mt-1')).toBeInTheDocument()
      expect(container.querySelector('.ml-4')).toBeInTheDocument()
    })

    it('should handle long titles gracefully', () => {
      const notification = factories.notification({
        title: 'This is a very long notification title that might wrap to multiple lines',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      expect(screen.getByText(/This is a very long notification title/)).toBeInTheDocument()
    })

    it('should handle long messages gracefully', () => {
      const notification = factories.notification({
        title: 'Test Notification',
        message: 'This is a very long notification message that contains a lot of text and might wrap to multiple lines to test the layout behavior',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      expect(screen.getByText(/This is a very long notification message/)).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty title gracefully', () => {
      const notification = factories.notification({
        title: '',
        message: 'Message without title',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      expect(screen.getByText('Message without title')).toBeInTheDocument()
    })

    it('should handle special characters in title and message', () => {
      const notification = factories.notification({
        title: 'Special chars: <>&"\'',
        message: 'Message with special chars: <>&"\'',
        type: 'info',
      })

      render(<NotificationItem notification={notification} />)

      expect(screen.getByText('Special chars: <>&"\'')).toBeInTheDocument()
      expect(screen.getByText('Message with special chars: <>&"\'')).toBeInTheDocument()
    })
  })
})