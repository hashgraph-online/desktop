import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiXMark, HiArrowsPointingOut, HiArrowsPointingIn } from 'react-icons/hi2';
import { Button } from './Button';
import Typography from './Typography';

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  headerAction?: ReactNode;
}

/**
 * Modal component adapted from hashblocks design
 * Supports both fullscreen and regular modal modes
 */
const Modal: React.FC<ModalProps> = ({
  children,
  isOpen,
  onClose,
  title = 'Modal',
  isFullscreen = false,
  onToggleFullscreen,
  headerAction,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    isFullscreen ? (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="absolute inset-0 bg-grid-gray-200/50 dark:bg-grid-white/[0.05] bg-[size:40px_40px] pointer-events-none"></div>
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex justify-between items-center p-6 border-b border-hgo-blue/30">
            <Typography
              variant="h3"
              className="text-2xl font-bold"
              noMargin
            >
              {title}
            </Typography>
            <div className="flex items-center space-x-4">
              {headerAction}
              {onToggleFullscreen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleFullscreen}
                  className="h-8 w-8 p-0"
                >
                  {isFullscreen ? <HiArrowsPointingIn className="w-4 h-4" /> : <HiArrowsPointingOut className="w-4 h-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900"
              >
                <HiXMark className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="flex-grow overflow-auto p-6">{children}</div>
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-hgo-blue shadow-lg shadow-hgo-blue/50 w-full max-w-5xl rounded-lg">
          <div className="absolute inset-0 bg-grid-gray-200/50 dark:bg-grid-white/[0.05] bg-[size:40px_40px] pointer-events-none rounded-lg"></div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-center p-6 border-b border-hgo-blue/30">
              <Typography
                variant="h3"
                className="text-2xl font-bold"
                noMargin
              >
                {title}
              </Typography>
              <div className="flex items-center space-x-4">
                {headerAction}
                {onToggleFullscreen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleFullscreen}
                    className="h-8 w-8 p-0"
                  >
                    {isFullscreen ? <HiArrowsPointingIn className="w-4 h-4" /> : <HiArrowsPointingOut className="w-4 h-4" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900"
                >
                  <HiXMark className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex-grow overflow-auto p-6">{children}</div>
          </div>
        </div>
      </div>
    ),
    document.body,
  );
};

export default Modal;