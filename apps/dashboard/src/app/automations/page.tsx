'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';
import { useAutomations, useUpdateAutomation, useDeleteAutomation } from '../../hooks/useApi';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Play,
  Pause,
  Zap,
  Clock,
  MapPin,
  Smartphone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Settings
} from 'lucide-react';

export default function AutomationsPage() {
  // API state management with React Query
  const { data: automations = [], isLoading, error, refetch } = useAutomations();
  const updateAutomationMutation = useUpdateAutomation();
  const deleteAutomationMutation = useDeleteAutomation();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterTrigger, setFilterTrigger] = useState<'all' | 'enter' | 'exit' | 'dwell'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);

  const filteredAutomations = automations.filter(automation => {
    const matchesSearch = automation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (automation.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && automation.is_active) ||
                         (filterStatus === 'inactive' && !automation.is_active);
    const matchesTrigger = true; // API doesn't have trigger type in the basic automation structure
    return matchesSearch && matchesStatus && matchesTrigger;
  });

  const formatLastTriggered = (lastTriggered?: string) => {
    if (!lastTriggered) return 'Never';
    const diff = Date.now() - new Date(lastTriggered).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Recently';
  };

  const toggleAutomationStatus = async (id: string) => {
    try {
      const automation = automations.find(a => a.id === id);
      if (automation) {
        await updateAutomationMutation.mutateAsync({
          automationId: id,
          updates: { is_active: !automation.is_active }
        });
      }
    } catch (err) {
      console.error('Failed to toggle automation status:', err);
      alert('Failed to update automation status');
    }
  };

  const handleEdit = (automation: any) => {
    setSelectedAutomation(automation);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this automation?')) {
      try {
        await deleteAutomationMutation.mutateAsync(id);
      } catch (err) {
        console.error('Failed to delete automation:', err);
        alert('Failed to delete automation');
      }
    }
  };

  const handleTest = (automation: any) => {
    console.log('Testing automation:', automation.id);
    // In real app, would trigger a test execution
    alert('Test functionality would be implemented here');
  };

  // Error handling
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header 
          title="Automations" 
          subtitle="Manage your geofence automation rules and webhooks"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load automations</h3>
            <p className="text-gray-600">There was an error loading automation data.</p>
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
        title="Automations" 
        subtitle="Manage your geofence automation rules and webhooks"
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search automations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus((e.target as HTMLSelectElement).value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              
              <select
                value={filterTrigger}
                onChange={(e) => setFilterTrigger((e.target as HTMLSelectElement).value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Triggers</option>
                <option value="enter">Enter</option>
                <option value="exit">Exit</option>
                <option value="dwell">Dwell</option>
              </select>
            </div>
          </div>
          
          <button 
            onClick={() => {
              setSelectedAutomation(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Automation
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Rules</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : automations.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Play className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : automations.filter(a => a.is_active).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : automations.filter(a => !a.is_active).length}
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
                <p className="text-sm font-medium text-gray-600">Total Created</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '...' : automations.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Automations Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Automation Rules</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Integration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Triggered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  // Loading skeleton rows
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="h-4 bg-gray-300 rounded animate-pulse mb-2" />
                          <div className="h-3 bg-gray-300 rounded animate-pulse w-2/3" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 bg-gray-300 rounded-full animate-pulse w-16" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-300 rounded animate-pulse w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {[...Array(4)].map((_, j) => (
                            <div key={j} className="h-4 w-4 bg-gray-300 rounded animate-pulse" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredAutomations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center">
                      <Zap className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">
                        {searchTerm ? 'No automations match your search' : 'No automations found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredAutomations.map((automation) => (
                    <tr key={automation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{automation.name}</div>
                          <div className="text-sm text-gray-500">{automation.description || 'No description'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Basic Automation
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          N/A
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          automation.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {automation.is_active ? (
                            <Play className="w-3 h-3 mr-1" />
                          ) : (
                            <Pause className="w-3 h-3 mr-1" />
                          )}
                          {automation.is_active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          N/A
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatLastTriggered(automation.updated_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleAutomationStatus(automation.id)}
                            disabled={updateAutomationMutation.isPending}
                            className={`${
                              automation.is_active 
                                ? 'text-yellow-600 hover:text-yellow-900' 
                                : 'text-green-600 hover:text-green-900'
                            } disabled:opacity-50`}
                            title={automation.is_active ? 'Pause' : 'Activate'}
                          >
                            {automation.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleTest(automation)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Test automation"
                          >
                            <Zap className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(automation)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Edit automation"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(automation.id)}
                            disabled={deleteAutomationMutation.isPending}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            title="Delete automation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">
              {selectedAutomation ? 'Edit Automation' : 'Create New Automation'}
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedAutomation?.name || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter rule name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Type
                  </label>
                  <select 
                    defaultValue={selectedAutomation?.triggerType || 'enter'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="enter">Enter Geofence</option>
                    <option value="exit">Exit Geofence</option>
                    <option value="dwell">Dwell in Geofence</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  defaultValue={selectedAutomation?.description || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this automation does"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Geofence
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select geofence</option>
                    <option value="1">Home Zone</option>
                    <option value="2">Work Campus</option>
                    <option value="3">Warehouse District</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Device (Optional)
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">All devices</option>
                    <option value="1">iPhone 15 Pro</option>
                    <option value="2">Samsung Galaxy S24</option>
                    <option value="3">GPS Tracker</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Integration
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select integration</option>
                    <option value="slack">💬 Slack</option>
                    <option value="notion">📝 Notion</option>
                    <option value="google_sheets">📊 Google Sheets</option>
                    <option value="whatsapp">📱 WhatsApp</option>
                    <option value="webhook">🔗 Custom Webhook</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dwell Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    defaultValue={selectedAutomation?.dwellTimeMinutes || 5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only applies to dwell triggers</p>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Action Configuration</h4>
                <p className="text-sm text-gray-600">
                  Configure the specific action to take when this rule triggers. This will vary based on the selected integration type.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {selectedAutomation ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}