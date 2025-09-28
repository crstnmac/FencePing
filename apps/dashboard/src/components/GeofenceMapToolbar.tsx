'use client';

import { useState } from 'react';
import {
  Square,
  Circle,
  Pentagon,
  Move,
  Ruler,
  Grid3X3,
  Target,
  Download,
  Upload,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Palette
} from 'lucide-react';

interface GeofenceMapToolbarProps {
  activeDrawingTool: 'select' | 'circle' | 'polygon' | 'rectangle' | 'measure' | null;
  onToolChange: (tool: 'select' | 'circle' | 'polygon' | 'rectangle' | 'measure' | null) => void;
  selectedGeofences: string[];
  onBulkDelete: () => void;
  onBulkDuplicate: () => void;
  onToggleSnapToGrid: () => void;
  onExportGeofences: () => void;
  onImportGeofences: () => void;
  showDevices: boolean;
  onToggleDevices: () => void;
  mapStyle: 'streets' | 'satellite' | 'terrain';
  onMapStyleChange: (style: 'streets' | 'satellite' | 'terrain') => void;
  snapToGrid: boolean;
}

export function GeofenceMapToolbar({
  activeDrawingTool,
  onToolChange,
  selectedGeofences,
  onBulkDelete,
  onBulkDuplicate,
  onToggleSnapToGrid,
  onExportGeofences,
  onImportGeofences,
  showDevices,
  onToggleDevices,
  mapStyle,
  onMapStyleChange,
  snapToGrid
}: GeofenceMapToolbarProps) {
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const drawingTools = [
    { id: 'select', icon: Move, label: 'Select & Move', shortcut: 'V' },
    { id: 'circle', icon: Circle, label: 'Circle Geofence', shortcut: 'C' },
    { id: 'polygon', icon: Pentagon, label: 'Polygon Geofence', shortcut: 'P' },
    { id: 'rectangle', icon: Square, label: 'Rectangle Geofence', shortcut: 'R' },
    { id: 'measure', icon: Ruler, label: 'Measure Distance', shortcut: 'M' }
  ] as const;

  const mapStyles = [
    { id: 'streets', label: 'Streets', preview: 'bg-gray-100' },
    { id: 'satellite', label: 'Satellite', preview: 'bg-green-100' },
    { id: 'terrain', label: 'Terrain', preview: 'bg-amber-100' }
  ] as const;

  return (
    <div className="absolute top-6 left-6 z-10 flex items-start gap-3">
      {/* Drawing Tools */}
      <div className="bg-white/95 backdrop-blur-sm rounded-md shadow-lg border border-neutral-200/50 p-2">
        <div className="flex flex-col gap-1">
          {drawingTools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeDrawingTool === tool.id;

            return (
              <button
                key={tool.id}
                onClick={() => onToolChange(tool.id as any)}
                className={`p-3 rounded-md transition-all duration-150 group relative ${isActive
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                title={`${tool.label} (${tool.shortcut})`}
              >
                <Icon className="h-4 w-4" />

                {/* Tooltip */}
                <div className="absolute left-full ml-3 px-3 py-2 bg-neutral-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20 font-medium">
                  {tool.label}
                  <span className="ml-2 text-neutral-400">({tool.shortcut})</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Utility Tools */}
      <div className="bg-white/95 backdrop-blur-sm rounded-md shadow-lg border border-neutral-200/50 p-2">
        <div className="flex flex-col gap-1">
          <button
            onClick={onToggleSnapToGrid}
            className={`p-3 rounded-md transition-all duration-150 group relative ${snapToGrid ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            title="Snap to Grid"
          >
            <Grid3X3 className="h-4 w-4" />
            <div className="absolute left-full ml-3 px-3 py-2 bg-neutral-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20 font-medium">
              Snap to Grid
            </div>
          </button>

          <button
            onClick={onToggleDevices}
            className={`p-3 rounded-md transition-all duration-150 group relative ${showDevices ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            title="Toggle Device Visibility"
          >
            {showDevices ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <div className="absolute left-full ml-3 px-3 py-2 bg-neutral-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20 font-medium">
              {showDevices ? 'Hide Devices' : 'Show Devices'}
            </div>
          </button>
        </div>
      </div>

      {/* Bulk Operations (show only when geofences are selected) */}
      {selectedGeofences.length > 0 && (
        <div className="bg-white rounded-md shadow-lg border border-gray-200 p-2">
          <div className="flex items-center space-x-1 text-xs text-gray-600 mb-2 px-2">
            <Target className="h-3 w-3" />
            <span>{selectedGeofences.length} selected</span>
          </div>

          <div className="flex flex-col space-y-1">
            <button
              onClick={onBulkDuplicate}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md group relative"
              title="Duplicate Selected"
            >
              <Copy className="h-4 w-4" />
              <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
                Duplicate Selected
              </div>
            </button>

            <button
              onClick={onBulkDelete}
              className="p-2 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-md group relative"
              title="Delete Selected"
            >
              <Trash2 className="h-4 w-4" />
              <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
                Delete Selected
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Layer & Style Controls */}
      <div className="bg-white rounded-md shadow-lg border border-gray-200 p-2">
        <div className="flex flex-col space-y-1">
          <div className="relative">
            <button
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md group relative"
              title="Map Style"
            >
              <Palette className="h-4 w-4" />
              <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
                Map Style
              </div>
            </button>

            {showStyleMenu && (
              <div className="absolute left-full ml-2 top-0 bg-white rounded-md shadow-lg border border-gray-200 p-2 min-w-32 z-30">
                <div className="text-xs font-medium text-gray-700 mb-2">Map Style</div>
                {mapStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      onMapStyleChange(style.id);
                      setShowStyleMenu(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-2.5 rounded text-xs ${mapStyle === style.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                      }`}
                  >
                    <div className={`w-3 h-3 rounded ${style.preview}`} />
                    <span>{style.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onExportGeofences}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md group relative"
            title="Export Geofences"
          >
            <Download className="h-4 w-4" />
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
              Export Geofences
            </div>
          </button>

          <button
            onClick={onImportGeofences}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md group relative"
            title="Import Geofences"
          >
            <Upload className="h-4 w-4" />
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
              Import Geofences
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}