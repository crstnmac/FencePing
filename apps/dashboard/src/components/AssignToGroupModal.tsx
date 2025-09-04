'use client';

import { useState } from 'react';
import { Device, DeviceGroup } from '../services/api';
import { X, Users, Loader2 } from 'lucide-react';

interface AssignToGroupModalProps {
  devices: Device[];
  groups: DeviceGroup[];
  isOpen: boolean;
  onClose: () => void;
  onAssign: (deviceIds: string[], groupId: string) => void;
  isLoading?: boolean;
}

export function AssignToGroupModal({
  devices,
  groups,
  isOpen,
  onClose,
  onAssign,
  isLoading = false
}: AssignToGroupModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return;
    
    const deviceIds = devices.map(device => device.id);
    onAssign(deviceIds, selectedGroupId);
  };

  if (!isOpen) return null;

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">
              Assign to Group
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <div className="text-sm text-gray-700 mb-2">
              Assigning {devices.length} device{devices.length !== 1 ? 's' : ''}:
            </div>
            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              {devices.map(device => (
                <div key={device.id} className="text-sm text-gray-600 mb-1">
                  • {device.name}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Group *
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a group...</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.deviceCount} devices)
                  </option>
                ))}
              </select>
            </div>

            {selectedGroup && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded-full mr-2" 
                    style={{ backgroundColor: selectedGroup.color }}
                  />
                  <div>
                    <div className="text-sm font-medium text-blue-900">
                      {selectedGroup.name}
                    </div>
                    {selectedGroup.description && (
                      <div className="text-sm text-blue-700">
                        {selectedGroup.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={isLoading || !selectedGroupId}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign to Group
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}