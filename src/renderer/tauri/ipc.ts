export interface CommandResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

const isCommandResponse = <T>(value: unknown): value is CommandResponse<T> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'success' in value;
};

export const invokeCommand = async <T = unknown>(
  channel: string,
  payload?: Record<string, unknown>
): Promise<CommandResponse<T>> => {
  const api = window?.desktop ?? window?.desktopAPI;
  if (!api?.invoke) {
    throw new Error('Desktop bridge is unavailable');
  }

  const result = await api.invoke(channel, payload);

  if (isCommandResponse<T>(result)) {
    return result;
  }

  return {
    success: true,
    data: result as T,
  } satisfies CommandResponse<T>;
};

export const toCommandResponse = <T>(value: unknown): CommandResponse<T> => {
  if (value && typeof value === 'object' && 'success' in (value as Record<string, unknown>)) {
    const response = value as CommandResponse<T>;
    return {
      success: Boolean(response.success),
      data: response.data,
      error: response.error,
    };
  }

  return {
    success: true,
    data: value as T,
  };
};
