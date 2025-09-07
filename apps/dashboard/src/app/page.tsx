'use client';

import { Header } from '../components/Header';
import { RealTimeMonitor } from '../components/RealTimeMonitor';
import { useDashboardStats, useRecentEvents } from '../hooks/useApi';
import { 
  Activity, 
  MapPin, 
  Smartphone, 
  Zap,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  BarChart3
} from 'lucide-react';

export default function HomePage() {
  // Fetch real data from API
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: recentEvents = [], isLoading: eventsLoading } = useRecentEvents(4);

  // Helper function to format event time
  const formatEventTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  // Helper function to get event type display name
  const getEventDisplayName = (eventType: string) => {
    switch (eventType) {
      case 'geofence_enter': return 'entered';
      case 'geofence_exit': return 'exited';
      case 'geofence_dwell': return 'dwelling in';
      default: return eventType;
    }
  };

  // Use real stats or show loading/error states
  const currentStats = stats || {
    totalDevices: 0,
    activeDevices: 0,
    geofences: 0,
    todayEvents: 0,
    automationSuccess: 0,
    failedWebhooks: 0
  };

  if (statsError) {
    return (
      <div className="flex flex-col h-full">
        <Header 
          title="Dashboard" 
          subtitle="Monitor your geofence automations and device activity"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard</h3>
            <p className="text-gray-600">There was an error loading dashboard statistics.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Dashboard" 
        subtitle="Monitor your geofence automations and device activity"
      />
      
      <div className="flex-1 overflow-auto p-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Smartphone className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-xs font-medium text-gray-600">Total Devices</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsLoading ? '...' : currentStats.totalDevices}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-xs font-medium text-gray-600">Active Devices</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsLoading ? '...' : currentStats.activeDevices}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <MapPin className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-xs font-medium text-gray-600">Geofences</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsLoading ? '...' : currentStats.geofences}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-xs font-medium text-gray-600">Today's Events</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsLoading ? '...' : currentStats.todayEvents}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-xs font-medium text-gray-600">Success Rate</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsLoading ? '...' : `${currentStats.automationSuccess}%`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-xs font-medium text-gray-600">Failed Webhooks</p>
                <p className="text-xl font-bold text-gray-900">
                  {statsLoading ? '...' : currentStats.failedWebhooks}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Events */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-2 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
            </div>
            <div className="p-4">
              {eventsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-300 rounded animate-pulse mb-1" style={{width: '80%'}} />
                        <div className="h-3 bg-gray-300 rounded animate-pulse" style={{width: '60%'}} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-xs text-gray-500">No recent events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          event.event_type === 'geofence_enter' ? 'bg-green-500' :
                          event.event_type === 'geofence_exit' ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                        <div>
                          <p className="text-xs font-medium text-gray-900">
                            {event.device?.name || 'Unknown Device'} {getEventDisplayName(event.event_type)} {event.geofence?.name || 'Unknown Geofence'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatEventTime(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-2 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">Create Geofence</p>
                      <p className="text-xs text-gray-500">Draw a new geofenced area on the map</p>
                    </div>
                  </div>
                </button>

                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">Add Device</p>
                      <p className="text-xs text-gray-500">Register a new tracking device</p>
                    </div>
                  </div>
                </button>

                <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">Setup Automation</p>
                      <p className="text-xs text-gray-500">Create a new webhook automation</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
