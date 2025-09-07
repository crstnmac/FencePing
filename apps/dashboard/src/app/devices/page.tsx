'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import { DevicePairingModal } from '../../components/DevicePairingModal';
import { DeviceTable } from '../../components/DeviceTable';
import { DeviceGrid } from '../../components/DeviceGrid';
import { DeviceCommandModal } from '../../components/DeviceCommandModal';
import { DeviceGroupModal } from '../../components/DeviceGroupModal';
import { AssignToGroupModal } from '../../components/AssignToGroupModal';
import { AutomationRuleModal } from '../../components/AutomationRuleModal';
import { 
  useDevices, 
  useDeleteDevice, 
  useCreateDevice, 
  useUpdateDevice,
  useDeviceGroups,
  useCreateDeviceGroup,
  useAssignDeviceToGroup,
  useBulkDeleteDevices,
  useSendDeviceCommand,
  useAutomationRulesForDevice
} from '../../hooks/useApi';
import type { Device, DeviceGroup } from '../../services/api';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MapPin,
  Activity,
  Clock,
  Copy,
  Users,
  Wifi,
  WifiOff,
  ChevronDown,
  Check,
  X,
  Terminal,
  FileText,
  Layers,
  Zap
} from 'lucide-react';

interface DeviceFilters {
  status?: 'all' | 'active' | 'inactive' | 'online' | 'offline';
  deviceType?: string;
  groupId?: string;
  lastSeen?: 'hour' | 'day' | 'week' | 'month';
}

export default function EnhancedDevicesPage() {
  // API Hooks
  const { data: devices = [], isLoading: devicesLoading } = useDevices();
  const { data: groups = [] } = useDeviceGroups();
  const deleteDeviceMutation = useDeleteDevice();
  const createDeviceMutation = useCreateDevice();
  const updateDeviceMutation = useUpdateDevice();
  const bulkDeleteMutation = useBulkDeleteDevices();
  const sendCommandMutation = useSendDeviceCommand();
  const createGroupMutation = useCreateDeviceGroup();
  const assignToGroupMutation = useAssignDeviceToGroup();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<DeviceFilters>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAssignGroupModal, setShowAssignGroupModal] = useState(false);
  const [showAutomationRuleModal, setShowAutomationRuleModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedDeviceForRule, setSelectedDeviceForRule] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    device_type: 'mobile'
  });

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Filter devices based on search and filters
  const filteredDevices = devices.filter(device => {
    // Search filter
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (device.description || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = !filters.status || filters.status === 'all' || 
      (filters.status === 'active' && device.is_active) ||
      (filters.status === 'inactive' && !device.is_active) ||
      (filters.status === 'online' && device.status === 'online') ||
      (filters.status === 'offline' && device.status === 'offline');

    // Device type filter
    const matchesType = !filters.deviceType || device.device_type === filters.deviceType;

    // Group filter  
    const matchesGroup = !filters.groupId || device.group_id === filters.groupId;

    // Last seen filter
    let matchesLastSeen = true;
    if (filters.lastSeen && device.last_seen) {
      const lastSeen = new Date(device.last_seen).getTime();
      const now = Date.now();
      const timeframes = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };
      matchesLastSeen = (now - lastSeen) <= timeframes[filters.lastSeen];
    }

    return matchesSearch && matchesStatus && matchesType && matchesGroup && matchesLastSeen;
  });

  // Utility functions
  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Never';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const selectAllDevices = () => {
    if (selectedDevices.length === filteredDevices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(filteredDevices.map(device => device.id));
    }
  };

  const toggleTokenVisibility = (deviceId: string) => {
    // Implementation for token visibility toggle
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotification({ type: 'success', message: 'Token copied to clipboard' });
  };

  // Event handlers
  const handleCreateDevice = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedDevice) {
      // Update existing device
      updateDeviceMutation.mutate(
        { deviceId: selectedDevice.id, updates: formData },
        {
          onSuccess: () => {
            setShowCreateModal(false);
            setSelectedDevice(null);
            setFormData({ name: '', description: '', device_type: 'mobile' });
            setNotification({ type: 'success', message: 'Device updated successfully' });
          },
          onError: (error: any) => {
            setNotification({ type: 'error', message: error.message || 'Failed to update device' });
          }
        }
      );
    } else {
      // Create new device
      createDeviceMutation.mutate(formData, {
        onSuccess: () => {
          setShowCreateModal(false);
          setFormData({ name: '', description: '', device_type: 'mobile' });
          setNotification({ type: 'success', message: 'Device created successfully' });
        },
        onError: (error: any) => {
          setNotification({ type: 'error', message: error.message || 'Failed to create device' });
        }
      });
    }
  };

  const handleEdit = (device: Device) => {
    setSelectedDevice(device);
    setFormData({
      name: device.name,
      description: device.description || '',
      device_type: device.device_type || 'mobile'
    });
    setShowCreateModal(true);
  };

  const handleDelete = (device: Device) => {
    if (confirm(`Are you sure you want to delete ${device.name}?`)) {
      deleteDeviceMutation.mutate(device.id, {
        onSuccess: () => {
          setNotification({ type: 'success', message: 'Device deleted successfully' });
        },
        onError: (error: any) => {
          setNotification({ type: 'error', message: error.message || 'Failed to delete device' });
        }
      });
    }
  };

  const handleSendCommand = (deviceId: string, command: any) => {
    sendCommandMutation.mutate({ deviceId, command }, {
      onSuccess: () => {
        setShowCommandModal(false);
        setSelectedDevice(null);
        setNotification({ type: 'success', message: 'Command sent successfully' });
      },
      onError: (error: any) => {
        setNotification({ type: 'error', message: error.message || 'Failed to send command' });
      }
    });
  };

  const handleCreateGroup = (groupData: any) => {
    createGroupMutation.mutate(groupData, {
      onSuccess: () => {
        setShowGroupModal(false);
        setNotification({ type: 'success', message: 'Group created successfully' });
      },
      onError: (error: any) => {
        setNotification({ type: 'error', message: error.message || 'Failed to create group' });
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedDevices.length === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedDevices.length} devices?`)) {
      bulkDeleteMutation.mutate(selectedDevices, {
        onSuccess: () => {
          setSelectedDevices([]);
          setNotification({ type: 'success', message: `${selectedDevices.length} devices deleted successfully` });
        },
        onError: (error: any) => {
          setNotification({ type: 'error', message: error.message || 'Failed to delete devices' });
        }
      });
    }
  };

  const handleAssignToGroup = (deviceId: string, groupId: string) => {
    assignToGroupMutation.mutate({ deviceId, groupId }, {
      onSuccess: () => {
        setNotification({ type: 'success', message: 'Device assigned to group successfully' });
      },
      onError: (error: any) => {
        setNotification({ type: 'error', message: error.message || 'Failed to assign device to group' });
      }
    });
  };

  const handleBulkAssignToGroup = (deviceIds: string[], groupId: string) => {
    // For bulk assignment, we can either implement a bulk API endpoint or call individual assignments
    // For now, we'll use individual assignments
    Promise.all(
      deviceIds.map(deviceId => 
        assignToGroupMutation.mutateAsync({ deviceId, groupId })
      )
    ).then(() => {
      setShowAssignGroupModal(false);
      setSelectedDevices([]);
      setNotification({ type: 'success', message: `${deviceIds.length} devices assigned to group successfully` });
    }).catch((error: any) => {
      setNotification({ type: 'error', message: error.message || 'Failed to assign devices to group' });
    });
  };

  const handleCreateAutomationRule = (deviceId: string) => {
    setSelectedDeviceForRule(deviceId);
    setShowAutomationRuleModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Device Management" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
              <p className="mt-2 text-sm text-gray-700">
                Manage your devices, send commands, and organize into groups
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowPairingModal(true)}
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Pair Device
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Device
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-1.5 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any || undefined }))}
                className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>

              <select
                value={filters.deviceType || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, deviceType: e.target.value || undefined }))}
                className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="">All Types</option>
                <option value="mobile">Mobile</option>
                <option value="vehicle">Vehicle</option>
                <option value="asset">Asset</option>
                <option value="pet">Pet</option>
                <option value="person">Person</option>
                <option value="other">Other</option>
              </select>

              <select
                value={filters.groupId || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, groupId: e.target.value || undefined }))}
                className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="">All Groups</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>

              <select
                value={filters.lastSeen || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, lastSeen: e.target.value as any || undefined }))}
                className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              >
                <option value="">All Time</option>
                <option value="hour">Last Hour</option>
                <option value="day">Last Day</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
              </select>

              <button
                onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                className="px-2 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs flex items-center"
              >
                <Layers className="h-3 w-3 mr-1" />
                {viewMode === 'table' ? 'Grid' : 'Table'}
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedDevices.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedDevices.length} device{selectedDevices.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAssignGroupModal(true)}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                >
                  <Users className="h-3 w-3 mr-1 inline" />
                  Assign to Group
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                >
                  <Trash2 className="h-3 w-3 mr-1 inline" />
                  Delete Selected
                </button>
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                >
                  <Plus className="h-3 w-3 mr-1 inline" />
                  Create Group
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Device List */}
        {viewMode === 'table' ? (
          <DeviceTable 
            devices={filteredDevices}
            loading={devicesLoading}
            selectedDevices={selectedDevices}
            groups={groups}
            onToggleSelection={toggleDeviceSelection}
            onSelectAll={selectAllDevices}
            onToggleToken={toggleTokenVisibility}
            onCopyToken={copyToClipboard}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSendCommand={(device: Device) => {
              setSelectedDevice(device);
              setShowCommandModal(true);
            }}
            onAssignToGroup={handleAssignToGroup}
            onCreateAutomationRule={handleCreateAutomationRule}
            formatLastSeen={formatLastSeen}
          />
        ) : (
          <DeviceGrid 
            devices={filteredDevices}
            loading={devicesLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSendCommand={(device: Device) => {
              setSelectedDevice(device);
              setShowCommandModal(true);
            }}
            onCreateAutomationRule={handleCreateAutomationRule}
            formatLastSeen={formatLastSeen}
          />
        )}

        {/* Modals */}
        <DevicePairingModal 
          isOpen={showPairingModal}
          onClose={() => setShowPairingModal(false)}
          onSuccess={() => {
            setShowPairingModal(false);
            setNotification({ type: 'success', message: 'Device paired successfully' });
          }}
        />

        {/* Create/Edit Device Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium mb-4">
                {selectedDevice ? 'Edit Device' : 'Create New Device'}
              </h3>
              
              <form onSubmit={handleCreateDevice} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device Type *
                  </label>
                  <select
                    value={formData.device_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, device_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="mobile">Mobile Phone</option>
                    <option value="vehicle">Vehicle Tracker</option>
                    <option value="asset">Asset Tracker</option>
                    <option value="pet">Pet Tracker</option>
                    <option value="person">Personal Tracker</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setSelectedDevice(null);
                      setFormData({ name: '', description: '', device_type: 'mobile' });
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending}
                  >
                    {(createDeviceMutation.isPending || updateDeviceMutation.isPending) ? 'Saving...' : (selectedDevice ? 'Update Device' : 'Create Device')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <DeviceCommandModal
          device={selectedDevice}
          isOpen={showCommandModal}
          onClose={() => {
            setShowCommandModal(false);
            setSelectedDevice(null);
          }}
          onSendCommand={handleSendCommand}
          isLoading={sendCommandMutation.isPending}
        />

        <DeviceGroupModal
          isOpen={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          onSave={handleCreateGroup}
          isLoading={createGroupMutation.isPending}
        />

        <AssignToGroupModal
          devices={selectedDevices.map(id => devices.find(d => d.id === id)).filter(Boolean) as Device[]}
          groups={groups}
          isOpen={showAssignGroupModal}
          onClose={() => setShowAssignGroupModal(false)}
          onAssign={handleBulkAssignToGroup}
          isLoading={assignToGroupMutation.isPending}
        />

        {/* Notification */}
        {notification && (
          <div className="fixed bottom-4 right-4 max-w-md w-full z-50">
            <div className={`rounded-lg p-4 shadow-lg ${
              notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
                      <X className="h-4 w-4 text-red-600" />
                    </div>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {notification.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
                  <button
                    onClick={() => setNotification(null)}
                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Automation Rule Modal */}
      <AutomationRuleModal
        isOpen={showAutomationRuleModal}
        onClose={() => {
          setShowAutomationRuleModal(false);
          setSelectedDeviceForRule(null);
        }}
        preselectedDeviceId={selectedDeviceForRule || undefined}
        onSuccess={(rule) => {
          setNotification({ 
            type: 'success', 
            message: `Automation rule "${rule.name}" created successfully` 
          });
        }}
      />
    </div>
  );
}
