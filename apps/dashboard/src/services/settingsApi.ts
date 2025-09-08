import { UserProfile, OrganizationSettings, NotificationPreferences, ApiKey, UserSession } from '../../../../packages/shared/src/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiFetch = async (endpoint: string, token?: string, options: RequestInit = {}) => {
  const authToken = token || localStorage.getItem('auth_token') || '';
  const url = `${API_BASE}/api/settings${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers,
    },
  };

  if (typeof options.body === 'object' && options.body !== null && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body) as BodyInit;
  }

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

const apiKeyFetch = async (endpoint: string, token?: string, options: RequestInit = {}) => {
  const authToken = token || localStorage.getItem('auth_token') || '';
  const url = `${API_BASE}/api/api-keys${endpoint}`;
  
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers,
    },
  };

  if (typeof options.body === 'object' && options.body !== null && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body) as BodyInit;
  }

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

// Profile
export const fetchProfile = async (token?: string): Promise<UserProfile> => {
  const { data } = await apiFetch('/profile', token);
  return data;
};

export const updateProfile = async (data: Partial<UserProfile>, token?: string): Promise<UserProfile> => {
  const { data: updated } = await apiFetch('/profile', token, { method: 'PUT', body: JSON.stringify(data) as BodyInit });
  return updated;
};

export const changePassword = async (currentPassword: string, newPassword: string, token?: string): Promise<{ message: string }> => {
  const response = await apiFetch('/profile/password', token, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword: newPassword }) as BodyInit
  });
  return { message: response.message };
};

// Organization
export const fetchOrganization = async (token?: string): Promise<OrganizationSettings> => {
  const { data } = await apiFetch('/organization', token);
  return data;
};

export const updateOrganization = async (data: Partial<OrganizationSettings>, token?: string): Promise<OrganizationSettings> => {
  const { data: updated } = await apiFetch('/organization', token, { method: 'PUT', body: JSON.stringify(data) as BodyInit });
  return updated;
};

// Notifications
export const updateNotifications = async (preferences: NotificationPreferences, token?: string): Promise<NotificationPreferences> => {
  const { data } = await apiFetch('/notifications', token, { method: 'PUT', body: JSON.stringify(preferences) as BodyInit });
  return data;
};

// API Keys
export const fetchApiKeys = async (token?: string): Promise<ApiKey[]> => {
 const { data } = await apiKeyFetch('/', token);
 return data.apiKeys.map((key: any) => ({
   ...key,
   keyValue: undefined,
   permissions: typeof key.permissions === 'string' ? JSON.parse(key.permissions) : (key.permissions || []),
   isActive: key.isActive || key.is_active,
   lastUsedAt: key.lastUsedAt || key.last_used_at,
   expiresAt: key.expiresAt || key.expires_at,
   createdAt: key.createdAt || key.created_at,
   updatedAt: key.updatedAt || key.updated_at
 }));
};

export const createApiKey = async (name: string, permissions: string[], expiresInDays?: number, token?: string): Promise<{ data: ApiKey & { keyValue: string }; message: string; warning?: string }> => {
 const response = await apiKeyFetch('/', token, {
   method: 'POST',
   body: JSON.stringify({ name, permissions, expires_in_days: expiresInDays }) as BodyInit
 });
 return {
   data: { ...response.data.apiKey, keyValue: response.data.apiKey.key },
   message: response.message || 'API key created successfully',
   warning: response.warning
 };
};

export const revokeApiKey = async (keyId: string, token?: string): Promise<{ message: string }> => {
 const response = await apiKeyFetch(`/${keyId}`, token, { method: 'DELETE' });
 return { message: response.message };
};

export const updateApiKey = async (keyId: string, updates: any, token?: string): Promise<ApiKey> => {
 const { data } = await apiKeyFetch(`/${keyId}`, token, { method: 'PATCH', body: updates });
 return {
   ...data.apiKey,
   permissions: typeof data.apiKey.permissions === 'string' ? JSON.parse(data.apiKey.permissions) : (data.apiKey.permissions || []),
   isActive: data.apiKey.isActive || data.apiKey.is_active,
   lastUsedAt: data.apiKey.lastUsedAt || data.apiKey.last_used_at,
   expiresAt: data.apiKey.expiresAt || data.apiKey.expires_at,
   createdAt: data.apiKey.createdAt || data.apiKey.created_at,
   updatedAt: data.apiKey.updatedAt || data.apiKey.updated_at
 };
};

export const getApiKeyUsage = async (keyId: string, token?: string): Promise<any> => {
 const { data } = await apiKeyFetch(`/${keyId}/usage`, token);
 return data.usage;
};

// Sessions
export const fetchSessions = async (token?: string): Promise<UserSession[]> => {
  const { data } = await apiFetch('/sessions', token);
  return data.map((s: any) => ({ ...s, isCurrent: Boolean(s.isCurrent) }));
};

export const revokeSession = async (sessionId: string, token?: string): Promise<{ message: string }> => {
  const response = await apiFetch(`/sessions/${sessionId}`, token, { method: 'DELETE' });
  return { message: response.message };
};

export const revokeAllSessions = async (token?: string): Promise<{ message: string }> => {
  const response = await apiFetch('/sessions/revoke-all', token, { method: 'POST' });
  return { message: response.message };
};
