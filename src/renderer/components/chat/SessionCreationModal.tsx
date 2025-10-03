import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import Typography from '../ui/Typography';
import { Input } from '../ui/input';
import {
  FiUser,
  FiMessageCircle,
  FiX,
  FiLoader,
  FiAlertCircle,
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import { useAgentStore } from '../../stores/agentStore';
import type { ChatSession } from '../../../main/db/schema';

type ChatMode = 'personal';

interface SessionCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (session: ChatSession) => void;
}

interface FormData {
  sessionName: string;
  mode: ChatMode;
}

interface ValidationErrors {
  sessionName?: string;
}


/**
 * Validates session name - allows empty names for auto-generation
 */
const validateSessionName = (name: string): boolean => {
  return name.trim().length === 0 || (name.trim().length >= 1 && name.trim().length <= 50);
};

/**
 * Modal component for creating new chat sessions
 */
export const SessionCreationModal: React.FC<SessionCreationModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
}) => {
  const { createSession } = useAgentStore();
  
  const [formData, setFormData] = useState<FormData>({
    sessionName: '',
    mode: 'personal',
  });
  
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleInputChange = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
    
    if (submitError) {
      setSubmitError(null);
    }
  }, [errors, submitError]);


  const validateForm = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};
    
    if (formData.sessionName.trim() && !validateSessionName(formData.sessionName)) {
      newErrors.sessionName = 'Session name must be 1-50 characters if provided';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.sessionName]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsCreating(true);
    setSubmitError(null);
    
    try {
      const session = await createSession(
        formData.sessionName.trim() || '',
        'personal'
      );
      
      onSessionCreated(session);
      onClose();
      
      setFormData({
        sessionName: '',
        mode: 'personal',
      });
      setErrors({});
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to create session'
      );
    } finally {
      setIsCreating(false);
    }
  }, [validateForm, createSession, formData, onSessionCreated, onClose]);

  const handleClose = useCallback(() => {
    if (isCreating) return;
    
    onClose();
    
    setFormData({
      sessionName: '',
      mode: 'personal',
    });
    setErrors({});
    setSubmitError(null);
  }, [isCreating, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={() => !isCreating && handleClose()}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FiMessageCircle className="w-5 h-5" />
            Create New Session
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Name */}
          <div className="space-y-2">
            <label className="block">
              <Typography variant="body2" className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Name (optional)
              </Typography>
              <Input
                type="text"
                placeholder="Leave empty for auto-naming (Session 1, Session 2, etc.)"
                value={formData.sessionName}
                onChange={(e) => handleInputChange('sessionName', e.target.value)}
                disabled={isCreating}
                aria-invalid={!!errors.sessionName}
                className={cn(
                  errors.sessionName && 'border-red-500 dark:border-red-500'
                )}
                maxLength={50}
                autoFocus
              />
              {errors.sessionName && (
                <div className="flex items-center gap-1 mt-1">
                  <FiAlertCircle className="w-3 h-3 text-red-500" />
                  <Typography variant="caption" className="text-red-500">
                    {errors.sessionName}
                  </Typography>
                </div>
              )}
            </label>
          </div>

          {/* Session Type */}
          <div className="space-y-3">
            <Typography variant="body2" className="font-medium text-gray-700 dark:text-gray-300">
              Session Type
            </Typography>
            <div className="p-4 rounded-lg border-2 border-[#5599fe] bg-[#5599fe]/10 dark:bg-[#5599fe]/20">
              <div className="flex items-center gap-2 mb-2">
                <FiUser className="w-4 h-4" />
                <Typography variant="body2" className="font-medium">
                  Personal Assistant
                </Typography>
              </div>
              <Typography variant="caption" className="text-gray-600 dark:text-gray-400">
                Private session with AI assistant
              </Typography>
            </div>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <FiAlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <Typography variant="caption" className="text-red-600 dark:text-red-400">
                {submitError}
              </Typography>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Session'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SessionCreationModal;