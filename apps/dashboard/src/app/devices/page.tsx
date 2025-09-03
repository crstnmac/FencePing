'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import { DevicePairingModal } from '../../components/DevicePairingModal';
import { useDevices, useDeleteDevice, useCreateDevice, useUpdateDevice } from '../../hooks/useApi';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MapPin,
  Activity,
  Clock,
  MoreHorizontal,
  Copy,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';

export default function DevicesPage() {
  // Use React Query hooks for API state management
  const { data: devices = [], isLoading: loading, error } = useDevices();
  const deleteDeviceMutation = useDeleteDevice();
  const createDeviceMutation = useCreateDevice();
  const updateDeviceMutation = useUpdateDevice();


  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    device_type: 'mobile'
  });
  
  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const filteredDevices = devices.filter(device =>
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatLastSeen = (lastSeen: string | null | undefined) => {
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

  const copyToClipboard = (text: string) => {
    window.navigator.clipboard.writeText(text);
    // In real app, show toast notification
  };

  const toggleTokenVisibility = (deviceId: string) => {
    setShowTokens(prev => ({
      ...prev,
      [deviceId]: !prev[deviceId]
    }));
  };

  const handleEdit = (device: any) => {
    setSelectedDevice(device);
    setFormData({
      name: device.name || '',
      description: device.description || '',
      device_type: device.device_type || 'mobile'
    });
    setShowCreateModal(true);
  };

  const handleCreateNew = () => {
    setSelectedDevice(null);
    setFormData({
      name: '',
      description: '',
      device_type: 'mobile'
    });
    setShowCreateModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Device name is required');
      return;
    }

    try {
      if (selectedDevice) {
        // Update existing device
        await updateDeviceMutation.mutateAsync({
          deviceId: selectedDevice.id,
          updates: {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            device_type: formData.device_type
          }
        });
      } else {
        // Create new device
        await createDeviceMutation.mutateAsync({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          device_type: formData.device_type
        });
      }
      
      // Close modal and reset form
      setShowCreateModal(false);
      setFormData({ name: '', description: '', device_type: 'mobile' });
      setSelectedDevice(null);
      
      // Show success notification
      setNotification({
        type: 'success',
        message: `Device ${selectedDevice ? 'updated' : 'created'} successfully!`
      });
    } catch (err) {
      console.error('Failed to save device:', err);
      setNotification({
        type: 'error',
        message: `Failed to ${selectedDevice ? 'update' : 'create'} device. Please try again.`
      });
    }
  };

  const handleCancel = () => {
    setShowCreateModal(false);
    setFormData({ name: '', description: '', device_type: 'mobile' });
    setSelectedDevice(null);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal) {
        handleCancel();
      }
    };

    if (showCreateModal) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCreateModal]);

  const handleDelete = async (deviceId: string) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        await deleteDeviceMutation.mutateAsync(deviceId);
        setNotification({
          type: 'success',
          message: 'Device deleted successfully!'
        });
      } catch (err) {
        console.error('Failed to delete device:', err);
        setNotification({
          type: 'error',
          message: 'Failed to delete device. Please try again.'
        });
      }
    }
  };

  // Show error state if API call failed
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header 
          title="Devices" 
          subtitle="Manage your tracking devices and monitor their status"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load devices</h3>
            <p className="text-gray-600">There was an error loading device data.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Devices" 
        subtitle="Manage your tracking devices and monitor their status"
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPairingModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Copy className="h-4 w-4" />
              Pair Device
            </button>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Device
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Devices</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : devices.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : devices.filter(d => d.is_active).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : devices.filter(d => d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 60 * 60 * 1000).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Activity className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : devices.filter(d => !d.is_active).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Devices Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">All Devices</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
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
                    Device Token
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  // Loading skeleton rows
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="h-4 bg-gray-300 rounded animate-pulse mb-1" />
                          <div className="h-3 bg-gray-300 rounded animate-pulse w-2/3" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-12" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 bg-gray-300 rounded-full animate-pulse w-16" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-32" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-8 bg-gray-300 rounded animate-pulse w-40" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" />
                          <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center">
                      <Activity className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">
                        {searchTerm ? 'No devices match your search' : 'No devices found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((device) => (
                    <tr key={device.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{device.name}</div>
                          <div className="text-sm text-gray-500">{device.description || 'No description'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {device.device_type || 'mobile'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          device.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          <div className={`w-2 h-2 rounded-full mr-1 ${
                            device.is_active ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          {device.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatLastSeen(device.last_seen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {device.longitude && device.latitude ? (
                          <div className="flex items-center text-sm text-gray-500">
                            <MapPin className="h-4 w-4 mr-1" />
                            {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No location</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {showTokens[device.id]
                              ? (device.device_token || 'No token')
                              : `${(device.device_token || '').substring(0, 8)}...`
                            }
                          </code>
                          <button
                            onClick={() => toggleTokenVisibility(device.id)}
                            className="text-gray-400 hover:text-gray-600"
                            disabled={!device.device_token}
                          >
                            {showTokens[device.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(device.device_token || '')}
                            className="text-gray-400 hover:text-gray-600"
                            disabled={!device.device_token}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(device)}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={deleteDeviceMutation.isPending}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(device.id)}
                            className="text-red-600 hover:text-red-900"
                            disabled={deleteDeviceMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancel();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {selectedDevice ? 'Edit Device' : 'Create New Device'}
            </h3>
            
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-1">
                  Device Name *
                </label>
                <input
                  type="text"
                  id="deviceName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter device name"
                  required
                  disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending}
                />
              </div>

              <div>
                <label htmlFor="deviceType" className="block text-sm font-medium text-gray-700 mb-1">
                  Device Type *
                </label>
                <select
                  id="deviceType"
                  value={formData.device_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, device_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending}
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
                <label htmlFor="deviceDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="deviceDescription"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter device description (optional)"
                  disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending}
                />
              </div>

              {selectedDevice && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Current Status:</strong> {selectedDevice.is_active ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Created:</strong> {new Date(selectedDevice.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending || !formData.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {(createDeviceMutation.isPending || updateDeviceMutation.isPending) && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  )}
                  {selectedDevice ? 'Update Device' : 'Create Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 ${
            notification.type === 'success' ? 'ring-green-500' : 'ring-red-500'
          }`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
                      <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
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
                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Device Pairing Modal */}
      <DevicePairingModal
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        onSuccess={() => {
          // Refresh devices list when new device is paired
          // This will happen automatically due to React Query refetch
          setShowPairingModal(false);
        }}
      />
    </div>
  );
}
