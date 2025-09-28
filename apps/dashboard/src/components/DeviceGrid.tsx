'use client';

import { Device } from '../services/api';
import {
  Wifi,
  WifiOff,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  Terminal,
  Activity,
  Zap
} from 'lucide-react';

interface DeviceGridProps {
  devices: Device[];
  loading: boolean;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onSendCommand: (device: Device) => void;
  onCreateAutomationRule?: (deviceId: string) => void;
  formatLastSeen: (lastSeen?: string) => string;
}

export function DeviceGrid({
  devices,
  loading,
  onEdit,
  onDelete,
  onSendCommand,
  onCreateAutomationRule,
  formatLastSeen
}: DeviceGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: 'var(--space-lg)' }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-md shadow animate-pulse" style={{ padding: 'var(--space-md)' }}>
            <div className="h-4 bg-gray-200 rounded w-3/4" style={{ marginBottom: 'var(--space-sm)' }}></div>
            <div className="h-3 bg-gray-200 rounded w-1/2" style={{ marginBottom: 'var(--space-lg)' }}></div>
            <div className="h-3 bg-gray-200 rounded w-full" style={{ marginBottom: 'var(--space-sm)' }}></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-white rounded-md shadow">
        <div className="text-center" style={{ padding: 'var(--space-md)' }}>
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center" style={{ marginBottom: 'var(--space-lg)' }}>
            <MapPin className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900" style={{ marginBottom: 'var(--space-sm)' }}>No devices found</h3>
          <p className="text-gray-500" style={{ marginBottom: 'var(--space-lg)' }}>Get started by adding your first device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: 'var(--space-lg)' }}>
      {devices.map((device) => (
        <div key={device.id} className="bg-white rounded-md shadow hover:shadow-md transition-shadow duration-200">
          <div style={{ padding: 'var(--space-md)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} style={{ marginRight: 'var(--space-md)' }}></div>
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {device.name}
                </h3>
              </div>
              <div className="flex items-center" style={{ gap: 'var(--space-xs)' }}>
                <button
                  onClick={() => onSendCommand(device)}
                  className="text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
                  style={{ padding: 'var(--space-sm)' }}
                  title="Send command"
                >
                  <Terminal className="h-4 w-4" />
                </button>
                {onCreateAutomationRule && (
                  <button
                    onClick={() => onCreateAutomationRule(device.id)}
                    className="text-purple-600 hover:bg-purple-50 rounded-md transition-colors duration-200"
                    style={{ padding: 'var(--space-sm)' }}
                    title="Create automation rule"
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => onEdit(device)}
                  className="text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors duration-200"
                  style={{ padding: 'var(--space-sm)' }}
                  title="Edit device"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(device)}
                  className="text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                  style={{ padding: 'var(--space-sm)' }}
                  title="Delete device"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <span className="inline-flex items-center rounded-full text-xs font-medium bg-gray-100 text-gray-800" style={{ padding: 'var(--space-xs) var(--space-sm)' }}>
                {device.device_type || 'Unknown'}
              </span>
            </div>

            <div className="flex items-center" style={{ marginBottom: 'var(--space-lg)' }}>
              {device.status === 'online' ? (
                <Wifi className="h-4 w-4 text-green-500" style={{ marginRight: 'var(--space-sm)' }} />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" style={{ marginRight: 'var(--space-sm)' }} />
              )}
              <span className={`text-sm font-medium ${device.status === 'online' ? 'text-green-700' : 'text-gray-500'}`}>
                {device.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center" style={{ marginBottom: 'var(--space-lg)' }}>
              <Clock className="h-4 w-4 text-gray-400" style={{ marginRight: 'var(--space-sm)' }} />
              <span className="text-sm text-gray-600">
                {formatLastSeen(device.last_seen)}
              </span>
            </div>

            <div className="flex items-center" style={{ marginBottom: 'var(--space-lg)' }}>
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" style={{ marginRight: 'var(--space-sm)' }} />
              {device.latitude && device.longitude ? (
                <span className="text-sm text-gray-600 truncate">
                  {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                </span>
              ) : (
                <span className="text-sm text-gray-400">No location data</span>
              )}
            </div>

            {device.is_active && (
              <div className="flex items-center text-green-600">
                <Activity className="h-4 w-4" style={{ marginRight: 'var(--space-xs)' }} />
                <span className="text-xs font-medium">Active</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}