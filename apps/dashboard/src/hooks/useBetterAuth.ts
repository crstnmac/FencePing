'use client';

import { useCallback } from 'react';
import { authClient } from '@/lib/auth-client';
import { useBetterAuthSession } from '../contexts/BetterAuthContext';

// Compatibility interface matching the existing useAuth hook
interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  organization_name?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  image?: string;
}

export interface AuthError {
  message: string;
  isRateLimited?: boolean;
  isAccountLocked?: boolean;
  isUnauthorized?: boolean;
}

// Hook that provides the same interface as the existing useAuth
export const useBetterAuth = () => {
  const { user, isLoading, isAuthenticated, error: sessionError } = useBetterAuthSession();

  const login = useCallback(async (credentials: LoginRequest): Promise<void> => {
    try {
      const result = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Login failed');
      }
    } catch (error: any) {
      const authError: AuthError = {
        message: error.message || 'Login failed',
        isUnauthorized: error.message?.includes('Invalid') || error.message?.includes('Unauthorized'),
        isRateLimited: error.message?.includes('rate limit') || error.message?.includes('too many'),
        isAccountLocked: error.message?.includes('locked') || error.message?.includes('disabled'),
      };
      throw authError;
    }
  }, []);

  const register = useCallback(async (userData: RegisterRequest): Promise<void> => {
    try {
      const result = await authClient.signUp.email({
        email: userData.email,
        password: userData.password,
        name: userData.name,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Registration failed');
      }
    } catch (error: any) {
      const authError: AuthError = {
        message: error.message || 'Registration failed',
      };
      throw authError;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authClient.signOut();
    } catch (error: any) {
      console.error('Logout error:', error);
      // Don't throw logout errors, just log them
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<void> => {
    // Better Auth handles session refresh automatically
    // This is mainly for compatibility
    try {
      await authClient.getSession();
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  }, []);

  const clearError = useCallback(() => {
    // Errors are handled by Better Auth automatically
    // This is mainly for compatibility
  }, []);

  // Map Better Auth user to our expected User interface
  const mappedUser: User | null = user ? {
    id: user.id,
    name: user.name || '',
    email: user.email,
    emailVerified: user.emailVerified || false,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
    image: user.image || undefined,
  } : null;

  // Map session error to AuthError
  const mappedError: AuthError | null = sessionError ? {
    message: sessionError.message || 'Authentication error',
  } : null;

  return {
    // State
    user: mappedUser,
    organization: null, // Better Auth doesn't have organization concept by default
    isLoading,
    isAuthenticated,
    error: mappedError,

    // Actions
    login,
    register,
    logout,
    refreshAuth,
    clearError,
  };
};