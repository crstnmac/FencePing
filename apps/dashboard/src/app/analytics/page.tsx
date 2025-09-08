'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';
import { useEvents, useDevices, useGeofences, useAutomations, useAnalytics } from '../../hooks/useApi';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  MapPin,
  Smartphone,
  Zap,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'events' | 'automations' | 'devices'>('events');
  
  // API hooks
  const { data: events = [] } = useEvents();
  const { data: devices = [] } = useDevices();
  const { data: geofences = [] } = useGeofences();
  const { data: automations = [] } = useAutomations();

  // Calculate metrics
  const totalEvents = Array.isArray(events) ? events.length : 0;
  const totalDevices = devices.length;
  const activeDevices = devices.filter(d => d.status === 'online' || d.is_active).length;
  const totalGeofences = geofences.length;
  const activeAutomations = automations.filter(a => a.is_active).length;

  // Event type distribution
  const eventTypes = Array.isArray(events) ? events.reduce((acc, event: any) => {
    const type = event.event_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) : {};

  // Fetch analytics data from API
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useAnalytics({ range: dateRange });

  const deviceActivity = analyticsData?.deviceActivity || [];
  const automationStats = analyticsData?.automationStats || [];

  // Top performing geofences
  const topGeofences = geofences
    .map(geofence => ({
      ...geofence,
      eventCount: Array.isArray(events) ? events.filter((e: any) => e.geofence?.id === geofence.id).length : 0
    }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 5);

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Analytics & Insights" 
        subtitle="Monitor performance, track usage patterns, and optimize your geofence automation"
      />
      
      <div className="flex-1 overflow-auto p-3">
        {/* Header Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-all duration-200">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-all duration-200">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Total Events</p>
                <p className="text-lg font-semibold text-gray-900">{totalEvents.toLocaleString()}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  {analyticsData?.eventsTrend || '+12.5%'} vs last period
                </p>
              </div>
              <div className="p-1.5 bg-blue-100 rounded-full">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Active Devices</p>
                <p className="text-lg font-semibold text-gray-900">{activeDevices} / {totalDevices}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  {analyticsData?.devicesTrend || '+5.2%'} vs last period
                </p>
              </div>
              <div className="p-1.5 bg-green-100 rounded-full">
                <Smartphone className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Active Geofences</p>
                <p className="text-lg font-semibold text-gray-900">{totalGeofences}</p>
                <p className="text-xs text-gray-500 flex items-center mt-1">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  No change
                </p>
              </div>
              <div className="p-1.5 bg-purple-100 rounded-full">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Active Automations</p>
                <p className="text-lg font-semibold text-gray-900">{activeAutomations}</p>
                <p className="text-xs text-green-600 flex items-center mt-1">
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  {analyticsData?.automationsTrend || '+8.1%'} vs last period
                </p>
              </div>
              <div className="p-1.5 bg-orange-100 rounded-full">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Event Types Distribution */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Event Distribution</h3>
              <PieChart className="h-4 w-4 text-gray-400" />
            </div>
            
            <div className="space-y-3">
              {Object.entries(eventTypes).map(([type, count]) => {
                const percentage = Math.round((count / totalEvents) * 100);
                const colors = {
                  enter: 'bg-green-500',
                  exit: 'bg-red-500',
                  dwell: 'bg-yellow-500',
                  unknown: 'bg-gray-500'
                };
                
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[type as keyof typeof colors] || 'bg-gray-500'}`}></div>
                      <span className="text-xs font-medium text-gray-900 capitalize">{type}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600">{count}</span>
                      <span className="text-xs text-gray-400">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Device Activity Chart */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Device Activity</h3>
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </div>
            
            {deviceActivity.length > 0 ? (
              <div className="space-y-2">
                {deviceActivity.slice(-7).map((day, index) => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-16">
                      {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                    </span>
                    <div className="flex-1 flex gap-0.5">
                      <div
                        className="bg-green-400 rounded-sm h-5 flex items-center justify-center text-white text-xs"
                        style={{ width: `${(day.online / (day.online + day.offline)) * 100}%`, minWidth: '30px' }}
                      >
                        {day.online}
                      </div>
                      <div
                        className="bg-red-400 rounded-sm h-5 flex items-center justify-center text-white text-xs"
                        style={{ width: `${(day.offline / (day.online + day.offline)) * 100}%`, minWidth: '25px' }}
                      >
                        {day.offline}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p className="text-xs text-gray-500">No device activity data available for this period</p>
              </div>
            )}
            
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-gray-600">Online</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span className="text-gray-600">Offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Automation Performance */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Automation Performance</h3>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Automation
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Executions
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success/Failed
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              {automationStats.length > 0 ? (
                <tbody className="divide-y divide-gray-100">
                  {automationStats.map((automation, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-all duration-200">
                      <td className="py-3 px-3 text-xs font-medium text-gray-900">
                        {automation.name}
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full"
                              style={{ width: `${automation.success}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">{automation.success}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-600">
                        {automation.total.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-600">
                        <span className="text-green-600">{Math.round(automation.total * automation.success / 100)}</span>
                        {' / '}
                        <span className="text-red-600">{Math.round(automation.total * automation.failed / 100)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          automation.success >= 95 ? 'bg-green-100 text-green-800' :
                          automation.success >= 90 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {automation.success >= 95 ? (
                            <><CheckCircle className="w-2.5 h-2.5 mr-1" /> Excellent</>
                          ) : automation.success >= 90 ? (
                            <><AlertCircle className="w-2.5 h-2.5 mr-1" /> Good</>
                          ) : (
                            <><AlertCircle className="w-2.5 h-2.5 mr-1" /> Needs Attention</>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ) : (
                <tbody>
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <TrendingUp className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                      <p className="text-xs text-gray-500">No automation performance data available</p>
                      <p className="text-xs text-gray-400 mt-1">Data will appear here as automations run</p>
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        </div>

        {/* Top Performing Geofences */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Top Active Geofences</h3>
            <MapPin className="h-4 w-4 text-gray-400" />
          </div>
          
          <div className="space-y-3">
            {topGeofences.map((geofence, index) => (
              <div key={geofence.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">#{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-900">{geofence.name}</h4>
                    <p className="text-xs text-gray-600">{geofence.geofence_type} • Created {new Date(geofence.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-900">{geofence.eventCount} events</p>
                  <p className="text-xs text-gray-600">
                    {geofence.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            ))}
            
            {topGeofences.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <MapPin className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p className="text-xs">No geofence activity data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
