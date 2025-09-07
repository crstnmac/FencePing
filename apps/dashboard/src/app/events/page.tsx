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
      <div className="flex flex-col h-full">
        <Header 
          title="Events" 
          subtitle="View and analyze location events and automation history"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load events</h3>
            <p className="text-gray-600">There was an error loading event data.</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Events" 
        subtitle="View and analyze location events and automation history"
      />
      
      <div className="flex-1 overflow-auto p-4">
        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                className="pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-2 py-1.5 border rounded-lg transition-colors ${
                  showFilters ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              
              <select
                value={dateRange}
                onChange={(e) => setDateRange((e.target as HTMLSelectElement).value as any)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-2 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={exportEvents}
              className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType((e.target as HTMLSelectElement).value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="geofence_enter">Enter</option>
                  <option value="geofence_exit">Exit</option>
                  <option value="geofence_dwell">Dwell</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
                <select
                  value={filterDevice}
                  onChange={(e) => setFilterDevice((e.target as HTMLSelectElement).value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Devices</option>
                  {uniqueDevices.map(device => (
                    <option key={device} value={device}>{device}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geofence</label>
                <select
                  value={filterGeofence}
                  onChange={(e) => setFilterGeofence((e.target as HTMLSelectElement).value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : totalEvents}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArrowRight className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Enter Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : filteredEvents.filter(e => e.event_type === 'geofence_enter').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowLeft className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Exit Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : filteredEvents.filter(e => e.event_type === 'geofence_exit').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Dwell Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : filteredEvents.filter(e => e.event_type === 'geofence_dwell').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Events Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Event History ({isLoading ? '...' : totalEvents} events)
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Geofence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  // Loading skeleton rows
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse mr-3" />
                          <div>
                            <div className="h-4 bg-gray-300 rounded animate-pulse mb-1" />
                            <div className="h-3 bg-gray-300 rounded animate-pulse w-16" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-28" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-32" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <Activity className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">
                        {searchTerm ? 'No events match your search' : 'No events found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event) => {
                    const eventIcon = getEventIcon(event.event_type);
                    const IconComponent = eventIcon.icon;
                    
                    return (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-full ${eventIcon.bg} mr-3`}>
                              <IconComponent className={`h-4 w-4 ${eventIcon.color}`} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {getEventDisplayName(event.event_type)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Smartphone className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{event.device?.name || 'Unknown Device'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{event.geofence?.name || 'Unknown Geofence'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {event.location ? (
                            <div>
                              {event.location.latitude.toFixed(4)}, {event.location.longitude.toFixed(4)}
                            </div>
                          ) : (
                            <span className="text-gray-400">No location</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(event.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => setSelectedEvent(event)}
                            className="text-blue-600 hover:text-blue-900"
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
          <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              {isLoading ? 'Loading...' : (
                totalEvents > 0 ? 
                  `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, totalEvents)} of ${totalEvents} results` :
                  'No results'
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || isLoading}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0 || isLoading}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium mb-4">Event Details</h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Event Type:</span>
                  <div className="font-medium">{getEventDisplayName(selectedEvent.event_type)}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Device:</span>
                  <div className="font-medium">{selectedEvent.device?.name || 'Unknown Device'}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Geofence:</span>
                  <div className="font-medium">{selectedEvent.geofence?.name || 'Unknown Geofence'}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Timestamp:</span>
                  <div className="font-medium">{formatTimestamp(selectedEvent.timestamp)}</div>
                </div>
              </div>
              
              <div>
                <span className="text-sm text-gray-500">Location:</span>
                <div className="font-medium">
                  {selectedEvent.location ? 
                    `${selectedEvent.location.latitude.toFixed(6)}, ${selectedEvent.location.longitude.toFixed(6)}` :
                    'No location data'
                  }
                </div>
              </div>
              
              {selectedEvent.processed_at && (
                <div>
                  <span className="text-sm text-gray-500">Processed At:</span>
                  <div className="font-medium">{formatTimestamp(selectedEvent.processed_at)}</div>
                </div>
              )}
              
              {selectedEvent.metadata && (
                <div>
                  <span className="text-sm text-gray-500">Metadata:</span>
                  <div className="mt-1 text-sm bg-gray-50 p-2 rounded">
                    <pre>{JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
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
