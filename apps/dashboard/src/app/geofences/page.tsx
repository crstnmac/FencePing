'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/Header';
import { Map } from '../../components/Map';
import { AutomationRuleModal } from '../../components/AutomationRuleModal';
import { useGeofences, useDeleteGeofence, useCreateGeofence, useUpdateGeofence, useAutomationRulesForGeofence, useDeleteAutomationRule, useToggleAutomationRule, useDevices } from '../../hooks/useApi';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  Circle,
  Square,
  Activity,
  Clock,
  Users,
  Filter,
  Zap,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

export default function GeofencesPage() {
  console.log('🎯 GeofencesPage component is rendering!');
  const { data: geofences = [], isLoading, error } = useGeofences();
  const { data: devices = [] } = useDevices();
  const deleteGeofenceMutation = useDeleteGeofence();
  const createGeofenceMutation = useCreateGeofence();
  const updateGeofenceMutation = useUpdateGeofence();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'polygon' | 'circle'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGeofence, setSelectedGeofence] = useState<any>(null);
  const [showMap, setShowMap] = useState(true);
  const [showAutomationRuleModal, setShowAutomationRuleModal] = useState(false);
  const [selectedGeofenceForRule, setSelectedGeofenceForRule] = useState<string | null>(null);
  const [expandedGeofence, setExpandedGeofence] = useState<string | null>(null);
  const [showDevices, setShowDevices] = useState(true);
  const [pendingGeofence, setPendingGeofence] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  
  // Get automation rules for expanded geofence
  const { data: automationRules = [] } = useAutomationRulesForGeofence(
    expandedGeofence || '', 
    !!expandedGeofence
  );
  const deleteAutomationRuleMutation = useDeleteAutomationRule();
  const toggleAutomationRuleMutation = useToggleAutomationRule();

  // Filter geofences based on search and type
  const filteredGeofences = geofences.filter(geofence => {
    const matchesSearch = geofence.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (geofence.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all';
    return matchesSearch && matchesType;
  });

  const handleGeofenceCreate = (geofence: { type: "polygon" | "circle" | "point"; coordinates: number[][]; center?: [number, number] | undefined; radius?: number | undefined; }) => {
    console.log('Creating geofence:', geofence);
    setPendingGeofence(geofence);
    setFormData({ name: '', description: '' });
    setShowCreateModal(true);
  };

  const handleSaveGeofence = async () => {
    if (!formData.name.trim()) return;

    try {
      if (selectedGeofence) {
        // Update existing geofence
        await updateGeofenceMutation.mutateAsync({
          geofenceId: selectedGeofence.id,
          updates: {
            name: formData.name,
            description: formData.description || undefined
          }
        });
      } else if (pendingGeofence) {
        // Create new geofence
        const geofenceData: any = {
          name: formData.name,
          description: formData.description || undefined,
          type: pendingGeofence.type,
          metadata: {}
        };

        if (pendingGeofence.type === 'circle') {
          geofenceData.center = {
            longitude: pendingGeofence.center![0],
            latitude: pendingGeofence.center![1]
          };
          geofenceData.radius = pendingGeofence.radius || 100;
        } else {
          // Convert coordinates to the expected format for polygon/point
          geofenceData.coordinates = pendingGeofence.coordinates.map((coord: number[]) => ({
            longitude: coord[0],
            latitude: coord[1]
          }));
        }

        await createGeofenceMutation.mutateAsync(geofenceData);
      }

      // Close modal and reset state
      setShowCreateModal(false);
      setSelectedGeofence(null);
      setPendingGeofence(null);
      setFormData({ name: '', description: '' });
    } catch (err) {
      console.error('Failed to save geofence:', err);
      alert('Failed to save geofence. Please try again.');
    }
  };

  const handleGeofenceUpdate = (id: string, geofence: any) => {
    console.log('Updating geofence:', id, geofence);
  };

  // Simple test function with useCallback
  const handleGeofenceDelete = useCallback((geofenceId: string) => {
    // Call the actual delete mutation
    deleteGeofenceMutation.mutate(geofenceId);
  }, [deleteGeofenceMutation]);
  

  const handleGeofenceDeleteFromList = async (geofenceId: string) => {
    if (window.confirm('Are you sure you want to delete this geofence?')) {
      try {
        await deleteGeofenceMutation.mutateAsync(geofenceId);
      } catch (err) {
        console.error('Failed to delete geofence:', err);
      }
    }
  };

  const handleCreateAutomationRule = (geofenceId: string) => {
    setSelectedGeofenceForRule(geofenceId);
    setShowAutomationRuleModal(true);
  };

  const handleToggleGeofenceExpansion = (geofenceId: string) => {
    setExpandedGeofence(prev => prev === geofenceId ? null : geofenceId);
  };

  const handleDeleteAutomationRule = async (ruleId: string) => {
    if (window.confirm('Are you sure you want to delete this automation rule?')) {
      try {
        await deleteAutomationRuleMutation.mutateAsync(ruleId);
      } catch (err) {
        console.error('Failed to delete automation rule:', err);
      }
    }
  };

  const handleToggleAutomationRule = async (ruleId: string, enabled: boolean) => {
    try {
      await toggleAutomationRuleMutation.mutateAsync({ ruleId, enabled });
    } catch (err) {
      console.error('Failed to toggle automation rule:', err);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header 
          title="Geofences" 
          subtitle="Create and manage location-based boundaries for automation triggers"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <Activity className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load geofences</h3>
            <p className="text-gray-500">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Geofences" 
        subtitle="Create and manage location-based boundaries for automation triggers"
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div className="w-1/3 flex flex-col border-r border-gray-200 bg-white">
          {/* Controls */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Geofences ({filteredGeofences.length})</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search geofences..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="polygon">Polygons</option>
                <option value="circle">Circles</option>
              </select>
            </div>

            {/* Toggle Controls */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setShowMap(!showMap)}
                className="w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center"
              >
                <MapPin className="h-4 w-4 mr-1" />
                {showMap ? 'Hide Map' : 'Show Map'}
              </button>
              
              {showMap && (
                <button
                  onClick={() => setShowDevices(!showDevices)}
                  className="w-full text-sm text-gray-600 hover:text-gray-700 flex items-center justify-center"
                >
                  <Users className="h-4 w-4 mr-1" />
                  {showDevices ? 'Hide Devices' : 'Show Devices'}
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading geofences...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredGeofences.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'No matching geofences' : 'No geofences yet'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'Try adjusting your search terms' : 'Start by creating your first geofence'}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Geofence
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Geofences List */}
          {!isLoading && filteredGeofences.length > 0 && (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-2 p-4">
                {filteredGeofences.map((geofence) => (
                  <div key={geofence.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Geofence Header */}
                    <div
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedGeofence(geofence)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-medium text-gray-900">{geofence.name}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              geofence.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {geofence.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {geofence.description && (
                            <p className="text-sm text-gray-600 mb-2">{geofence.description}</p>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(geofence.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateAutomationRule(geofence.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                            title="Create automation rule"
                          >
                            <Zap className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleGeofenceExpansion(geofence.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
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
                                description: geofence.description || ''
                              });
                              setPendingGeofence(null);
                              setShowCreateModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGeofenceDeleteFromList(geofence.id);
                            }}
                            disabled={deleteGeofenceMutation.isPending}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Automation Rules Section */}
                    {expandedGeofence === geofence.id && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            <Zap className="h-4 w-4 mr-1" />
                            Automation Rules
                          </h4>
                          <button
                            onClick={() => handleCreateAutomationRule(geofence.id)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Plus className="h-3 w-3 mr-1 inline" />
                            Add Rule
                          </button>
                        </div>

                        {automationRules.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-2">
                            No automation rules configured for this geofence
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {automationRules.map((rule) => (
                              <div key={rule.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900">{rule.name}</span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                      rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {rule.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Events: {rule.on_events.join(', ')}
                                    {rule.device ? ` • Device: ${rule.device.name}` : ' • All devices'}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleToggleAutomationRule(rule.id, !rule.enabled)}
                                    className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                  >
                                    {rule.enabled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAutomationRule(rule.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                                    title="Delete rule"
                                  >
                                    <Trash2 className="h-3 w-3" />
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

        {/* Right Panel - Map */}
        {showMap && (
          <div className="flex-1 relative">
            <Map
              geofences={filteredGeofences.map(geofence => ({
                ...geofence,
                type: geofence.geofence_type
              }))}
              devices={showDevices ? devices
                .filter(device => device.longitude && device.latitude) // Only show devices with known locations
                .map(device => ({
                  id: device.id,
                  name: device.name,
                  location: [device.longitude!, device.latitude!] as [number, number],
                  lastSeen: device.last_seen || new Date().toISOString(),
                  isActive: device.status === 'online'
                })) : []
              }
              onGeofenceCreate={handleGeofenceCreate}
              onGeofenceUpdate={handleGeofenceUpdate}
              onGeofenceDelete={handleGeofenceDelete}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {selectedGeofence ? 'Edit Geofence' : 'Create New Geofence'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Geofence Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter geofence name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <p className="text-sm text-gray-500">
                Use the map to draw the geofence boundary, then fill in the details here.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedGeofence(null);
                  setPendingGeofence(null);
                  setFormData({ name: '', description: '' });
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGeofence}
                disabled={createGeofenceMutation.isPending || updateGeofenceMutation.isPending || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createGeofenceMutation.isPending || updateGeofenceMutation.isPending ? 'Saving...' : (selectedGeofence ? 'Update' : 'Create')} Geofence
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
          // Optionally show a success notification here
        }}
      />
    </div>
  );
}