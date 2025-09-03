'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Dynamically import devtools to avoid SSR issues
let ReactQueryDevtools: React.ComponentType<any> | null = null;
if (typeof window !== 'undefined') {
  import('@tanstack/react-query-devtools').then((module) => {
    ReactQueryDevtools = module.ReactQueryDevtools;
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error) => {
              // Don't retry on 401/403 errors
              if (error && typeof error === 'object' && 'status' in error) {
                if (error.status === 401 || error.status === 403) {
                  return false;
                }
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {ReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}