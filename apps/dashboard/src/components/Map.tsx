'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { 
  TerraDraw, 
  TerraDrawPolygonMode, 
  TerraDrawPointMode,
  TerraDrawCircleMode,
  TerraDrawSelectMode 
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { Search, MapPin, X } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProps {
  onGeofenceCreate?: (geofence: {
    type: 'polygon' | 'circle' | 'point';
    coordinates: number[][];
    center?: [number, number];
    radius?: number;
  }) => void;
  onGeofenceUpdate?: (id: string, geofence: any) => void;
  onGeofenceDelete?: (id: string) => void;
  geofences?: Array<{
    id: string;
    name: string;
    geometry: any;
    type: 'polygon' | 'circle';
  }>;
  devices?: Array<{
    id: string;
    name: string;
    location: [number, number];
    lastSeen: string;
    isActive: boolean;
  }>;
}

export function Map({
  onGeofenceCreate,
  onGeofenceUpdate,
  onGeofenceDelete,
  geofences = [],
  devices = []
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const draw = useRef<TerraDraw | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMode, setCurrentMode] = useState<'select' | 'polygon' | 'circle' | 'point'>('select');
  const [terraDrawStatus, setTerraDrawStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    place_name: string;
    center: [number, number];
    place_type?: string[];
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const searchMarker = useRef<maplibregl.Marker | null>(null);
  
  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onGeofenceCreate,
    onGeofenceUpdate,
    onGeofenceDelete
  });

  // Update callback refs when props change
  useEffect(() => {
    callbacksRef.current = {
      onGeofenceCreate,
      onGeofenceUpdate,
      onGeofenceDelete
    };
  }, [onGeofenceCreate, onGeofenceUpdate, onGeofenceDelete]);

  // Search functionality
  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      // Using OpenStreetMap Nominatim API for geocoding (free alternative to Mapbox)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        const results = data.map((item: any) => ({
          place_name: item.display_name,
          center: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
          place_type: [item.type || 'place']
        }));
        setSearchResults(results);
        setShowResults(results.length > 0);
        setSelectedResultIndex(-1);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const flyToLocation = useCallback((center: [number, number], placeName: string) => {
    if (!map.current) return;

    // Remove existing search marker
    if (searchMarker.current) {
      searchMarker.current.remove();
    }

    // Fly to the location
    map.current.flyTo({
      center,
      zoom: 15,
      duration: 1000
    });

    // Add a marker for the searched location
    const el = document.createElement('div');
    el.className = 'search-marker w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center';
    el.innerHTML = '📍';

    searchMarker.current = new maplibregl.Marker(el)
      .setLngLat(center)
      .setPopup(
        new maplibregl.Popup({ offset: 25 })
          .setHTML(`<div class="p-2"><strong>${placeName}</strong></div>`)
      )
      .addTo(map.current);

    // Hide search results
    setShowResults(false);
    setSearchQuery('');
  }, []);

  const loadGeofences = useCallback(() => {
    if (!draw.current) return;

    // Clear existing features
    draw.current.clear();

    // Add geofences as GeoJSON features
    geofences.forEach(geofence => {
      if (geofence.geometry) {
        draw.current?.addFeatures([{
          type: 'Feature',
          id: geofence.id,
          properties: {
            name: geofence.name
          },
          geometry: geofence.geometry
        }]);
      }
    });
  }, [geofences]);

  const loadDevices = useCallback(() => {
    if (!map.current) return;

    // Remove existing device markers
    const existingMarkers = document.querySelectorAll('.device-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add device markers
    devices.forEach(device => {
      const el = document.createElement('div');
      el.className = `device-marker w-4 h-4 rounded-full border-2 border-white shadow-lg ${
        device.isActive ? 'bg-green-500' : 'bg-gray-400'
      }`;
      el.title = `${device.name} - Last seen: ${new Date(device.lastSeen).toLocaleString()}`;

      // Create popup
      const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-2">
            <h3 class="font-semibold">${device.name}</h3>
            <p class="text-sm text-gray-600">Status: ${device.isActive ? 'Active' : 'Inactive'}</p>
            <p class="text-sm text-gray-600">Last seen: ${new Date(device.lastSeen).toLocaleString()}</p>
            <p class="text-sm text-gray-600">Location: ${device.location[1].toFixed(4)}, ${device.location[0].toFixed(4)}</p>
          </div>
        `);

      // Add marker to map
      new maplibregl.Marker(el)
        .setLngLat(device.location)
        .setPopup(popup)
        .addTo(map.current!);
    });
  }, [devices]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('Initializing Map and Terra Draw...');

    // Initialize MapLibre GL map with configurable tiles
    const tileUrl = process.env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileKey = process.env.TILE_KEY;
    
    // Build tile URL with API key if provided
    const tilesUrl = tileKey 
      ? tileUrl.replace('{key}', tileKey)
      : tileUrl;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'tiles': {
            type: 'raster',
            tiles: [tilesUrl],
            tileSize: 256,
            attribution: tileKey 
              ? '© MapTiler © OpenStreetMap contributors'
              : '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'tiles',
            type: 'raster',
            source: 'tiles',
            minzoom: 0,
            maxzoom: 18
          }
        ]
      },
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 12,
      attributionControl: false
    });

    // Initialize Terra Draw with MapLibre adapter
    try {
      draw.current = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({
          map: map.current
        }),
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
                  deletable: true
                }
              }
            }
          }
        }),
        new TerraDrawPolygonMode({
          styles: {
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            outlineColor: '#3b82f6',
            outlineWidth: 2,
            closingPointColor: '#ef4444',
            closingPointWidth: 4
          }
        }),
        new TerraDrawCircleMode({
          styles: {
            fillColor: '#10b981',
            fillOpacity: 0.1,
            outlineColor: '#10b981',
            outlineWidth: 2
          }
        }),
        new TerraDrawPointMode({
          styles: {
            pointColor: '#f59e0b',
            pointWidth: 8,
            pointOutlineColor: '#ffffff',
            pointOutlineWidth: 2
          }
        })
      ]
    });
      console.log('Terra Draw initialized successfully');
      setTerraDrawStatus('ready');
    } catch (error) {
      console.error('Failed to initialize Terra Draw:', error);
      setTerraDrawStatus('error');
      return;
    }

    // Event listeners for drawing
    draw.current.on('finish', (id, context) => {
      if (callbacksRef.current.onGeofenceCreate && draw.current) {
        // Get the feature from the snapshot
        const features = draw.current.getSnapshot();
        const feature = features.find(f => f.id === id);
        
        if (feature && feature.type === 'Feature') {
          if (feature.geometry.type === 'Polygon') {
            callbacksRef.current.onGeofenceCreate({
              type: 'polygon',
              coordinates: feature.geometry.coordinates[0]
            });
          } else if (feature.geometry.type === 'Point') {
            const center = feature.geometry.coordinates as [number, number];
            callbacksRef.current.onGeofenceCreate({
              type: 'circle',
              coordinates: [center],
              center: center,
              radius: 100 // Default 100 meters
            });
          }
        }
      }
    });

    draw.current.on('change', (ids, type) => {
      if (type === 'delete' && callbacksRef.current.onGeofenceDelete) {
        ids.forEach(id => callbacksRef.current.onGeofenceDelete!(String(id)));
      } else if (type === 'update' && callbacksRef.current.onGeofenceUpdate) {
        ids.forEach(id => {
          const feature = draw.current?.getSnapshot().find(f => f.id === id);
          if (feature) {
            callbacksRef.current.onGeofenceUpdate!(String(id), feature);
          }
        });
      }
    });

    // Add navigation control
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      console.log('Map loaded, starting Terra Draw...');
      // Start drawing only after map style is loaded
      if (draw.current) {
        try {
          draw.current.start();
          console.log('Terra Draw started successfully');
          setTerraDrawStatus('ready');
        } catch (error) {
          console.error('Failed to start Terra Draw:', error);
          setTerraDrawStatus('error');
        }
      }
      setIsLoaded(true);
      loadGeofences();
      loadDevices();
    });

    return () => {
      // Cleanup search marker
      if (searchMarker.current) {
        searchMarker.current.remove();
        searchMarker.current = null;
      }
      if (draw.current) {
        draw.current.stop();
        draw.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array to prevent re-initialization

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchPlaces(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchPlaces]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer && !searchContainer.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reload geofences when they change
  useEffect(() => {
    if (isLoaded && draw.current) {
      loadGeofences();
    }
  }, [geofences, isLoaded, loadGeofences]);

  // Reload devices when they change
  useEffect(() => {
    if (isLoaded) {
      loadDevices();
    }
  }, [devices, isLoaded, loadDevices]);

  const setDrawingMode = (mode: 'select' | 'polygon' | 'circle' | 'point') => {
    if (!draw.current) {
      console.warn('Terra Draw not initialized, cannot set mode:', mode);
      return;
    }
    
    console.log('Setting drawing mode to:', mode);
    setCurrentMode(mode);
    
    try {
      switch (mode) {
        case 'select':
          draw.current.setMode('select');
          break;
        case 'polygon':
          draw.current.setMode('polygon');
          break;
        case 'circle':
          draw.current.setMode('circle');
          break;
        case 'point':
          draw.current.setMode('point');
          break;
      }
      console.log('Successfully set mode to:', mode);
    } catch (error) {
      console.error('Failed to set Terra Draw mode:', error);
    }
  };

  const clearDrawing = () => {
    if (draw.current) {
      draw.current.clear();
    }
  };

  return (
    <div className="relative h-full">
      <div ref={mapContainer} className="h-full rounded-lg overflow-hidden" />
      
      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-80 z-10">
        <div className="relative search-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowResults(searchResults.length > 0)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedResultIndex(prev => 
                    prev < searchResults.length - 1 ? prev + 1 : prev
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (selectedResultIndex >= 0 && selectedResultIndex < searchResults.length) {
                    const result = searchResults[selectedResultIndex];
                    flyToLocation(result.center, result.place_name);
                  }
                } else if (e.key === 'Escape') {
                  setShowResults(false);
                  setSelectedResultIndex(-1);
                }
              }}
              className="w-full pl-10 pr-10 py-2 bg-white border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowResults(false);
                  setSelectedResultIndex(-1);
                  if (searchMarker.current) {
                    searchMarker.current.remove();
                    searchMarker.current = null;
                  }
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => flyToLocation(result.center, result.place_name)}
                  className={`w-full px-4 py-3 text-left border-b border-gray-100 last:border-b-0 focus:outline-none transition-colors ${
                    index === selectedResultIndex 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.place_name.split(',')[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {result.place_name}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Terra Draw Status */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-2">
        <div className="text-xs mb-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            terraDrawStatus === 'ready' ? 'bg-green-500' : 
            terraDrawStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
          }`}></div>
          <span className="font-medium">
            {terraDrawStatus === 'ready' ? 'Terra Draw Ready' : 
             terraDrawStatus === 'error' ? 'Terra Draw Error' : 'Initializing...'}
          </span>
        </div>
        
        {/* Drawing Controls */}
        <div className="flex flex-col gap-2">
        <button
          onClick={() => setDrawingMode('select')}
          disabled={terraDrawStatus !== 'ready'}
          className={`p-2 rounded text-sm font-medium transition-colors ${
            currentMode === 'select'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${terraDrawStatus !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Select and edit"
        >
          ✋ Select
        </button>
        <button
          onClick={() => setDrawingMode('polygon')}
          disabled={terraDrawStatus !== 'ready'}
          className={`p-2 rounded text-sm font-medium transition-colors ${
            currentMode === 'polygon'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${terraDrawStatus !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Draw polygon"
        >
          ⬟ Polygon
        </button>
        <button
          onClick={() => setDrawingMode('circle')}
          disabled={terraDrawStatus !== 'ready'}
          className={`p-2 rounded text-sm font-medium transition-colors ${
            currentMode === 'circle'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${terraDrawStatus !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Draw circle"
        >
          ⭕ Circle
        </button>
        <button
          onClick={() => setDrawingMode('point')}
          disabled={terraDrawStatus !== 'ready'}
          className={`p-2 rounded text-sm font-medium transition-colors ${
            currentMode === 'point'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${terraDrawStatus !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Add point"
        >
          📍 Point
        </button>
        <div className="border-t border-gray-200 mt-1 pt-1">
          <button
            onClick={clearDrawing}
            disabled={terraDrawStatus !== 'ready'}
            className={`p-2 w-full rounded text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors ${terraDrawStatus !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Clear all drawings"
          >
            🗑️ Clear
          </button>
        </div>
        </div>
      </div>

      {/* Map Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3 text-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Active Device</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span>Inactive Device</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-blue-500"></div>
            <span>Polygon Geofence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-green-500"></div>
            <span>Circle Geofence</span>
          </div>
        </div>
      </div>
    </div>
  );
}