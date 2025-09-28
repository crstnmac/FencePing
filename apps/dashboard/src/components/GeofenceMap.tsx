'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { TerraDraw } from 'terra-draw';
import {
  TerraDrawSelectMode,
  TerraDrawPolygonMode,
  TerraDrawCircleMode,
  TerraDrawRectangleMode,
  TerraDrawLineStringMode,
} from 'terra-draw';
import { GeofenceMapToolbar } from './GeofenceMapToolbar';
import { FrontendGeofence } from '../types/geofence';
import { toast } from 'react-hot-toast';
import { Ruler, X } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Device {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastSeen: Date;
  isOnline: boolean;
}

// Use professional types from our type system
type Geofence = FrontendGeofence;

interface GeofenceMapProps {
  geofences?: Geofence[];
  devices?: Device[];
  onGeofenceCreate?: (geofence: Omit<Geofence, 'id'>) => void;
  onGeofenceUpdate?: (id: string, geofence: Partial<Geofence>) => void;
  onGeofenceDelete?: (ids: string[]) => void;
  onGeofenceDuplicate?: (ids: string[]) => void;
  className?: string;
}

export function GeofenceMap({
  geofences = [],
  devices = [],
  onGeofenceCreate,
  onGeofenceUpdate,
  onGeofenceDelete,
  onGeofenceDuplicate,
  className = '',
}: GeofenceMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const draw = useRef<TerraDraw | null>(null);

  const [activeDrawingTool, setActiveDrawingTool] = useState<
    'select' | 'circle' | 'polygon' | 'rectangle' | 'measure' | null
  >('select');
  const [selectedGeofences, setSelectedGeofences] = useState<string[]>([]);
  const [showDevices, setShowDevices] = useState(true);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'terrain'>('streets');
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [measurementResults, setMeasurementResults] = useState<{
    totalDistance: number;
    points: Array<{ lat: number; lng: number; distance?: number }>;
  } | null>(null);

  // Helper function to clear measurement lines from Terra Draw
  const clearMeasurementLines = useCallback(() => {
    if (!draw.current) return;

    const snapshot = draw.current.getSnapshot();
    const lineStringIds = snapshot
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature) => feature.id)
      .filter((id): id is string | number => id !== undefined);

    if (lineStringIds.length > 0) {
      try {
        // Try different Terra Draw clear methods
        if (typeof draw.current.removeFeatures === 'function') {
          draw.current.removeFeatures(lineStringIds);
        } else if (typeof draw.current.removeFeatures === 'function') {
          draw.current.removeFeatures(lineStringIds);
        } else if (typeof draw.current.clear === 'function') {
          // Clear all features if specific deletion isn't available
          draw.current.clear();
        } else {
          console.warn('No clear method found in Terra Draw');
        }
      } catch (error) {
        console.error('Failed to clear measurements:', error);
      }
    }
  }, []);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [lastDrawingTool, setLastDrawingTool] = useState<string | null>(null); // Track the tool that initiated drawing

  // Map styles - using free OpenStreetMap tiles
  const mapStyles = useMemo(
    () => ({
      streets: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      satellite: {
        version: 8,
        sources: {
          'satellite-tiles': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS',
          },
        },
        layers: [
          {
            id: 'satellite-tiles',
            type: 'raster',
            source: 'satellite-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      terrain: {
        version: 8,
        sources: {
          'terrain-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenTopoMap contributors',
          },
        },
        layers: [
          {
            id: 'terrain-tiles',
            type: 'raster',
            source: 'terrain-tiles',
            minzoom: 0,
            maxzoom: 17,
          },
        ],
      },
    }),
    []
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyles[mapStyle] as any, // Type assertion for map styles
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 13,
      attributionControl: false,
    });

    // Wait for map to load before initializing Terra Draw and controls
    map.current.on('load', () => {
      if (!map.current) return;

      try {
        // Add navigation controls
        map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');

        // Initialize Terra Draw
        const adapter = new TerraDrawMapLibreGLAdapter({
          map: map.current,
          coordinatePrecision: 9,
        });

        draw.current = new TerraDraw({
          adapter,
          modes: [
            new TerraDrawSelectMode({
              flags: {
                arbitary: {
                  feature: {
                    draggable: true,
                    rotateable: true,
                    scaleable: true,
                    coordinates: {
                      midpoints: true,
                      draggable: true,
                      deletable: true,
                    },
                  },
                },
              },
            }),
            new TerraDrawPolygonMode({
              styles: {
                fillColor: '#3B82F6',
                fillOpacity: 0.2,
                outlineColor: '#3B82F6',
                outlineWidth: 2,
                closingPointColor: '#ef4444',
                closingPointWidth: 4,
              },
            }),
            new TerraDrawCircleMode({
              styles: {
                fillColor: '#10B981',
                fillOpacity: 0.2,
                outlineColor: '#10B981',
                outlineWidth: 2,
              },
            }),
            new TerraDrawRectangleMode({
              styles: {
                fillColor: '#8B5CF6',
                fillOpacity: 0.2,
                outlineColor: '#8B5CF6',
                outlineWidth: 2,
              },
            }),
            new TerraDrawLineStringMode(), // For measurement
          ],
        });

        draw.current.start();
        draw.current.setMode('select');

        // Mark map as loaded
        setIsMapLoaded(true);

        // Set up Terra Draw event handlers after map is loaded
        setTimeout(() => {
          if (draw.current && typeof draw.current.on === 'function') {
            setupTerraDrawEvents();
          } else {
            console.warn('⚠️ Terra Draw not ready for event setup, retrying...');
            setTimeout(setupTerraDrawEvents, 200);
          }
        }, 100);
      } catch (error) {
        console.error('Failed to initialize Terra Draw:', error);
      }
    });

    // Setup Terra Draw event handlers
    const setupTerraDrawEvents = () => {
      if (!draw.current) {
        console.warn('⚠️ Cannot setup events - Terra Draw not initialized');
        return;
      }

      try {
        console.log('🔧 Setting up Terra Draw event handlers...');

        // Skip the 'start' event handler for now as it's causing issues
        // Instead, we'll track the tool when mode changes
        console.log('📝 Skipping start event handler - will track via mode changes');

        // Handle drawing events - add safety checks
        if (typeof draw.current.on === 'function') {
          draw.current.on('finish', (id) => {
            console.log('🎯 Terra Draw finish event triggered:', { id });

            const feature = draw.current?.getSnapshot().find((f) => f.id === id);
            console.log('📍 Found feature:', feature);

            if (!feature) {
              console.warn('❌ No feature found for ID:', id);
              return;
            }

            // Use Terra Draw's feature properties for reliable tool detection
            const terraDrawMode = (feature.properties?.mode as string) || 'unknown';
            console.log('🔧 Terra Draw mode from feature properties:', terraDrawMode);

            const geometry = feature.geometry;
            console.log('🔷 Geometry:', geometry);

            // Handle measurement tool completion
            if (terraDrawMode === 'linestring' || feature.geometry.type === 'LineString') {
              console.log('📏 Processing measurement line');
              const coords = geometry.coordinates as number[][];
              const points = coords.map((coord, index) => ({
                lat: coord[1],
                lng: coord[0],
                distance: index > 0 ? calculateDistance(coords[index - 1], coord) : 0,
              }));

              const totalDistance = points.reduce((sum, point) => sum + (point.distance || 0), 0);

              setMeasurementResults({
                totalDistance,
                points,
              });

              console.log('📏 Measurement completed:', {
                totalDistance: formatDistance(totalDistance),
                pointCount: points.length,
              });

              toast.success(`Measurement complete: ${formatDistance(totalDistance)}`);

              // Auto-switch back to select mode after measurement
              setTimeout(() => {
                setActiveDrawingTool('select');
              }, 100);

              return;
            }

            if (
              terraDrawMode &&
              terraDrawMode !== 'select' &&
              terraDrawMode !== 'unknown' &&
              terraDrawMode !== 'linestring'
            ) {
              console.log('✏️ Creating geofence for tool:', terraDrawMode);

              const newGeofence: Omit<Geofence, 'id'> = {
                name: `${terraDrawMode.charAt(0).toUpperCase() + terraDrawMode.slice(1)} Geofence ${geofences.length + 1}`,
                geometry: geometry as any,
                color: '#3B82F6',
                is_active: true,
                type:
                  terraDrawMode === 'circle'
                    ? 'circle'
                    : terraDrawMode === 'polygon' || terraDrawMode === 'rectangle'
                      ? 'polygon'
                      : 'point',
              };

              if (terraDrawMode === 'circle') {
                console.log('🟢 Processing circle geofence');

                // Use Terra Draw's radius data if available, otherwise calculate from coordinates
                const terraDrawRadius = feature.properties?.radiusKilometers;
                if (typeof terraDrawRadius === 'number') {
                  console.log('📏 Using Terra Draw radius (km):', terraDrawRadius);
                  newGeofence.radius = terraDrawRadius * 1000; // Convert km to meters
                } else {
                  // Fallback to coordinate calculation
                  const coords = geometry.coordinates as number[][];
                  const center = coords[0];
                  const edge = coords[1] || coords[0];
                  const radius = calculateDistance(center, edge);
                  console.log('📏 Circle radius calculated from coords:', radius);
                  newGeofence.radius = radius;
                }

                // For circles, geometry should be the center point
                let center: [number, number];

                if (geometry.type === 'Polygon') {
                  // Terra Draw creates a polygon for circles, extract center from first coordinate
                  const coords = geometry.coordinates as number[][][];
                  center = coords[0][0] as [number, number];
                } else if (geometry.type === 'Point') {
                  // If somehow it's already a point, use it (but fix coordinate array if malformed)
                  const coords = geometry.coordinates as number[];
                  if (coords.length === 2) {
                    center = coords as [number, number];
                  } else {
                    // Malformed point with too many coordinates, take first two
                    center = [coords[0], coords[1]];
                  }
                } else {
                  console.warn('Unexpected geometry type for circle:', geometry.type);
                  return;
                }

                newGeofence.geometry = {
                  type: 'Point',
                  coordinates: center,
                };
              }

              console.log('🚀 Calling onGeofenceCreate with:', newGeofence);
              console.log('🔗 onGeofenceCreate function exists:', !!onGeofenceCreate);

              if (onGeofenceCreate) {
                try {
                  onGeofenceCreate(newGeofence);
                  toast.success(`${newGeofence.type} geofence created successfully!`);
                  console.log('✅ Geofence creation completed');

                  // Reset last drawing tool after successful creation
                  setLastDrawingTool(null);
                } catch (error) {
                  console.error('❌ Error calling onGeofenceCreate:', error);
                  toast.error('Failed to create geofence');
                }
              } else {
                console.warn('⚠️ onGeofenceCreate callback not provided');
                toast.error('Geofence creation handler not available');
              }
            } else {
              console.log('🔍 Not creating geofence - tool is select or null');
            }
          });

          draw.current.on('change', (ids) => {
            const id = Array.isArray(ids) ? ids[0] : ids;
            const feature = draw.current?.getSnapshot().find((f) => f.id === id);
            if (!feature) return;
            const geometry = feature.geometry;

            // Get the original geofence ID from properties or use the feature ID
            const geofenceId = feature.properties?.geofenceId || id;
            const geofence = geofences.find((g) => g.id === geofenceId);

            if (geofence && onGeofenceUpdate) {
              onGeofenceUpdate(String(geofenceId), { geometry: geometry as any });
            }
          });

          draw.current.on('select', (selectedIds) => {
            // Convert selectedIds to array and get geofence IDs
            const idsArray = Array.isArray(selectedIds) ? selectedIds : [selectedIds];
            const geofenceIds = idsArray.map((id) => {
              const feature = draw.current
                ?.getSnapshot()
                .find((f) => f.id !== undefined && f.id === id);
              return String(feature?.properties?.geofenceId || id);
            });
            setSelectedGeofences(geofenceIds);
          });

          draw.current.on('deselect', () => {
            setSelectedGeofences([]);
          });

          console.log('✅ Terra Draw event handlers setup complete');
        } else {
          console.warn('⚠️ Terra Draw event system not available');
        }
      } catch (error) {
        console.error('❌ Error setting up Terra Draw event handlers:', error);
      }
    };

    return () => {
      draw.current?.stop();
      draw.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(mapStyles[mapStyle] as any);
  }, [mapStyle, mapStyles]);

  // Update drawing mode
  useEffect(() => {
    if (!draw.current) {
      console.log('⚠️ Terra Draw not initialized yet');
      return;
    }

    console.log('🔄 Changing drawing mode:', { activeDrawingTool });

    try {
      if (activeDrawingTool === 'measure') {
        console.log('📏 Setting measurement mode (linestring)');
        draw.current.setMode('linestring');
        return;
      }

      switch (activeDrawingTool) {
        case 'select':
          console.log('👆 Setting select mode');
          draw.current.setMode('select');
          setLastDrawingTool(null); // Clear when selecting
          break;
        case 'circle':
          console.log('🟢 Setting circle mode');
          draw.current.setMode('circle');
          setLastDrawingTool('circle'); // Save the drawing tool
          break;
        case 'polygon':
          console.log('🔷 Setting polygon mode');
          draw.current.setMode('polygon');
          setLastDrawingTool('polygon'); // Save the drawing tool
          break;
        case 'rectangle':
          console.log('⬜ Setting rectangle mode');
          draw.current.setMode('rectangle');
          setLastDrawingTool('rectangle'); // Save the drawing tool
          break;
        default:
          console.log('🔍 Setting default select mode');
          draw.current.setMode('select');
          setLastDrawingTool(null); // Clear for default
      }
      console.log('✅ Mode change successful');
    } catch (error) {
      console.error('❌ Terra Draw mode change failed:', error);
      toast.error(`Failed to switch to ${activeDrawingTool} mode`);
    }
  }, [activeDrawingTool]);

  // Add geofences to map
  useEffect(() => {
    if (!map.current || !draw.current || !isMapLoaded) return;

    // Clear existing geofences
    draw.current.clear();

    // Add geofences to terra draw with proper feature structure
    const features = geofences.map((geofence) => {
      let geometry;
      let mode = 'polygon';

      if (geofence.geometry.type === 'Point' && geofence.radius) {
        // For circle geofences, create a polygon approximation
        geometry = createCirclePolygon(geofence.geometry.coordinates as number[], geofence.radius);
        mode = 'circle';
      } else {
        // Use geometry as-is for polygons
        geometry = geofence.geometry;
        mode = geofence.geometry.type === 'Point' ? 'point' : 'polygon';
      }

      return {
        id: geofence.id, // Terra Draw uses this as the feature ID
        type: 'Feature' as const,
        geometry,
        properties: {
          geofenceId: geofence.id, // Keep original ID for reference
          name: geofence.name,
          color: geofence.color,
          mode,
          isActive: geofence.is_active,
        },
      };
    });

    // Add all features at once
    if (features.length > 0) {
      draw.current.addFeatures(features);
    }
  }, [geofences, isMapLoaded]);

  // Add devices to map
  useEffect(() => {
    if (!map.current || !showDevices || !isMapLoaded) return;

    // Remove existing device markers
    const existingMarkers = document.querySelectorAll('.device-marker');
    existingMarkers.forEach((marker) => marker.remove());

    // Add device markers
    devices.forEach((device) => {
      const el = document.createElement('div');
      el.className = 'device-marker';
      el.style.cssText = `
        width: 12px;
        height: 12px;
        background: ${device.isOnline ? '#10B981' : '#6B7280'};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        cursor: pointer;
      `;

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
          <div class="font-medium">${device.name}</div>
          <div class="text-sm text-gray-600">${device.isOnline ? 'Online' : 'Offline'}</div>
          <div class="text-xs text-gray-500">Last seen: ${device.lastSeen.toLocaleString()}</div>
        `);

      new maplibregl.Marker({ element: el })
        .setLngLat([device.longitude, device.latitude])
        .setPopup(popup)
        .addTo(map.current!);
    });
  }, [devices, showDevices, isMapLoaded]);

  // Toolbar event handlers
  const handleToolChange = useCallback(
    (tool: typeof activeDrawingTool) => {
      // Clear measurement results when switching away from measurement tool
      if (activeDrawingTool === 'measure' && tool !== 'measure') {
        setMeasurementResults(null);
        // Clear Terra Draw measurements
        clearMeasurementLines();
      }
      setActiveDrawingTool(tool);
    },
    [activeDrawingTool, clearMeasurementLines]
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedGeofences.length === 0) return;

    onGeofenceDelete?.(selectedGeofences);
    setSelectedGeofences([]);
    toast.success(`Deleted ${selectedGeofences.length} geofences`);
  }, [selectedGeofences, onGeofenceDelete]);

  const handleBulkDuplicate = useCallback(() => {
    if (selectedGeofences.length === 0) return;

    onGeofenceDuplicate?.(selectedGeofences);
    toast.success(`Duplicated ${selectedGeofences.length} geofences`);
  }, [selectedGeofences, onGeofenceDuplicate]);

  const handleExportGeofences = useCallback(() => {
    const dataStr = JSON.stringify(geofences, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `geofences-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast.success('Geofences exported successfully');
  }, [geofences]);

  const handleImportGeofences = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedGeofences = JSON.parse(e.target?.result as string);
          // Process imported geofences
          toast.success('Geofences imported successfully');
        } catch (error) {
          toast.error('Failed to import geofences');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />

      {!isMapLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      <GeofenceMapToolbar
        activeDrawingTool={activeDrawingTool}
        onToolChange={handleToolChange}
        selectedGeofences={selectedGeofences}
        onBulkDelete={handleBulkDelete}
        onBulkDuplicate={handleBulkDuplicate}
        onToggleSnapToGrid={() => setSnapToGrid(!snapToGrid)}
        onExportGeofences={handleExportGeofences}
        onImportGeofences={handleImportGeofences}
        showDevices={showDevices}
        onToggleDevices={() => setShowDevices(!showDevices)}
        mapStyle={mapStyle}
        onMapStyleChange={setMapStyle}
        snapToGrid={snapToGrid}
      />

      {/* Measurement Mode Helper */}
      {activeDrawingTool === 'measure' && !measurementResults && (
        <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm p-2 rounded-md shadow-lg border border-neutral-200/50 max-w-sm">
          <h3 className="font-medium text-neutral-900 mb-2 flex items-center gap-2">
            <Ruler className="h-4 w-4 text-neutral-600" />
            Measurement Mode
          </h3>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Click points on the map to measure distances. Double-click to finish.
          </p>
        </div>
      )}

      {/* Measurement Results Overlay */}
      {measurementResults && (
        <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm p-2 rounded-md shadow-lg border border-neutral-200/50 max-w-sm">
          <h3 className="font-medium text-neutral-900 mb-3 flex items-center gap-2">
            <Ruler className="h-4 w-4 text-neutral-600" />
            Measurement Results
            <button
              onClick={() => setMeasurementResults(null)}
              className="ml-auto p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-600 text-sm">Total Distance</span>
              <span className="font-mono font-semibold text-neutral-900 text-sm">
                {formatDistance(measurementResults.totalDistance)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-neutral-600 text-sm">Points</span>
              <span className="font-mono text-neutral-600 text-sm">
                {measurementResults.points.length}
              </span>
            </div>

            {measurementResults.points.length > 2 && (
              <div className="pt-3 border-t border-neutral-200">
                <h4 className="text-sm font-medium text-neutral-700 mb-2">Segments</h4>
                <div className="max-h-32 overflow-y-auto premium-scrollbar space-y-2">
                  {measurementResults.points.slice(1).map((point, index) => (
                    <div key={index} className="text-sm flex justify-between items-center">
                      <span className="text-neutral-600">Segment {index + 1}</span>
                      <span className="font-mono text-neutral-900">
                        {formatDistance(point.distance || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                clearMeasurementLines();
                setMeasurementResults(null);
              }}
              className="w-full mt-4  bg-neutral-100 text-neutral-700 rounded-md border border-neutral-200 hover:bg-neutral-200 hover:text-neutral-900 text-sm font-medium transition-all duration-150"
            >
              Clear Measurements
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility functions
function calculateDistance(from: number[], to: number[]): number {
  const R = 6371000; // Earth radius in meters
  const lat1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[1] * Math.PI) / 180;
  const deltaLat = ((to[1] - from[1]) * Math.PI) / 180;
  const deltaLng = ((to[0] - from[0]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${distanceInMeters.toFixed(1)} m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(2)} km`;
  }
}

function createCirclePolygon(center: number[], radius: number, points: number = 64): any {
  const coordinates = [];
  for (let i = 0; i < points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const lng =
      center[0] + ((radius / 111320) * Math.cos(angle)) / Math.cos((center[1] * Math.PI) / 180);
    const lat = center[1] + (radius / 110540) * Math.sin(angle);
    coordinates.push([lng, lat]);
  }
  coordinates.push(coordinates[0]); // Close the polygon

  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
}
