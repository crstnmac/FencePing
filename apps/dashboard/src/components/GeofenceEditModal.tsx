'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Save,
  MapPin,
  Circle,
  Hexagon,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  ZoomIn,
} from 'lucide-react';
import { FrontendGeofence, UpdateGeofenceRequest } from '../types/geofence';

interface GeofenceEditModalProps {
  geofence: FrontendGeofence | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: UpdateGeofenceRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onZoom?: (geofence: FrontendGeofence) => void;
  loading?: boolean;
}

export function GeofenceEditModal({
  geofence,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onZoom,
  loading = false,
}: GeofenceEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    radius: 100,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (geofence) {
      setFormData({
        name: geofence.name || '',
        description: geofence.description || '',
        is_active: geofence.is_active,
        radius: geofence.radius || 100,
      });
    }
  }, [geofence]);

  const handleSave = async () => {
    if (!geofence) return;

    setSaving(true);
    try {
      const updates: UpdateGeofenceRequest = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
      };

      if (geofence.type === 'circle') {
        updates.radius_m = formData.radius;
      }

      await onSave(geofence.id, updates);
      onClose();
    } catch (error) {
      console.error('Failed to save geofence:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!geofence) return;

    setDeleting(true);
    try {
      await onDelete(geofence.id);
      onClose();
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete geofence:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getGeofenceIcon = (type: string) => {
    switch (type) {
      case 'circle':
        return <Circle className="h-4 w-4" />;
      case 'polygon':
        return <Hexagon className="h-4 w-4" />;
      case 'point':
        return <MapPin className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getCoordinatesSummary = (geofence: FrontendGeofence) => {
    if (!geofence.geometry) return 'No coordinates';

    switch (geofence.type) {
      case 'point':
        const point = geofence.geometry.coordinates as number[];
        return `${point[1]?.toFixed(4)}, ${point[0]?.toFixed(4)}`;
      case 'circle':
        const center = geofence.geometry.coordinates as number[];
        return `Center: ${center[1]?.toFixed(4)}, ${center[0]?.toFixed(4)} • Radius: ${geofence.radius}m`;
      case 'polygon':
        const coords = geofence.geometry.coordinates as number[][];
        return `${coords.length} vertices`;
      default:
        return 'Complex geometry';
    }
  };

  if (!isOpen || !geofence) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-md shadow-xl border border-gray-200 max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
        <div
          className="flex items-center justify-between border-b border-gray-200"
          style={{ padding: 'var(--space-lg)' }}
        >
          <div className="flex items-center" style={{ gap: 'var(--space-md)' }}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-md ${
                geofence.type === 'circle'
                  ? 'bg-green-100 text-green-600'
                  : geofence.type === 'polygon'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-orange-100 text-orange-600'
              }`}
            >
              {getGeofenceIcon(geofence.type)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Geofence</h2>
              <p className="text-sm text-gray-600 capitalize">{geofence.type} geofence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-md transition-colors"
            style={{ padding: 'var(--space-sm)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ padding: 'var(--space-lg)' }}>
          <div className="space-y-6">
            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                style={{ marginBottom: 'var(--space-sm)' }}
              >
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                style={{ padding: 'var(--space-md)' }}
                placeholder="Enter geofence name"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-gray-700"
                style={{ marginBottom: 'var(--space-sm)' }}
              >
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                style={{ padding: 'var(--space-md)' }}
                rows={3}
                placeholder="Enter description (optional)"
              />
            </div>

            {geofence.type === 'circle' && (
              <div>
                <label
                  className="block text-sm font-medium text-gray-700"
                  style={{ marginBottom: 'var(--space-sm)' }}
                >
                  Radius (meters)
                </label>
                <input
                  type="number"
                  value={formData.radius}
                  onChange={(e) =>
                    setFormData({ ...formData, radius: parseInt(e.target.value) || 100 })
                  }
                  className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  style={{ padding: 'var(--space-md)' }}
                  min="10"
                  max="10000"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="text-sm text-gray-500" style={{ marginTop: 'var(--space-xs)' }}>
                  {formData.is_active ? 'Active and monitoring' : 'Paused'}
                </p>
              </div>
              <button
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.is_active ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.is_active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="bg-gray-50 rounded-md" style={{ padding: 'var(--space-md)' }}>
              <h4
                className="text-sm font-medium text-gray-700"
                style={{ marginBottom: 'var(--space-sm)' }}
              >
                Location Details
              </h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
                  <span className="font-medium">Type:</span>
                  <span className="capitalize">{geofence.type}</span>
                </div>
                <div className="flex items-start" style={{ gap: 'var(--space-sm)' }}>
                  <span className="font-medium">Coordinates:</span>
                  <span className="font-mono text-xs">{getCoordinatesSummary(geofence)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-between border-t border-gray-200"
          style={{ padding: 'var(--space-lg)' }}
        >
          <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="flex items-center text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md"
              style={{ padding: 'var(--space-sm)', gap: 'var(--space-sm)' }}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>

            {onZoom && (
              <button
                onClick={() => geofence && onZoom(geofence)}
                className="flex items-center text-blue-600 hover:text-blue-700 transition-colors rounded-md"
                style={{ padding: 'var(--space-sm)', gap: 'var(--space-sm)' }}
              >
                <ZoomIn className="h-4 w-4" />
                <span>Zoom to</span>
              </button>
            )}
          </div>

          <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
            <button
              onClick={onClose}
              className="text-gray-700 hover:text-gray-900 border border-gray-300 hover:bg-gray-50 rounded-md font-medium transition-colors"
              style={{ padding: 'var(--space-sm) var(--space-lg)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center"
              style={{ padding: 'var(--space-sm) var(--space-lg)', gap: 'var(--space-sm)' }}
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-md shadow-xl border border-gray-200 max-w-sm mx-4">
            <div style={{ padding: 'var(--space-lg)' }}>
              <div
                className="flex items-center"
                style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Delete Geofence</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <div
                className="bg-gray-50 rounded-md"
                style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}
              >
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-gray-900">&quot;{geofence.name}&quot;</span>?
                </p>
              </div>

              <div className="flex" style={{ gap: 'var(--space-sm)' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-medium transition-colors"
                  style={{ padding: 'var(--space-sm) var(--space-lg)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
                  style={{ padding: 'var(--space-sm) var(--space-lg)' }}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
