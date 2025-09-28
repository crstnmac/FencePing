'use client';

import { useState } from 'react';
import { Header } from '../../components/Header';
import { toast } from 'react-hot-toast';
import { useTestAutomation, useDeliveries, useAutomations, useAutomationRules, useToggleAutomationRule, useDeleteAutomationRule } from '../../hooks/useApi';
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
  Settings,
  Activity
} from 'lucide-react';
import { AutomationRuleModal } from '@/components/AutomationRuleModal';
import { AutomationWizard } from '@/components/AutomationWizard';
import { DeliveryMonitor } from '@/components/DeliveryMonitor';
import { useSocket } from '../../providers/SocketProvider';

export default function AutomationsPage() {
  // API state management with React Query
  const { data: rules = [], isLoading, error, refetch } = useAutomationRules();
  const { data: automations = [], isLoading: automationsLoading } = useAutomations();
  const { socket, isConnected } = useSocket();
  const toggleRuleMutation = useToggleAutomationRule();
  const deleteRuleMutation = useDeleteAutomationRule();
  const testMutation = useTestAutomation();
  const { data: deliveries = [] } = useDeliveries({ limit: 100 });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterTrigger, setFilterTrigger] = useState<'all' | 'enter' | 'exit' | 'dwell'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showDeliveryMonitor, setShowDeliveryMonitor] = useState(false);
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
      <div className="flex flex-col h-full bg-neutral-50">
        <Header
          title="Automations"
          subtitle="Manage your geofence automation rules and webhooks"
        />
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-medium text-neutral-900 mb-3">Failed to load automations</h3>
            <p className="text-neutral-600 leading-relaxed mb-6">There was an error loading automation data.</p>
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
        title="Automations"
        subtitle="Manage your geofence automation rules and webhooks"
      />

      <div className="flex-1 overflow-auto p-3">
        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md p-3 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-blue-900 mb-2">Complete Automation Setup</h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                Create automations with webhooks, Slack, Notion, Sheets, and WhatsApp integrations
              </p>
            </div>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-3 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors duration-150 font-medium"
            >
              <Plus className="h-5 w-5" />
              New Automation
            </button>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search automations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
                className="pl-12 pr-4 py-3 border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:border-neutral-300 text-sm bg-white"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-neutral-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus((e.target as HTMLSelectElement).value as any)}
                  className="border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <select
                value={filterTrigger}
                onChange={(e) => setFilterTrigger((e.target as HTMLSelectElement).value as any)}
                className="border border-neutral-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 bg-white"
              >
                <option value="all">All Triggers</option>
                <option value="enter">Enter</option>
                <option value="exit">Exit</option>
                <option value="dwell">Dwell</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors duration-150 font-medium"
            >
              <Plus className="h-5 w-5" />
              New Automation
            </button>
            <button
              onClick={() => {
                setSelectedRule(null);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 bg-neutral-600 text-white px-3 py-2 rounded-md hover:bg-neutral-700 transition-colors duration-150 font-medium"
            >
              <Plus className="h-5 w-5" />
              Add Rule
            </button>
            <button
              onClick={() => setShowDeliveryMonitor(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors duration-150 font-medium"
            >
              <Activity className="h-5 w-5" />
              Monitor
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-md flex items-center justify-center">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Total Rules</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : rules.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-md flex items-center justify-center">
                <Play className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Active</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : rules.filter(r => r.enabled).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-neutral-200 p-3 hover:shadow-md transition-shadow duration-150">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-md flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500 mb-1">Inactive</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : rules.filter(r => !r.enabled).length}
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
                <p className="text-sm font-medium text-neutral-500 mb-1">Total Created</p>
                <p className="text-2xl font-light text-neutral-900">
                  {isLoading ? '—' : rules.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Automations Table */}
        <div className="bg-white rounded-md shadow-sm border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h3 className="text-lg font-medium text-neutral-900">Automation Rules</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Rule
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Deliveries
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Last Triggered
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {isLoading ? (
                  // Loading skeleton rows
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="h-4 bg-neutral-300 rounded animate-pulse mb-2" />
                          <div className="h-3 bg-neutral-300 rounded animate-pulse w-2/3" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 bg-neutral-300 rounded-full animate-pulse w-16" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-24" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-neutral-300 rounded animate-pulse w-20" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {[...Array(4)].map((_, j) => (
                            <div key={j} className="h-4 w-4 bg-neutral-300 rounded animate-pulse" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="w-12 h-12 bg-neutral-100 rounded-md flex items-center justify-center mx-auto mb-4">
                        <Zap className="h-6 w-6 text-neutral-400" />
                      </div>
                      <p className="text-sm text-neutral-600">
                        {searchTerm ? 'No rules match your search' : 'No rules found'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-neutral-50 transition-all duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">{rule.name}</div>
                          <div className="text-xs text-neutral-500">{(rule as any).description || 'No description'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-900">
                          Basic Automation
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-900">
                          {(() => {
                            // Find the automation to show its type
                            const automation = automations.find(a => a.id === rule.automation_id);
                            return automation ? (
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${automation.kind === 'webhook' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                automation.kind === 'slack' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                  automation.kind === 'notion' ? 'bg-neutral-50 text-neutral-700 border border-neutral-200' :
                                    automation.kind === 'sheets' ? 'bg-green-50 text-green-700 border border-green-200' :
                                      automation.kind === 'whatsapp' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                        'bg-neutral-50 text-neutral-700 border border-neutral-200'
                                }`}>
                                {automation.kind.charAt(0).toUpperCase() + automation.kind.slice(1)}
                              </span>
                            ) : 'Unknown';
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${rule.enabled
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                          }`}>
                          {rule.enabled ? (
                            <Play className="w-3 h-3" />
                          ) : (
                            <Pause className="w-3 h-3" />
                          )}
                          {rule.enabled ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-900">
                          {(() => {
                            const deliveryArray = Array.isArray(deliveries) ? deliveries : [];
                            const ruleDeliveries = deliveryArray.filter((d: any) => d.automation_id === rule.automation_id);
                            const lastDelivery = ruleDeliveries[ruleDeliveries.length - 1];
                            return lastDelivery ? (lastDelivery as any).status : 'No deliveries';
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                        {formatLastTriggered(rule.updated_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleRuleStatus(rule.id)}
                            disabled={toggleRuleMutation.isPending}
                            className={`p-2 rounded-md transition-all duration-150 disabled:opacity-50 ${rule.enabled
                              ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              }`}
                            title={rule.enabled ? 'Pause' : 'Activate'}
                          >
                            {rule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleTest(rule)}
                            disabled={testMutation.isPending}
                            className="p-2 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-150 disabled:opacity-50"
                            title="Test rule"
                          >
                            <Zap className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-2 rounded-md text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 transition-all duration-150"
                            title="Edit rule"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleteRuleMutation.isPending}
                            className="p-2 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 transition-all duration-150"
                            title="Delete rule"
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

      {/* Create/Edit Rule Modal */}
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

      {/* Comprehensive Automation Wizard */}
      {showWizard && (
        <AutomationWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onSuccess={(automation, rule) => {
            toast.success('Automation and rule created successfully!');
            refetch();
          }}
        />
      )}

      {/* Delivery Monitoring Dashboard */}
      {showDeliveryMonitor && (
        <DeliveryMonitor
          isOpen={showDeliveryMonitor}
          onClose={() => setShowDeliveryMonitor(false)}
        />
      )}
    </div>
  )
}
