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
  onGeofenceCreate: (geofence: {
    type: 'polygon' | 'circle' | 'point';
    coordinates: number[][];
    center?: [number, number];
    radius?: number;
  }) => void;
  onGeofenceUpdate: (id: string, geofence: any) => void;
  onGeofenceDelete: (id: string) => void;
  geofences: Array<{
    id: string;
    name: string;
    geometry: any;
    type: 'polygon' | 'circle' | 'point';
  }>;
  devices: Array<{
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
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<{ id: string; name: string } | null>(null);

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

  // Refs for up-to-date state in event handlers
  const selectedGeofenceIdRef = useRef<string | null>(null);
  const geofencesRef = useRef<typeof geofences>([]);

  // Update callback refs when props change
  useEffect(() => {
    callbacksRef.current = {
      onGeofenceCreate,
      onGeofenceUpdate,
      onGeofenceDelete
    };
  }, [onGeofenceCreate, onGeofenceUpdate, onGeofenceDelete]);

  // Update refs for event handlers
  useEffect(() => {
    selectedGeofenceIdRef.current = selectedGeofenceId;
  }, [selectedGeofenceId]);

  useEffect(() => {
    geofencesRef.current = geofences;
  }, [geofences]);


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
    if (!map.current) return;

    // Reset selection state when reloading geofences
    setSelectedGeofenceId(null);

    // Remove existing geofence layers
    const existingLayers = [
      'geofences-highlight',
      'geofences-line',
      'geofences-fill',
      'geofences-shadow',
      'geofences-selected',
      'geofences-selected-fill',
      'geofences-points',
      'geofences-circles',
      'geofences-points-highlight',
      'geofences-selected-points'
    ];
    existingLayers.forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });

    if (map.current!.getSource('geofences')) {
      map.current!.removeSource('geofences');
    }

    // Create GeoJSON features from geofences
    console.log('Raw geofences data:', geofences);
    const features = geofences
      .filter(g => g.geometry && g.id !== undefined && g.id !== null && g.id !== '') // Ensure valid geometry and ID
      .map(geofence => {
        // Ensure ID is always a string
        const featureId = String(geofence.id);
        console.log('Processing geofence:', {
          id: geofence.id,
          featureId,
          name: geofence.name,
          hasGeometry: !!geofence.geometry
        });
        return {
          type: 'Feature' as const,
          id: featureId, // Always use string ID
          properties: {
            name: geofence.name,
            type: geofence.type || (geofence as any).geofence_type,
            id: featureId // Store string ID in properties too
          },
          geometry: geofence.geometry
        };
      });

    console.log('Created features:', features);

    if (features.length === 0) {
      return;
    }

    // Add geofences as a MapLibre source
    map.current!.addSource('geofences', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: features
      }
    });

    // Add shadow layer for geofences (depth effect)
    map.current!.addLayer({
      id: 'geofences-shadow',
      type: 'fill',
      source: 'geofences',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': '#000000',
        'fill-opacity': 0.1,
        'fill-translate': [2, 2]
      }
    });

    // Add animated fill layer for geofences
    map.current!.addLayer({
      id: 'geofences-fill',
      type: 'fill',
      source: 'geofences',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'type'], 'circle'], '#10b981',
          '#3b82f6'
        ],
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 0.1,
          15, 0.25,
          18, 0.35
        ]
      }
    });

    // Add animated outline layer for geofences  
    map.current!.addLayer({
      id: 'geofences-line',
      type: 'line',
      source: 'geofences',
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']],
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'type'], 'circle'], '#10b981',
          '#3b82f6'
        ],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 1.5,
          15, 2.5,
          18, 3.5
        ],
        'line-opacity': 0.8
      }
    });

    // Add point layer for point geofences
    map.current!.addLayer({
      id: 'geofences-points',
      type: 'circle',
      source: 'geofences',
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'type'], 'point']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 3,
          18, 8
        ],
        'circle-color': '#f59e0b',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.8
      }
    });

    // Add circle layer for circle geofences (fixed size for simplicity)
    map.current!.addLayer({
      id: 'geofences-circles',
      type: 'circle',
      source: 'geofences',
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'type'], 'circle']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 10,
          18, 20
        ],
        'circle-color': '#10b981',
        'circle-stroke-color': '#10b981',
        'circle-stroke-width': 2,
        'circle-opacity': 0.2,
        'circle-stroke-opacity': 0.8
      }
    });

    // Add hover highlight layer for lines/polygons
    map.current!.addLayer({
      id: 'geofences-highlight',
      type: 'line',
      source: 'geofences',
      filter: ['all', ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']], ['==', ['get', 'id'], '']],
      paint: {
        'line-color': '#ffffff',
        'line-width': 4,
        'line-opacity': 0
      }
    });

    // Add point highlight layer
    map.current!.addLayer({
      id: 'geofences-points-highlight',
      type: 'circle',
      source: 'geofences',
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'id'], '']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 6,
          18, 12
        ],
        'circle-color': '#ffffff',
        'circle-stroke-color': '#000000',
        'circle-stroke-width': 2,
        'circle-opacity': 0.8
      }
    });

    // Add selected geofence layer for lines/polygons
    map.current!.addLayer({
      id: 'geofences-selected',
      type: 'line',
      source: 'geofences',
      filter: ['all', ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']], ['==', ['get', 'id'], '']],
      paint: {
        'line-color': '#ef4444',
        'line-width': 6,
        'line-opacity': 0.9,
        'line-dasharray': [2, 2]
      }
    });

    // Add selected point layer
    map.current!.addLayer({
      id: 'geofences-selected-points',
      type: 'circle',
      source: 'geofences',
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'id'], '']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 8,
          18, 15
        ],
        'circle-color': '#ef4444',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-opacity': 0.9
      }
    });

    // Add selected geofence fill overlay
    map.current!.addLayer({
      id: 'geofences-selected-fill',
      type: 'fill',
      source: 'geofences',
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'id'], '']],
      paint: {
        'fill-color': '#ef4444',
        'fill-opacity': 0.1
      }
    });

  }, [geofences]);

  const loadDevices = useCallback(() => {
    if (!map.current) return;

    // Remove existing device markers
    const existingMarkers = document.querySelectorAll('.device-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add enhanced device markers with animations
    devices.forEach((device, index) => {
      // Create device marker container
      const el = document.createElement('div');
      el.className = 'device-marker relative cursor-pointer transform hover:scale-110 transition-all duration-300';

      // Add pulsing animation for active devices
      const pulseRing = document.createElement('div');
      pulseRing.className = `absolute inset-0 rounded-full border-2 ${device.isActive ? 'border-green-400 animate-ping' : 'border-transparent'
        }`;

      // Main device icon
      const deviceIcon = document.createElement('div');
      deviceIcon.className = `relative w-8 h-8 rounded-full border-3 border-white shadow-xl z-10 flex items-center justify-center text-white font-bold text-xs transition-all duration-300 ${device.isActive
          ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-green-400/50'
          : 'bg-gradient-to-br from-gray-400 to-gray-600 shadow-gray-400/50'
        }`;
      deviceIcon.textContent = device.name.charAt(0).toUpperCase();

      // Status indicator dot
      const statusDot = document.createElement('div');
      statusDot.className = `absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white z-20 ${device.isActive ? 'bg-green-500' : 'bg-red-500'
        }`;

      // Assemble marker
      el.appendChild(pulseRing);
      el.appendChild(deviceIcon);
      el.appendChild(statusDot);

      el.title = `${device.name} - ${device.isActive ? 'Online' : 'Offline'}`;

      // Enhanced popup with better styling
      const popup = new maplibregl.Popup({
        offset: 35,
        className: 'device-popup',
        maxWidth: '300px'
      })
        .setHTML(`
          <div class="p-4 bg-white rounded-lg shadow-xl border border-gray-200">
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${device.isActive ? 'bg-green-500' : 'bg-gray-500'
          }">
                ${device.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">${device.name}</h3>
                <div class="flex items-center space-x-1">
                  <div class="w-2 h-2 rounded-full ${device.isActive ? 'bg-green-500' : 'bg-red-500'}"></div>
                  <span class="text-sm ${device.isActive ? 'text-green-600' : 'text-red-600'}">
                    ${device.isActive ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
            <div class="space-y-2 text-sm text-gray-600">
              <div class="flex justify-between">
                <span>Last seen:</span>
                <span class="font-medium">${new Date(device.lastSeen).toLocaleString()}</span>
              </div>
              <div class="flex justify-between">
                <span>Location:</span>
                <span class="font-medium font-mono">${device.location[1].toFixed(4)}, ${device.location[0].toFixed(4)}</span>
              </div>
            </div>
            <div class="mt-3 pt-3 border-t border-gray-200">
              <button class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                View Details
              </button>
            </div>
          </div>
        `);

      // Add marker to map with staggered animation
      const marker = new maplibregl.Marker(el)
        .setLngLat(device.location)
        .setPopup(popup)
        .addTo(map.current!);

      // Staggered entrance animation
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'scale(0) translateY(-20px)';
        el.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';

        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'scale(1) translateY(0)';
        });
      }, index * 100);
    });
  }, [devices]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;


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
            maxzoom: 19,
            paint: {
              'raster-brightness-min': 0,
              'raster-brightness-max': 1,
              'raster-contrast': 0.3,
              'raster-saturation': -0.2
            }
          }
        ]
      },
      center: [-122.4194, 37.7749], // San Francisco
      zoom: 13,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      logoPosition: 'bottom-left',
      maxZoom: 20,
      minZoom: 8
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
            const radius = feature.properties?.radius;
            if (typeof radius === 'number' && radius > 0) {
              callbacksRef.current.onGeofenceCreate({
                type: 'circle',
                coordinates: [center],
                center: center,
                radius: radius
              });
            } else {
              callbacksRef.current.onGeofenceCreate({
                type: 'point',
                coordinates: [center]
              });
            }
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

    // Add enhanced navigation controls
    map.current.addControl(new maplibregl.NavigationControl({
      showCompass: true,
      showZoom: true,
      visualizePitch: true
    }), 'top-right');

    // Add scale control
    map.current.addControl(new maplibregl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }), 'bottom-left');

    // Add fullscreen control
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Add geolocate control
    map.current.addControl(new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
    }), 'top-right');

    // Add map interaction handlers
    map.current.on('style.load', () => {
      // Start drawing only after map style is loaded
      if (draw.current) {
        try {
          draw.current.start();
          setTerraDrawStatus('ready');
        } catch (error) {
          console.error('Failed to start Terra Draw:', error);
          setTerraDrawStatus('error');
        }
      }
      setIsLoaded(true);
    });

    // Add smooth map animations
    map.current.on('movestart', () => {
      map.current!.getCanvas().style.cursor = 'grabbing';
    });

    map.current.on('moveend', () => {
      map.current!.getCanvas().style.cursor = '';
    });

    // Add geofence hover effects for polygons
    map.current.on('mouseenter', 'geofences-fill', (e) => {
      map.current!.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features[0]) {
        const featureId = e.features[0].id || e.features[0].properties?.id;
        console.log('Hover - Feature ID:', featureId, 'Type:', typeof featureId);
        if (featureId !== undefined && featureId !== null && featureId !== '') {
          try {
            // Check if the layer exists before trying to use it
            if (map.current!.getLayer('geofences-highlight')) {
              map.current!.setFilter('geofences-highlight', ['==', ['get', 'id'], featureId]);
              map.current!.setPaintProperty('geofences-highlight', 'line-opacity', 0.8);
            }
          } catch (error) {
            console.error('Error setting hover filter:', error, 'ID:', featureId);
          }
        } else {
          console.warn('Skipping hover highlight - invalid feature ID:', featureId);
        }
      }
    });

    // Add hover for points
    map.current.on('mouseenter', 'geofences-points', (e) => {
      map.current!.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features[0]) {
        const featureId = e.features[0].id || e.features[0].properties?.id;
        if (featureId !== undefined && featureId !== null && featureId !== '') {
          try {
            if (map.current!.getLayer('geofences-points-highlight')) {
              map.current!.setFilter('geofences-points-highlight', ['==', ['get', 'id'], featureId]);
            }
          } catch (error) {
            console.error('Error setting point hover filter:', error, 'ID:', featureId);
          }
        }
      }
    });

    map.current.on('mouseenter', 'geofences-circles', (e) => {
      map.current!.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features[0]) {
        const featureId = e.features[0].id || e.features[0].properties?.id;
        if (featureId !== undefined && featureId !== null && featureId !== '') {
          try {
            if (map.current!.getLayer('geofences-points-highlight')) {
              map.current!.setFilter('geofences-points-highlight', ['==', ['get', 'id'], featureId]);
            }
          } catch (error) {
            console.error('Error setting circle hover filter:', error, 'ID:', featureId);
          }
        }
      }
    });

    map.current.on('mouseleave', 'geofences-fill', () => {
      map.current!.getCanvas().style.cursor = '';
      // Check if the layer exists before trying to use it
      if (map.current!.getLayer('geofences-highlight')) {
        try {
          map.current!.setPaintProperty('geofences-highlight', 'line-opacity', 0);
        } catch (error) {
          console.error('Error clearing hover highlight:', error);
        }
      }
    });

    // Clear point hover
    map.current.on('mouseleave', 'geofences-points', () => {
      map.current!.getCanvas().style.cursor = '';
      if (map.current!.getLayer('geofences-points-highlight')) {
        try {
          map.current!.setFilter('geofences-points-highlight', ['==', ['get', 'id'], '']);
        } catch (error) {
          console.error('Error clearing point hover highlight:', error);
        }
      }
    });

    map.current.on('mouseleave', 'geofences-circles', () => {
      map.current!.getCanvas().style.cursor = '';
      if (map.current!.getLayer('geofences-points-highlight')) {
        try {
          map.current!.setFilter('geofences-points-highlight', ['==', ['get', 'id'], '']);
        } catch (error) {
          console.error('Error clearing circle hover highlight:', error);
        }
      }
    });

    // Add geofence click handler for selection and zoom for polygons
    map.current.on('click', 'geofences-fill', (e) => {
      console.log('Geofence clicked, event:', e);
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        // Try to get ID from feature.id first, then from properties as backup
        const geofenceId = feature.id?.toString() || feature.properties?.id?.toString();
        console.log('Feature:', feature, 'ID from feature.id:', feature.id, 'ID from properties:', feature.properties?.id, 'Final ID:', geofenceId);

        if (geofenceId) {
          // Select/deselect geofence
          if (selectedGeofenceIdRef.current === geofenceId) {
            // Deselect if already selected
            console.log('Deselecting geofence:', geofenceId);
            setSelectedGeofenceId(null);
            if (map.current!.getLayer('geofences-selected')) {
              map.current!.setFilter('geofences-selected', ['==', ['get', 'id'], '']);
            }
            if (map.current!.getLayer('geofences-selected-fill')) {
              map.current!.setFilter('geofences-selected-fill', ['==', ['get', 'id'], '']);
            }
            if (map.current!.getLayer('geofences-selected-points')) {
              map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], '']);
            }
          } else {
            // Select new geofence
            console.log('Selecting geofence:', geofenceId);
            setSelectedGeofenceId(geofenceId);
            console.log('Setting filter for layers with ID:', geofenceId);

            // Check if the layers exist before applying filters
            if (map.current!.getLayer('geofences-selected')) {
              map.current!.setFilter('geofences-selected', ['==', ['get', 'id'], geofenceId]);
              console.log('Applied filter to geofences-selected layer');
            } else {
              console.error('Layer geofences-selected not found');
            }
            
            if (map.current!.getLayer('geofences-selected-fill')) {
              map.current!.setFilter('geofences-selected-fill', ['==', ['get', 'id'], geofenceId]);
              console.log('Applied filter to geofences-selected-fill layer');
            } else {
              console.error('Layer geofences-selected-fill not found');
            }
          }
        }

        // Zoom to geofence
        if (feature.geometry.type === 'Polygon') {
          const coordinates = feature.geometry.coordinates[0] as [number, number][];
          const bounds = new maplibregl.LngLatBounds();
          coordinates.forEach(coord => bounds.extend(coord));

          map.current!.fitBounds(bounds, {
            padding: 100,
            duration: 1000,
            curve: 1.42
          });
        }
      }
    });

    // Add click handler for points
    map.current.on('click', 'geofences-points', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        const geofenceId = feature.id?.toString() || (feature.properties as any)?.id?.toString();

        if (geofenceId) {
          if (selectedGeofenceIdRef.current === geofenceId) {
            setSelectedGeofenceId(null);
            if (map.current!.getLayer('geofences-selected-points')) {
              map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], '']);
            }
          } else {
            setSelectedGeofenceId(geofenceId);
            if (map.current!.getLayer('geofences-selected-points')) {
              map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], geofenceId]);
            }
          }
        }

        // Fly to point
        const center = (feature.geometry as any).coordinates as [number, number];
        map.current!.flyTo({
          center,
          zoom: 15,
          duration: 1000
        });
      }
    });

    map.current.on('click', 'geofences-circles', (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0];
        const geofenceId = feature.id?.toString() || (feature.properties as any)?.id?.toString();

        if (geofenceId) {
          if (selectedGeofenceIdRef.current === geofenceId) {
            setSelectedGeofenceId(null);
            if (map.current!.getLayer('geofences-selected-points')) {
              map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], '']);
            }
          } else {
            setSelectedGeofenceId(geofenceId);
            if (map.current!.getLayer('geofences-selected-points')) {
              map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], geofenceId]);
            }
          }
        }

        // Fly to circle center
        const center = (feature.geometry as any).coordinates as [number, number];
        map.current!.flyTo({
          center,
          zoom: 14,
          duration: 1000
        });
      }
    });

    // Add double-click handler for zoom-to-fit for polygons
    map.current.on('dblclick', 'geofences-fill', (e) => {
      e.preventDefault(); // Prevent default map zoom
      if (e.features && e.features[0] && e.features[0].geometry.type === 'Polygon') {
        const coordinates = e.features[0].geometry.coordinates[0] as [number, number][];
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));

        map.current!.fitBounds(bounds, {
          padding: 50,
          duration: 1200,
          curve: 1.42
        });
      }
    });

    // Double-click for points - zoom closer
    map.current.on('dblclick', 'geofences-points', (e) => {
      e.preventDefault();
      if (e.features && e.features[0]) {
        const center = (e.features[0].geometry as any).coordinates as [number, number];
        map.current!.flyTo({
          center,
          zoom: 18,
          duration: 1200
        });
      }
    });

    map.current.on('dblclick', 'geofences-circles', (e) => {
      e.preventDefault();
      if (e.features && e.features[0]) {
        const center = (e.features[0].geometry as any).coordinates as [number, number];
        const rawRadius = e.features[0].properties?.radius;
        const radius = typeof rawRadius === 'number' ? rawRadius : 100;
        // Approximate zoom based on radius
        const zoom = Math.max(12, 18 - Math.log(radius) / Math.LN2);
        map.current!.flyTo({
          center,
          zoom,
          duration: 1200
        });
      }
    });

    // Add keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // Skip if typing in input

      switch (e.key) {
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const searchInput = document.querySelector('input[placeholder="Search places..."]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
              searchInput.select();
            }
          }
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            loadGeofences();
            loadDevices();
          }
          break;
        case '1':
          setDrawingMode('select');
          break;
        case '2':
          setDrawingMode('polygon');
          break;
        case '3':
          setDrawingMode('circle');
          break;
        case '4':
          setDrawingMode('point');
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            clearDrawing();
          }
          break;
        case 'Delete':
        case 'Backspace':
          console.log('Delete key pressed, selectedGeofenceId:', selectedGeofenceIdRef.current);
          if (selectedGeofenceIdRef.current) {
            e.preventDefault();
            const selectedGeofence = geofencesRef.current.find(g => g.id === selectedGeofenceIdRef.current);
            console.log('Found selected geofence for deletion:', selectedGeofence);
            if (selectedGeofence) {
              console.log('Setting delete confirmation dialog:', {
                id: selectedGeofenceIdRef.current,
                name: selectedGeofence.name
              });
              setShowDeleteConfirmation({
                id: selectedGeofenceIdRef.current!,
                name: selectedGeofence.name
              });
            }
          }
          break;
        case 'Escape':
          if (selectedGeofenceIdRef.current) {
            // Deselect geofence
            setSelectedGeofenceId(null);
            if (map.current!.getLayer('geofences-selected')) {
              map.current!.setFilter('geofences-selected', ['==', ['get', 'id'], '']);
            }
            if (map.current!.getLayer('geofences-selected-fill')) {
              map.current!.setFilter('geofences-selected-fill', ['==', ['get', 'id'], '']);
            }
            if (map.current!.getLayer('geofences-selected-points')) {
              map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], '']);
            }
          } else {
            setShowResults(false);
            setSelectedResultIndex(-1);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      // Cleanup keyboard listeners
      document.removeEventListener('keydown', handleKeyDown);

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
  }, []); // Run only once on mount

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
    if (isLoaded && map.current) {
      loadGeofences();
    }
  }, [geofences, isLoaded, loadGeofences]);

  // Reload devices when they change
  useEffect(() => {
    if (isLoaded) {
      loadDevices();
    }
  }, [devices, isLoaded, loadDevices]);

  // Load existing geofences into TerraDraw for editing
  useEffect(() => {
    if (!draw.current || !isLoaded) return;

    const drawInstance = draw.current;
    const features = geofences
      .filter(g => g.geometry && g.id !== undefined && g.id !== null && g.id !== '')
      .map(geofence => {
        const featureId = String(geofence.id);
        return {
          id: featureId,
          type: 'Feature' as const,
          geometry: geofence.geometry,
          properties: {
            name: geofence.name,
            type: geofence.type,
            mode: geofence.type === 'polygon' ? 'polygon' : geofence.type === 'circle' ? 'circle' : 'point'
          }
        };
      });

    drawInstance.clear();
    (drawInstance as any).snapshot = features;
  }, [geofences, isLoaded]);

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

          {/* Enhanced Search Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-30 animate-in slide-in-from-top-2 duration-300">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => flyToLocation(result.center, result.place_name)}
                  className={`w-full px-6 py-4 text-left border-b border-gray-100 last:border-b-0 focus:outline-none transition-all duration-200 first:rounded-t-xl last:rounded-b-xl group ${index === selectedResultIndex
                      ? 'bg-blue-50 border-blue-200 shadow-md'
                      : 'hover:bg-blue-50 hover:shadow-md'
                    }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{result.place_name.split(',')[0]}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.place_name}</p>
                      <div className="flex items-center mt-2 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded-full">{result.place_type?.[0] || 'Location'}</span>
                      </div>
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
          <div className={`w-2 h-2 rounded-full ${terraDrawStatus === 'ready' ? 'bg-green-500' :
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
            className={`p-2 rounded text-sm font-medium transition-colors ${currentMode === 'select'
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
            className={`p-2 rounded text-sm font-medium transition-colors ${currentMode === 'polygon'
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
            className={`p-2 rounded text-sm font-medium transition-colors ${currentMode === 'circle'
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
            className={`p-2 rounded text-sm font-medium transition-colors ${currentMode === 'point'
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

      {/* Real-time Statistics Panel */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-4 text-sm min-w-48">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
          <div className="w-4 h-4 rounded bg-gradient-to-r from-green-500 to-blue-500"></div>
          <span className="font-semibold text-gray-900">Live Status</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Active Devices:</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-semibold text-green-600">
                {devices?.filter(d => d.isActive).length || 0}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Devices:</span>
            <span className="font-semibold text-blue-600">{devices?.length || 0}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Geofences:</span>
            <span className="font-semibold text-purple-600">{geofences?.length || 0}</span>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Auto-refresh: 30s</span>
          </div>
        </div>
      </div>

      {/* Enhanced Map Legend */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-4 text-sm max-w-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
          <div className="w-4 h-4 rounded bg-gradient-to-r from-blue-500 to-purple-600"></div>
          <span className="font-semibold text-gray-900">Map Legend</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="font-medium text-gray-700 mb-1">Devices</div>
            <div className="space-y-1 ml-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-pulse opacity-75"></div>
                </div>
                <span className="text-xs">Online Device</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-xs">Offline Device</span>
              </div>
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-700 mb-1">Geofences</div>
            <div className="space-y-1 ml-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 bg-blue-500 rounded-full shadow-sm"></div>
                <span className="text-xs">Polygon Area</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 bg-green-500 rounded-full shadow-sm"></div>
                <span className="text-xs">Circle Area</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 bg-purple-500 rounded-full shadow-sm"></div>
                <span className="text-xs">Hover Highlight</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-xs">Point Geofence</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Live Updates Active</span>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-4 text-sm max-w-xs">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
          <div className="w-4 h-4 rounded bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <span className="font-semibold text-gray-900">Shortcuts</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Focus Search:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">Ctrl+F</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Refresh Data:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">Ctrl+R</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Select Mode:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">1</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Draw Polygon:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">2</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Draw Circle:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">3</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Clear Drawing:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">Ctrl+C</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Delete Selected:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">Del</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Deselect:</span>
            <kbd className="bg-gray-100 px-2 py-1 rounded border text-gray-800">Esc</kbd>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>⌨️ Click to select • Double-click to zoom</span>
          </div>
        </div>
      </div>

      {/* Selected Geofence Info Panel */}
      {selectedGeofenceId && (() => {
        console.log('Rendering selection panel for ID:', selectedGeofenceId);
        console.log('Available geofences:', geofences.map(g => ({ id: g.id, name: g.name })));
        const selectedGeofence = geofences.find(g => g.id === selectedGeofenceId);
        console.log('Found selected geofence:', selectedGeofence);
        if (!selectedGeofence) return null;

        return (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-4 text-sm max-w-xs z-40 ml-20">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
              <div className="w-4 h-4 rounded bg-gradient-to-r from-red-500 to-orange-500"></div>
              <span className="font-semibold text-gray-900">Selected Geofence</span>
            </div>

            <div className="space-y-2">
              <div>
                <span className="font-medium text-gray-700">Name:</span>
                <p className="text-gray-900 font-semibold">{selectedGeofence.name}</p>
              </div>

              <div>
                <span className="font-medium text-gray-700">Type:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-3 h-1 rounded-full ${selectedGeofence.type === 'circle' ? 'bg-green-500' : 'bg-blue-500'
                    }`}></div>
                  <span className="text-gray-600 capitalize">{selectedGeofence.type}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    console.log('Delete button clicked, selectedGeofenceId:', selectedGeofenceId);
                    const selectedGeofence = geofences.find(g => g.id === selectedGeofenceId);
                    console.log('Found geofence for deletion:', selectedGeofence);
                    if (selectedGeofence) {
                      console.log('Setting delete confirmation dialog from button');
                      setShowDeleteConfirmation({
                        id: selectedGeofenceId,
                        name: selectedGeofence.name
                      });
                    } else {
                      console.error('Could not find geofence to delete');
                    }
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg text-xs font-medium transition-colors"
                >
                  🗑️ Delete
                </button>

                <button
                  onClick={() => {
                    setSelectedGeofenceId(null);
                    if (map.current!.getLayer('geofences-selected')) {
                      map.current!.setFilter('geofences-selected', ['==', ['get', 'id'], '']);
                    }
                    if (map.current!.getLayer('geofences-selected-fill')) {
                      map.current!.setFilter('geofences-selected-fill', ['==', ['get', 'id'], '']);
                    }
                    if (map.current!.getLayer('geofences-selected-points')) {
                      map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], '']);
                    }
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-3 rounded-lg text-xs font-medium transition-colors"
                >
                  ✕ Deselect
                </button>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <span>Press Del to delete • Esc to deselect</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <div className="w-6 h-6 text-red-600">🗑️</div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Geofence</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-900">&ldquo;{showDeleteConfirmation.name}&rdquo;</span>?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmation(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  onGeofenceDelete(showDeleteConfirmation.id);

                  setShowDeleteConfirmation(null);
                  setSelectedGeofenceId(null);
                  if (map.current!.getLayer('geofences-selected')) {
                    map.current!.setFilter('geofences-selected', ['==', ['get', 'id'], '']);
                  }
                  if (map.current!.getLayer('geofences-selected-fill')) {
                    map.current!.setFilter('geofences-selected-fill', ['==', ['get', 'id'], '']);
                  }
                  if (map.current!.getLayer('geofences-selected-points')) {
                    map.current!.setFilter('geofences-selected-points', ['==', ['get', 'id'], '']);
                  }
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
