'use client';

import { useState, useCallback, useMemo } from 'react';
import { Header } from '../../components/Header';
import { GeofenceMap } from '../../components/GeofenceMap';
import { AutomationRuleModal } from '../../components/AutomationRuleModal';
import { GeofenceTemplates } from '../../components/GeofenceTemplates';
import { GeofenceAnalytics } from '../../components/GeofenceAnalytics';
import { GeofenceTestingTools } from '../../components/GeofenceTestingTools';
import { GeofenceSettings } from '../../components/GeofenceSettings';
import {
  useGeofences,
  useCreateGeofence,
  useUpdateGeofence,
  useBatchGeofenceOperations,
} from '../../hooks/useGeofenceOperations';
import {
  useAutomationRulesForGeofence,
  useDeleteAutomationRule,
  useToggleAutomationRule,
  useDevices,
} from '../../hooks/useApi';
import { FrontendGeofence } from '../../types/geofence';
import { validateGeometry } from '../../validation/geofenceSchemas';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Map,
  Layout,
  BarChart3,
  TestTube,
  Settings,
  MapPin,
  Zap,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function GeofencesPage() {
  // State management
  const [activeTab, setActiveTab] = useState<
    'map' | 'templates' | 'analytics' | 'testing' | 'settings'
  >('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGeofence, setSelectedGeofence] = useState<FrontendGeofence | null>(null);
  const [showAutomationRuleModal, setShowAutomationRuleModal] = useState(false);
  const [selectedGeofenceForRule, setSelectedGeofenceForRule] = useState<string | null>(null);
  const [expandedGeofence, setExpandedGeofence] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [pendingGeofence, setPendingGeofence] = useState<Omit<FrontendGeofence, 'id'> | null>(null); // For drawn geofences

  // Data fetching
  const { geofences, isLoading: geofencesLoading, error: geofencesError, refetch } = useGeofences();
  const { data: devices = [] } = useDevices();

  // Mutations
  const createGeofenceMutation = useCreateGeofence();
  const updateGeofenceMutation = useUpdateGeofence();
  const {
    deleteGeofences,
    duplicateGeofences,
    isLoading: batchLoading,
  } = useBatchGeofenceOperations();

  // Get automation rules for expanded geofence
  const { data: automationRules = [] } = useAutomationRulesForGeofence(
    expandedGeofence || '',
    !!expandedGeofence
  );
  const deleteAutomationRuleMutation = useDeleteAutomationRule();
  const toggleAutomationRuleMutation = useToggleAutomationRule();

  // Computed values
  const filteredGeofences = useMemo(() => {
    if (!searchTerm.trim()) return geofences;

    const searchLower = searchTerm.toLowerCase();
    return geofences.filter(
      (geofence) =>
        geofence.name.toLowerCase().includes(searchLower) ||
        (geofence.description || '').toLowerCase().includes(searchLower)
    );
  }, [geofences, searchTerm]);

  const isLoading =
    geofencesLoading ||
    createGeofenceMutation.isPending ||
    updateGeofenceMutation.isPending ||
    batchLoading;

  // Event handlers
  const handleGeofenceCreate = useCallback((geofence: Omit<FrontendGeofence, 'id'>) => {
    console.log('🔍 Received geofence for creation:', geofence);
    console.log('🔍 Geometry to validate:', geofence.geometry);

    // Validate geometry before creating
    const validatedGeometry = validateGeometry(geofence.geometry);
    if (!validatedGeometry) {
      console.error('❌ Invalid geometry for geofence creation:', geofence.geometry);
      console.error('❌ Expected format: GeoJSON Point/Polygon with valid coordinates');

      // Try to fix common geometry issues
      console.log('🔧 Attempting to fix geometry...');

      // For circles, Terra Draw might be giving us a polygon when we need a point
      if (geofence.type === 'circle' && geofence.geometry?.type === 'Polygon') {
        console.log('🟡 Converting circle polygon to point geometry');
        const coords = geofence.geometry.coordinates as number[][];
        if (coords && coords[0] && coords[0].length >= 2) {
          // Use first coordinate as center
          const center = coords;
          geofence.geometry = {
            type: 'Point',
            coordinates: center,
          };
          console.log('✅ Fixed circle geometry:', geofence.geometry);
        }
      }

      // Re-validate after potential fix
      const revalidatedGeometry = validateGeometry(geofence.geometry);
      if (!revalidatedGeometry) {
        console.error('❌ Still invalid after attempted fix, aborting creation');
        return;
      }
    }

    console.log('🎨 Geofence drawn, showing creation modal:', geofence);

    // Store the pending geofence and show the modal
    setPendingGeofence(geofence);
    setFormData({
      name: geofence.name || `New ${geofence.type} geofence`,
      description: geofence.description || '',
    });
    setSelectedGeofence(null); // Ensure we're in create mode
    setShowCreateModal(true);
  }, []);

  const handleGeofenceUpdate = useCallback(
    (id: string, updates: Partial<FrontendGeofence>) => {
      // Validate geometry if it's being updated
      if (updates.geometry && !validateGeometry(updates.geometry)) {
        console.error('Invalid geometry for geofence update');
        return;
      }

      updateGeofenceMutation.mutate({ geofenceId: id, updates });
    },
    [updateGeofenceMutation]
  );

  const handleGeofenceDelete = useCallback(
    (ids: string[]) => {
      deleteGeofences.mutate(ids);
    },
    [deleteGeofences]
  );

  const handleGeofenceDuplicate = useCallback(
    (ids: string[]) => {
      duplicateGeofences.mutate(ids);
    },
    [duplicateGeofences]
  );

  const handleGeofenceDeleteFromList = useCallback(
    (geofenceId: string) => {
      const geofence = geofences.find((g) => g.id === geofenceId);
      if (geofence && window.confirm(`Are you sure you want to delete "${geofence.name}"?`)) {
        deleteGeofences.mutate([geofenceId]);
      }
    },
    [geofences, deleteGeofences]
  );

  const handleSaveGeofence = useCallback(async () => {
    if (!formData.name.trim()) return;

    try {
      if (selectedGeofence) {
        // Update existing geofence
        await updateGeofenceMutation.mutateAsync({
          geofenceId: selectedGeofence.id,
          updates: {
            name: formData.name,
            description: formData.description || undefined,
          },
        });
      } else if (pendingGeofence) {
        // Create new geofence from drawing
        const geofenceToCreate = {
          ...pendingGeofence,
          name: formData.name,
          description: formData.description || undefined,
        };

        console.log('💾 Creating geofence from modal:', geofenceToCreate);
        await createGeofenceMutation.mutateAsync(geofenceToCreate);
      }

      // Close modal and reset state
      setShowCreateModal(false);
      setSelectedGeofence(null);
      setPendingGeofence(null);
      setFormData({ name: '', description: '' });
    } catch (err) {
      // Error handling is done by the mutation
      console.error('Failed to save geofence:', err);
    }
  }, [formData, selectedGeofence, pendingGeofence, updateGeofenceMutation, createGeofenceMutation]);

  const handleCreateAutomationRule = useCallback((geofenceId: string) => {
    setSelectedGeofenceForRule(geofenceId);
    setShowAutomationRuleModal(true);
  }, []);

  const handleToggleGeofenceExpansion = useCallback((geofenceId: string) => {
    setExpandedGeofence((prev) => (prev === geofenceId ? null : geofenceId));
  }, []);

  const handleDeleteAutomationRule = useCallback(
    async (ruleId: string) => {
      if (window.confirm('Are you sure you want to delete this automation rule?')) {
        try {
          await deleteAutomationRuleMutation.mutateAsync(ruleId);
        } catch (err) {
          console.error('Failed to delete automation rule:', err);
        }
      }
    },
    [deleteAutomationRuleMutation]
  );

  const handleToggleAutomationRule = useCallback(
    async (ruleId: string, enabled: boolean) => {
      try {
        await toggleAutomationRuleMutation.mutateAsync({ ruleId, enabled });
      } catch (err) {
        console.error('Failed to toggle automation rule:', err);
      }
    },
    [toggleAutomationRuleMutation]
  );

  // Error state
  if (geofencesError) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Geofences"
          subtitle="Create and manage location-based boundaries for automation triggers"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load geofences</h3>
            <p className="text-gray-500 mb-4">There was a problem loading your geofences.</p>
            <button
              onClick={() => refetch()}
              className=" bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      <Header
        title="Geofences"
        subtitle="Create and manage location-based boundaries for automation triggers"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-80 flex flex-col border-r border-neutral-200 bg-white">
          {/* Controls */}
          <div className="p-3 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-medium text-neutral-900">Geofences</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  {filteredGeofences.length}{' '}
                  {filteredGeofences.length === 1 ? 'boundary' : 'boundaries'}
                </p>
              </div>
              {isLoading && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search boundaries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all duration-150 bg-neutral-50 focus:bg-white"
              />
            </div>

            {/* Add Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-all duration-150 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Geofence
            </button>
          </div>

          {/* Loading State */}
          {geofencesLoading && (
            <div className="flex-1 flex items-center justify-center p-3">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-300 border-t-neutral-900 mx-auto mb-4"></div>
                <p className="text-neutral-600 text-sm">Loading boundaries...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!geofencesLoading && filteredGeofences.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-3">
              <div className="text-center max-w-xs">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">
                  {searchTerm ? 'No matching boundaries' : 'No boundaries yet'}
                </h3>
                <p className="text-neutral-600 text-sm leading-relaxed">
                  {searchTerm
                    ? "Try adjusting your search terms to find what you're looking for."
                    : 'Create your first geofence boundary by drawing on the map or using our templates.'}
                </p>
              </div>
            </div>
          )}

          {/* Geofences List */}
          {!geofencesLoading && filteredGeofences.length > 0 && (
            <div className="flex-1 overflow-y-auto premium-scrollbar">
              <div className="p-2 space-y-3">
                {filteredGeofences.map((geofence) => (
                  <div
                    key={geofence.id}
                    className="group bg-white border border-neutral-200 rounded-md overflow-hidden hover:shadow-md hover:border-neutral-300 transition-all duration-150"
                  >
                    {/* Geofence Header */}
                    <div
                      className="p-2 cursor-pointer"
                      onClick={() => setSelectedGeofence(geofence)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-neutral-900 truncate text-sm">
                              {geofence.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-3 py-2 rounded-md text-xs font-medium ${
                                geofence.is_active
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                              }`}
                            >
                              {geofence.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {geofence.description && (
                            <p className="text-xs text-neutral-600 mb-3 line-clamp-2 leading-relaxed">
                              {geofence.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-neutral-500">
                            <span className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: geofence.color }}
                              />
                              <span className="capitalize">{geofence.type}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateAutomationRule(geofence.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100 transition-colors"
                            title="Create automation rule"
                          >
                            <Zap className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleGeofenceExpansion(geofence.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100 transition-colors"
                            title="View automation rules"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGeofence(geofence);
                              setFormData({
                                name: geofence.name,
                                description: geofence.description || '',
                              });
                              setShowCreateModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGeofenceDeleteFromList(geofence.id);
                            }}
                            disabled={deleteGeofences.isPending}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Automation Rules Section */}
                    {expandedGeofence === geofence.id && (
                      <div className="border-t border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            <Zap className="h-4 w-4 mr-2" />
                            Automation Rules
                          </h4>
                          <button
                            onClick={() => handleCreateAutomationRule(geofence.id)}
                            className="flex items-center space-x-1 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Rule</span>
                          </button>
                        </div>

                        {automationRules.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No automation rules configured for this geofence
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {automationRules.map((rule) => (
                              <div
                                key={rule.id}
                                className="flex items-center justify-between p-3 bg-white rounded-md border shadow-sm"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {rule.name}
                                    </span>
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        rule.enabled
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {rule.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Events: {rule.on_events.join(', ')}
                                    {rule.device
                                      ? ` • Device: ${rule.device.name}`
                                      : ' • All devices'}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-3 shrink-0">
                                  <button
                                    onClick={() =>
                                      handleToggleAutomationRule(rule.id, !rule.enabled)
                                    }
                                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100 transition-colors"
                                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                  >
                                    {rule.enabled ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAutomationRule(rule.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors"
                                    title="Delete rule"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Tabbed Content */}
        <div className="flex-1 flex flex-col">
          {/* Tab Navigation */}
          <div className="border-b border-neutral-200 bg-white px-6">
            <nav className="flex space-x-8">
              {[
                { id: 'map', label: 'Map View', icon: Map },
                { id: 'templates', label: 'Templates', icon: Layout },
                { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                { id: 'testing', label: 'Testing', icon: TestTube },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-150 ${
                      activeTab === tab.id
                        ? 'border-neutral-900 text-neutral-900'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 relative">
            {activeTab === 'map' && (
              <GeofenceMap
                geofences={filteredGeofences}
                devices={devices
                  .filter((device) => device.longitude && device.latitude)
                  .map((device) => ({
                    id: device.id,
                    name: device.name,
                    latitude: device.latitude!,
                    longitude: device.longitude!,
                    lastSeen: new Date(device.last_seen || Date.now()),
                    isOnline: device.status === 'online',
                  }))}
                onGeofenceCreate={handleGeofenceCreate}
                onGeofenceUpdate={handleGeofenceUpdate}
                onGeofenceDelete={handleGeofenceDelete}
                onGeofenceDuplicate={handleGeofenceDuplicate}
              />
            )}

            {activeTab === 'templates' && (
              <GeofenceTemplates
                onTemplateSelect={(template) => {
                  // Convert template to geofence format and trigger creation
                  const geofence = {
                    name: template.name,
                    description: template.description,
                    geometry:
                      template.shape === 'circle' && template.center
                        ? { type: 'Point' as const, coordinates: template.center }
                        : { type: 'Polygon' as const, coordinates: template.coordinates || [] },
                    radius: template.radius,
                    color: template.color,
                    is_active: true,
                    type: template.shape as 'circle' | 'polygon',
                  };
                  handleGeofenceCreate(geofence);
                }}
              />
            )}

            {activeTab === 'analytics' && (
              <GeofenceAnalytics
                data={{
                  geofenceEvents: [], // TODO: Fetch real events data
                  geofences: filteredGeofences.map((g) => ({
                    id: g.id,
                    name: g.name,
                    category: g.type, // Using type as category for now
                    isActive: g.is_active,
                    created: new Date(), // TODO: Add created date to geofence schema
                  })),
                  devices: devices.map((d) => ({
                    id: d.id,
                    name: d.name,
                    lastActive: new Date(d.last_seen || Date.now()),
                    totalEvents: 0, // TODO: Add events count
                  })),
                }}
              />
            )}

            {activeTab === 'testing' && <GeofenceTestingTools geofences={filteredGeofences} />}

            {activeTab === 'settings' && (
              <GeofenceSettings
                settings={{
                  accuracyThreshold: 5,
                  hysteresisBuffer: 2,
                  dwellTimeThreshold: 30,
                  updateInterval: 5,
                  batchingEnabled: true,
                  batchSize: 10,
                  retryAttempts: 3,
                  retryDelay: 5,
                  healthCheckInterval: 60,
                  alertOnFailure: true,
                  alertThreshold: 10,
                  dataEncryption: true,
                  anonymizeLocation: false,
                  locationPrecision: 6,
                  dataRetention: 90,
                  auditLogging: true,
                  lowPowerMode: false,
                  wifiOptimization: true,
                  cellularFallback: true,
                  adaptiveSampling: true,
                  batteryThreshold: 20,
                  silentHours: {
                    enabled: false,
                    start: '22:00',
                    end: '07:00',
                  },
                  priorityGeofences: [],
                  notificationCooldown: 300,
                  machineLearning: false,
                  predictiveAnalytics: false,
                  anomalyDetection: false,
                  loadBalancing: true,
                  caching: true,
                }}
                onSettingsChange={(settings) => console.log('Settings changed:', settings)}
                onOptimize={() => console.log('Optimizing geofences...')}
                onReset={() => console.log('Resetting settings...')}
                performance={{
                  accuracy: 95,
                  latency: 45,
                  batteryUsage: 32,
                  networkUsage: 12,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
          <div className="bg-white rounded-md p-3 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold mb-6 text-gray-900">
              {selectedGeofence ? 'Edit Geofence' : 'Create New Geofence'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Geofence Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter geofence name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Enter description (optional)"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <p className="text-sm text-gray-500 italic">
                {pendingGeofence
                  ? 'Geofence boundary drawn successfully. Enter the name and description to complete creation.'
                  : 'Use the map to draw the geofence boundary, then fill in the details here.'}
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-8">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedGeofence(null);
                  setPendingGeofence(null); // Clear pending geofence on cancel
                  setFormData({ name: '', description: '' });
                }}
                className=".5 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGeofence}
                disabled={
                  updateGeofenceMutation.isPending ||
                  createGeofenceMutation.isPending ||
                  !formData.name.trim()
                }
                className=".5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {(updateGeofenceMutation.isPending || createGeofenceMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span>{selectedGeofence ? 'Update' : 'Create'} Geofence</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automation Rule Modal */}
      <AutomationRuleModal
        isOpen={showAutomationRuleModal}
        onClose={() => {
          setShowAutomationRuleModal(false);
          setSelectedGeofenceForRule(null);
        }}
        preselectedGeofenceId={selectedGeofenceForRule || undefined}
        onSuccess={(rule) => {
          console.log('Automation rule created/updated:', rule);
        }}
      />
    </div>
  );
}
