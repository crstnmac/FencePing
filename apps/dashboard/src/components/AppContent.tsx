'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from './Sidebar';
import { LoadingSpinner } from './LoadingSpinner';
import { SidebarProvider } from '../contexts/SidebarContext';

interface AppContentProps {
  children: React.ReactNode;
}

export const AppContent = ({ children }: AppContentProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname?.startsWith('/auth/');

  // Handle redirect to login when not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthPage) {
      router.replace('/auth/login');
    }
  }, [isLoading, isAuthenticated, isAuthPage, router]);
  
  // Show loading spinner while auth is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  // If on auth page, show without sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // If not authenticated and not on auth page, show loading while redirecting
  if (!isAuthenticated && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  // Authenticated user - show app with sidebar
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
};
