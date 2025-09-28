'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Circle,
  MapPin,
  Smartphone,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface RealtimeEvent {
  id: string;
  type: 'device_online' | 'device_offline' | 'geofence_enter' | 'geofence_exit' | 'geofence_dwell' | 'automation_triggered' | 'automation_failed';
  timestamp: string;
  device?: {
    id: string;
    name: string;
  };
  geofence?: {
    id: string;
    name: string;
  };
  automation?: {
    id: string;
    name: string;
  };
  metadata?: Record<string, any>;
}

interface RealTimeMonitorProps {
  className?: string;
  showHeader?: boolean;
  maxEvents?: number;
  compact?: boolean;
}

export const RealTimeMonitor = ({
  className = '',
  showHeader = true,
  maxEvents = 50,
  compact = false
}: RealTimeMonitorProps) => {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch real-time events from API
  const { data: liveEvents = [] } = useQuery({
    queryKey: ['realtime-events', maxEvents],
    queryFn: async () => {
      const response = await fetch(`/api/events/realtime?limit=${maxEvents}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    refetchInterval: isPaused ? false : 3000, // Refetch every 3 seconds
    enabled: !isPaused
  });

  // Update events when new data arrives
  useEffect(() => {
    if (liveEvents.length > 0) {
      setEvents(liveEvents.slice(0, maxEvents));
    }
  }, [liveEvents, maxEvents]);


  const getEventIcon = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'device_online':
        return <Smartphone className="h-4 w-4 text-green-600" />;
      case 'device_offline':
        return <Smartphone className="h-4 w-4 text-red-600" />;
      case 'geofence_enter':
        return <MapPin className="h-4 w-4 text-blue-600" />;
      case 'geofence_exit':
        return <MapPin className="h-4 w-4 text-orange-600" />;
      case 'geofence_dwell':
        return <Clock className="h-4 w-4 text-purple-600" />;
      case 'automation_triggered':
        return <Zap className="h-4 w-4 text-green-600" />;
      case 'automation_failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventColor = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'device_online':
      case 'automation_triggered':
        return 'border-l-green-400 bg-green-50';
      case 'device_offline':
      case 'automation_failed':
        return 'border-l-red-400 bg-red-50';
      case 'geofence_enter':
        return 'border-l-blue-400 bg-blue-50';
      case 'geofence_exit':
        return 'border-l-orange-400 bg-orange-50';
      case 'geofence_dwell':
        return 'border-l-purple-400 bg-purple-50';
      default:
        return 'border-l-gray-400 bg-gray-50';
    }
  };

  const getEventDescription = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'device_online':
        return `${event.device?.name} came online`;
      case 'device_offline':
        return `${event.device?.name} went offline`;
      case 'geofence_enter':
        return `${event.device?.name} entered ${event.geofence?.name}`;
      case 'geofence_exit':
        return `${event.device?.name} exited ${event.geofence?.name}`;
      case 'geofence_dwell':
        return `${event.device?.name} dwelling in ${event.geofence?.name}`;
      case 'automation_triggered':
        return `${event.automation?.name} executed for ${event.device?.name}`;
      case 'automation_failed':
        return `${event.automation?.name} failed for ${event.device?.name}`;
      default:
        return 'Unknown event';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!isExpanded && compact) {
    return (
      <div className={`bg-white rounded-md border border-gray-200 ${className}`}>
        <div className="p-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`}></div>
              <span className="text-sm font-medium text-gray-900">Live Activity</span>
            </div>
            <span className="text-xs text-gray-500">{events.length} events</span>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-gray-400 hover:text-gray-600"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-md border border-gray-200 ${className}`}>
      {showHeader && (
        <div className="p-2 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`}></div>
                <h3 className="text-lg font-semibold text-gray-900">Real-Time Activity</h3>
              </div>
              <span className="text-sm text-gray-500">{events.length} events</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-3 py-1 rounded text-sm font-medium ${isPaused
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>

              <button
                onClick={() => setEvents([])}
                className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Clear
              </button>

              {compact && (
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <div className="p-3 text-center text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No recent activity</p>
            <p className="text-sm">Events will appear here in real-time</p>
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {events.map((event) => (
              <div
                key={event.id}
                className={`border-l-4 rounded-r-lg p-3 ${getEventColor(event)} transition-all duration-200 hover:shadow-sm`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getEventIcon(event)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {getEventDescription(event)}
                      </p>
                      {event.metadata && (
                        <div className="mt-1 text-xs text-gray-600">
                          {event.type.includes('geofence') && event.metadata.location && (
                            <span>Location: {event.metadata.location[1].toFixed(4)}, {event.metadata.location[0].toFixed(4)}</span>
                          )}
                          {event.type.includes('automation') && event.metadata.executionTime && (
                            <span>Execution: {event.metadata.executionTime}ms</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};