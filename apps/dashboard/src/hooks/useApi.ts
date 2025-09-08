import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dashboardService,
  deviceService,
  deviceGroupService,
  eventService,
  geofenceService,
  automationService,
  automationRuleService,
  integrationService,
  analyticsService,
  type Device,
  type Event,
  type Geofence,
  type Automation,
  type AutomationRule,
  type CreateAutomationRuleRequest,
  type Integration,
  type CreateDeviceRequest,
  type UpdateDeviceRequest,
  type PairingCodeResponse,
  type PairingRequest,
  type DeviceTokenResponse,
  type DeviceStatus,
  type DeviceUser,
  type DeviceShareRequest,
  type DeviceGroup,
  type CreateDeviceGroupRequest,
  type DeviceCommand,
  type SendDeviceCommandRequest,
  type DeviceLocationHistoryResponse,
  type DeviceTag,
  type CreateDeviceTagRequest,
  type DeviceCertificate,
  type BulkDeviceOperationResult,
  type DashboardStats,
  type AnalyticsData,
  type AnalyticsResponse,
  type DeviceActivity,
  type AutomationStat
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
    mutationFn: (webhookData: { automation_id: string; url: string; headers?: Record<string, string>; is_active?: boolean }) =>
      integrationService.createIntegration(webhookData),
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

export function usePairingStatus(code: string | null) {
  return useQuery({
    queryKey: ['pairing', 'status', code],
    queryFn: () => deviceService.getPairingStatus(code!),
    enabled: !!code,
    staleTime: 30 * 1000,
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

// Device Location History hooks
export function useDeviceLocationHistory(
  deviceId: string, 
  params: { page?: number; limit?: number; start_date?: string; end_date?: string } = {},
  enabled = true
) {
  return useQuery({
    queryKey: ['device', 'location-history', deviceId, params],
    queryFn: () => deviceService.getDeviceLocationHistory(deviceId, params),
    enabled: !!deviceId && enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Device Commands hooks
export function useSendDeviceCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, command }: { deviceId: string; command: SendDeviceCommandRequest }) =>
      deviceService.sendDeviceCommand(deviceId, command),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['device', 'commands', variables.deviceId] });
    },
  });
}

export function useDeviceCommand(deviceId: string, commandId: string, enabled = true) {
  return useQuery({
    queryKey: ['device', 'command', deviceId, commandId],
    queryFn: () => deviceService.getDeviceCommand(deviceId, commandId),
    enabled: !!deviceId && !!commandId && enabled,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 5 * 1000, // Poll every 5 seconds for command status
  });
}

export function useDeviceCommands(
  deviceId: string, 
  params: { page?: number; limit?: number } = {},
  enabled = true
) {
  return useQuery({
    queryKey: ['device', 'commands', deviceId, params],
    queryFn: () => deviceService.getDeviceCommands(deviceId, params),
    enabled: !!deviceId && enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Device Tags hooks
export function useDeviceTags(deviceId: string, enabled = true) {
  return useQuery({
    queryKey: ['device', 'tags', deviceId],
    queryFn: () => deviceService.getDeviceTags(deviceId),
    enabled: !!deviceId && enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useAddDeviceTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, tag }: { deviceId: string; tag: CreateDeviceTagRequest }) =>
      deviceService.addDeviceTag(deviceId, tag),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['device', 'tags', variables.deviceId] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useRemoveDeviceTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, tag }: { deviceId: string; tag: string }) =>
      deviceService.removeDeviceTag(deviceId, tag),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['device', 'tags', variables.deviceId] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

// Device Certificates hooks
export function useDeviceCertificates(deviceId: string, enabled = true) {
  return useQuery({
    queryKey: ['device', 'certificates', deviceId],
    queryFn: () => deviceService.getDeviceCertificates(deviceId),
    enabled: !!deviceId && enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useGenerateDeviceCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceService.generateDeviceCertificate(deviceId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['device', 'certificates', variables] });
    },
  });
}

export function useRevokeDeviceCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, certificateId, reason }: { deviceId: string; certificateId: string; reason?: string }) =>
      deviceService.revokeDeviceCertificate(deviceId, certificateId, reason),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['device', 'certificates', variables.deviceId] });
    },
  });
}

// Bulk Operations hooks
export function useBulkCreateDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (devices: CreateDeviceRequest[]) => deviceService.bulkCreateDevices(devices),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useBulkUpdateDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceIds, updates }: { deviceIds: string[]; updates: UpdateDeviceRequest }) =>
      deviceService.bulkUpdateDevices(deviceIds, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useBulkDeleteDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceIds: string[]) => deviceService.bulkDeleteDevices(deviceIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Device Groups hooks
export function useDeviceGroups() {
  return useQuery({
    queryKey: ['device-groups'],
    queryFn: deviceGroupService.getDeviceGroups,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateDeviceGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (group: CreateDeviceGroupRequest) => deviceGroupService.createDeviceGroup(group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });
}

export function useUpdateDeviceGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, updates }: { groupId: string; updates: Partial<CreateDeviceGroupRequest> }) =>
      deviceGroupService.updateDeviceGroup(groupId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });
}

export function useDeleteDeviceGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => deviceGroupService.deleteDeviceGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useAssignDeviceToGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deviceId, groupId }: { deviceId: string; groupId: string }) =>
      deviceGroupService.assignDeviceToGroup(deviceId, groupId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['devices', variables.deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });
}

// Automation Rules hooks
export function useAutomationRules() {
  return useQuery({
    queryKey: ['automation-rules'],
    queryFn: automationRuleService.getAutomationRules,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useAutomationRulesForGeofence(geofenceId: string, enabled = true) {
  return useQuery({
    queryKey: ['automation-rules', 'geofence', geofenceId],
    queryFn: () => automationRuleService.getAutomationRulesForGeofence(geofenceId),
    enabled: !!geofenceId && enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useAutomationRulesForDevice(deviceId: string, enabled = true) {
  return useQuery({
    queryKey: ['automation-rules', 'device', deviceId],
    queryFn: () => automationRuleService.getAutomationRulesForDevice(deviceId),
    enabled: !!deviceId && enabled,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rule: CreateAutomationRuleRequest) => 
      automationRuleService.createAutomationRule(rule),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-rules', 'geofence', data.geofence_id] });
      if (data.device_id) {
        queryClient.invalidateQueries({ queryKey: ['automation-rules', 'device', data.device_id] });
      }
    },
  });
}

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, updates }: { ruleId: string; updates: Partial<CreateAutomationRuleRequest> }) =>
      automationRuleService.updateAutomationRule(ruleId, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-rules', 'geofence', data.geofence_id] });
      if (data.device_id) {
        queryClient.invalidateQueries({ queryKey: ['automation-rules', 'device', data.device_id] });
      }
    },
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) => automationRuleService.deleteAutomationRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
  });
}

export function useToggleAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) =>
      automationRuleService.toggleAutomationRule(ruleId, enabled),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-rules', 'geofence', data.geofence_id] });
      if (data.device_id) {
        queryClient.invalidateQueries({ queryKey: ['automation-rules', 'device', data.device_id] });
      }
    },
  });
}

// Analytics hooks
export function useAnalytics(params: { range?: '24h' | '7d' | '30d' | '90d' } = {}) {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => analyticsService.getAnalytics(params),
    staleTime: 15 * 1000, // 15 seconds - refresh analytics more frequently
  });
}


// Re-export types for easy access
export type { 
  Device, 
  Event, 
  Geofence, 
  Automation, 
  AutomationRule, 
  CreateAutomationRuleRequest,
  Integration,
  CreateDeviceRequest,
  UpdateDeviceRequest,
  PairingCodeResponse,
  PairingRequest,
  DeviceTokenResponse,
  DeviceStatus,
  DeviceUser,
  DeviceShareRequest,
  DeviceGroup,
  CreateDeviceGroupRequest,
  DashboardStats
};
