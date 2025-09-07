'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';
import { useIntegrations, useDeleteIntegration, useTestIntegration, useUpdateIntegration } from '../../hooks/useApi';
import { 
  Plus, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Key,
  Shield,
  Search
} from 'lucide-react';

const getIntegrationIcon = (type: string) => {
  switch (type) {
    case 'slack':
      return '💬';
    case 'notion':
      return '📋';
    case 'google_sheets':
      return '📊';
    case 'whatsapp':
      return '📱';
    case 'webhook':
      return '🔗';
    default:
      return '🔗';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected':
      return 'text-green-600 bg-green-100';
    case 'error':
      return 'text-red-600 bg-red-100';
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'disconnected':
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'connected':
      return <CheckCircle className="h-4 w-4" />;
    case 'error':
      return <XCircle className="h-4 w-4" />;
    case 'pending':
      return <RefreshCw className="h-4 w-4" />;
    case 'disconnected':
    default:
      return <XCircle className="h-4 w-4" />;
  }
};

export default function IntegrationsPage() {
  const { data: integrations = [], isLoading, error } = useIntegrations();
  const deleteIntegrationMutation = useDeleteIntegration();
  const testIntegrationMutation = useTestIntegration();
  const updateIntegrationMutation = useUpdateIntegration();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);

  // Filter integrations
  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || integration.type === selectedType;
    return matchesSearch && matchesType;
  });

  const handleToggleActive = async (integration: any) => {
    try {
      await updateIntegrationMutation.mutateAsync({
        integrationId: integration.id,
        updates: { is_active: !integration.is_active }
      });
    } catch (err) {
      console.error('Failed to toggle integration:', err);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    try {
      const result = await testIntegrationMutation.mutateAsync(integrationId);
      alert(result.success ? 'Connection test successful!' : `Connection test failed: ${result.message}`);
    } catch (err) {
      alert('Connection test failed');
    }
  };

  const handleDelete = async (integrationId: string) => {
    if (window.confirm('Are you sure you want to delete this integration? This action cannot be undone.')) {
      try {
        await deleteIntegrationMutation.mutateAsync(integrationId);
      } catch (err) {
        console.error('Failed to delete integration:', err);
      }
    }
  };

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <Header 
          title="Integrations" 
          subtitle="Connect external services to automate workflows"
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <AlertTriangle className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load integrations</h3>
            <p className="text-gray-500">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Integrations" 
        subtitle="Connect external services to automate workflows"
      />
      
      <div className="flex-1 p-4 overflow-auto">
        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="slack">Slack</option>
              <option value="notion">Notion</option>
              <option value="google_sheets">Google Sheets</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="webhook">Custom Webhook</option>
            </select>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading integrations...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredIntegrations.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No matching integrations' : 'No integrations yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Connect your first external service to get started with automation'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Integration
              </button>
            )}
          </div>
        )}

        {/* Integrations Grid */}
        {!isLoading && filteredIntegrations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredIntegrations.map((integration) => (
              <div
                key={integration.id}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{getIntegrationIcon(integration.type)}</span>
                    <div>
                      <h3 className="font-medium text-gray-900">{integration.name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{integration.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setSelectedIntegration(integration);
                        setShowCreateModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      disabled={deleteIntegrationMutation.isPending}
                      className="p-1 text-gray-400 hover:text-red-600 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-600 mb-3">{integration.description}</p>

                {/* Status */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                    {getStatusIcon(integration.status)}
                    <span className="ml-1 capitalize">{integration.status}</span>
                  </span>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTestConnection(integration.id)}
                      disabled={testIntegrationMutation.isPending}
                      className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {testIntegrationMutation.isPending ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Active</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integration.is_active}
                      onChange={() => handleToggleActive(integration)}
                      className="sr-only peer"
                      disabled={updateIntegrationMutation.isPending}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Additional Info */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>
                      Connected: {integration.connected_at ? 
                        new Date(integration.connected_at).toLocaleDateString() : 
                        'Never'
                      }
                    </span>
                    {integration.last_used && (
                      <span>
                        Last used: {new Date(integration.last_used).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {selectedIntegration ? 'Edit Integration' : 'Add New Integration'}
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Integration Type
                </label>
                <select
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={selectedIntegration}
                >
                  <option value="">Select integration type</option>
                  <option value="slack">Slack</option>
                  <option value="notion">Notion</option>
                  <option value="google_sheets">Google Sheets</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="webhook">Custom Webhook</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Slack Notifications"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe what this integration does"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start">
                  <Key className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-xs font-medium text-yellow-800 mb-1">Authentication Required</h4>
                    <p className="text-xs text-yellow-700">
                      You'll need to authenticate with the service after creating this integration.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedIntegration(null);
                }}
                className="px-3 py-1.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {selectedIntegration ? 'Update' : 'Create'} Integration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
