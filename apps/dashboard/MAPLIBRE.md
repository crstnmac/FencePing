# MapLibre GL JS Integration Guide

This document describes the MapLibre GL JS integration implemented in the GeoFence dashboard, replacing the previous Mapbox GL JS dependency.

## Overview

The map component now uses **MapLibre GL JS** with **Terra Draw** for drawing functionality, providing a completely open-source solution that doesn't require API tokens or usage fees.

## Key Benefits

- 🆓 **No API Keys Required**: Uses OpenStreetMap tiles by default
- ⚡ **Modern Drawing Tools**: Terra Draw provides advanced drawing capabilities  
- 🔄 **Better React Integration**: Clean, reactive component architecture
- 🌍 **Open Source**: Fully open-source mapping stack
- 🎨 **Customizable Styling**: Complete control over map appearance

## Architecture

### Core Components

1. **MapLibre GL JS**: WebGL-based map rendering engine
2. **Terra Draw**: Modern drawing and editing library
3. **OpenStreetMap**: Free tile service (no registration required)
4. **React Integration**: Clean useEffect-based component lifecycle

### Drawing Modes

The map supports four drawing modes:

- **Select Mode**: Edit existing shapes (drag, rotate, scale, edit vertices)
- **Polygon Mode**: Draw complex polygon geofences
- **Circle Mode**: Draw circular geofences  
- **Point Mode**: Add point markers (converted to circular geofences)

## Installation

```bash
npm install maplibre-gl terra-draw
```

## Usage Example

```typescript
import { Map } from '@/components/Map';

function GeofenceManager() {
  const handleGeofenceCreate = (geofence) => {
    console.log('New geofence:', geofence);
    // Save to API
  };

  return (
    <Map
      geofences={existingGeofences}
      devices={trackedDevices}
      onGeofenceCreate={handleGeofenceCreate}
      onGeofenceUpdate={handleUpdate}
      onGeofenceDelete={handleDelete}
    />
  );
}
```

## Features

### Interactive Drawing
- Click to start drawing polygons
- Drag to resize circles
- Double-click to finish shapes
- Right-click to cancel

### Editing Capabilities
- Drag shapes to move
- Drag vertices to reshape
- Delete vertices with right-click
- Rotate and scale shapes

### Device Tracking
- Real-time device markers
- Status indicators (active/inactive)
- Click for device details popup
- Automatic location updates

### Visual Styling
- Custom colors per geofence type
- Semi-transparent fills
- Clear outlines and vertices
- Hover effects

## Customization

### Map Style

Change the map style by modifying the MapLibre style object:

```typescript
// Use different tile service
const customStyle = {
  version: 8,
  sources: {
    'satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256
    }
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
};
```

### Drawing Styles

Customize Terra Draw appearance:

```typescript
new TerraDrawPolygonMode({
  styles: {
    fillColor: '#ff0000',
    fillOpacity: 0.2,
    outlineColor: '#ff0000',
    outlineWidth: 3
  }
})
```

### Controls Position

Move drawing controls:

```typescript
// Controls positioned via CSS classes
<div className="absolute top-4 right-4">
  {/* Custom control layout */}
</div>
```

## API Integration

### Geofence Data Format

```typescript
interface Geofence {
  id: string;
  name: string;
  type: 'polygon' | 'circle';
  geometry: GeoJSON.Geometry; // Standard GeoJSON
}
```

### Device Data Format

```typescript  
interface Device {
  id: string;
  name: string;
  location: [longitude, latitude];
  lastSeen: string; // ISO timestamp
  isActive: boolean;
}
```

## Event Handling

The component emits these events:

- `onGeofenceCreate`: New shape drawn
- `onGeofenceUpdate`: Existing shape modified  
- `onGeofenceDelete`: Shape deleted

All events include GeoJSON geometry for easy API integration.

## Performance Considerations

### Large Datasets
- Use clustering for many devices
- Implement viewport-based loading for geofences
- Consider WebGL layers for heavy data

### Memory Management
- Component properly cleans up map instances
- Terra Draw instances are disposed on unmount
- Event listeners are removed

## Browser Support

MapLibre GL JS requires:
- WebGL support
- Modern browser (Chrome 57+, Firefox 52+, Safari 11+)
- Mobile browsers supported

## Migration from Mapbox

Key differences from the previous Mapbox implementation:

1. **No Access Token**: Remove `MAPBOX_ACCESS_TOKEN` environment variable
2. **Better Drawing**: Terra Draw replaces mapbox-gl-draw with more features
3. **Open Source**: No usage limits or billing concerns
4. **Modern API**: Cleaner, more React-friendly component structure

## Troubleshooting

### Common Issues

**Map not loading**: Check console for tile loading errors
```javascript
// Add error handler
map.on('error', (e) => console.error('Map error:', e));
```

**Drawing not working**: Ensure Terra Draw is started
```javascript
// Check if draw is initialized
if (draw.current && !draw.current.enabled) {
  draw.current.start();
}
```

**Performance issues**: Check for memory leaks
```javascript
// Proper cleanup in useEffect
return () => {
  draw.current?.stop();
  map.current?.remove();
};
```

## Future Enhancements

- [ ] Vector tile support for faster rendering
- [ ] Custom drawing modes for specialized geofences
- [ ] 3D terrain and buildings
- [ ] Offline tile caching
- [ ] Custom marker clustering
- [ ] Animation and transitions

## Resources

- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [Terra Draw Documentation](https://terradraw.io)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [GeoJSON Specification](https://geojson.org/)