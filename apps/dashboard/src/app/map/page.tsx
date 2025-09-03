'use client';

import { Header } from '../../components/Header';
import { Map } from '../../components/Map';
import { useGeofences, useDevices } from '../../hooks/useApi';

export default function MapPage() {
  const { data: geofences = [], isLoading: geofencesLoading } = useGeofences();
  const { data: devices = [], isLoading: devicesLoading } = useDevices();

  const isLoading = geofencesLoading || devicesLoading;

  // Convert devices to the format expected by Map component
  const mapDevices = devices
    .filter(device => device.longitude && device.latitude)
    .map(device => ({
      id: device.id,
      name: device.name,
      location: [device.longitude!, device.latitude!] as [number, number],
      lastSeen: device.last_seen || new Date().toISOString(),
      isActive: device.is_active
    }));

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header 
          title="Map View" 
          subtitle="Real-time visualization of devices and geofences"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading map data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Map View" 
        subtitle="Real-time visualization of devices and geofences"
      />
      
      <div className="flex-1 relative">
        <Map
          geofences={geofences.map(geofence => ({
            ...geofence,
            type: geofence.geofence_type
          }))}
          devices={mapDevices}
          onGeofenceCreate={(geofence) => {
            console.log('Create geofence:', geofence);
            // Could open a modal or redirect to geofences page
          }}
          onGeofenceUpdate={(id, geofence) => {
            console.log('Update geofence:', id, geofence);
          }}
        />
      </div>
    </div>
  );
}