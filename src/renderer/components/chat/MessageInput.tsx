import React, { useState, useRef, useEffect } from 'react';
import { Input } from '../ui';
import { Button } from '../ui';
import Typography from '../ui/Typography';
import { FiSend, FiAlertCircle } from 'react-icons/fi';
import { cn } from '../../lib/utils';

interface MessageInputProps {
  onSendMessage: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Input field with send button for chat messages
 */
const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  disabled = false,
  placeholder = "Type a message..." 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const message = inputValue.trim();
    if (!message || isSubmitting || disabled) return;

    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSendMessage(message);
      setInputValue('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (error) setError(null);
  };

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      {error && (
        <div 
          className="px-4 sm:px-6 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center space-x-2">
            <FiAlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-hidden="true" />
            <Typography variant="caption" className="text-red-600 dark:text-red-400">
              {error}
            </Typography>
          </div>
        </div>
      )}
      
      <div className="px-4 sm:px-6 py-4">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={disabled ? "Connect to agent to start chatting..." : placeholder}
              disabled={disabled || isSubmitting}
              className="w-full"
              aria-label="Message input"
              aria-describedby={error ? "message-error" : "message-help"}
              maxLength={2000}
            />
          </div>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={disabled || isSubmitting || !inputValue.trim()}
            size="default"
            className="flex-shrink-0 min-w-[80px] sm:min-w-[100px]"
            aria-label={isSubmitting ? 'Sending message' : 'Send message'}
          >
            <FiSend className="w-4 h-4 mr-2" aria-hidden="true" />
            <span className="whitespace-nowrap">{isSubmitting ? 'Sending...' : 'Send'}</span>
          </Button>
        </form>
        
        {!disabled && (
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <Typography variant="caption" color="secondary">
              <span id="message-help">
                Press Enter to send, Shift+Enter for new line
              </span>
            </Typography>
            <Typography 
              variant="caption" 
              color="secondary"
              className={cn(
                "tabular-nums",
                inputValue.length > 1800 && "text-orange-600 dark:text-orange-400",
                inputValue.length > 1950 && "text-red-600 dark:text-red-400"
              )}
              aria-label={`Character count: ${inputValue.length} of 2000`}
            >
              {inputValue.length}/2000
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageInput;