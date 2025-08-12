import React, { useState, useCallback } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiX, FiInfo, FiWifi } from 'react-icons/fi';
import Typography from '../ui/Typography';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export interface ErrorInfo {
  category: string;
  severity: string;
  message: string;
  userMessage: string;
  code: string;
  recoverable: boolean;
  retryAfter?: number;
  context?: Record<string, any>;
}

export interface RecoveryAction {
  type: 'retry' | 'refresh' | 'redirect' | 'manual' | 'none';
  label: string;
  description: string;
  autoExecute?: boolean;
  delayMs?: number;
}

interface ErrorDisplayProps {
  error: ErrorInfo;
  recoveryActions?: RecoveryAction[];
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Enhanced error display component with recovery actions and user guidance
 * 
 * @param error - Error information object
 * @param recoveryActions - Available recovery actions
 * @param onRetry - Callback for retry action
 * @param onDismiss - Callback for dismissing the error
 * @param className - Additional CSS classes
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  recoveryActions = [],
  onRetry,
  onDismiss,
  className,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const getSeverityStyles = useCallback((severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low':
        return {
          container: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
          icon: 'text-yellow-600 dark:text-yellow-400',
          text: 'text-yellow-800 dark:text-yellow-200',
        };
      case 'medium':
        return {
          container: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
          icon: 'text-orange-600 dark:text-orange-400',
          text: 'text-orange-800 dark:text-orange-200',
        };
      case 'high':
      case 'critical':
        return {
          container: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400',
          text: 'text-red-800 dark:text-red-200',
        };
      default:
        return {
          container: 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800',
          icon: 'text-gray-600 dark:text-gray-400',
          text: 'text-gray-800 dark:text-gray-200',
        };
    }
  }, []);

  const getErrorIcon = useCallback((category: string) => {
    switch (category.toLowerCase()) {
      case 'network':
        return FiWifi;
      case 'validation':
        return FiInfo;
      default:
        return FiAlertTriangle;
    }
  }, []);

  const handleRetry = useCallback(async () => {
    if (isRetrying || !onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, onRetry]);

  const handleAutoRetry = useCallback((action: RecoveryAction) => {
    if (!action.autoExecute || !action.delayMs) return;

    let timeLeft = Math.ceil(action.delayMs / 1000);
    setCountdown(timeLeft);

    const timer = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(timer);
        setCountdown(null);
        handleRetry();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [handleRetry]);

  const styles = getSeverityStyles(error.severity);
  const ErrorIcon = getErrorIcon(error.category);

  const getActionButton = useCallback((action: RecoveryAction, index: number) => {
    const isRetryAction = action.type === 'retry';
    const isDisabled = isRetrying || (countdown !== null && countdown > 0);

    if (action.autoExecute && action.delayMs && countdown !== null) {
      return (
        <Button
          key={index}
          variant="outline"
          size="sm"
          disabled={true}
          className="min-h-[2.25rem]"
        >
          <FiRefreshCw className={cn("w-4 h-4 mr-2", "animate-spin")} />
          Retrying in {countdown}s
        </Button>
      );
    }

    return (
      <Button
        key={index}
        variant={isRetryAction ? "default" : "outline"}
        size="sm"
        onClick={handleRetry}
        disabled={isDisabled}
        className="min-h-[2.25rem] transition-all duration-200"
        title={action.description}
      >
        {isRetrying && isRetryAction ? (
          <FiRefreshCw className={cn("w-4 h-4 mr-2", "animate-spin")} />
        ) : null}
        {action.label}
      </Button>
    );
  }, [isRetrying, countdown, handleRetry]);

  return (
    <div 
      className={cn(
        "border rounded-lg p-4 mt-3 shadow-sm",
        styles.container,
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <ErrorIcon 
          className={cn("w-5 h-5 flex-shrink-0 mt-0.5", styles.icon)} 
          aria-hidden="true"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Typography 
                variant="subtitle2" 
                className={cn("font-semibold", styles.text)}
              >
                {error.category.charAt(0).toUpperCase() + error.category.slice(1)} Error
              </Typography>
              
              <Typography 
                variant="body2" 
                className={cn("mt-1", styles.text)}
              >
                {error.userMessage}
              </Typography>
              
              {error.code && (
                <Typography 
                  variant="caption" 
                  className={cn("mt-2 font-mono", styles.text, "opacity-75")}
                >
                  Error Code: {error.code}
                </Typography>
              )}
            </div>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={cn(
                  "p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                  styles.icon
                )}
                aria-label="Dismiss error"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {recoveryActions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {recoveryActions.map((action, index) => getActionButton(action, index))}
            </div>
          )}
        </div>
      </div>
      
      {error.retryAfter && countdown === null && (
        <div className={cn("mt-3 pt-3 border-t", "border-current opacity-20")}>
          <Typography variant="caption" className={cn(styles.text, "opacity-75")}>
            Automatic retry available in {Math.ceil(error.retryAfter / 1000)} seconds
          </Typography>
        </div>
      )}
    </div>
  );
};

export { ErrorDisplay };
export type { ErrorDisplayProps };