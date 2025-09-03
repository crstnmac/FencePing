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
  
  // In development, provide organization header fallback for backwards compatibility
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Build a Headers instance to safely merge different possible HeadersInit types (Headers, string[][], Record<string,string>)
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (isDevelopment && !token) {
    headers.set('x-dev-mode', 'true');
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
  geofence_type: 'polygon' | 'circle';
  geometry: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

// Integration Types
export interface Integration {
  id: string;
  name: string;
  type: 'slack' | 'notion' | 'google_sheets' | 'whatsapp' | 'webhook';
  description: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  is_active: boolean;
  connected_at?: string;
  last_used?: string;
  error_message?: string;
  config?: Record<string, any>;
  credentials?: {
    expires_at?: string;
    scope?: string;
  };
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
    const response = await apiRequest<{ data: Geofence[]; total: number }>('/api/geofences');
    return response.data || [];
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

  // Get specific integration
  async getIntegration(integrationId: string): Promise<Integration> {
    const response = await apiRequest<{ data: Integration }>(`/api/integrations/${integrationId}`);
    return response.data;
  },

  // Create integration
  async createIntegration(integration: Omit<Integration, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<Integration> {
    const response = await apiRequest<{ data: Integration }>('/api/integrations', {
      method: 'POST',
      body: JSON.stringify(integration),
    });
    return response.data;
  },

  // Update integration
  async updateIntegration(integrationId: string, updates: Partial<Integration>): Promise<Integration> {
    const response = await apiRequest<{ data: Integration }>(`/api/integrations/${integrationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Delete integration
  async deleteIntegration(integrationId: string): Promise<void> {
    await apiRequest(`/api/integrations/${integrationId}`, {
      method: 'DELETE',
    });
  },

  // Test integration connection
  async testIntegration(integrationId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiRequest<{ success: boolean; message: string }>(`/api/integrations/${integrationId}/test`, {
      method: 'POST',
    });
    return response;
  }
};
