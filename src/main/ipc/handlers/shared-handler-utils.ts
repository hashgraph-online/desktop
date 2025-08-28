import { IpcMainInvokeEvent } from 'electron';
import { IPCResponse } from '../../../shared/schemas';
import { z } from 'zod';

/**
 * Creates a standardized error response for IPC handlers
 * @param error - The error to handle
 * @param fallbackMessage - Default message if error is not an Error instance
 * @returns Standardized IPCResponse error format
 */
export function handleIPCError(error: unknown, fallbackMessage: string): IPCResponse {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: `Validation error: ${error.message}`,
    };
  }
  
  const errorMessage = error instanceof Error ? error.message : fallbackMessage;
  return { success: false, error: errorMessage };
}

/**
 * Creates a standardized success response for IPC handlers
 * @param data - Optional data to include in the response
 * @returns Standardized IPCResponse success format
 */
export function createSuccessResponse<T>(data?: T): IPCResponse {
  return { success: true, data };
}