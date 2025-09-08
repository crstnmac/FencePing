'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';
import { toast } from 'react-hot-toast';
import {useTestAutomation, useDeliveries, useAutomationRules, useToggleAutomationRule, useDeleteAutomationRule } from '../../hooks/useApi';
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
import { AutomationRuleModal } from '@/components/AutomationRuleModal';
import { useSocket } from '../../providers/SocketProvider';

export default function AutomationsPage() {
  // API state management with React Query
  const { data: rules = [], isLoading, error, refetch } = useAutomationRules();
  const { socket, isConnected } = useSocket();
  const toggleRuleMutation = useToggleAutomationRule();
  const deleteRuleMutation = useDeleteAutomationRule();
  const testMutation = useTestAutomation();
  const { data: deliveries = [] } = useDeliveries({ limit: 100 });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterTrigger, setFilterTrigger] = useState<'all' | 'enter' | 'exit' | 'dwell'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && rule.enabled) ||
      (filterStatus === 'inactive' && !rule.enabled);
    const matchesTrigger = filterTrigger === 'all' || rule.on_events.includes(filterTrigger);
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

  const toggleRuleStatus = async (id: string) => {
    try {
      const rule = rules.find(r => r.id === id);
      if (rule) {
        await toggleRuleMutation.mutateAsync({
          ruleId: id,
          enabled: !rule.enabled
        });
        toast.success('Rule status updated');
      }
    } catch (err) {
      console.error('Failed to toggle rule status:', err);
      toast.error('Failed to update rule status');
    }
  };

  const handleEdit = (rule: any) => {
    setSelectedRule(rule);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      try {
        await deleteRuleMutation.mutateAsync(id);
        toast.success('Rule deleted successfully');
      } catch (err) {
        console.error('Failed to delete rule:', err);
        toast.error('Failed to delete rule');
      }
    }
  };

  const handleTest = (rule: any) => {
    try {
      testMutation.mutate(rule.automation_id, {
        onSuccess: () => {
          toast.success('Test delivery sent');
        },
        onError: () => {
          toast.error('Failed to send test');
        }
      });
    } catch (err) {
      toast.error('Failed to test rule');
    }
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

      <div className="flex-1 overflow-auto p-3">
        {/* Navigation Links */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Integration Setup</span>
            </div>
            <a 
              href="/integrations" 
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Manage Integrations →
            </a>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            Configure webhook endpoints and third-party integrations for your automations
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
              <input
                type="text"
                placeholder="Search automations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex items-center space-x-1.5">
              <Filter className="h-3.5 w-3.5 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus((e.target as HTMLSelectElement).value as any)}
                className="border border-gray-300 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select
                value={filterTrigger}
                onChange={(e) => setFilterTrigger((e.target as HTMLSelectElement).value as any)}
                className="border border-gray-300 rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              setSelectedRule(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-blue-700 transition-all duration-200 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Rule
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-md shadow-sm p-3 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="p-1.5 bg-blue-100 rounded-md">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600">Total Rules</p>
                <p className="text-lg font-semibold text-gray-900">
                  {isLoading ? '...' : rules.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm p-3 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="p-1.5 bg-green-100 rounded-md">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600">Active</p>
                <p className="text-lg font-semibold text-gray-900">
                  {isLoading ? '...' : rules.filter(r => r.enabled).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm p-3 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="p-1.5 bg-emerald-100 rounded-md">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600">Inactive</p>
                <p className="text-lg font-semibold text-gray-900">
                  {isLoading ? '...' : rules.filter(r => !r.enabled).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm p-3 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="p-1.5 bg-yellow-100 rounded-md">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-600">Total Created</p>
                <p className="text-lg font-semibold text-gray-900">
                  {isLoading ? '...' : rules.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Automations Table */}
        <div className="bg-white rounded-md shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Automation Rules</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rule
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Integration
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deliveries
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Triggered
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {isLoading ? (
                  // Loading skeleton rows
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="h-3.5 bg-gray-300 rounded animate-pulse mb-1.5" />
                          <div className="h-2.5 bg-gray-300 rounded animate-pulse w-2/3" />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-3.5 bg-gray-300 rounded animate-pulse w-16" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-3.5 bg-gray-300 rounded animate-pulse w-20" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-5 bg-gray-300 rounded-full animate-pulse w-14" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-3.5 bg-gray-300 rounded animate-pulse w-20" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="h-3.5 bg-gray-300 rounded animate-pulse w-16" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex space-x-1.5">
                          {[...Array(4)].map((_, j) => (
                            <div key={j} className="h-3.5 w-3.5 bg-gray-300 rounded animate-pulse" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center">
                      <Zap className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">
                        {searchTerm ? 'No rules match your search' : 'No rules found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 transition-all duration-200">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                          <div className="text-xs text-gray-500">{(rule as any).description || 'No description'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          Basic Automation
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          <a 
                            href="/integrations" 
                            className="text-blue-600 hover:text-blue-800 underline"
                            title="Manage integrations"
                          >
                            Manage
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rule.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                          }`}>
                          {rule.enabled ? (
                            <Play className="w-2.5 h-2.5 mr-1" />
                          ) : (
                            <Pause className="w-2.5 h-2.5 mr-1" />
                          )}
                          {rule.enabled ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          {(() => {
                            const deliveryArray = Array.isArray(deliveries) ? deliveries : [];
                            const ruleDeliveries = deliveryArray.filter((d: any) => d.automation_id === rule.automation_id);
                            const lastDelivery = ruleDeliveries[ruleDeliveries.length - 1];
                            return lastDelivery ? (lastDelivery as any).status : 'No deliveries';
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatLastTriggered(rule.updated_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => toggleRuleStatus(rule.id)}
                            disabled={toggleRuleMutation.isPending}
                            className={`${rule.enabled
                              ? 'text-yellow-600 hover:text-yellow-900'
                              : 'text-green-600 hover:text-green-900'
                              } disabled:opacity-50 transition-all duration-200`}
                            title={rule.enabled ? 'Pause' : 'Activate'}
                          >
                            {rule.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleTest(rule)}
                            disabled={testMutation.isPending}
                            className="text-blue-600 hover:text-blue-900 transition-all duration-200 disabled:opacity-50"
                            title="Test rule"
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            className="text-gray-600 hover:text-gray-900 transition-all duration-200"
                            title="Edit rule"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleteRuleMutation.isPending}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 transition-all duration-200"
                            title="Delete rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
        <AutomationRuleModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          rule={selectedRule}
          onSuccess={() => {
            toast.success('Rule saved successfully');
            refetch();
          }}
        />
      )}
    </div >
  )
}
