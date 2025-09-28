import { toast } from 'react-hot-toast';
import { GeofenceOperationResult } from '../types/geofence';

export enum GeofenceErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
  GEOMETRY_INVALID = 'GEOMETRY_INVALID',
  NAME_REQUIRED = 'NAME_REQUIRED',
  DUPLICATE_NAME = 'DUPLICATE_NAME'
}

export interface GeofenceError {
  code: GeofenceErrorCode;
  message: string;
  userMessage: string;
  details?: any;
  retryable: boolean;
}

/**
 * Maps API errors to user-friendly messages
 */
const ERROR_MESSAGES: Record<GeofenceErrorCode, { message: string; userMessage: string; retryable: boolean }> = {
  [GeofenceErrorCode.NETWORK_ERROR]: {
    message: 'Network request failed',
    userMessage: 'Connection failed. Please check your internet connection and try again.',
    retryable: true
  },
  [GeofenceErrorCode.VALIDATION_ERROR]: {
    message: 'Data validation failed',
    userMessage: 'The geofence data is invalid. Please check your input and try again.',
    retryable: false
  },
  [GeofenceErrorCode.NOT_FOUND]: {
    message: 'Geofence not found',
    userMessage: 'The requested geofence was not found. It may have been deleted.',
    retryable: false
  },
  [GeofenceErrorCode.UNAUTHORIZED]: {
    message: 'User not authorized',
    userMessage: 'You are not authorized to perform this action. Please sign in again.',
    retryable: false
  },
  [GeofenceErrorCode.FORBIDDEN]: {
    message: 'Access forbidden',
    userMessage: 'You do not have permission to perform this action.',
    retryable: false
  },
  [GeofenceErrorCode.SERVER_ERROR]: {
    message: 'Server error occurred',
    userMessage: 'A server error occurred. Please try again in a few moments.',
    retryable: true
  },
  [GeofenceErrorCode.TIMEOUT]: {
    message: 'Request timed out',
    userMessage: 'The request took too long. Please try again.',
    retryable: true
  },
  [GeofenceErrorCode.GEOMETRY_INVALID]: {
    message: 'Invalid geometry data',
    userMessage: 'The geofence shape is invalid. Please redraw the geofence.',
    retryable: false
  },
  [GeofenceErrorCode.NAME_REQUIRED]: {
    message: 'Geofence name is required',
    userMessage: 'Please provide a name for the geofence.',
    retryable: false
  },
  [GeofenceErrorCode.DUPLICATE_NAME]: {
    message: 'Geofence name already exists',
    userMessage: 'A geofence with this name already exists. Please choose a different name.',
    retryable: false
  },
  [GeofenceErrorCode.UNKNOWN]: {
    message: 'Unknown error occurred',
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true
  }
};

/**
 * Determines error code from various error types
 */
export function determineErrorCode(error: any): GeofenceErrorCode {
  // Network errors
  if (!navigator.onLine) {
    return GeofenceErrorCode.NETWORK_ERROR;
  }

  // Fetch/axios errors
  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
    return GeofenceErrorCode.NETWORK_ERROR;
  }

  // HTTP status code errors
  if (error?.status || error?.response?.status) {
    const status = error.status || error.response.status;
    
    switch (status) {
      case 400:
        return GeofenceErrorCode.VALIDATION_ERROR;
      case 401:
        return GeofenceErrorCode.UNAUTHORIZED;
      case 403:
        return GeofenceErrorCode.FORBIDDEN;
      case 404:
        return GeofenceErrorCode.NOT_FOUND;
      case 408:
      case 504:
        return GeofenceErrorCode.TIMEOUT;
      case 500:
      case 502:
      case 503:
        return GeofenceErrorCode.SERVER_ERROR;
      default:
        return GeofenceErrorCode.UNKNOWN;
    }
  }

  // Validation specific errors
  if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
    return GeofenceErrorCode.VALIDATION_ERROR;
  }

  if (error?.message?.includes('geometry')) {
    return GeofenceErrorCode.GEOMETRY_INVALID;
  }

  if (error?.message?.includes('name') && error?.message?.includes('required')) {
    return GeofenceErrorCode.NAME_REQUIRED;
  }

  if (error?.message?.includes('duplicate') || error?.message?.includes('already exists')) {
    return GeofenceErrorCode.DUPLICATE_NAME;
  }

  // Timeout errors
  if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout')) {
    return GeofenceErrorCode.TIMEOUT;
  }

  return GeofenceErrorCode.UNKNOWN;
}

/**
 * Creates a structured error object from various error types
 */
export function createGeofenceError(error: any, context?: string): GeofenceError {
  const code = determineErrorCode(error);
  const errorConfig = ERROR_MESSAGES[code];
  
  const geofenceError: GeofenceError = {
    code,
    message: errorConfig.message,
    userMessage: errorConfig.userMessage,
    retryable: errorConfig.retryable,
    details: {
      originalError: error,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }
  };

  // Log error for debugging (but not to console in production)
  if (process.env.NODE_ENV === 'development') {
    console.error('Geofence Error:', geofenceError);
  }

  return geofenceError;
}

/**
 * Shows appropriate user notification for errors
 */
export function handleGeofenceError(error: any, context?: string): GeofenceError {
  const geofenceError = createGeofenceError(error, context);
  
  // Show user notification based on error severity
  if (geofenceError.code === GeofenceErrorCode.NETWORK_ERROR) {
    toast.error(geofenceError.userMessage, {
      duration: 6000,
      icon: '🌐'
    });
  } else if (geofenceError.code === GeofenceErrorCode.VALIDATION_ERROR || 
             geofenceError.code === GeofenceErrorCode.GEOMETRY_INVALID) {
    toast.error(geofenceError.userMessage, {
      duration: 5000,
      icon: '⚠️'
    });
  } else if (geofenceError.retryable) {
    toast.error(geofenceError.userMessage, {
      duration: 4000,
      icon: '🔄'
    });
  } else {
    toast.error(geofenceError.userMessage, {
      duration: 4000,
      icon: '❌'
    });
  }

  return geofenceError;
}

/**
 * Shows success notifications for geofence operations
 */
export function handleGeofenceSuccess(operation: 'create' | 'update' | 'delete' | 'duplicate', name?: string) {
  const messages = {
    create: `Geofence "${name}" created successfully`,
    update: `Geofence "${name}" updated successfully`, 
    delete: name ? `Geofence "${name}" deleted successfully` : 'Geofences deleted successfully',
    duplicate: name ? `Geofence "${name}" duplicated successfully` : 'Geofences duplicated successfully'
  };

  const icons = {
    create: '✅',
    update: '📝', 
    delete: '🗑️',
    duplicate: '📋'
  };

  toast.success(messages[operation], {
    duration: 3000,
    icon: icons[operation]
  });
}

/**
 * Creates a result object for geofence operations
 */
export function createOperationResult(
  success: boolean,
  data?: any,
  error?: GeofenceError
): GeofenceOperationResult & { data?: any } {
  return {
    success,
    data,
    error: error ? {
      code: error.code,
      message: error.message,
      details: error.details
    } : undefined
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const geofenceError = createGeofenceError(error);
      
      // Don't retry if error is not retryable or this is the last attempt
      if (!geofenceError.retryable || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}