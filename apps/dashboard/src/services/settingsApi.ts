import {
  UserProfile,
  OrganizationSettings,
  NotificationPreferences,
  ApiKey,
  UserSession,
} from '../../../../packages/shared/src/types';
// Better Auth integration for settings API

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE}/api/settings${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (
    typeof options.body === 'object' &&
    options.body !== null &&
    !(options.body instanceof FormData)
  ) {
    config.body = JSON.stringify(options.body) as BodyInit;
  }

  const response = await fetch(url, {
    ...config,
    credentials: 'include', // Important for Better Auth cookies
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

const apiKeyFetch = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE}/api/api-keys${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (
    typeof options.body === 'object' &&
    options.body !== null &&
    !(options.body instanceof FormData)
  ) {
    config.body = JSON.stringify(options.body) as BodyInit;
  }

  const response = await fetch(url, {
    ...config,
    credentials: 'include', // Important for Better Auth cookies
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

// Profile
export const fetchProfile = async (): Promise<UserProfile> => {
  const { data } = await apiFetch('/profile');
  return data;
};

export const updateProfile = async (data: Partial<UserProfile>): Promise<UserProfile> => {
  const { data: updated } = await apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(data) as BodyInit,
  });
  return updated;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<{ message: string }> => {
  const response = await apiFetch('/profile/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword,
      newPassword,
      confirmPassword: newPassword,
    }) as BodyInit,
  });
  return { message: response.message };
};

// Organization
export const fetchOrganization = async (): Promise<OrganizationSettings> => {
  const { data } = await apiFetch('/organization');
  return data;
};

export const updateOrganization = async (
  data: Partial<OrganizationSettings>
): Promise<OrganizationSettings> => {
  const { data: updated } = await apiFetch('/organization', {
    method: 'PUT',
    body: JSON.stringify(data) as BodyInit,
  });
  return updated;
};

// Notifications
export const updateNotifications = async (
  preferences: NotificationPreferences
): Promise<NotificationPreferences> => {
  const { data } = await apiFetch('/notifications', {
    method: 'PUT',
    body: JSON.stringify(preferences) as BodyInit,
  });
  return data;
};

// API Keys
export const fetchApiKeys = async (): Promise<ApiKey[]> => {
  const { data } = await apiKeyFetch('/');
  return data.apiKeys.map((key: any) => ({
    ...key,
    keyValue: undefined,
    permissions:
      typeof key.permissions === 'string' ? JSON.parse(key.permissions) : key.permissions || [],
    isActive: key.isActive || key.is_active,
    lastUsedAt: key.lastUsedAt || key.last_used_at,
    expiresAt: key.expiresAt || key.expires_at,
    createdAt: key.createdAt || key.created_at,
    updatedAt: key.updatedAt || key.updated_at,
  }));
};

export const createApiKey = async (
  name: string,
  permissions: string[],
  expiresInDays?: number
): Promise<{ data: ApiKey & { keyValue: string }; message: string; warning?: string }> => {
  const response = await apiKeyFetch('/', {
    method: 'POST',
    body: JSON.stringify({ name, permissions, expires_in_days: expiresInDays }) as BodyInit,
  });
  return {
    data: { ...response.data.apiKey, keyValue: response.data.apiKey.key },
    message: response.message || 'API key created successfully',
    warning: response.warning,
  };
};

export const revokeApiKey = async (keyId: string): Promise<{ message: string }> => {
  const response = await apiKeyFetch(`/${keyId}`, { method: 'DELETE' });
  return { message: response.message };
};

export const updateApiKey = async (keyId: string, updates: any): Promise<ApiKey> => {
  const { data } = await apiKeyFetch(`/${keyId}`, { method: 'PATCH', body: updates });
  return {
    ...data.apiKey,
    permissions:
      typeof data.apiKey.permissions === 'string'
        ? JSON.parse(data.apiKey.permissions)
        : data.apiKey.permissions || [],
    isActive: data.apiKey.isActive || data.apiKey.is_active,
    lastUsedAt: data.apiKey.lastUsedAt || data.apiKey.last_used_at,
    expiresAt: data.apiKey.expiresAt || data.apiKey.expires_at,
    createdAt: data.apiKey.createdAt || data.apiKey.created_at,
    updatedAt: data.apiKey.updatedAt || data.apiKey.updated_at,
  };
};

export const getApiKeyUsage = async (keyId: string): Promise<any> => {
  const { data } = await apiKeyFetch(`/${keyId}/usage`);
  return data.usage;
};

// Sessions
export const fetchSessions = async (): Promise<UserSession[]> => {
  const { data } = await apiFetch('/sessions');
  return data.map((s: any) => ({ ...s, isCurrent: Boolean(s.isCurrent) }));
};

export const revokeSession = async (sessionId: string): Promise<{ message: string }> => {
  const response = await apiFetch(`/sessions/${sessionId}`, { method: 'DELETE' });
  return { message: response.message };
};

export const revokeAllSessions = async (): Promise<{ message: string }> => {
  const response = await apiFetch('/sessions/revoke-all', { method: 'POST' });
  return { message: response.message };
};
