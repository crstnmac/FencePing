'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Smartphone, 
  Zap, 
  Clock, 
  Target,
  Users
} from 'lucide-react';
import { 
  useDevices, 
  useGeofences, 
  useAutomations, 
  useCreateAutomationRule,
  useUpdateAutomationRule,
  type AutomationRule,
  type CreateAutomationRuleRequest
} from '../hooks/useApi';

interface AutomationRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule?: AutomationRule | null; // For editing existing rules
  preselectedGeofenceId?: string;
  preselectedDeviceId?: string;
  onSuccess?: (rule: AutomationRule) => void;
}

export function AutomationRuleModal({
  isOpen,
  onClose,
  rule,
  preselectedGeofenceId,
  preselectedDeviceId,
  onSuccess
}: AutomationRuleModalProps) {
  const { data: devices = [] } = useDevices();
  const { data: geofences = [] } = useGeofences();
  const { data: automations = [] } = useAutomations();
  
  const createRuleMutation = useCreateAutomationRule();
  const updateRuleMutation = useUpdateAutomationRule();

  const [formData, setFormData] = useState<CreateAutomationRuleRequest>({
    name: '',
    geofence_id: preselectedGeofenceId || '',
    device_id: preselectedDeviceId || undefined,
    automation_id: '',
    on_events: ['enter'],
    min_dwell_seconds: undefined,
    device_filter: {},
    enabled: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or rule changes
  useEffect(() => {
    if (isOpen) {
      if (rule) {
        // Editing existing rule
        setFormData({
          name: rule.name,
          geofence_id: rule.geofence_id,
          device_id: rule.device_id,
          automation_id: rule.automation_id,
          on_events: rule.on_events,
          min_dwell_seconds: rule.min_dwell_seconds,
          device_filter: rule.device_filter,
          enabled: rule.enabled,
        });
      } else {
        // Creating new rule
        setFormData({
          name: '',
          geofence_id: preselectedGeofenceId || '',
          device_id: preselectedDeviceId || undefined,
          automation_id: '',
          on_events: ['enter'],
          min_dwell_seconds: undefined,
          device_filter: {},
          enabled: true,
        });
      }
      setErrors({});
    }
  }, [isOpen, rule, preselectedGeofenceId, preselectedDeviceId]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (!formData.geofence_id) {
      newErrors.geofence_id = 'Please select a geofence';
    }

    if (!formData.automation_id) {
      newErrors.automation_id = 'Please select an automation';
    }

    if (formData.on_events.length === 0) {
      newErrors.on_events = 'Please select at least one trigger event';
    }

    if (formData.on_events.includes('dwell') && (!formData.min_dwell_seconds || formData.min_dwell_seconds < 1)) {
      newErrors.min_dwell_seconds = 'Minimum dwell time is required for dwell events';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      let result: AutomationRule;
      
      if (rule) {
        // Update existing rule
        result = await updateRuleMutation.mutateAsync({
          ruleId: rule.id,
          updates: formData
        });
      } else {
        // Create new rule
        result = await createRuleMutation.mutateAsync(formData);
      }

      onSuccess?.(result);
      onClose();
    } catch (error: any) {
      console.error('Failed to save automation rule:', error);
      setErrors({ submit: error.message || 'Failed to save automation rule' });
    }
  };

  const handleEventToggle = (event: 'enter' | 'exit' | 'dwell') => {
    setFormData(prev => ({
      ...prev,
      on_events: prev.on_events.includes(event)
        ? prev.on_events.filter(e => e !== event)
        : [...prev.on_events, event]
    }));
  };

  if (!isOpen) return null;

  const isLoading = createRuleMutation.isPending || updateRuleMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {rule ? 'Edit Automation Rule' : 'Create Automation Rule'}
                </h2>
                <p className="text-sm text-gray-500">
                  Connect devices and geofences to trigger automations
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Rule Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rule Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Office Entry Alert"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Geofence Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="h-4 w-4 inline mr-1" />
              Geofence <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.geofence_id}
              onChange={(e) => setFormData(prev => ({ ...prev, geofence_id: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.geofence_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a geofence...</option>
              {geofences.map(geofence => (
                <option key={geofence.id} value={geofence.id}>
                  {geofence.name} ({geofence.geofence_type})
                </option>
              ))}
            </select>
            {errors.geofence_id && <p className="mt-1 text-sm text-red-600">{errors.geofence_id}</p>}
          </div>

          {/* Device Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Smartphone className="h-4 w-4 inline mr-1" />
              Device (Optional)
            </label>
            <select
              value={formData.device_id || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                device_id: e.target.value || undefined 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All devices</option>
              {devices.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.device_type})
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Leave empty to apply rule to all devices
            </p>
          </div>

          {/* Trigger Events */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Target className="h-4 w-4 inline mr-1" />
              Trigger Events <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {[
                { value: 'enter', label: 'Enter Geofence', description: 'When device enters the geofence area' },
                { value: 'exit', label: 'Exit Geofence', description: 'When device leaves the geofence area' },
                { value: 'dwell', label: 'Dwell in Geofence', description: 'When device stays in geofence for specified time' }
              ].map(({ value, label, description }) => (
                <label key={value} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.on_events.includes(value as any)}
                    onChange={() => handleEventToggle(value as any)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{label}</div>
                    <div className="text-xs text-gray-500">{description}</div>
                  </div>
                </label>
              ))}
            </div>
            {errors.on_events && <p className="mt-1 text-sm text-red-600">{errors.on_events}</p>}
          </div>

          {/* Dwell Time (only show if dwell event is selected) */}
          {formData.on_events.includes('dwell') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="h-4 w-4 inline mr-1" />
                Minimum Dwell Time (seconds) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.min_dwell_seconds || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  min_dwell_seconds: parseInt(e.target.value) || undefined 
                }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.min_dwell_seconds ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="300"
              />
              {errors.min_dwell_seconds && <p className="mt-1 text-sm text-red-600">{errors.min_dwell_seconds}</p>}
              <p className="mt-1 text-sm text-gray-500">
                How long the device must stay in the geofence before triggering
              </p>
            </div>
          )}

          {/* Automation Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="h-4 w-4 inline mr-1" />
              Automation <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.automation_id}
              onChange={(e) => setFormData(prev => ({ ...prev, automation_id: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.automation_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select an automation...</option>
              {automations.map(automation => (
                <option key={automation.id} value={automation.id}>
                  {automation.name}
                </option>
              ))}
            </select>
            {errors.automation_id && <p className="mt-1 text-sm text-red-600">{errors.automation_id}</p>}
            {automations.length === 0 && (
              <p className="mt-1 text-sm text-amber-600">
                No automations available. Create an automation first.
              </p>
            )}
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
              Enable this rule immediately
            </label>
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{rule ? 'Updating...' : 'Creating...'}</span>
                </div>
              ) : (
                rule ? 'Update Rule' : 'Create Rule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}