const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper function to make authenticated API calls
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  console.log('🔑 API Request:', endpoint, 'Token exists:', !!token);
  
  // In development, provide organization header fallback for backwards compatibility
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Build a Headers instance to safely merge different possible HeadersInit types (Headers, string[][], Record<string,string>)
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('🔑 Added Authorization header');
  }
  if (isDevelopment && !token) {
    headers.set('x-dev-mode', 'true');
    console.log('🔑 Added dev-mode header');
  }

  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    // Don't automatically clear tokens or redirect - let the auth context handle this
    throw new ApiError(data.error || 'Request failed', response.status);
  }

  return data;
}

// Dashboard Statistics Types
export interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  geofences: number;
  todayEvents: number;
  automationSuccess: number;
  failedWebhooks: number;
}

// Device Types
export interface Device {
  id: string;
  name: string;
  description?: string;
  device_token?: string;
  device_type?: string;
  last_seen?: string;
  longitude?: number;
  latitude?: number;
  is_active: boolean;
  is_paired?: boolean;
  status?: 'online' | 'offline' | 'connecting' | 'error';
  last_heartbeat?: string;
  health_metrics?: any;
  capabilities?: any;
  device_model?: string;
  group_id?: string;
  device_firmware_version?: string;
  connection_type?: string;
  pairing_code?: string;
  pairing_expires_at?: string;
  created_at: string;
  updated_at: string;
}

// Device Pairing Types
export interface PairingCodeResponse {
  pairingCode: string;
  expiresAt: string;
  pairingUrl: string;
}

export interface PairingRequest {
  pairingCode?: string;
  deviceData: {
    name: string;
    deviceModel?: string;
    deviceFirmwareVersion?: string;
    deviceOs?: string;
    capabilities?: Record<string, any>;
    meta?: Record<string, any>;
  };
}

export interface DeviceTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  deviceId: string;
  deviceInfo: {
    name: string;
    status: string;
    lastSeen: string;
  };
}

export interface DeviceStatus {
  deviceId: string;
  name: string;
  status: 'online' | 'offline';
  lastHeartbeat: string;
  healthMetrics?: any;
  capabilities?: any;
  connectionType?: string;
  ipAddress?: string;
  macAddress?: string;
  deviceModel?: string;
  firmwareVersion?: string;
  deviceOs?: string;
  isPaired: boolean;
  secondsSinceHeartbeat: number;
}

export interface DeviceUser {
  user_id: string;
  permissions: 'owner' | 'admin' | 'write' | 'read';
  granted_at: string;
  name: string;
  email: string;
}

export interface DeviceShareRequest {
  targetUserId: string;
  permissions: 'read' | 'write' | 'admin';
}

// Device Groups Types
export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  metadata: any;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceGroupRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  metadata?: any;
}

// Device Commands Types
export interface DeviceCommand {
  commandId: string;
  command: 'restart' | 'update_config' | 'ping' | 'get_status' | 'update_firmware' | 'factory_reset';
  parameters?: any;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed' | 'timeout';
  response?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
  timeout: number;
}

export interface SendDeviceCommandRequest {
  command: 'restart' | 'update_config' | 'ping' | 'get_status' | 'update_firmware' | 'factory_reset';
  parameters?: any;
  timeout?: number;
}

// Device Location History Types
export interface DeviceLocationEntry {
  id: string;
  longitude: number;
  latitude: number;
  timestamp: string;
  metadata?: any;
}

export interface DeviceLocationHistoryResponse {
  success: boolean;
  data: DeviceLocationEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Device Tags Types
export interface DeviceTag {
  tag: string;
  value?: string;
  created_at: string;
}

export interface CreateDeviceTagRequest {
  tag: string;
  value?: string;
}

// Device Certificates Types
export interface DeviceCertificate {
  certificateId: string;
  serial: string;
  issuedAt: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string;
  revocationReason?: string;
}

// Bulk Operations Types
export interface BulkDeviceOperationResult {
  created?: Device[];
  updated?: Device[];
  deleted?: { id: string; name: string }[];
  failed?: any[];
  summary: {
    total?: number;
    created?: number;
    updated?: number;
    deleted?: number;
    requested?: number;
    failed?: number;
  };
}

export interface CreateDeviceRequest {
  name: string;
  description?: string;
  device_type?: string;
}

export interface UpdateDeviceRequest {
  name?: string;
  description?: string;
  device_type?: string;
  is_active?: boolean;
}

// Event Types
export interface Event {
  id: string;
  event_type: 'geofence_enter' | 'geofence_exit' | 'geofence_dwell';
  device: {
    id: string;
    name: string;
  } | null;
  geofence: {
    id: string;
    name: string;
  } | null;
  location: {
    latitude: number;
    longitude: number;
  } | null;
  metadata?: any;
  timestamp: string;
  processed_at: string;
}

export interface EventsResponse {
  success: boolean;
  data: Event[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// Geofence Types
export interface Geofence {
  id: string;
  name: string;
  description?: string;
  geofence_type: 'polygon' | 'circle' | 'point';
  geometry: {
    type: string;
    coordinates: number[][] | number[] | number[][][];
  };
  metadata?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  radius_m?: number;
}

// Automation Types (basic structure for now)
export interface Automation {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Automation Rule Types
export interface AutomationRule {
  id: string;
  name: string;
  account_id: string;
  geofence_id: string;
  device_id?: string; // Optional - can apply to all devices or specific device
  automation_id: string;
  on_events: ('enter' | 'exit' | 'dwell')[];
  min_dwell_seconds?: number;
  device_filter: Record<string, any>; // JSON filter for device properties
  enabled: boolean;
  created_at: string;
  updated_at: string;
  
  // Populated relations
  geofence?: Geofence;
  device?: Device;
  automation?: Automation;
}

export interface CreateAutomationRuleRequest {
  name: string;
  geofence_id: string;
  device_id?: string;
  automation_id: string;
  on_events: ('enter' | 'exit' | 'dwell')[];
  min_dwell_seconds?: number;
  device_filter?: Record<string, any>;
  enabled?: boolean;
}

// Analytics Types
export interface DeviceActivity {
  date: string;
  online: number;
  offline: number;
}

export interface AutomationStat {
  name: string;
  success: number;
  failed: number;
  total: number;
}

export interface AnalyticsData {
  deviceActivity: DeviceActivity[];
  automationStats: AutomationStat[];
  eventsTrend: string;
  devicesTrend: string;
  automationsTrend: string;
}

export interface AnalyticsResponse {
  success: boolean;
  data: AnalyticsData;
}

// Integration Types
export interface Integration {
  id: string;
  name: string; // From automation
  url: string;
  status: 'active' | 'inactive';
  is_active: boolean;
  headers?: Record<string, string>;
  automation_id: string;
  created_at: string;
  updated_at: string;
}

// API Services
export const dashboardService = {
  // Get dashboard statistics
  async getStats(): Promise<DashboardStats> {
    // For now, we'll aggregate from individual endpoints
    const [devicesResponse, geofencesResponse, eventsResponse] = await Promise.all([
      apiRequest<{ data: Device[]; total: number }>('/api/devices'),
      apiRequest<{ data: Geofence[]; total: number }>('/api/geofences'),
      apiRequest<EventsResponse>('/api/events?limit=100') // Get recent events for today's count
    ]);

    const devices = devicesResponse.data || [];
    const geofences = geofencesResponse.data || [];
    const events = eventsResponse.data || [];

    // Calculate today's events
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(event => 
      event.timestamp.startsWith(today)
    ).length;

    // Calculate success rate (simplified for now)
    const automationSuccess = events.length > 0 ? 
      ((events.length - Math.floor(events.length * 0.02)) / events.length) * 100 : 100;

    return {
      totalDevices: devices.length,
      activeDevices: devices.filter(d => d.is_active).length,
      geofences: geofences.length,
      todayEvents,
      automationSuccess: Number(automationSuccess.toFixed(1)),
      failedWebhooks: Math.floor(events.length * 0.02) // Simplified calculation
    };
  },

  // Get recent events for dashboard
  async getRecentEvents(limit = 10): Promise<Event[]> {
    const response = await apiRequest<EventsResponse>(`/api/events?limit=${limit}`);
    return response.data || [];
  }
};

export const deviceService = {
  // Get all devices
  async getDevices(): Promise<Device[]> {
    const response = await apiRequest<{ data: Device[]; total: number }>('/api/devices');
    return response.data || [];
  },

  // Get specific device
  async getDevice(deviceId: string): Promise<Device> {
    const response = await apiRequest<{ data: Device }>(`/api/devices/${deviceId}`);
    return response.data;
  },

  // Create device
  async createDevice(device: CreateDeviceRequest): Promise<Device> {
    const response = await apiRequest<{ data: Device }>('/api/devices', {
      method: 'POST',
      body: JSON.stringify(device),
    });
    return response.data;
  },

  // Update device
  async updateDevice(deviceId: string, updates: UpdateDeviceRequest): Promise<Device> {
    const response = await apiRequest<{ data: Device }>(`/api/devices/${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Delete device
  async deleteDevice(deviceId: string): Promise<void> {
    await apiRequest(`/api/devices/${deviceId}`, {
      method: 'DELETE',
    });
  },

  // Device Pairing Methods
  // Generate pairing code
  async generatePairingCode(): Promise<PairingCodeResponse> {
    const response = await apiRequest<{ data: PairingCodeResponse }>(
      '/api/devices/pairing/generate',
      { method: 'POST' }
    );
    return response.data;
  },

  // Complete device pairing
  async completePairing(pairingRequest: PairingRequest): Promise<DeviceTokenResponse> {
    const response = await apiRequest<{ data: DeviceTokenResponse }>(
      '/api/devices/pairing/complete',
      {
        method: 'POST',
        body: JSON.stringify(pairingRequest),
      }
    );
    return response.data;
  },

  // Get pairing status
  async getPairingStatus(code: string): Promise<{ 
    success: boolean;
    data: { 
      status: 'valid' | 'expired' | 'used';
      pairingCode: string;
      expiresAt: string;
      usedAt?: string;
      isValid: boolean;
      accountId: string;
    } 
  }> {
    const response = await apiRequest<{ 
      success: boolean;
      data: { 
        status: 'valid' | 'expired' | 'used';
        pairingCode: string;
        expiresAt: string;
        usedAt?: string;
        isValid: boolean;
        accountId: string;
      } 
    }>(`/api/devices/pairing/status/${code}`);
    return response;
  },

  // Get device status
  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const response = await apiRequest<{ data: DeviceStatus }>(`/api/devices/${deviceId}/status`);
    return response.data;
  },

  // Send heartbeat
  async sendHeartbeat(deviceId: string, heartbeatData?: any): Promise<{ message: string }> {
    const response = await apiRequest<{ message: string }>(`/api/devices/${deviceId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify(heartbeatData || {}),
    });
    return response;
  },

  // Get device users (permissions)
  async getDeviceUsers(deviceId: string): Promise<DeviceUser[]> {
    const response = await apiRequest<{ data: DeviceUser[] }>(`/api/devices/${deviceId}/users`);
    return response.data;
  },

  // Share device with user
  async shareDevice(deviceId: string, shareRequest: DeviceShareRequest): Promise<{ message: string }> {
    const response = await apiRequest<{ message: string }>(`/api/devices/${deviceId}/share`, {
      method: 'POST',
      body: JSON.stringify(shareRequest),
    });
    return response;
  },

  // Clean up expired pairing requests
  async cleanupPairingRequests(): Promise<{ message: string }> {
    const response = await apiRequest<{ message: string }>('/api/devices/pairing/cleanup', {
      method: 'POST',
    });
    return response;
  },

  // Device Location History
  async getDeviceLocationHistory(
    deviceId: string, 
    params: { 
      page?: number; 
      limit?: number; 
      start_date?: string; 
      end_date?: string; 
    } = {}
  ): Promise<DeviceLocationHistoryResponse> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    const endpoint = `/api/devices/${deviceId}/locations${queryString ? `?${queryString}` : ''}`;
    return await apiRequest<DeviceLocationHistoryResponse>(endpoint);
  },

  // Device Commands
  async sendDeviceCommand(deviceId: string, command: SendDeviceCommandRequest): Promise<DeviceCommand> {
    const response = await apiRequest<{ data: DeviceCommand }>(`/api/devices/${deviceId}/commands`, {
      method: 'POST',
      body: JSON.stringify(command),
    });
    return response.data;
  },

  async getDeviceCommand(deviceId: string, commandId: string): Promise<DeviceCommand> {
    const response = await apiRequest<{ data: DeviceCommand }>(`/api/devices/${deviceId}/commands/${commandId}`);
    return response.data;
  },

  async getDeviceCommands(deviceId: string, params: { page?: number; limit?: number } = {}): Promise<{
    data: DeviceCommand[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    const endpoint = `/api/devices/${deviceId}/commands${queryString ? `?${queryString}` : ''}`;
    return await apiRequest<{
      data: DeviceCommand[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(endpoint);
  },

  // Device Tags
  async getDeviceTags(deviceId: string): Promise<DeviceTag[]> {
    const response = await apiRequest<{ data: DeviceTag[] }>(`/api/devices/${deviceId}/tags`);
    return response.data;
  },

  async addDeviceTag(deviceId: string, tag: CreateDeviceTagRequest): Promise<DeviceTag> {
    const response = await apiRequest<{ data: DeviceTag }>(`/api/devices/${deviceId}/tags`, {
      method: 'POST',
      body: JSON.stringify(tag),
    });
    return response.data;
  },

  async removeDeviceTag(deviceId: string, tag: string): Promise<{ message: string }> {
    const response = await apiRequest<{ message: string }>(`/api/devices/${deviceId}/tags/${tag}`, {
      method: 'DELETE',
    });
    return response;
  },

  // Device Certificates
  async generateDeviceCertificate(deviceId: string): Promise<DeviceCertificate> {
    const response = await apiRequest<{ data: DeviceCertificate }>(`/api/devices/${deviceId}/certificates`, {
      method: 'POST',
    });
    return response.data;
  },

  async getDeviceCertificates(deviceId: string): Promise<DeviceCertificate[]> {
    const response = await apiRequest<{ data: DeviceCertificate[] }>(`/api/devices/${deviceId}/certificates`);
    return response.data;
  },

  async revokeDeviceCertificate(deviceId: string, certificateId: string, reason?: string): Promise<{ message: string }> {
    const response = await apiRequest<{ message: string }>(`/api/devices/${deviceId}/certificates/${certificateId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
    return response;
  },

  // Bulk Operations
  async bulkCreateDevices(devices: CreateDeviceRequest[]): Promise<BulkDeviceOperationResult> {
    const response = await apiRequest<{ data: BulkDeviceOperationResult }>('/api/devices/bulk', {
      method: 'POST',
      body: JSON.stringify({ devices }),
    });
    return response.data;
  },

  async bulkUpdateDevices(deviceIds: string[], updates: UpdateDeviceRequest): Promise<BulkDeviceOperationResult> {
    const response = await apiRequest<{ data: BulkDeviceOperationResult }>('/api/devices/bulk', {
      method: 'PUT',
      body: JSON.stringify({ deviceIds, updates }),
    });
    return response.data;
  },

  async bulkDeleteDevices(deviceIds: string[]): Promise<BulkDeviceOperationResult> {
    const response = await apiRequest<{ data: BulkDeviceOperationResult }>('/api/devices/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ deviceIds }),
    });
    return response.data;
  }
};

// Device Groups Service
export const deviceGroupService = {
  // Get all device groups
  async getDeviceGroups(): Promise<DeviceGroup[]> {
    const response = await apiRequest<{ data: DeviceGroup[] }>('/api/device-groups');
    return response.data;
  },

  // Create device group
  async createDeviceGroup(group: CreateDeviceGroupRequest): Promise<DeviceGroup> {
    const response = await apiRequest<{ data: DeviceGroup }>('/api/device-groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
    return response.data;
  },

  // Update device group
  async updateDeviceGroup(groupId: string, updates: Partial<CreateDeviceGroupRequest>): Promise<DeviceGroup> {
    const response = await apiRequest<{ data: DeviceGroup }>(`/api/device-groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Delete device group
  async deleteDeviceGroup(groupId: string): Promise<{ message: string }> {
    const response = await apiRequest<{ message: string }>(`/api/device-groups/${groupId}`, {
      method: 'DELETE',
    });
    return response;
  },

  // Assign device to group
  async assignDeviceToGroup(deviceId: string, groupId: string): Promise<{ id: string; name: string; group_id: string }> {
    const response = await apiRequest<{ data: { id: string; name: string; group_id: string } }>(`/api/devices/${deviceId}/group`, {
      method: 'PUT',
      body: JSON.stringify({ groupId }),
    });
    return response.data;
  }
};

export const eventService = {
  // Get events with filtering
  async getEvents(params: {
    limit?: number;
    offset?: number;
    device_id?: string;
    geofence_id?: string;
    event_type?: string;
    from_date?: string;
    to_date?: string;
  } = {}): Promise<EventsResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    const endpoint = `/api/events${queryString ? `?${queryString}` : ''}`;
    
    return await apiRequest<EventsResponse>(endpoint);
  },

  // Get specific event
  async getEvent(eventId: string): Promise<Event> {
    const response = await apiRequest<{ data: Event }>(`/api/events/${eventId}`);
    return response.data;
  },

  // Replay event
  async replayEvent(eventId: string): Promise<{ message: string }> {
    const response = await apiRequest<{ message: string }>(`/api/events/${eventId}/replay`, {
      method: 'POST',
    });
    return response;
  }
};

export const geofenceService = {
  // Get all geofences
  async getGeofences(): Promise<Geofence[]> {
    console.log('🔍 Fetching geofences from API...');
    const response = await apiRequest<{ data: Geofence[]; total: number }>('/api/geofences');
    console.log('🔍 Geofences API response:', response);
    
    // Validate and normalize the response data
    const geofences = (response.data || []).map((geofence, index) => {
      // Validate essential fields
      if (!geofence.id) {
        console.warn(`🔍 Geofence at index ${index} missing ID:`, geofence);
        return null;
      }
      
      if (!geofence.geometry || !geofence.geometry.coordinates) {
        console.warn(`🔍 Geofence "${geofence.name}" missing valid geometry:`, geofence);
        return null;
      }
      
      // Normalize the geofence data
      return {
        ...geofence,
        id: String(geofence.id), // Ensure ID is string
        name: geofence.name || 'Unnamed Geofence',
        geofence_type: geofence.geofence_type || 'polygon',
        is_active: geofence.is_active !== undefined ? geofence.is_active : true,
        metadata: geofence.metadata || {}
      };
    }).filter(g => g !== null) as Geofence[];
    
    console.log('🔍 Normalized geofences:', geofences.length, 'valid geofences');
    return geofences;
  },

  // Get specific geofence
  async getGeofence(geofenceId: string): Promise<Geofence> {
    const response = await apiRequest<{ data: Geofence }>(`/api/geofences/${geofenceId}`);
    return response.data;
  },

  // Create geofence
  async createGeofence(geofence: Omit<Geofence, 'id' | 'created_at' | 'updated_at'>): Promise<Geofence> {
    const response = await apiRequest<{ data: Geofence }>('/api/geofences', {
      method: 'POST',
      body: JSON.stringify(geofence),
    });
    return response.data;
  },

  // Update geofence
  async updateGeofence(geofenceId: string, updates: Partial<Geofence>): Promise<Geofence> {
    const response = await apiRequest<{ data: Geofence }>(`/api/geofences/${geofenceId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Delete geofence
  async deleteGeofence(geofenceId: string): Promise<void> {
    await apiRequest(`/api/geofences/${geofenceId}`, {
      method: 'DELETE',
    });
  }
};

// Automation service (basic structure for now)
export const automationService = {
  // Get all automations
  async getAutomations(): Promise<Automation[]> {
    try {
      const response = await apiRequest<{ data: Automation[]; total: number }>('/api/automations');
      return response.data || [];
    } catch (error) {
      // Return empty array if automations endpoint doesn't exist yet
      console.warn('Automations endpoint not available:', error);
      return [];
    }
  },

  // Create automation
  async createAutomation(automation: Omit<Automation, 'id' | 'created_at' | 'updated_at'>): Promise<Automation> {
    const response = await apiRequest<{ data: Automation }>('/api/automations', {
      method: 'POST',
      body: JSON.stringify(automation),
    });
    return response.data;
  },

  // Update automation
  async updateAutomation(automationId: string, updates: Partial<Automation>): Promise<Automation> {
    const response = await apiRequest<{ data: Automation }>(`/api/automations/${automationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Delete automation
  async deleteAutomation(automationId: string): Promise<void> {
    await apiRequest(`/api/automations/${automationId}`, {
      method: 'DELETE',
    });
  }
};

// Automation Rules service
export const automationRuleService = {
  // Get all automation rules
  async getAutomationRules(): Promise<AutomationRule[]> {
    try {
      const response = await apiRequest<{ data: AutomationRule[]; total: number }>('/api/automation-rules');
      return response.data || [];
    } catch (error) {
      console.warn('Automation rules endpoint not available:', error);
      return [];
    }
  },

  // Get automation rules for a specific geofence
  async getAutomationRulesForGeofence(geofenceId: string): Promise<AutomationRule[]> {
    try {
      const response = await apiRequest<{ data: AutomationRule[]; total: number }>(`/api/automation-rules?geofence_id=${geofenceId}`);
      return response.data || [];
    } catch (error) {
      console.warn('Automation rules endpoint not available:', error);
      return [];
    }
  },

  // Get automation rules for a specific device
  async getAutomationRulesForDevice(deviceId: string): Promise<AutomationRule[]> {
    try {
      const response = await apiRequest<{ data: AutomationRule[]; total: number }>(`/api/automation-rules?device_id=${deviceId}`);
      return response.data || [];
    } catch (error) {
      console.warn('Automation rules endpoint not available:', error);
      return [];
    }
  },

  // Create automation rule
  async createAutomationRule(rule: CreateAutomationRuleRequest): Promise<AutomationRule> {
    const response = await apiRequest<{ data: AutomationRule }>('/api/automation-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
    return response.data;
  },

  // Update automation rule
  async updateAutomationRule(ruleId: string, updates: Partial<CreateAutomationRuleRequest>): Promise<AutomationRule> {
    const response = await apiRequest<{ data: AutomationRule }>(`/api/automation-rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Delete automation rule
  async deleteAutomationRule(ruleId: string): Promise<void> {
    await apiRequest(`/api/automation-rules/${ruleId}`, {
      method: 'DELETE',
    });
  },

  // Toggle automation rule
  async toggleAutomationRule(ruleId: string, enabled: boolean): Promise<AutomationRule> {
    const response = await apiRequest<{ data: AutomationRule }>(`/api/automation-rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    });
    return response.data;
  }
};

// Analytics service
export const analyticsService = {
  // Get analytics data
  async getAnalytics(params: { range?: '24h' | '7d' | '30d' | '90d' } = {}): Promise<AnalyticsData> {
    const searchParams = new URLSearchParams();
    if (params.range) {
      searchParams.append('range', params.range);
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/analytics${queryString ? `?${queryString}` : ''}`;

    try {
      const response = await apiRequest<AnalyticsResponse>(endpoint);
      // Return empty arrays if no data, rather than undefined
      return {
        deviceActivity: response.data?.deviceActivity || [],
        automationStats: response.data?.automationStats || [],
        eventsTrend: response.data?.eventsTrend || '+0%',
        devicesTrend: response.data?.devicesTrend || '+0%',
        automationsTrend: response.data?.automationsTrend || '+0%'
      };
    } catch (error) {
      console.warn('Analytics endpoint not available:', error);
      // Return empty arrays instead of mock data
      return {
        deviceActivity: [],
        automationStats: [],
        eventsTrend: '+0%',
        devicesTrend: '+0%',
        automationsTrend: '+0%'
      };
    }
  }
};

// Integration service
export const integrationService = {
  // Get all integrations
  async getIntegrations(): Promise<Integration[]> {
    try {
      const response = await apiRequest<{ data: Integration[]; total: number }>('/api/integrations');
      return response.data || [];
    } catch (error) {
      console.warn('Integrations endpoint not available:', error);
      return [];
    }
  },

  // Get specific webhook integration
  async getIntegration(integrationId: string): Promise<Integration> {
    const response = await apiRequest<{ data: Integration }>(`/api/integrations/webhook/${integrationId}`);
    return response.data;
  },

  // Create webhook integration
  async createIntegration(webhookData: { automation_id: string; url: string; headers?: Record<string, string>; is_active?: boolean }): Promise<Integration> {
    const response = await apiRequest<{ data: Integration }>('/api/integrations/webhook', {
      method: 'POST',
      body: JSON.stringify(webhookData),
    });
    return response.data;
  },

  // Update webhook integration
  async updateIntegration(integrationId: string, updates: Partial<Integration>): Promise<Integration> {
    const response = await apiRequest<{ data: Integration }>(`/api/integrations/webhook/${integrationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Delete webhook integration
  async deleteIntegration(integrationId: string): Promise<void> {
    await apiRequest(`/api/integrations/webhook/${integrationId}`, {
      method: 'DELETE',
    });
  },

};
