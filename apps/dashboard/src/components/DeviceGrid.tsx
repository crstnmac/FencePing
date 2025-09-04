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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <MapPin className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
          <p className="text-gray-500 mb-4">Get started by adding your first device.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {devices.map((device) => (
        <div key={device.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  device.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {device.name}
                </h3>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onSendCommand(device)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                  title="Send command"
                >
                  <Terminal className="h-4 w-4" />
                </button>
                {onCreateAutomationRule && (
                  <button
                    onClick={() => onCreateAutomationRule(device.id)}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                    title="Create automation rule"
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => onEdit(device)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors duration-200"
                  title="Edit device"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(device)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  title="Delete device"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Device Type */}
            <div className="mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {device.device_type || 'Unknown'}
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center mb-3">
              {device.status === 'online' ? (
                <Wifi className="h-4 w-4 text-green-500 mr-2" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400 mr-2" />
              )}
              <span className={`text-sm font-medium ${
                device.status === 'online' ? 'text-green-700' : 'text-gray-500'
              }`}>
                {device.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Last Seen */}
            <div className="flex items-center mb-3">
              <Clock className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">
                {formatLastSeen(device.last_seen)}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center mb-4">
              <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
              {device.latitude && device.longitude ? (
                <span className="text-sm text-gray-600 truncate">
                  {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                </span>
              ) : (
                <span className="text-sm text-gray-400">No location data</span>
              )}
            </div>

            {/* Activity Indicator */}
            {device.is_active && (
              <div className="flex items-center text-green-600">
                <Activity className="h-4 w-4 mr-1" />
                <span className="text-xs font-medium">Active</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}