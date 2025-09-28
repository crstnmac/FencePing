'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { authClient, useSession } from '../lib/auth-client';

// Better Auth context types
interface BetterAuthContextType {
  // Methods
  signIn: typeof authClient.signIn;
  signUp: typeof authClient.signUp;
  signOut: typeof authClient.signOut;

  // Hooks
  useSession: typeof useSession;
}

const BetterAuthContext = createContext<BetterAuthContextType | undefined>(undefined);

// Custom hook to use Better Auth context
export const useBetterAuth = () => {
  const context = useContext(BetterAuthContext);
  if (context === undefined) {
    throw new Error('useBetterAuth must be used within a BetterAuthProvider');
  }
  return context;
};

interface BetterAuthProviderProps {
  children: ReactNode;
}

export const BetterAuthProvider = ({ children }: BetterAuthProviderProps) => {
  const contextValue: BetterAuthContextType = {
    signIn: authClient.signIn,
    signUp: authClient.signUp,
    signOut: authClient.signOut,
    useSession,
  };

  return (
    <BetterAuthContext.Provider value={contextValue}>
      {children}
    </BetterAuthContext.Provider>
  );
};

// Convenience hooks that use Better Auth directly
export const useBetterAuthSession = () => {
  const { data: session, isPending: isLoading, error } = useSession();

  return {
    session,
    user: session?.user,
    isLoading,
    isAuthenticated: !!session?.user,
    error,
  };
};

// User data is available through the session
export const useBetterAuthUser = () => {
  const { session, user, isLoading, isAuthenticated, error } = useBetterAuthSession();

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
  };
};