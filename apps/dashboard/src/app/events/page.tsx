'use client';

import { useState, useMemo } from 'react';
import { Header } from '../../components/Header';
import { useEvents } from '../../hooks/useApi';
import { Event } from '../../services/api';
import {
  Search,
  Filter,
  Download,
  Calendar,
  MapPin,
  Smartphone,
  Activity,
  Clock,
  ArrowRight,
  ArrowLeft,
  Circle,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

export default function EventsPage() {
  // State for filters and UI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'geofence_enter' | 'geofence_exit' | 'geofence_dwell'>('all');
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [filterGeofence, setFilterGeofence] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Build API parameters based on filters
  const apiParams = useMemo(() => {
    const params: any = {
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
    };

    if (filterType !== 'all') {
      params.event_type = filterType;
    }

    // Date filtering
    if (dateRange !== 'all') {
      const now = new Date();
      if (dateRange === 'today') {
        params.from_date = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.from_date = weekAgo.toISOString();
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.from_date = monthAgo.toISOString();
      }
    }

    return params;
  }, [filterType, dateRange, currentPage, itemsPerPage]);

  // API call with React Query
  const { data: eventsResponse, isLoading, error, refetch } = useEvents(apiParams);
  const events = useMemo(() => eventsResponse?.data || [], [eventsResponse?.data]);
  const totalEvents = eventsResponse?.pagination?.total || 0;
  const hasMore = eventsResponse?.pagination?.has_more || false;

  // Client-side filtering for search and other filters not supported by API
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = !searchTerm ||
        event.device?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.geofence?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDevice = filterDevice === 'all' || event.device?.name === filterDevice;
      const matchesGeofence = filterGeofence === 'all' || event.geofence?.name === filterGeofence;

      return matchesSearch && matchesDevice && matchesGeofence;
    });
  }, [events, searchTerm, filterDevice, filterGeofence]);

  // Get unique devices and geofences for filter dropdowns
  const uniqueDevices = Array.from(new Set(events.map(e => e.device?.name).filter(Boolean)));
  const uniqueGeofences = Array.from(new Set(events.map(e => e.geofence?.name).filter(Boolean)));

  // Calculate pagination
  const totalPages = Math.ceil(totalEvents / itemsPerPage);

  // Reset to first page when filters change
  const handleFilterChange = (newFilters: any) => {
    setCurrentPage(1);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'geofence_enter': return { icon: ArrowRight, color: 'text-green-600', bg: 'bg-green-100' };
      case 'geofence_exit': return { icon: ArrowLeft, color: 'text-red-600', bg: 'bg-red-100' };
      case 'geofence_dwell': return { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' };
      default: return { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEventDisplayName = (type: string) => {
    switch (type) {
      case 'geofence_enter': return 'Entered';
      case 'geofence_exit': return 'Exited';
      case 'geofence_dwell': return 'Dwelling';
      default: return type;
    }
  };

  const exportEvents = () => {
    const csvContent = [
      ['Timestamp', 'Event Type', 'Device', 'Geofence', 'Location'].join(','),
      ...filteredEvents.map(event => [
        event.timestamp,
        getEventDisplayName(event.event_type),
        event.device?.name || 'Unknown',
        event.geofence?.name || 'Unknown',
        event.location ? `"${event.location.latitude}, ${event.location.longitude}"` : 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geofence-events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Error handling
  if (error) {
    return (
      <div className="flex flex-col h-full bg-neutral-50">
        <Header
          title="Events"
          subtitle="View and analyze location events and automation history"
        />
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-medium text-neutral-900 mb-3">Failed to load events</h3>
            <p className="text-neutral-600 leading-relaxed mb-6">There was an error loading event data.</p>
            <button
              onClick={() => refetch()}
              className="px-6 py-3 bg-neutral-900 text-white font-medium rounded-md hover:bg-neutral-800 transition-colors duration-150"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50">
      <Header
        title="Events"
        subtitle="View and analyze location events and automation history"
      />

      <div className="flex-1 overflow-auto p-3">
        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                className="pl-12 pr-4 py-3 border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:border-neutral-300 bg-white"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-3 px-3 py-2 border rounded-md transition-colors duration-150 ${showFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-neutral-200 hover:bg-neutral-50 bg-white'
                  }`}
              >
                <Filter className="h-5 w-5" />
                Filters
                <ChevronDown className={`h-5 w-5 transition-transform duration-150 ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              <select
                value={dateRange}
                onChange={(e) => setDateRange((e.target as HTMLSelectElement).value as any)}
                className="border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 bg-white"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 text-neutral-600 hover:text-neutral-800 px-3 py-2 border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-50 bg-white transition-colors duration-150"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportEvents}
              className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors duration-150 font-medium"
            >
              <Download className="h-5 w-5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Event Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType((e.target as HTMLSelectElement).value as any)}
                  className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
                >
                  <option value="all">All Types</option>
                  <option value="geofence_enter">Enter</option>
                  <option value="geofence_exit">Exit</option>
                  <option value="geofence_dwell">Dwell</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Device</label>
                <select
                  value={filterDevice}
                  onChange={(e) => setFilterDevice((e.target as HTMLSelectElement).value)}
                  className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
                >
                  <option value="all">All Devices</option>
                  {uniqueDevices.map(device => (
                    <option key={device} value={device}>{device}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Geofence</label>
                <select
                  value={filterGeofence}
                  onChange={(e) => setFilterGeofence((e.target as HTMLSelectElement).value)}
                  className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
                >
                  <option value="all">All Geofences</option>
                  {uniqueGeofences.map(geofence => (
                    <option key={geofence} value={geofence}>{geofence}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-md flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Total Events</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : totalEvents.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-md flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Enter Events</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : filteredEvents.filter(e => e.event_type === 'geofence_enter').length.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-md flex items-center justify-center">
                <ArrowLeft className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Exit Events</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : filteredEvents.filter(e => e.event_type === 'geofence_exit').length.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-md flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Dwell Events</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : filteredEvents.filter(e => e.event_type === 'geofence_dwell').length.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white rounded-md shadow-sm border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h3 className="text-lg font-medium text-neutral-900">
              Event History ({isLoading ? '—' : totalEvents.toLocaleString()} events)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Geofence
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {isLoading ? (
                  // Loading skeleton rows
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-neutral-300 rounded-md animate-pulse mr-4" />
                          <div>
                            <div className="h-4 bg-neutral-300 rounded animate-pulse mb-2 w-20" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-28" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-32" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-36" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-28" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-4 bg-neutral-300 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-100 rounded-md flex items-center justify-center mx-auto mb-4">
                        <Activity className="h-6 w-6 text-neutral-400" />
                      </div>
                      <p className="text-sm text-neutral-600">
                        {searchTerm ? 'No events match your search' : 'No events found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => {
                    const eventIcon = getEventIcon(event.event_type);
                    const IconComponent = eventIcon.icon;

                    return (
                      <tr key={event.id} className="hover:bg-neutral-50 transition-all duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${event.event_type === 'geofence_enter' ? 'bg-green-50' :
                              event.event_type === 'geofence_exit' ? 'bg-red-50' : 'bg-amber-50'
                              }`}>
                              <IconComponent className={`h-4 w-4 ${event.event_type === 'geofence_enter' ? 'text-green-600' :
                                event.event_type === 'geofence_exit' ? 'text-red-600' : 'text-amber-600'
                                }`} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-neutral-900">
                                {getEventDisplayName(event.event_type)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-neutral-400" />
                            <span className="text-sm text-neutral-900">{event.device?.name || 'Unknown Device'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-neutral-400" />
                            <span className="text-sm text-neutral-900">{event.geofence?.name || 'Unknown Geofence'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                          {event.location ? (
                            <div className="font-mono text-xs">
                              {event.location.latitude.toFixed(4)}, {event.location.longitude.toFixed(4)}
                            </div>
                          ) : (
                            <span className="text-neutral-400">No location</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                          {formatTimestamp(event.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedEvent(event)}
                            className="p-2 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-150"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-neutral-200">
            <div className="text-sm text-neutral-700">
              {isLoading ? 'Loading...' : (
                totalEvents > 0 ?
                  `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, totalEvents)} of ${totalEvents.toLocaleString()} results` :
                  'No results'
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || isLoading}
                className=" border border-neutral-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors duration-150"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-700 px-3">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                className=" border border-neutral-200 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors duration-150"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
          <div className="bg-white rounded-2xl p-3 w-full max-w-2xl">
            <h3 className="text-xl font-medium text-neutral-900 mb-6">Event Details</h3>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm font-medium text-neutral-500 block mb-1">Event Type</span>
                  <div className="text-neutral-900">{getEventDisplayName(selectedEvent.event_type)}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-neutral-500 block mb-1">Device</span>
                  <div className="text-neutral-900">{selectedEvent.device?.name || 'Unknown Device'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-sm font-medium text-neutral-500 block mb-1">Geofence</span>
                  <div className="text-neutral-900">{selectedEvent.geofence?.name || 'Unknown Geofence'}</div>
                </div>
                <div>
                  <span className="text-sm font-medium text-neutral-500 block mb-1">Timestamp</span>
                  <div className="text-neutral-900 font-mono text-sm">{formatTimestamp(selectedEvent.timestamp)}</div>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-neutral-500 block mb-1">Location</span>
                <div className="text-neutral-900 font-mono text-sm">
                  {selectedEvent.location ?
                    `${selectedEvent.location.latitude.toFixed(6)}, ${selectedEvent.location.longitude.toFixed(6)}` :
                    'No location data'
                  }
                </div>
              </div>

              {selectedEvent.processed_at && (
                <div>
                  <span className="text-sm font-medium text-neutral-500 block mb-1">Processed At</span>
                  <div className="text-neutral-900 font-mono text-sm">{formatTimestamp(selectedEvent.processed_at)}</div>
                </div>
              )}

              {selectedEvent.metadata && (
                <div>
                  <span className="text-sm font-medium text-neutral-500 block mb-2">Metadata</span>
                  <div className="text-sm bg-neutral-50 p-2 rounded-md border border-neutral-200">
                    <pre className="text-neutral-700">{JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-8">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-6 py-3 bg-neutral-900 text-white font-medium rounded-md hover:bg-neutral-800 transition-colors duration-150"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
