'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  MapPin,
  Clock,
  Activity,
  Zap,
  AlertTriangle,
  Target,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  BarChart3,
} from 'lucide-react';

interface GeofenceAnalyticsData {
  geofenceEvents: Array<{
    id: string;
    geofenceId: string;
    geofenceName: string;
    deviceId: string;
    deviceName: string;
    eventType: 'enter' | 'exit' | 'dwell';
    timestamp: Date;
    duration?: number;
    automationTriggered: boolean;
  }>;
  geofences: Array<{
    id: string;
    name: string;
    category: string;
    isActive: boolean;
    created: Date;
  }>;
  devices: Array<{
    id: string;
    name: string;
    lastActive: Date;
    totalEvents: number;
  }>;
}

interface GeofenceAnalyticsProps {
  data: GeofenceAnalyticsData;
  onRefresh?: () => void;
  onExport?: (type: 'csv' | 'pdf' | 'json') => void;
  className?: string;
}

export function GeofenceAnalytics({
  data,
  onRefresh,
  onExport,
  className = '',
}: GeofenceAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'events' | 'devices' | 'geofences'>(
    'events'
  );
  const [showHeatMap, setShowHeatMap] = useState(false);

  // Calculate analytics metrics
  const analytics = useMemo(() => {
    const now = new Date();
    const timeRangeMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    }[timeRange];

    const cutoffDate = new Date(now.getTime() - timeRangeMs);
    const recentEvents = data.geofenceEvents.filter((event) => event.timestamp >= cutoffDate);

    // Total events
    const totalEvents = recentEvents.length;
    const enterEvents = recentEvents.filter((e) => e.eventType === 'enter').length;
    const exitEvents = recentEvents.filter((e) => e.eventType === 'exit').length;
    const dwellEvents = recentEvents.filter((e) => e.eventType === 'dwell').length;

    // Active devices
    const activeDevices = new Set(recentEvents.map((e) => e.deviceId)).size;

    // Active geofences
    const activeGeofences = new Set(recentEvents.map((e) => e.geofenceId)).size;

    // Automation success rate
    const automationTriggered = recentEvents.filter((e) => e.automationTriggered).length;
    const automationRate = totalEvents > 0 ? (automationTriggered / totalEvents) * 100 : 0;

    // Most active geofences
    const geofenceActivity = recentEvents.reduce(
      (acc, event) => {
        acc[event.geofenceId] = (acc[event.geofenceId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topGeofences = Object.entries(geofenceActivity)
      .map(([id, count]) => {
        const geofence = data.geofences.find((g) => g.id === id);
        return {
          id,
          name: geofence?.name || 'Unknown',
          events: count,
          category: geofence?.category || 'Unknown',
        };
      })
      .sort((a, b) => b.events - a.events)
      .slice(0, 5);

    // Device activity
    const deviceActivity = recentEvents.reduce(
      (acc, event) => {
        acc[event.deviceId] = (acc[event.deviceId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topDevices = Object.entries(deviceActivity)
      .map(([id, count]) => {
        const device = data.devices.find((d) => d.id === id);
        return {
          id,
          name: device?.name || 'Unknown',
          events: count,
        };
      })
      .sort((a, b) => b.events - a.events)
      .slice(0, 5);

    // Event timeline
    const timelineData = [];
    const bucketSize = timeRangeMs / 24; // 24 data points

    for (let i = 0; i < 24; i++) {
      const bucketStart = new Date(cutoffDate.getTime() + i * bucketSize);
      const bucketEnd = new Date(cutoffDate.getTime() + (i + 1) * bucketSize);

      const bucketEvents = recentEvents.filter(
        (e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd
      );

      timelineData.push({
        time: bucketStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: timeRange === '24h' ? 'numeric' : undefined,
        }),
        enter: bucketEvents.filter((e) => e.eventType === 'enter').length,
        exit: bucketEvents.filter((e) => e.eventType === 'exit').length,
        dwell: bucketEvents.filter((e) => e.eventType === 'dwell').length,
        total: bucketEvents.length,
      });
    }

    // Event type distribution
    const eventDistribution = [
      { name: 'Enter', value: enterEvents, color: '#10B981' },
      { name: 'Exit', value: exitEvents, color: '#EF4444' },
      { name: 'Dwell', value: dwellEvents, color: '#F59E0B' },
    ];

    return {
      totalEvents,
      enterEvents,
      exitEvents,
      dwellEvents,
      activeDevices,
      activeGeofences,
      automationRate,
      topGeofences,
      topDevices,
      timelineData,
      eventDistribution,
    };
  }, [data, timeRange]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    color = 'blue',
  }: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    trend?: { direction: 'up' | 'down'; value: string };
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      orange: 'bg-orange-50 text-orange-600',
      purple: 'bg-purple-50 text-purple-600',
      red: 'bg-red-50 text-red-600',
    };

    return (
      <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-12 h-12 rounded-md flex items-center justify-center ${colorClasses[color]}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-sm ${
                trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-light text-neutral-900">{value}</div>
          <div className="text-sm font-medium text-neutral-500">{title}</div>
        </div>
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col bg-neutral-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 p-3">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-light text-neutral-900 tracking-tight">
              Geofence Analytics
            </h2>
            <p className="text-neutral-600 mt-2">Real-time insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHeatMap(!showHeatMap)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors duration-150 ${
                showHeatMap
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <Eye className="h-5 w-5" />
              <span>Heat Map</span>
            </button>
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors duration-150"
            >
              <RefreshCw className="h-5 w-5" />
              <span>Refresh</span>
            </button>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                className="appearance-none bg-white border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-10">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Total Events"
            value={analytics.totalEvents.toLocaleString()}
            icon={Activity}
            trend={{ direction: 'up', value: '+12%' }}
            color="blue"
          />
          <StatCard
            title="Active Devices"
            value={analytics.activeDevices}
            icon={Users}
            trend={{ direction: 'up', value: '+5%' }}
            color="green"
          />
          <StatCard
            title="Active Geofences"
            value={analytics.activeGeofences}
            icon={MapPin}
            color="purple"
          />
          <StatCard
            title="Automation Success"
            value={`${analytics.automationRate.toFixed(1)}%`}
            icon={Zap}
            trend={{
              direction: analytics.automationRate >= 85 ? 'up' : 'down',
              value: analytics.automationRate >= 85 ? 'Good' : 'Needs attention',
            }}
            color={analytics.automationRate >= 85 ? 'green' : 'orange'}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Timeline */}
          <div className="lg:col-span-2 bg-white rounded-md shadow-sm border border-neutral-200 p-3">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-neutral-900">Event Timeline</h3>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-neutral-600">Enter</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-neutral-600">Exit</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-neutral-600">Dwell</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  angle={timeRange === '24h' ? -45 : 0}
                  textAnchor={timeRange === '24h' ? 'end' : 'middle'}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="enter"
                  stackId="1"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="exit"
                  stackId="1"
                  stroke="#EF4444"
                  fill="#EF4444"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="dwell"
                  stackId="1"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Event Distribution */}
          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3">
            <h3 className="text-lg font-medium text-neutral-900 mb-6">Event Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.eventDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                >
                  {analytics.eventDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Geofences */}
          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3">
            <h3 className="text-lg font-medium text-neutral-900 mb-6">Most Active Geofences</h3>
            <div className="space-y-4">
              {analytics.topGeofences.map((geofence, index) => (
                <div
                  key={geofence.id}
                  className="flex items-center justify-between p-2 bg-neutral-50 rounded-md border border-neutral-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center font-medium">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">{geofence.name}</div>
                      <div className="text-sm text-neutral-500 capitalize">{geofence.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-light text-neutral-900">{geofence.events}</div>
                    <div className="text-sm text-neutral-500">events</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Devices */}
          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3">
            <h3 className="text-lg font-medium text-neutral-900 mb-6">Most Active Devices</h3>
            <div className="space-y-4">
              {analytics.topDevices.map((device, index) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-2 bg-neutral-50 rounded-md border border-neutral-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-md flex items-center justify-center font-medium">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">{device.name}</div>
                      <div className="text-sm text-neutral-500">Device</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-light text-neutral-900">{device.events}</div>
                    <div className="text-sm text-neutral-500">events</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-neutral-900">Export Analytics</h3>
              <p className="text-neutral-600 mt-1">Download detailed reports and data</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onExport?.('csv')}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 transition-colors duration-150"
              >
                <Download className="h-5 w-5" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => onExport?.('json')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors duration-150"
              >
                <Download className="h-5 w-5" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => onExport?.('pdf')}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors duration-150"
              >
                <Download className="h-5 w-5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
