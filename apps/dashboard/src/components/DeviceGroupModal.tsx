'use client';

import { useState, useEffect } from 'react';
import { DeviceGroup, CreateDeviceGroupRequest } from '../services/api';
import { X, Users, Loader2 } from 'lucide-react';

interface DeviceGroupModalProps {
  group?: DeviceGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: CreateDeviceGroupRequest) => void;
  isLoading?: boolean;
}

const predefinedColors = [
  '#3B82F6', // Blue
  '#10B981', // Emerald  
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#F97316'  // Orange
];

const predefinedIcons = [
  'users',
  'building',
  'home',
  'truck',
  'smartphone',
  'laptop',
  'server',
  'shield',
  'map-pin',
  'tag'
];

export function DeviceGroupModal({
  group,
  isOpen,
  onClose,
  onSave,
  isLoading = false
}: DeviceGroupModalProps) {
  const [formData, setFormData] = useState<CreateDeviceGroupRequest>({
    name: '',
    description: '',
    color: predefinedColors[0],
    icon: predefinedIcons[0],
    metadata: {}
  });

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || '',
        color: group.color,
        icon: group.icon,
        metadata: group.metadata || {}
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: predefinedColors[0],
        icon: predefinedIcons[0],
        metadata: {}
      });
    }
  }, [group]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">
              {group ? 'Edit Device Group' : 'Create Device Group'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter group name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {predefinedColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="mt-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 rounded border border-gray-300"
                />
              </div>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Icon
              </label>
              <select
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {predefinedIcons.map(icon => (
                  <option key={icon} value={icon}>
                    {icon.charAt(0).toUpperCase() + icon.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview */}
            <div className="border border-gray-200 rounded-md p-3">
              <div className="text-sm text-gray-700 mb-2">Preview:</div>
              <div className="flex items-center">
                <div
                  className="w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: formData.color }}
                />
                <span className="font-medium">{formData.name || 'Group Name'}</span>
              </div>
              {formData.description && (
                <div className="text-sm text-gray-500 mt-1 ml-6">
                  {formData.description}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className=" text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className=" text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {group ? 'Update Group' : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}