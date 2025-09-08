'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';
import { 
  useIntegrations, 
  useDeleteIntegration, 
  useUpdateIntegration, 
  useCreateIntegration, 
  useAutomations,
  Integration,
  Automation
} from '../../hooks/useApi';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface HeaderRow {
  key: string;
  value: string;
}

export default function IntegrationsPage() {
  const { data: integrations = [], isLoading: integrationsLoading, error: integrationsError } = useIntegrations();
  const { data: automations = [], isLoading: automationsLoading } = useAutomations();
  const deleteIntegrationMutation = useDeleteIntegration();
  const updateIntegrationMutation = useUpdateIntegration();
  const createIntegrationMutation = useCreateIntegration();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [formData, setFormData] = useState({
    automation_id: '',
    url: '',
    is_active: true,
    headers: [] as HeaderRow[]
  });
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [urlError, setUrlError] = useState('');

  const { user } = useAuth();

  // Filter integrations
  const filteredIntegrations = integrations.filter((integration: Integration) =>
    integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleActive = async (integration: Integration) => {
    try {
      await updateIntegrationMutation.mutateAsync({
        integrationId: integration.id,
        updates: { is_active: !integration.is_active }
      });
      alert('Status updated successfully');
    } catch (err) {
      alert('Failed to update status');
      console.error('Failed to toggle integration:', err);
    }
  };

  const handleDelete = async (integrationId: string) => {
    if (window.confirm('Are you sure you want to delete this webhook integration? This action cannot be undone.')) {
      try {
        await deleteIntegrationMutation.mutateAsync(integrationId);
        alert('Integration deleted successfully');
      } catch (err) {
        alert('Failed to delete integration');
        console.error('Failed to delete integration:', err);
      }
    }
  };

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setFormData({
      automation_id: integration.automation_id,
      url: integration.url,
      is_active: integration.is_active,
      headers: Object.entries(integration.headers || {}).map(([key, value]) => ({ key, value: value as string }))
    });
    setShowCreateModal(true);
  };

  const handleAddHeader = () => {
    if (newHeaderKey.trim() && newHeaderValue.trim()) {
      setFormData(prev => ({
        ...prev,
        headers: [...prev.headers, { key: newHeaderKey.trim(), value: newHeaderValue.trim() }]
      }));
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const handleRemoveHeader = (index: number) => {
    setFormData(prev => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index)
    }));
  };

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      setUrlError('');
      return true;
    } catch {
      setUrlError('Please enter a valid URL');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(formData.url)) return;

    const payload = {
      automation_id: formData.automation_id,
      url: formData.url,
      is_active: formData.is_active,
      headers: formData.headers.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {})
    };

    try {
      if (editingIntegration) {
        await updateIntegrationMutation.mutateAsync({
          integrationId: editingIntegration.id,
          updates: payload
        });
        alert('Integration updated successfully');
      } else {
        await createIntegrationMutation.mutateAsync(payload);
        alert('Integration created successfully');
      }
      setShowCreateModal(false);
      setEditingIntegration(null);
      setFormData({ automation_id: '', url: '', is_active: true, headers: [] });
    } catch (err) {
      alert('Failed to save integration');
      console.error('Failed to save integration:', err);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingIntegration(null);
    setFormData({ automation_id: '', url: '', is_active: true, headers: [] });
    setUrlError('');
  };

  if (integrationsError) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Integrations" subtitle="Manage webhook integrations" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load integrations</h3>
            <p className="text-gray-500">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Integrations" subtitle="Manage webhook integrations for automations" />
      
      <div className="flex-1 p-4 overflow-auto">
        {/* Controls */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </button>
        </div>

        {/* Loading */}
        {(integrationsLoading || automationsLoading) && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-gray-500">Loading...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!integrationsLoading && filteredIntegrations.length === 0 && !showCreateModal && (
          <div className="text-center py-12">
            <LinkIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No webhook integrations</h3>
            <p className="text-gray-500 mb-4">Create your first webhook integration to automate actions.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Webhook
            </button>
          </div>
        )}

        {/* Table */}
        {!integrationsLoading && filteredIntegrations.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Automation</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredIntegrations.map((integration: Integration) => (
                  <tr key={integration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{integration.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 truncate max-w-xs" title={integration.url}>
                        {integration.url}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        integration.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {integration.is_active ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                        {integration.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {automations.find(a => a.id === integration.automation_id)?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleToggleActive(integration)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title={integration.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(integration.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium mb-4">
                {editingIntegration ? 'Edit Webhook' : 'Create Webhook'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Automation</label>
                  <select
                    value={formData.automation_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, automation_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select automation</option>
                    {automations.map((automation: Automation) => (
                      <option key={automation.id} value={automation.id}>
                        {automation.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, url: e.target.value }));
                      validateUrl(e.target.value);
                    }}
                    placeholder="https://example.com/webhook"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {urlError && <p className="mt-1 text-sm text-red-600">{urlError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-900">Active</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headers (Optional)</label>
                  <div className="space-y-2 mb-2">
                    {formData.headers.map((header, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          value={header.key}
                          onChange={(e) => {
                            const newHeaders = [...formData.headers];
                            newHeaders[index].key = e.target.value;
                            setFormData(prev => ({ ...prev, headers: newHeaders }));
                          }}
                          placeholder="Key"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          value={header.value}
                          onChange={(e) => {
                            const newHeaders = [...formData.headers];
                            newHeaders[index].value = e.target.value;
                            setFormData(prev => ({ ...prev, headers: newHeaders }));
                          }}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveHeader(index)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <input
                      value={newHeaderKey}
                      onChange={(e) => setNewHeaderKey(e.target.value)}
                      placeholder="New key"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      value={newHeaderValue}
                      onChange={(e) => setNewHeaderValue(e.target.value)}
                      placeholder="New value"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={handleAddHeader}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.automation_id || !formData.url || !!urlError}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingIntegration ? 'Update' : 'Create'} Webhook
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
