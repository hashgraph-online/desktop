import { toast as sonnerToast } from 'sonner';

/**
 * Options for accessible toast notifications
 */
interface AccessibleToastOptions {
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  important?: boolean;
}

/**
 * Create an accessible toast notification
 */
export const toast = {
  /**
   * Success toast with proper ARIA attributes
   */
  success: (message: string, options?: AccessibleToastOptions) => {
    return sonnerToast.success(message, {
      ...options,
      description: options?.description,
      action: options?.action,
      duration: options?.duration || 5000,
      onAutoClose: () => {
        announceToScreenReader(`Success: ${message}. ${options?.description || ''}`);
      },
      onDismiss: () => {
        announceToScreenReader('Notification dismissed');
      },
    });
  },

  /**
   * Error toast with proper ARIA attributes
   */
  error: (message: string, options?: AccessibleToastOptions) => {
    return sonnerToast.error(message, {
      ...options,
      description: options?.description,
      action: options?.action,
      duration: options?.duration || 7000,
      onAutoClose: () => {
        announceToScreenReader(`Error: ${message}. ${options?.description || ''}`, 'alert');
      },
      onDismiss: () => {
        announceToScreenReader('Error notification dismissed');
      },
    });
  },

  /**
   * Info toast with proper ARIA attributes
   */
  info: (message: string, options?: AccessibleToastOptions) => {
    return sonnerToast.info(message, {
      ...options,
      description: options?.description,
      action: options?.action,
      duration: options?.duration || 5000,
      onAutoClose: () => {
        announceToScreenReader(`Information: ${message}. ${options?.description || ''}`);
      },
      onDismiss: () => {
        announceToScreenReader('Notification dismissed');
      },
    });
  },

  /**
   * Warning toast with proper ARIA attributes
   */
  warning: (message: string, options?: AccessibleToastOptions) => {
    return sonnerToast.warning(message, {
      ...options,
      description: options?.description,
      action: options?.action,
      duration: options?.duration || 6000,
      onAutoClose: () => {
        announceToScreenReader(`Warning: ${message}. ${options?.description || ''}`, 'alert');
      },
      onDismiss: () => {
        announceToScreenReader('Warning notification dismissed');
      },
    });
  },

  /**
   * Loading toast with proper ARIA attributes
   */
  loading: (message: string, options?: AccessibleToastOptions) => {
    announceToScreenReader(`Loading: ${message}`, 'status');
    return sonnerToast.loading(message, {
      ...options,
      description: options?.description,
    });
  },

  /**
   * Dismiss a toast
   */
  dismiss: (id?: string | number) => {
    announceToScreenReader('Notification dismissed');
    return sonnerToast.dismiss(id);
  },
};

/**
 * Helper function to announce messages to screen readers
 */
function announceToScreenReader(
  message: string,
  role: 'status' | 'alert' = 'status'
) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', role);
  announcement.setAttribute('aria-live', role === 'alert' ? 'assertive' : 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}