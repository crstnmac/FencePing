import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { geofenceService } from '../services/api';
import {
  FrontendGeofence,
  CreateGeofenceRequest,
  GeofenceBulkOperationResult,
} from '../types/geofence';
import {
  transformToFrontend,
  transformToCreateRequest,
  transformToUpdateRequest,
  transformMultipleToFrontend,
  duplicateGeofence,
} from '../utils/geofenceTransformers';
import {
  handleGeofenceError,
  handleGeofenceSuccess,
  retryOperation,
} from '../utils/geofenceErrorHandler';

export interface UseGeofencesResult {
  geofences: FrontendGeofence[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface GeofenceOperationState {
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching all geofences with proper transformation
 */
export function useGeofences(): UseGeofencesResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['geofences'], // Force cache bust
    queryFn: async () => {
      const backendGeofences = await geofenceService.getGeofences();
      const transformed = transformMultipleToFrontend(backendGeofences);
      return transformed;
    },
    retry: (failureCount, error) => {
      // Retry up to 3 times for retryable errors
      if (failureCount >= 3) return false;

      const geofenceError = handleGeofenceError(error, 'fetch geofences');
      return geofenceError.retryable;
    },
  });

  return {
    geofences: data || [],
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for creating geofences with optimistic updates
 */
export function useCreateGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (geofence: Omit<FrontendGeofence, 'id'>) => {
      console.log('🔄 Frontend geofence data:', geofence);

      const createRequest = transformToCreateRequest(geofence);
      if (!createRequest) {
        throw new Error('Invalid geofence data for creation');
      }

      console.log('📡 API request data:', createRequest);

      return await retryOperation(
        () => geofenceService.createGeofence(createRequest),
        2 // Retry twice for creates
      );
    },
    onMutate: async (newGeofence) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['geofences'] });

      // Snapshot the previous value
      const previousGeofences = queryClient.getQueryData<FrontendGeofence[]>(['geofences']);

      // Optimistically update the cache
      if (previousGeofences) {
        const optimisticGeofence: FrontendGeofence = {
          ...newGeofence,
          id: `temp-${Date.now()}`, // Temporary ID
        };

        queryClient.setQueryData<FrontendGeofence[]>(
          ['geofences'],
          [...previousGeofences, optimisticGeofence]
        );
      }

      // Return a context object with the snapshotted value
      return { previousGeofences };
    },
    onError: (error, newGeofence, context) => {
      // Rollback on error
      if (context?.previousGeofences) {
        queryClient.setQueryData(['geofences'], context.previousGeofences);
      }

      handleGeofenceError(error, 'create geofence');
    },
    onSuccess: (data, variables) => {
      // Replace optimistic update with real data
      const transformed = transformToFrontend(data);
      if (transformed) {
        queryClient.setQueryData<FrontendGeofence[]>(['geofences'], (old) => {
          if (!old) return [transformed];

          // Remove the optimistic entry and add the real one
          const withoutOptimistic = old.filter((g) => !g.id.startsWith('temp-'));
          return [...withoutOptimistic, transformed];
        });

        handleGeofenceSuccess('create', transformed.name);
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Hook for updating geofences with optimistic updates
 */
export function useUpdateGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      geofenceId,
      updates,
    }: {
      geofenceId: string;
      updates: Partial<FrontendGeofence>;
    }) => {
      const updateRequest = transformToUpdateRequest(updates);
      if (!updateRequest) {
        throw new Error('Invalid geofence updates');
      }

      return await retryOperation(
        () => geofenceService.updateGeofence(geofenceId, updateRequest),
        2 // Retry twice for updates
      );
    },
    onMutate: async ({ geofenceId, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['geofences'] });

      // Snapshot the previous value
      const previousGeofences = queryClient.getQueryData<FrontendGeofence[]>(['geofences']);

      // Optimistically update the cache
      if (previousGeofences) {
        queryClient.setQueryData<FrontendGeofence[]>(['geofences'], (old) => {
          if (!old) return old;

          return old.map((geofence) =>
            geofence.id === geofenceId ? { ...geofence, ...updates } : geofence
          );
        });
      }

      return { previousGeofences, geofenceId };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousGeofences) {
        queryClient.setQueryData(['geofences'], context.previousGeofences);
      }

      handleGeofenceError(error, 'update geofence');
    },
    onSuccess: (data, variables) => {
      // Update with real data from server
      const transformed = transformToFrontend(data);
      if (transformed) {
        queryClient.setQueryData<FrontendGeofence[]>(['geofences'], (old) => {
          if (!old) return [transformed];

          return old.map((geofence) =>
            geofence.id === variables.geofenceId ? transformed : geofence
          );
        });

        handleGeofenceSuccess('update', transformed.name);
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Hook for deleting single or multiple geofences
 */
export function useDeleteGeofences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (geofenceIds: string | string[]) => {
      const ids = Array.isArray(geofenceIds) ? geofenceIds : [geofenceIds];

      // Delete all geofences in parallel
      await Promise.all(
        ids.map((id) =>
          retryOperation(
            () => geofenceService.deleteGeofence(id),
            1 // Only retry once for deletions
          )
        )
      );

      return ids;
    },
    onMutate: async (geofenceIds) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['geofences'] });

      const ids = Array.isArray(geofenceIds) ? geofenceIds : [geofenceIds];

      // Snapshot the previous value
      const previousGeofences = queryClient.getQueryData<FrontendGeofence[]>(['geofences']);

      // Get names for success message
      const geofenceNames =
        previousGeofences?.filter((g) => ids.includes(g.id)).map((g) => g.name) || [];

      // Optimistically remove from cache
      if (previousGeofences) {
        queryClient.setQueryData<FrontendGeofence[]>(
          ['geofences'],
          previousGeofences.filter((geofence) => !ids.includes(geofence.id))
        );
      }

      return { previousGeofences, geofenceNames };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousGeofences) {
        queryClient.setQueryData(['geofences'], context.previousGeofences);
      }

      handleGeofenceError(error, 'delete geofence');
    },
    onSuccess: (deletedIds, variables, context) => {
      const geofenceNames = context?.geofenceNames || [];
      const displayName =
        geofenceNames.length === 1 ? geofenceNames[0] : `${geofenceNames.length} geofences`;

      handleGeofenceSuccess('delete', displayName);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Hook for duplicating geofences
 */
export function useDuplicateGeofences() {
  const queryClient = useQueryClient();
  const createMutation = useCreateGeofence();

  return useMutation({
    mutationFn: async (geofenceIds: string[]) => {
      const currentGeofences = queryClient.getQueryData<FrontendGeofence[]>(['geofences']) || [];

      const geofencesToDuplicate = currentGeofences.filter((g) => geofenceIds.includes(g.id));

      if (geofencesToDuplicate.length === 0) {
        throw new Error('No geofences found to duplicate');
      }

      // Create duplicates in parallel
      const results = await Promise.all(
        geofencesToDuplicate.map(async (geofence) => {
          const duplicate = duplicateGeofence(geofence);
          const createRequest = transformToCreateRequest(duplicate);

          if (!createRequest) {
            throw new Error(`Invalid geofence data for duplication: ${geofence.name}`);
          }

          return await retryOperation(
            () => geofenceService.createGeofence(createRequest),
            1 // Only retry once for duplications
          );
        })
      );

      return results;
    },
    onSuccess: (results, variables) => {
      // Transform and add to cache
      const transformed = results
        .map((result: any) => transformToFrontend(result))
        .filter((g): g is FrontendGeofence => g !== null);

      queryClient.setQueryData<FrontendGeofence[]>(['geofences'], (old) => {
        if (!old) return transformed;
        return [...old, ...transformed];
      });

      const displayName =
        results.length === 1 ? transformed[0]?.name : `${results.length} geofences`;

      handleGeofenceSuccess('duplicate', displayName);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      handleGeofenceError(error, 'duplicate geofences');
    },
  });
}

/**
 * Hook for batch operations on geofences
 */
export function useBatchGeofenceOperations() {
  const deleteMutation = useDeleteGeofences();
  const duplicateMutation = useDuplicateGeofences();

  return {
    deleteGeofences: deleteMutation,
    duplicateGeofences: duplicateMutation,
    isLoading: deleteMutation.isPending || duplicateMutation.isPending,
  };
}
