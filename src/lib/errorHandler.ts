/**
 * Comprehensive error handling utilities for production-ready error management
 * Provides retry logic, user-friendly error messages, and error reporting
 */

export interface ApiError {
  message: string;
  code?: string;
  retryable?: boolean;
  statusCode?: number;
}

export class AppError extends Error {
  code?: string;
  retryable: boolean;
  statusCode?: number;
  userMessage: string;

  constructor(
    message: string,
    options?: {
      code?: string;
      retryable?: boolean;
      statusCode?: number;
      userMessage?: string;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.code = options?.code;
    this.retryable = options?.retryable ?? false;
    this.statusCode = options?.statusCode;
    this.userMessage = options?.userMessage || message;
  }
}

/**
 * Parse API error response into user-friendly message
 */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof AppError) {
    return {
      message: error.userMessage,
      code: error.code,
      retryable: error.retryable,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        message: 'Network error - please check your connection and try again',
        code: 'NETWORK_ERROR',
        retryable: true,
      };
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.message.includes('aborted')) {
      return {
        message: 'Request timed out - please try again',
        code: 'TIMEOUT',
        retryable: true,
      };
    }

    return {
      message: error.message,
      retryable: false,
    };
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    retryable: true,
  };
}

/**
 * Fetch with automatic retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry on 4xx errors (client errors)
      if (error instanceof AppError && error.statusCode && error.statusCode < 500) {
        throw error;
      }

      // Retry on network errors
      if (attempt < maxRetries && (error instanceof TypeError || error instanceof DOMException)) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * API call wrapper with error handling
 */
export async function apiCall<T>(
  url: string,
  options: RequestInit = {},
  retries: number = 2
): Promise<T> {
  try {
    const response = await fetchWithRetry(url, options, retries);

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // If response isn't JSON, use status text
        errorData = { error: response.statusText };
      }

      throw new AppError(errorData.error || `Request failed: ${response.statusText}`, {
        code: errorData.code,
        statusCode: response.status,
        retryable: response.status >= 500,
        userMessage: errorData.error || getErrorMessage(response.status),
      });
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const parsed = parseApiError(error);
    throw new AppError(parsed.message, {
      code: parsed.code,
      retryable: parsed.retryable,
      statusCode: parsed.statusCode,
    });
  }
}

/**
 * Get user-friendly error message based on HTTP status
 */
function getErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Please sign in to continue.';
    case 403:
      return 'You don\'t have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Server error. Please try again in a moment.';
    default:
      return 'An error occurred. Please try again.';
  }
}

/**
 * Error boundary error handler (for React error boundaries)
 */
export function logError(error: Error, errorInfo?: any): void {
  // In production, send to error tracking service (e.g., Sentry)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  } else {
    // In development, log to console
    console.error('Error:', error, errorInfo);
  }
}

