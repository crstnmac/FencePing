'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Filter,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { useDeliveries } from '../hooks/useApi';
import React from 'react';

// Simple time ago formatter
function timeAgo(date: string): string {
  const now = new Date().getTime();
  const time = new Date(date).getTime();
  const diffInMinutes = Math.floor((now - time) / (1000 * 60));

  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

interface DeliveryMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  automationId?: string; // Optional filter for specific automation
}

interface DeliveryLog {
  id: string;
  automation_id: string;
  automation_name: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempt: number;
  last_error?: string;
  response_code?: number;
  response_time_ms?: number;
  created_at: string;
  updated_at: string;
  geofence_event: {
    type: 'enter' | 'exit' | 'dwell';
    device_name: string;
    geofence_name: string;
    timestamp: string;
  };
}

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
  success: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
  failed: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  retrying: { bg: 'bg-blue-100', text: 'text-blue-800', icon: RefreshCw },
};

export function DeliveryMonitor({ isOpen, onClose, automationId }: DeliveryMonitorProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    data: deliveryData = [],
    isLoading,
    refetch,
  } = useDeliveries({
    limit: 100,
    automation_id: automationId,
  });

  // Extract deliveries array from response
  const deliveries = Array.isArray(deliveryData) ? deliveryData : (deliveryData as any)?.data || [];

  // Auto-refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh || !isOpen) return;

    const interval = setInterval(() => {
      refetch();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, isOpen, refetch]);

  // Calculate statistics
  const stats = {
    total: deliveries.length,
    success: deliveries.filter((d: DeliveryLog) => d.status === 'success').length,
    failed: deliveries.filter((d: DeliveryLog) => d.status === 'failed').length,
    pending: deliveries.filter(
      (d: DeliveryLog) => d.status === 'pending' || d.status === 'retrying'
    ).length,
    avgResponseTime:
      deliveries
        .filter((d: DeliveryLog) => d.response_time_ms)
        .reduce((sum: number, d: DeliveryLog) => sum + (d.response_time_ms || 0), 0) /
      Math.max(deliveries.filter((d: DeliveryLog) => d.response_time_ms).length, 1),
  };

  const successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0;

  const filteredDeliveries = deliveries.filter((delivery: DeliveryLog) => {
    if (statusFilter === 'all') return true;
    return delivery.status === statusFilter;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-md">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Delivery Monitor</h2>
                <p className="text-sm text-gray-600">
                  Real-time webhook delivery tracking and analytics
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="autoRefresh" className="text-sm text-gray-600">
                  Auto-refresh
                </label>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(90vh-8rem)]">
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Stats and Filters */}
            <div className="border-b border-gray-200 p-2">
              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-white border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Total</p>
                      <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
                    </div>
                    <Activity className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Success</p>
                      <p className="text-lg font-semibold text-green-600">{stats.success}</p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Failed</p>
                      <p className="text-lg font-semibold text-red-600">{stats.failed}</p>
                    </div>
                    <XCircle className="h-5 w-5 text-red-400" />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Success Rate</p>
                      <p className="text-lg font-semibold text-blue-600">
                        {successRate.toFixed(1)}%
                      </p>
                    </div>
                    {successRate >= 95 ? (
                      <TrendingUp className="h-5 w-5 text-green-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-600">Avg Response</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {stats.avgResponseTime.toFixed(0)}ms
                      </p>
                    </div>
                    <Zap className="h-5 w-5 text-yellow-400" />
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as any)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1h">Last Hour</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Deliveries List */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading deliveries...</span>
                </div>
              ) : filteredDeliveries.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <Activity className="h-8 w-8 mb-2" />
                  <p>No deliveries found for the selected criteria</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredDeliveries.map((delivery: DeliveryLog) => {
                    const statusConfig = STATUS_COLORS[delivery.status];
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={delivery.id}
                        onClick={() => setSelectedDelivery(delivery)}
                        className="p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div
                                className={`flex items-center space-x-2 px-3 py-2 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                <span>{delivery.status.toUpperCase()}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {delivery.automation_name}
                              </span>
                              {delivery.attempt > 1 && (
                                <span className="text-xs text-gray-500">
                                  Attempt {delivery.attempt}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>
                                {delivery.geofence_event.device_name} {delivery.geofence_event.type}
                                ed {delivery.geofence_event.geofence_name}
                              </span>
                              <span>•</span>
                              <span>{timeAgo(delivery.created_at)}</span>
                              {delivery.response_time_ms && (
                                <>
                                  <span>•</span>
                                  <span>{delivery.response_time_ms}ms</span>
                                </>
                              )}
                              {delivery.response_code && (
                                <>
                                  <span>•</span>
                                  <span
                                    className={
                                      delivery.response_code >= 400
                                        ? 'text-red-600'
                                        : 'text-green-600'
                                    }
                                  >
                                    HTTP {delivery.response_code}
                                  </span>
                                </>
                              )}
                            </div>

                            {delivery.last_error && (
                              <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                                {delivery.last_error}
                              </div>
                            )}
                          </div>

                          <button className="text-gray-400 hover:text-gray-600">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedDelivery && (
            <div className="w-96 border-l border-gray-200 bg-gray-50">
              <div className="p-2 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Delivery Details</h3>
                  <button
                    onClick={() => setSelectedDelivery(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-2 space-y-4 overflow-auto h-full">
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {(() => {
                    const statusConfig = STATUS_COLORS[selectedDelivery.status];
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div
                        className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text}`}
                      >
                        <StatusIcon className="h-4 w-4" />
                        <span>{selectedDelivery.status.toUpperCase()}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Event Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Geofence Event
                  </label>
                  <div className="bg-white rounded-md p-3 text-sm">
                    <div className="space-y-1">
                      <div>
                        <span className="font-medium">Device:</span>{' '}
                        {selectedDelivery.geofence_event.device_name}
                      </div>
                      <div>
                        <span className="font-medium">Geofence:</span>{' '}
                        {selectedDelivery.geofence_event.geofence_name}
                      </div>
                      <div>
                        <span className="font-medium">Event:</span>{' '}
                        {selectedDelivery.geofence_event.type.toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium">Time:</span>{' '}
                        {new Date(selectedDelivery.geofence_event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Info
                  </label>
                  <div className="bg-white rounded-md p-3 text-sm space-y-2">
                    <div>
                      <span className="font-medium">Automation:</span>{' '}
                      {selectedDelivery.automation_name}
                    </div>
                    <div>
                      <span className="font-medium">Attempt:</span> {selectedDelivery.attempt}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(selectedDelivery.created_at).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Updated:</span>{' '}
                      {new Date(selectedDelivery.updated_at).toLocaleString()}
                    </div>
                    {selectedDelivery.response_time_ms && (
                      <div>
                        <span className="font-medium">Response Time:</span>{' '}
                        {selectedDelivery.response_time_ms}ms
                      </div>
                    )}
                    {selectedDelivery.response_code && (
                      <div>
                        <span className="font-medium">HTTP Status:</span>
                        <span
                          className={
                            selectedDelivery.response_code >= 400
                              ? 'text-red-600'
                              : 'text-green-600'
                          }
                        >
                          {selectedDelivery.response_code}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Details */}
                {selectedDelivery.last_error && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Error Details
                    </label>
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                      {selectedDelivery.last_error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
