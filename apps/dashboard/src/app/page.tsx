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
  BarChart3,
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
      case 'geofence_enter':
        return 'entered';
      case 'geofence_exit':
        return 'exited';
      case 'geofence_dwell':
        return 'dwelling in';
      default:
        return eventType;
    }
  };

  // Use real stats or show loading/error states
  const currentStats = stats || {
    totalDevices: 0,
    activeDevices: 0,
    geofences: 0,
    todayEvents: 0,
    automationSuccess: 0,
    failedWebhooks: 0,
  };

  if (statsError) {
    return (
      <div className="flex flex-col h-full bg-neutral-50">
        <Header
          title="Dashboard"
          subtitle="Monitor your geofence automations and device activity"
        />
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-medium text-neutral-900 mb-3">Unable to load dashboard</h3>
            <p className="text-neutral-600 leading-relaxed">
              There was an error loading dashboard statistics. Please try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      <Header title="Dashboard" subtitle="Monitor your geofence automations and device activity" />

      <div className="flex-1 overflow-auto p-3">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-10">
          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-md flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Total Devices</p>
                <p className="text-2xl font-light text-neutral-900">
                  {statsLoading ? '—' : currentStats.totalDevices.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-md flex items-center justify-center">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Active Devices</p>
                <p className="text-2xl font-light text-neutral-900">
                  {statsLoading ? '—' : currentStats.activeDevices.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-md flex items-center justify-center">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Geofences</p>
                <p className="text-2xl font-light text-neutral-900">
                  {statsLoading ? '—' : currentStats.geofences.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-md flex items-center justify-center">
                <Zap className="h-6 w-6 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Today&apos;s Events</p>
                <p className="text-2xl font-light text-neutral-900">
                  {statsLoading ? '—' : currentStats.todayEvents.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-md flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Success Rate</p>
                <p className="text-2xl font-light text-neutral-900">
                  {statsLoading ? '—' : `${currentStats.automationSuccess}%`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-md flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Failed Webhooks</p>
                <p className="text-2xl font-light text-neutral-900">
                  {statsLoading ? '—' : currentStats.failedWebhooks.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Events */}
          <div className="bg-white rounded-md shadow-sm border border-neutral-200">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h3 className="text-lg font-medium text-neutral-900">Recent Events</h3>
            </div>
            <div className="p-3">
              {eventsLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div
                          className="h-4 bg-neutral-300 rounded animate-pulse"
                          style={{ width: '85%' }}
                        />
                        <div
                          className="h-3 bg-neutral-200 rounded animate-pulse"
                          style={{ width: '65%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentEvents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-neutral-100 rounded-md flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-6 w-6 text-neutral-400" />
                  </div>
                  <p className="text-sm text-neutral-600">No recent events</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-4">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          event.event_type === 'geofence_enter'
                            ? 'bg-green-500'
                            : event.event_type === 'geofence_exit'
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate mb-1">
                          {event.device?.name || 'Unknown Device'}{' '}
                          {getEventDisplayName(event.event_type)}{' '}
                          {event.geofence?.name || 'Unknown Geofence'}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatEventTime(event.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-md shadow-sm border border-neutral-200">
            <div className="px-6 py-4 border-b border-neutral-200">
              <h3 className="text-lg font-medium text-neutral-900">Quick Actions</h3>
            </div>
            <div className="p-3">
              <div className="space-y-4">
                <button className="w-full text-left p-2 rounded-md border border-neutral-200 hover:border-neutral-300 hover:shadow-sm transition-all duration-150 group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-md flex items-center justify-center group-hover:bg-blue-100 transition-colors duration-150">
                      <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 mb-1">Create Geofence</p>
                      <p className="text-sm text-neutral-600">
                        Draw a new geofenced area on the map
                      </p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-neutral-400 group-hover:text-neutral-600 transition-colors duration-150" />
                  </div>
                </button>

                <button className="w-full text-left p-2 rounded-md border border-neutral-200 hover:border-neutral-300 hover:shadow-sm transition-all duration-150 group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-md flex items-center justify-center group-hover:bg-green-100 transition-colors duration-150">
                      <Smartphone className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 mb-1">Add Device</p>
                      <p className="text-sm text-neutral-600">Register a new tracking device</p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-neutral-400 group-hover:text-neutral-600 transition-colors duration-150" />
                  </div>
                </button>

                <button className="w-full text-left p-2 rounded-md border border-neutral-200 hover:border-neutral-300 hover:shadow-sm transition-all duration-150 group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-md flex items-center justify-center group-hover:bg-purple-100 transition-colors duration-150">
                      <Zap className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 mb-1">Setup Automation</p>
                      <p className="text-sm text-neutral-600">Create a new webhook automation</p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-neutral-400 group-hover:text-neutral-600 transition-colors duration-150" />
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
