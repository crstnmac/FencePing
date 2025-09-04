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
  Copy,
  Eye,
  EyeOff,
  Check,
  Zap
} from 'lucide-react';

interface DeviceTableProps {
  devices: Device[];
  loading: boolean;
  selectedDevices: string[];
  groups?: any[];
  onToggleSelection: (deviceId: string) => void;
  onSelectAll: () => void;
  onToggleToken: (deviceId: string) => void;
  onCopyToken: (token: string) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onSendCommand: (device: Device) => void;
  onAssignToGroup?: (deviceId: string, groupId: string) => void;
  onCreateAutomationRule?: (deviceId: string) => void;
  formatLastSeen: (lastSeen?: string) => string;
}

export function DeviceTable({
  devices,
  loading,
  selectedDevices,
  groups = [],
  onToggleSelection,
  onSelectAll,
  onToggleToken,
  onCopyToken,
  onEdit,
  onDelete,
  onSendCommand,
  onAssignToGroup,
  onCreateAutomationRule,
  formatLastSeen
}: DeviceTableProps) {
  const showTokens: Record<string, boolean> = {};

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading devices...</p>
        </div>
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
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={selectedDevices.length === devices.length}
                onChange={onSelectAll}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Device
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Seen
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Token
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Group
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {devices.map((device) => (
            <tr key={device.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedDevices.includes(device.id)}
                  onChange={() => onToggleSelection(device.id)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{device.name}</div>
                  <div className="text-sm text-gray-500">{device.device_type}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {device.status === 'online' ? (
                    <Wifi className="h-4 w-4 text-green-500 mr-2" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-gray-400 mr-2" />
                  )}
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    device.status === 'online' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {device.status || 'offline'}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-400 mr-1" />
                  {formatLastSeen(device.last_seen)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {device.latitude && device.longitude ? (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                    <span>{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">No location</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  {device.device_token ? (
                    <>
                      <button
                        onClick={() => onToggleToken(device.id)}
                        className="text-gray-400 hover:text-gray-600"
                        title={showTokens[device.id] ? "Hide token" : "Show token"}
                      >
                        {showTokens[device.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <span className="text-sm text-gray-500 font-mono">
                        {showTokens[device.id] ? device.device_token : '••••••••'}
                      </span>
                      <button
                        onClick={() => onCopyToken(device.device_token!)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Copy token"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-gray-400 text-sm">No token</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {onAssignToGroup ? (
                  <select
                    value={device.group_id || ''}
                    onChange={(e) => onAssignToGroup(device.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No group</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-gray-500">
                    {device.group_id ? 
                      groups.find(g => g.id === device.group_id)?.name || 'Unknown Group' 
                      : 'No group'
                    }
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => onSendCommand(device)}
                    className="text-blue-600 hover:text-blue-900"
                    title="Send command"
                  >
                    <Terminal className="h-4 w-4" />
                  </button>
                  {onCreateAutomationRule && (
                    <button
                      onClick={() => onCreateAutomationRule(device.id)}
                      className="text-purple-600 hover:text-purple-900"
                      title="Create automation rule"
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(device)}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="Edit device"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(device)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete device"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}