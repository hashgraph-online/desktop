jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn()
  }
}));

const mockAnnouncement = {
  setAttribute: jest.fn(),
  style: {},
  textContent: ''
};

const originalDocument = global.document;
Object.defineProperty(global, 'document', {
  value: {
    createElement: jest.fn(() => mockAnnouncement),
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn()
    }
  },
  writable: true
});

import { toast } from '../../../src/renderer/utils/accessible-toast';

describe('accessible-toast', () => {
  let mockSonnerToast: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSonnerToast = require('sonner').toast;
  });

  afterAll(() => {
    Object.defineProperty(global, 'document', {
      value: originalDocument,
      writable: true
    });
  });

  describe('Success Toast', () => {
    test('should call sonner success with default options', () => {
      const message = 'Operation completed successfully';
      const result = toast.success(message);

      expect(mockSonnerToast.success).toHaveBeenCalledWith(message, {
        description: undefined,
        action: undefined,
        duration: 5000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });

      expect(result).toBe(mockSonnerToast.success.mock.results[0].value);
    });

    test('should call sonner success with custom options', () => {
      const message = 'Data saved successfully';
      const options = {
        description: 'Your changes have been saved',
        action: {
          label: 'Undo',
          onClick: jest.fn()
        },
        duration: 3000,
        important: true
      };

      toast.success(message, options);

      expect(mockSonnerToast.success).toHaveBeenCalledWith(message, {
        description: 'Your changes have been saved',
        action: options.action,
        duration: 3000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });
    });

    test('should announce success to screen reader on auto close', () => {
      const message = 'File uploaded';
      const description = 'Upload completed successfully';

      toast.success(message, { description });

      const callArgs = mockSonnerToast.success.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'status');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
      expect(mockAnnouncement.textContent).toBe(`Success: ${message}. ${description}`);
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockAnnouncement);

      jest.runOnlyPendingTimers();
      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockAnnouncement);
    });

    test('should announce success dismissal to screen reader', () => {
      const message = 'Success message';

      toast.success(message);

      const callArgs = mockSonnerToast.success.mock.calls[0][1];
      callArgs.onDismiss();

      expect(mockAnnouncement.textContent).toBe('Notification dismissed');
    });
  });

  describe('Error Toast', () => {
    test('should call sonner error with default options', () => {
      const message = 'Failed to save data';
      const result = toast.error(message);

      expect(mockSonnerToast.error).toHaveBeenCalledWith(message, {
        description: undefined,
        action: undefined,
        duration: 7000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });

      expect(result).toBe(mockSonnerToast.error.mock.results[0].value);
    });

    test('should call sonner error with custom options', () => {
      const message = 'Network error occurred';
      const options = {
        description: 'Please check your internet connection',
        action: {
          label: 'Retry',
          onClick: jest.fn()
        },
        duration: 10000
      };

      toast.error(message, options);

      expect(mockSonnerToast.error).toHaveBeenCalledWith(message, {
        description: 'Please check your internet connection',
        action: options.action,
        duration: 10000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });
    });

    test('should announce error to screen reader with alert role', () => {
      const message = 'Login failed';
      const description = 'Invalid credentials';

      toast.error(message, { description });

      const callArgs = mockSonnerToast.error.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'alert');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
      expect(mockAnnouncement.textContent).toBe(`Error: ${message}. ${description}`);
    });

    test('should announce error dismissal to screen reader', () => {
      const message = 'Error occurred';

      toast.error(message);

      const callArgs = mockSonnerToast.error.mock.calls[0][1];
      callArgs.onDismiss();

      expect(mockAnnouncement.textContent).toBe('Error notification dismissed');
    });
  });

  describe('Info Toast', () => {
    test('should call sonner info with default options', () => {
      const message = 'New feature available';
      const result = toast.info(message);

      expect(mockSonnerToast.info).toHaveBeenCalledWith(message, {
        description: undefined,
        action: undefined,
        duration: 5000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });

      expect(result).toBe(mockSonnerToast.info.mock.results[0].value);
    });

    test('should call sonner info with custom options', () => {
      const message = 'Update available';
      const options = {
        description: 'Version 2.1.0 is now available',
        action: {
          label: 'Update Now',
          onClick: jest.fn()
        },
        duration: 8000
      };

      toast.info(message, options);

      expect(mockSonnerToast.info).toHaveBeenCalledWith(message, {
        description: 'Version 2.1.0 is now available',
        action: options.action,
        duration: 8000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });
    });

    test('should announce info to screen reader on auto close', () => {
      const message = 'System update';
      const description = 'Restart required';

      toast.info(message, { description });

      const callArgs = mockSonnerToast.info.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'status');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockAnnouncement.textContent).toBe(`Information: ${message}. ${description}`);
    });
  });

  describe('Warning Toast', () => {
    test('should call sonner warning with default options', () => {
      const message = 'Session expiring soon';
      const result = toast.warning(message);

      expect(mockSonnerToast.warning).toHaveBeenCalledWith(message, {
        description: undefined,
        action: undefined,
        duration: 6000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });

      expect(result).toBe(mockSonnerToast.warning.mock.results[0].value);
    });

    test('should call sonner warning with custom options', () => {
      const message = 'Disk space low';
      const options = {
        description: 'Only 10% space remaining',
        action: {
          label: 'Clean Up',
          onClick: jest.fn()
        },
        duration: 12000
      };

      toast.warning(message, options);

      expect(mockSonnerToast.warning).toHaveBeenCalledWith(message, {
        description: 'Only 10% space remaining',
        action: options.action,
        duration: 12000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });
    });

    test('should announce warning to screen reader with alert role', () => {
      const message = 'Security warning';
      const description = 'Unusual activity detected';

      toast.warning(message, { description });

      const callArgs = mockSonnerToast.warning.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'alert');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
      expect(mockAnnouncement.textContent).toBe(`Warning: ${message}. ${description}`);
    });
  });

  describe('Loading Toast', () => {
    test('should call sonner loading with options', () => {
      const message = 'Saving your data...';
      const result = toast.loading(message);

      expect(mockSonnerToast.loading).toHaveBeenCalledWith(message, {
        description: undefined,
        action: undefined,
        duration: undefined
      });

      expect(result).toBe(mockSonnerToast.loading.mock.results[0].value);
    });

    test('should call sonner loading with custom options', () => {
      const message = 'Processing...';
      const options = {
        description: 'This may take a few moments',
        action: {
          label: 'Cancel',
          onClick: jest.fn()
        }
      };

      toast.loading(message, options);

      expect(mockSonnerToast.loading).toHaveBeenCalledWith(message, {
        description: 'This may take a few moments',
        action: options.action,
        duration: undefined
      });
    });

    test('should announce loading to screen reader immediately', () => {
      const message = 'Loading content';

      toast.loading(message);

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'status');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockAnnouncement.textContent).toBe(`Loading: ${message}`);
    });
  });

  describe('Dismiss Toast', () => {
    test('should call sonner dismiss without ID', () => {
      const result = toast.dismiss();

      expect(mockSonnerToast.dismiss).toHaveBeenCalledWith(undefined);
      expect(result).toBe(mockSonnerToast.dismiss.mock.results[0].value);
    });

    test('should call sonner dismiss with string ID', () => {
      const id = 'toast-123';
      const result = toast.dismiss(id);

      expect(mockSonnerToast.dismiss).toHaveBeenCalledWith(id);
      expect(result).toBe(mockSonnerToast.dismiss.mock.results[0].value);
    });

    test('should call sonner dismiss with numeric ID', () => {
      const id = 456;
      const result = toast.dismiss(id);

      expect(mockSonnerToast.dismiss).toHaveBeenCalledWith(id);
      expect(result).toBe(mockSonnerToast.dismiss.mock.results[0].value);
    });

    test('should announce dismissal to screen reader', () => {
      toast.dismiss();

      expect(mockAnnouncement.textContent).toBe('Notification dismissed');
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockAnnouncement);
    });
  });

  describe('Screen Reader Announcements', () => {
    test('should create proper announcement element for status role', () => {
      toast.dismiss();

      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'status');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
      expect(mockAnnouncement.style.position).toBe('absolute');
      expect(mockAnnouncement.style.left).toBe('-10000px');
      expect(mockAnnouncement.style.width).toBe('1px');
      expect(mockAnnouncement.style.height).toBe('1px');
      expect(mockAnnouncement.style.overflow).toBe('hidden');
    });

    test('should create proper announcement element for alert role', () => {
      toast.error('Test error');

      const callArgs = mockSonnerToast.error.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'alert');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
    });

    test('should append and remove announcement from document body', () => {
      jest.useFakeTimers();

      toast.dismiss();

      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockAnnouncement);

      jest.runOnlyPendingTimers();

      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockAnnouncement);

      jest.useRealTimers();
    });

    test('should handle empty description gracefully', () => {
      toast.success('Simple message');

      const callArgs = mockSonnerToast.success.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.textContent).toBe('Success: Simple message. ');
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete success workflow', () => {
      const message = 'File uploaded successfully';
      const options = {
        description: 'Upload completed in 2.3 seconds',
        action: {
          label: 'View File',
          onClick: () => console.log('View clicked')
        },
        duration: 4000
      };

      const toastId = toast.success(message, options);

      expect(mockSonnerToast.success).toHaveBeenCalledWith(message, {
        description: options.description,
        action: options.action,
        duration: 4000,
        onAutoClose: expect.any(Function),
        onDismiss: expect.any(Function)
      });

      expect(toastId).toBeDefined();
    });

    test('should handle error with retry action', () => {
      const message = 'Connection failed';
      const retryAction = jest.fn();
      const options = {
        description: 'Unable to connect to server',
        action: {
          label: 'Retry',
          onClick: retryAction
        },
        duration: 8000
      };

      const toastId = toast.error(message, options);

      const callArgs = mockSonnerToast.error.mock.calls[0][1];
      if (callArgs.action?.onClick) {
        callArgs.action.onClick();
      }

      expect(retryAction).toHaveBeenCalled();
      expect(toastId).toBeDefined();
    });

    test('should handle multiple toasts with different priorities', () => {
      const successToast = toast.success('Task completed');
      const errorToast = toast.error('Something went wrong');
      const warningToast = toast.warning('Please review settings');
      const infoToast = toast.info('New update available');

      expect(mockSonnerToast.success).toHaveBeenCalledTimes(1);
      expect(mockSonnerToast.error).toHaveBeenCalledTimes(1);
      expect(mockSonnerToast.warning).toHaveBeenCalledTimes(1);
      expect(mockSonnerToast.info).toHaveBeenCalledTimes(1);

      expect(successToast).toBeDefined();
      expect(errorToast).toBeDefined();
      expect(warningToast).toBeDefined();
      expect(infoToast).toBeDefined();
    });

    test('should handle dismissal of specific toast', () => {
      const toastId = 'specific-toast-123';
      const result = toast.dismiss(toastId);

      expect(mockSonnerToast.dismiss).toHaveBeenCalledWith(toastId);
      expect(result).toBeDefined();
    });
  });

  describe('Accessibility Features', () => {
    test('should set proper ARIA attributes for screen readers', () => {
      toast.success('Accessible message');

      const callArgs = mockSonnerToast.success.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'status');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
    });

    test('should use assertive live region for alerts', () => {
      toast.error('Critical error');

      const callArgs = mockSonnerToast.error.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('role', 'alert');
      expect(mockAnnouncement.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
    });

    test('should announce both message and description', () => {
      const message = 'Data saved';
      const description = 'All changes have been persisted';

      toast.info(message, { description });

      const callArgs = mockSonnerToast.info.mock.calls[0][1];
      callArgs.onAutoClose();

      expect(mockAnnouncement.textContent).toBe(`Information: ${message}. ${description}`);
    });

    test('should make announcement invisible but accessible', () => {
      toast.warning('System warning');

      expect(mockAnnouncement.style.position).toBe('absolute');
      expect(mockAnnouncement.style.left).toBe('-10000px');
      expect(mockAnnouncement.style.width).toBe('1px');
      expect(mockAnnouncement.style.height).toBe('1px');
      expect(mockAnnouncement.style.overflow).toBe('hidden');
    });
  });
});
