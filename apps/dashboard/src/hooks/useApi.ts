import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dashboardService,
  deviceService,
  eventService,
  geofenceService,
  automationService,
  integrationService,
  type Device,
  type Event,
  type Geofence,
  type Automation,
  type Integration,
  type CreateDeviceRequest,
  type UpdateDeviceRequest,
  type PairingCodeResponse,
  type PairingRequest,
  type DeviceTokenResponse,
  type DeviceStatus,
  type DeviceUser,
  type DeviceShareRequest
} from '../services/api';

// Dashboard hooks
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardService.getStats,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useRecentEvents(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'recent-events', limit],
    queryFn: () => dashboardService.getRecentEvents(limit),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

// Device hooks
export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: deviceService.getDevices,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ['devices', deviceId],
    queryFn: () => deviceService.getDevice(deviceId),
    enabled: !!deviceId,
    staleTime: 30 * 1000,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (device: CreateDeviceRequest) => deviceService.createDevice(device),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, updates }: { deviceId: string; updates: UpdateDeviceRequest }) => 
      deviceService.updateDevice(deviceId, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', variables.deviceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceService.deleteDevice(deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Event hooks
export function useEvents(params: {
  limit?: number;
  offset?: number;
  device_id?: string;
  geofence_id?: string;
  event_type?: string;
  from_date?: string;
  to_date?: string;
} = {}) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => eventService.getEvents(params),
    staleTime: 15 * 1000, // 15 seconds
    placeholderData: (previousData) => previousData, // Keep data while fetching new pages
  });
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventService.getEvent(eventId),
    enabled: !!eventId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useReplayEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => eventService.replayEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

// Geofence hooks
export function useGeofences() {
  return useQuery({
    queryKey: ['geofences'],
    queryFn: geofenceService.getGeofences,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useGeofence(geofenceId: string) {
  return useQuery({
    queryKey: ['geofences', geofenceId],
    queryFn: () => geofenceService.getGeofence(geofenceId),
    enabled: !!geofenceId,
    staleTime: 60 * 1000,
  });
}

export function useCreateGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (geofence: Omit<Geofence, 'id' | 'created_at' | 'updated_at'>) => 
      geofenceService.createGeofence(geofence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ geofenceId, updates }: { geofenceId: string; updates: Partial<Geofence> }) => 
      geofenceService.updateGeofence(geofenceId, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['geofences', variables.geofenceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (geofenceId: string) => geofenceService.deleteGeofence(geofenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Automation hooks
export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: automationService.getAutomations,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (automation: Omit<Automation, 'id' | 'created_at' | 'updated_at'>) => 
      automationService.createAutomation(automation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ automationId, updates }: { automationId: string; updates: Partial<Automation> }) => 
      automationService.updateAutomation(automationId, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automations', variables.automationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (automationId: string) => automationService.deleteAutomation(automationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Integration hooks
export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: integrationService.getIntegrations,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useIntegration(integrationId: string) {
  return useQuery({
    queryKey: ['integrations', integrationId],
    queryFn: () => integrationService.getIntegration(integrationId),
    enabled: !!integrationId,
    staleTime: 60 * 1000,
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (integration: Omit<Integration, 'id' | 'created_at' | 'updated_at' | 'status'>) => 
      integrationService.createIntegration(integration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ integrationId, updates }: { integrationId: string; updates: Partial<Integration> }) => 
      integrationService.updateIntegration(integrationId, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integrations', variables.integrationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (integrationId: string) => integrationService.deleteIntegration(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: (integrationId: string) => integrationService.testIntegration(integrationId),
  });
}

// Device Pairing hooks
export function useGeneratePairingCode() {
  return useMutation({
    mutationFn: () => deviceService.generatePairingCode(),
  });
}

export function useCompletePairing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pairingRequest: PairingRequest) => deviceService.completePairing(pairingRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeviceStatus(deviceId: string, enabled = true) {
  return useQuery({
    queryKey: ['device', 'status', deviceId],
    queryFn: () => deviceService.getDeviceStatus(deviceId),
    enabled: !!deviceId && enabled,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time status
  });
}

export function useSendHeartbeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, heartbeatData }: { deviceId: string; heartbeatData?: any }) =>
      deviceService.sendHeartbeat(deviceId, heartbeatData),
    onSuccess: (data, variables) => {
      // Invalidate the device status and devices list
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device', 'status', variables.deviceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeviceUsers(deviceId: string) {
  return useQuery({
    queryKey: ['device', 'users', deviceId],
    queryFn: () => deviceService.getDeviceUsers(deviceId),
    enabled: !!deviceId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useShareDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, shareRequest }: { deviceId: string; shareRequest: DeviceShareRequest }) =>
      deviceService.shareDevice(deviceId, shareRequest),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['device', 'users', variables.deviceId] });
    },
  });
}

export function useCleanupPairingRequests() {
  return useMutation({
    mutationFn: () => deviceService.cleanupPairingRequests(),
  });
}
