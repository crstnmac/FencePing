'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';
import { Map } from '../../components/Map';
import { useGeofences, useDeleteGeofence } from '../../hooks/useApi';
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
  Filter
} from 'lucide-react';

export default function GeofencesPage() {
  const { data: geofences = [], isLoading, error } = useGeofences();
  const deleteGeofenceMutation = useDeleteGeofence();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'polygon' | 'circle'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGeofence, setSelectedGeofence] = useState<any>(null);
  const [showMap, setShowMap] = useState(true);

  // Filter geofences based on search and type
  const filteredGeofences = geofences.filter(geofence => {
    const matchesSearch = geofence.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (geofence.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all';
    return matchesSearch && matchesType;
  });

  const handleGeofenceCreate = (geofence: { type: "polygon" | "circle" | "point"; coordinates: number[][]; center?: [number, number] | undefined; radius?: number | undefined; }) => {
    console.log('Creating geofence:', geofence);
    setShowCreateModal(true);
  };

  const handleGeofenceUpdate = (id: string, geofence: any) => {
    console.log('Updating geofence:', id, geofence);
  };

  const handleGeofenceDelete = async (geofenceId: string) => {
    if (window.confirm('Are you sure you want to delete this geofence?')) {
      try {
        await deleteGeofenceMutation.mutateAsync(geofenceId);
      } catch (err) {
        console.error('Failed to delete geofence:', err);
      }
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

            {/* Toggle Map */}
            <button
              onClick={() => setShowMap(!showMap)}
              className="mt-4 w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center"
            >
              <MapPin className="h-4 w-4 mr-1" />
              {showMap ? 'Hide Map' : 'Show Map'}
            </button>
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
                  <div
                    key={geofence.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
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
                            setSelectedGeofence(geofence);
                            setShowCreateModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGeofenceDelete(geofence.id);
                          }}
                          disabled={deleteGeofenceMutation.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
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
              devices={[]}
              onGeofenceCreate={handleGeofenceCreate}
              onGeofenceUpdate={handleGeofenceUpdate}
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
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {selectedGeofence ? 'Update' : 'Create'} Geofence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}