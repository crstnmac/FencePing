'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { authService, AuthError, type User, type Account, type LoginRequest, type RegisterRequest } from '../services/auth';

// Auth context state interface
interface AuthState {
  user: User | null;
  organization: Account | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
}

// Auth context actions interface
interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
}

type AuthContextType = AuthState & AuthActions;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // State management
  const [user, setUser] = useState<User | null>(null);
  const [organization, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  const isAuthenticated = !!user && authService.isAuthenticated();

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Handle logout (internal method)
  const handleLogout = useCallback(async () => {
    setUser(null);
    setAccount(null);
    setError(null);
    authService.removeStoredToken();
  }, []);

  // Refresh auth state from server
  const refreshAuth = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await authService.me();
      
      if (response.success) {
        setUser(response.data.user);
        setAccount(response.data.organization);
      } else {
        // Invalid response, clear auth
        await handleLogout();
      }
    } catch (err) {
      console.error('Auth refresh failed:', err);
      
      if (err instanceof AuthError && err.isUnauthorized) {
        // Token is invalid, clear auth silently
        await handleLogout();
      } else if (err instanceof Error && err.message.includes('Session expired')) {
        // Handle session expired from token refresh
        await handleLogout();
        setError(new AuthError(err.message, 401));
      } else {
        setError(err as AuthError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleLogout]);

  // Initialize auth state on mount
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Public auth actions
  const login = useCallback(async (credentials: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);
      
      if (response.success) {
        setUser(response.data.user);
        setAccount(response.data.organization);
      } else {
        throw new AuthError(response.error || 'Login failed');
      }
    } catch (err) {
      const authError = err instanceof AuthError ? err : new AuthError('Login failed');
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (userData: RegisterRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.register(userData);
      
      if (response.success) {
        setUser(response.data.user);
        setAccount(response.data.organization);
      } else {
        throw new AuthError(response.error || 'Registration failed');
      }
    } catch (err) {
      const authError = err instanceof AuthError ? err : new AuthError('Registration failed');
      setError(authError);
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call server logout to revoke session
      await authService.logout();
    } catch (err) {
      // Log error but don't throw - we still want to clear local state
      console.warn('Server logout failed:', err);
    } finally {
      await handleLogout();
      setIsLoading(false);
    }
  }, [handleLogout]);

  // Context value
  const value: AuthContextType = {
    // State
    user,
    organization,
    isLoading,
    isAuthenticated,
    error,
    // Actions
    login,
    register,
    logout,
    refreshAuth,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};