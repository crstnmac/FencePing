'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Header } from '../../components/Header';
import {
  User,
  Building2,
  Key,
  Shield,
  Bell,
  Globe,
  Save,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  fetchProfile,
  updateProfile,
  changePassword,
  fetchOrganization,
  updateOrganization,
  updateNotifications,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  updateApiKey,
  getApiKeyUsage,
  fetchSessions,
  revokeSession,
  revokeAllSessions,
} from '../../services/settingsApi';
import {
  ApiKey,
  NotificationPreferences,
  OrganizationSettings,
  UserProfile,
  UserSession,
} from '../../../../../packages/shared/src/types';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    icon: User,
    description: 'Manage your personal information and preferences',
  },
  {
    id: 'organization',
    title: 'Account',
    icon: Building2,
    description: 'Account settings and team management',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    description: 'Configure email and push notification preferences',
  },
  {
    id: 'api-keys',
    title: 'API Keys',
    icon: Key,
    description: 'Manage API keys for device authentication',
  },
  {
    id: 'security',
    title: 'Security',
    icon: Shield,
    description: 'Security settings and session management',
  },
  {
    id: 'regional',
    title: 'Regional',
    icon: Globe,
    description: 'Time zone, units, and localization settings',
  },
];

export default function SettingsPage() {
  const { user, organization } = useAuth();
  const token = useAuth().isAuthenticated ? localStorage.getItem('auth_token') || '' : '';
  const [activeSection, setActiveSection] = useState('profile');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  interface ProfileFormData extends Partial<UserProfile> {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }

  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [orgData, setOrgData] = useState<OrganizationSettings>({
    id: '',
    name: '',
    timezone: 'UTC',
    date_format: 'MM/DD/YYYY' as const,
    time_format: '12' as const,
    distance_unit: 'metric' as const,
    location_retention_days: 30,
    event_retention_days: 90,
    default_map_region: 'auto' as const,
    coordinate_format: 'decimal' as const,
  });
  const [notificationSettings, setNotificationSettings] = useState<NotificationPreferences>({
    emailGeofenceEvents: true,
    emailAutomationFailures: true,
    emailWeeklyReports: false,
    pushGeofenceEvents: false,
    pushAutomationFailures: true,
  });

  useEffect(() => {
    const loadData = async () => {
      if (!token) return;

      setIsLoading(true);
      setError(null);
      try {
        const [profile, org, keys, sess] = await Promise.all([
          fetchProfile(),
          fetchOrganization(),
          fetchApiKeys(),
          fetchSessions(),
        ]);

        setProfileData((prev: ProfileFormData) => ({
          ...prev,
          name: profile.name,
          email: profile.email,
          phone: profile.phone || '',
        }));
        setOrgData((prev: OrganizationSettings) => ({
          ...prev,
          name: org.name,
          timezone: org.timezone || 'UTC',
          distance_unit: org.distance_unit || 'metric',
          location_retention_days: org.location_retention_days || 30,
          event_retention_days: org.event_retention_days || 90,
          default_map_region: org.default_map_region || 'auto',
          coordinate_format: org.coordinate_format || 'decimal',
        }));
        setNotificationSettings(
          profile.notification_preferences || {
            emailGeofenceEvents: true,
            emailAutomationFailures: true,
            emailWeeklyReports: false,
            pushGeofenceEvents: false,
            pushAutomationFailures: true,
          }
        );
        setApiKeys(keys);
        setSessions(sess);
      } catch (err: any) {
        setError(err.message);
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token]); // Removed notificationSettings from dependencies to prevent infinite loop

  // Refresh specific data when sections change
  useEffect(() => {
    const refreshData = async () => {
      if (!token) return;
      try {
        if (activeSection === 'api-keys') {
          const keys = await fetchApiKeys();
          setApiKeys(keys);
        } else if (activeSection === 'security') {
          const sess = await fetchSessions();
          setSessions(sess);
        }
      } catch (err: any) {
        setError(err.message);
      }
    };
    refreshData();
  }, [activeSection, token]);

  const handleSaveProfile = async () => {
    if (!token) {
      alert('Authentication required');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Update profile info (exclude password fields)
      const profileUpdate = {
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone || undefined,
      };
      await updateProfile(profileUpdate);

      // If password change requested
      if (profileData.newPassword && profileData.currentPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          throw new Error("Passwords don't match");
        }
        await changePassword(profileData.currentPassword, profileData.newPassword);
        // Clear password fields
        setProfileData((prev: ProfileFormData) => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      }

      alert('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
      alert(`Failed to save profile: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!token) {
      alert('Authentication required');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const updateData = {
        name: orgData.name,
        timezone: orgData.timezone,
        date_format: orgData.date_format,
        time_format: orgData.time_format,
        distance_unit: orgData.distance_unit,
        location_retention_days: orgData.location_retention_days,
        event_retention_days: orgData.event_retention_days,
        default_map_region: orgData.default_map_region,
        coordinate_format: orgData.coordinate_format,
      };
      await updateOrganization(updateData);
      alert('Organization settings updated successfully');
    } catch (err: any) {
      setError(err.message);
      alert(`Failed to save organization: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!token) {
      alert('Authentication required');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await updateNotifications(notificationSettings);
      alert('Notification preferences updated successfully');
    } catch (err: any) {
      setError(err.message);
      alert(`Failed to save notifications: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    if (!token || !confirm('Revoke this API key? This cannot be undone.')) return;

    setIsLoading(true);
    try {
      await revokeApiKey(keyId);
      // Show success message without alert for better UX
      setError(null);
      // Refresh keys
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (err: any) {
      setError(`Failed to revoke API key: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!token || !confirm('Revoke this session?')) return;

    setIsLoading(true);
    try {
      await revokeSession(sessionId);
      alert('Session revoked successfully');
      // Refresh sessions
      const sess = await fetchSessions();
      setSessions(sess);
    } catch (err: any) {
      alert(`Failed to revoke session: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!token || !confirm('Revoke all other sessions? You will be logged out from other devices.'))
      return;

    setIsLoading(true);
    try {
      await revokeAllSessions();
      alert('All other sessions revoked successfully');
      // Refresh sessions
      const sess = await fetchSessions();
      setSessions(sess);
    } catch (err: any) {
      alert(`Failed to revoke sessions: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderProfileSection = () => (
    <div className="space-y-6">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={profileData.name}
              onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={profileData.phone || ''}
              onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={profileData.currentPassword}
              onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={profileData.newPassword}
              onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={profileData.confirmPassword}
              onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveProfile}
          disabled={isLoading}
          className="flex items-center  bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderAccountSection = () => (
    <div className="space-y-6">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Account Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
            <input
              type="text"
              value={orgData.name}
              onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Time Zone
            </label>
            <select
              value={orgData.timezone}
              onChange={(e) => setOrgData({ ...orgData, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Regional Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Distance Units</label>
            <select
              value={orgData.distance_unit}
              onChange={(e) => setOrgData({ ...orgData, distance_unit: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="metric">Metric (meters, kilometers)</option>
              <option value="imperial">Imperial (feet, miles)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
            <select
              value={orgData.date_format}
              onChange={(e) => setOrgData({ ...orgData, date_format: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Format</label>
            <select
              value={orgData.time_format}
              onChange={(e) => setOrgData({ ...orgData, time_format: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="12">12-hour</option>
              <option value="24">24-hour</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveAccount}
          disabled={isLoading}
          className="flex items-center  bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Email Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Geofence Events</h4>
              <p className="text-sm text-gray-500">
                Get notified when devices enter/exit geofences
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.emailGeofenceEvents}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    emailGeofenceEvents: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Automation Failures</h4>
              <p className="text-sm text-gray-500">Get notified when webhook automations fail</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.emailAutomationFailures}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    emailAutomationFailures: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Weekly Reports</h4>
              <p className="text-sm text-gray-500">Weekly summary of geofence activity</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.emailWeeklyReports}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    emailWeeklyReports: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Push Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Geofence Events</h4>
              <p className="text-sm text-gray-500">
                Browser push notifications for real-time events
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.pushGeofenceEvents}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    pushGeofenceEvents: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Critical Failures</h4>
              <p className="text-sm text-gray-500">Immediate alerts for automation failures</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.pushAutomationFailures}
                onChange={(e) =>
                  setNotificationSettings({
                    ...notificationSettings,
                    pushAutomationFailures: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveNotifications}
          disabled={isLoading}
          className="flex items-center  bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageData, setUsageData] = useState<any>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [createForm, setCreateForm] = useState<{
    name: string;
    permissions: string[];
    expiresInDays: number;
  }>({ name: '', permissions: ['devices:read'], expiresInDays: 30 });
  const [editForm, setEditForm] = useState<{
    name: string;
    permissions: string[];
    isActive: boolean;
  }>({ name: '', permissions: [], isActive: true });

  const validScopes = [
    'devices:read',
    'devices:write',
    'events:read',
    'events:write',
    'geofences:read',
    'geofences:write',
    'integrations:read',
    'automations:read',
    '*',
  ];

  const permissionOptions = [
    { value: 'devices:read', label: 'View Devices' },
    { value: 'devices:write', label: 'Manage Devices' },
    { value: 'events:read', label: 'View Events' },
    { value: 'events:write', label: 'Manage Event Logs' },
    { value: 'geofences:read', label: 'View Geofences' },
    { value: 'geofences:write', label: 'Manage Geofences' },
    { value: 'integrations:read', label: 'View Integrations' },
    { value: 'automations:read', label: 'View Automations' },
    { value: '*', label: 'Full Access (Admin Only)' },
  ];

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsLoading(true);
    try {
      const { data, message, warning } = await createApiKey(
        createForm.name,
        createForm.permissions,
        createForm.expiresInDays
      );
      // Show success with key in a better way, but for now use alert
      alert(
        `${message}\n${warning || ''}\nNew key: ${data.keyValue}\nCopy this now - it won't be shown again!`
      );
      setShowCreateModal(false);
      setCreateForm({ name: '', permissions: ['devices:read'], expiresInDays: 30 });
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (err: any) {
      alert(`Failed to generate API key: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedKey) return;
    setIsLoading(true);
    try {
      await updateApiKey(selectedKey.id, {
        name: editForm.name,
        permissions: editForm.permissions,
        is_active: editForm.isActive,
      });
      // Success message
      setError(null);
      setShowEditModal(false);
      setEditForm({ name: '', permissions: [], isActive: true });
      const keys = await fetchApiKeys();
      setApiKeys(keys);
    } catch (err: any) {
      alert(`Failed to update API key: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowUsage = async (keyId: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const usage = await getApiKeyUsage(keyId);
      setUsageData(usage);
      setShowUsageModal(true);
    } catch (err: any) {
      setError(`Failed to fetch usage: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditKey = (key: ApiKey) => {
    setSelectedKey(key);
    setEditForm({ name: key.name, permissions: key.permissions || [], isActive: key.isActive });
    setShowEditModal(true);
  };

  const renderCreateModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md p-3 w-full max-w-md">
        <h3 className="text-lg font-medium mb-4">Create New API Key</h3>
        <form onSubmit={handleCreateApiKey}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Permissions</label>
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-white">
              {permissionOptions.map((opt) => (
                <label key={opt.value} className="flex items-center cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={createForm.permissions.includes(opt.value)}
                    onChange={(e) => {
                      const newPermissions = e.target.checked
                        ? [...createForm.permissions, opt.value]
                        : createForm.permissions.filter((s) => s !== opt.value);
                      setCreateForm({ ...createForm, permissions: newPermissions });
                    }}
                    className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Expiration (days)</label>
            <select
              value={createForm.expiresInDays}
              onChange={(e) =>
                setCreateForm({ ...createForm, expiresInDays: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
              <option value={0}>No expiration</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className=" text-gray-600 border rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className=" bg-indigo-600 text-white rounded-md disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderEditModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md p-3 w-full max-w-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit API Key</h3>
        <form onSubmit={handleUpdateApiKey} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            <div className="grid grid-cols-2 gap-2 border border-gray-200 rounded-md p-3 bg-gray-50">
              {permissionOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center space-x-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={editForm.permissions.includes(opt.value)}
                    onChange={(e) => {
                      const newPermissions = e.target.checked
                        ? [...editForm.permissions, opt.value]
                        : editForm.permissions.filter((s) => s !== opt.value);
                      setEditForm({ ...editForm, permissions: newPermissions });
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span>Active</span>
            </label>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className=" text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className=" bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Updating...' : 'Update Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderUsageModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md p-3 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-medium mb-4">API Key Usage</h3>
        {usageData && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Total Requests</p>
                <p className="text-2xl font-bold text-gray-900">{usageData.total_requests}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Days Used</p>
                <p className="text-2xl font-bold text-gray-900">{usageData.days_used}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Uses</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Endpoint
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usageData.recentUses && usageData.recentUses.length > 0 ? (
                      usageData.recentUses.map((use: any, index: number) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {new Date(use.timestamp).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">{use.method}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{use.endpoint}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{use.ip_address}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center text-gray-500 text-sm">
                          No recent usage
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={() => {
              setShowUsageModal(false);
              setUsageData(null);
            }}
            className=" bg-gray-600 text-white rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const renderApiKeysSection = () => (
    <div className="space-y-6">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">API Keys</h3>
        <p className="text-sm text-gray-600 mb-4">
          Manage API keys for programmatic access to your geofence data and automations.
        </p>

        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-sm text-gray-500">Total keys: {apiKeys.length}</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={isLoading}
            className="flex items-center  bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <Key className="w-4 h-4 mr-2" />
            Create New Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No API keys found. Create one to get started.
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {key.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(key.permissions || []).join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {key.expiresAt
                        ? new Date(key.expiresAt).toLocaleDateString()
                        : 'No expiration'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-2 text-xs font-medium rounded-full ${key.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {key.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleShowUsage(key.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Usage
                      </button>
                      <button
                        onClick={() => handleEditKey(key)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRevokeApiKey(key.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Note: API keys are shown masked after creation. Copy the full key immediately when
          creating.
        </p>
      </div>

      {showCreateModal && renderCreateModal()}
      {showEditModal && renderEditModal()}
      {showUsageModal && renderUsageModal()}

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">MQTT Configuration</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MQTT Broker URL
              </label>
              <input
                type="text"
                value="mqtt://mqtt.geofence.app:1883"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic Pattern</label>
              <input
                type="text"
                value="devices/{device_id}/location"
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecuritySection = () => (
    <div className="space-y-6">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Active Sessions</h3>
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-gray-500">No active sessions found.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-2 border border-gray-200 rounded-md"
              >
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Session {session.isCurrent ? '(Current)' : ''}
                  </h4>
                  <p className="text-sm text-gray-500">{session.user_agent}</p>
                  <p className="text-sm text-gray-500">IP: {session.ip_address}</p>
                  <p className="text-xs text-gray-400">
                    Last active:{' '}
                    {session.last_activity_at
                      ? new Date(session.last_activity_at).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {session.isCurrent && (
                    <span className="px-3 py-2 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                      Current
                    </span>
                  )}
                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={isLoading}
                      className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-500">
                Add an extra layer of security to your account
              </p>
            </div>
            <button className=" border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
              Enable 2FA
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Login Notifications</h4>
              <p className="text-sm text-gray-500">Get notified of new login attempts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <button
          onClick={handleRevokeAllSessions}
          disabled={isLoading || sessions.length <= 1}
          className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
          ) : (
            <Trash2 className="w-4 h-4 inline mr-1" />
          )}
          Revoke All Other Sessions
        </button>
        <p className="text-xs text-gray-500 mt-1">
          This will sign you out of all other devices and require re-authentication.
        </p>
      </div>
    </div>
  );

  const renderRegionalSection = () => (
    <div className="space-y-6">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Location & Units</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Map Region
            </label>
            <select
              value={orgData.default_map_region}
              onChange={(e) =>
                setOrgData({ ...orgData, default_map_region: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="auto">Auto-detect</option>
              <option value="us">United States</option>
              <option value="eu">Europe</option>
              <option value="asia">Asia Pacific</option>
              <option value="global">Global</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coordinate Format
            </label>
            <select
              value={orgData.coordinate_format}
              onChange={(e) => setOrgData({ ...orgData, coordinate_format: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="decimal">Decimal Degrees (40.7128, -74.0060)</option>
              <option value="dms">
                Degrees Minutes Seconds (40°42&apos;46&quot;N, 74°00&apos;22&quot;W)
              </option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Retention</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location Data Retention
            </label>
            <select
              value={orgData.location_retention_days.toString()}
              onChange={(e) =>
                setOrgData({ ...orgData, location_retention_days: parseInt(e.target.value) || 30 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">6 months</option>
              <option value="365">1 year</option>
              <option value="0">Indefinite</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">How long to keep device location history</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Log Retention
            </label>
            <select
              value={orgData.event_retention_days.toString()}
              onChange={(e) =>
                setOrgData({ ...orgData, event_retention_days: parseInt(e.target.value) || 90 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="90">90 days</option>
              <option value="180">6 months</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
              <option value="0">Indefinite</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">How long to keep geofence event history</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSaveAccount}
          disabled={isLoading}
          className="flex items-center  bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection();
      case 'organization':
        return renderAccountSection();
      case 'notifications':
        return renderNotificationsSection();
      case 'api-keys':
        return renderApiKeysSection();
      case 'security':
        return renderSecuritySection();
      case 'regional':
        return renderRegionalSection();
      default:
        return renderProfileSection();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Settings"
        subtitle="Manage your account, organization, and system preferences"
      />

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Settings Navigation */}
          <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
            <nav className="p-2">
              <ul className="space-y-1">
                {settingsSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;

                  return (
                    <li key={section.id}>
                      <button
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        <div className="text-left">
                          <div className="font-medium">{section.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{section.description}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3">{renderContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
