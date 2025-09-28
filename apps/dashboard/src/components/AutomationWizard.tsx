'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Webhook,
  MessageSquare,
  Database,
  FileSpreadsheet,
  MessageCircle,
  MapPin,
  Smartphone,
  Target,
  Clock,
  Zap,
  AlertCircle,
  ExternalLink,
  Copy,
} from 'lucide-react';
import {
  useDevices,
  useGeofences,
  useCreateAutomation,
  useCreateAutomationRule,
  useTestAutomation,
  type Automation,
  type AutomationRule,
  type CreateAutomationRuleRequest,
} from '../hooks/useApi';
import { toast } from 'react-hot-toast';

interface AutomationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (automation: Automation, rule: AutomationRule) => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

const STEPS: WizardStep[] = [
  { id: 'type', title: 'Choose Type', description: 'Select automation type' },
  { id: 'config', title: 'Configure', description: 'Set up integration' },
  { id: 'rules', title: 'Create Rules', description: 'Define triggers' },
  { id: 'test', title: 'Test & Review', description: 'Verify setup' },
];

const AUTOMATION_TYPES = [
  {
    kind: 'webhook' as const,
    name: 'Webhook',
    description: 'Send HTTP requests to any endpoint',
    icon: Webhook,
    color: 'blue',
    popular: true,
  },
  {
    kind: 'slack' as const,
    name: 'Slack',
    description: 'Post messages to Slack channels',
    icon: MessageSquare,
    color: 'purple',
    popular: true,
  },
  {
    kind: 'notion' as const,
    name: 'Notion',
    description: 'Add entries to Notion databases',
    icon: Database,
    color: 'gray',
    popular: false,
  },
  {
    kind: 'sheets' as const,
    name: 'Google Sheets',
    description: 'Add rows to Google Sheets',
    icon: FileSpreadsheet,
    color: 'green',
    popular: false,
  },
  {
    kind: 'whatsapp' as const,
    name: 'WhatsApp',
    description: 'Send WhatsApp messages via Business API',
    icon: MessageCircle,
    color: 'emerald',
    popular: false,
  },
];

export function AutomationWizard({ isOpen, onClose, onSuccess }: AutomationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string>('');
  const [automationData, setAutomationData] = useState({
    name: '',
    description: '',
    config: {} as Record<string, any>,
  });
  const [ruleData, setRuleData] = useState<Partial<CreateAutomationRuleRequest>>({
    name: '',
    geofence_id: '',
    device_id: undefined,
    on_events: ['enter'],
    min_dwell_seconds: undefined,
    device_filter: {},
    enabled: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdAutomation, setCreatedAutomation] = useState<Automation | null>(null);

  const { data: devices = [] } = useDevices();
  const { geofences = [] } = useGeofences();
  const createAutomationMutation = useCreateAutomation();
  const createRuleMutation = useCreateAutomationRule();
  const testMutation = useTestAutomation();

  useEffect(() => {
    if (isOpen) {
      // Reset wizard state
      setCurrentStep(0);
      setSelectedType('');
      setAutomationData({ name: '', description: '', config: {} });
      setRuleData({
        name: '',
        geofence_id: '',
        device_id: undefined,
        on_events: ['enter'],
        min_dwell_seconds: undefined,
        device_filter: {},
        enabled: true,
      });
      setErrors({});
      setCreatedAutomation(null);
    }
  }, [isOpen]);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 0) {
      if (!selectedType) newErrors.type = 'Please select an automation type';
    } else if (currentStep === 1) {
      if (!automationData.name.trim()) newErrors.name = 'Automation name is required';
      if (selectedType === 'webhook' && !automationData.config.url) {
        newErrors.config = 'Webhook URL is required';
      }
    } else if (currentStep === 2) {
      if (!ruleData.name?.trim()) newErrors.ruleName = 'Rule name is required';
      if (!ruleData.geofence_id) newErrors.geofence = 'Please select a geofence';
      if (!ruleData.on_events?.length) newErrors.events = 'Please select trigger events';
      if (
        ruleData.on_events?.includes('dwell') &&
        (!ruleData.min_dwell_seconds || ruleData.min_dwell_seconds < 1)
      ) {
        newErrors.dwell = 'Minimum dwell time is required for dwell events';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;

    if (currentStep === 1) {
      // Create automation when moving from config to rules
      try {
        const automation = await createAutomationMutation.mutateAsync({
          name: automationData.name,
          description: automationData.description,
          kind: selectedType as any,
          config: automationData.config,
          enabled: true,
        });
        setCreatedAutomation(automation);
        toast.success('Automation created successfully');
      } catch (error) {
        setErrors({ submit: 'Failed to create automation' });
        return;
      }
    }

    nextStep();
  };

  const handleFinish = async () => {
    if (!validateCurrentStep() || !createdAutomation) return;

    try {
      const rule = await createRuleMutation.mutateAsync({
        ...ruleData,
        automation_id: createdAutomation.id,
      } as CreateAutomationRuleRequest);

      toast.success('Automation setup completed successfully!');
      onSuccess?.(createdAutomation, rule);
      onClose();
    } catch (error) {
      setErrors({ submit: 'Failed to create automation rule' });
    }
  };

  const handleTest = async () => {
    if (createdAutomation) {
      try {
        await testMutation.mutateAsync(createdAutomation.id);
        toast.success('Test webhook sent successfully!');
      } catch (error) {
        toast.error('Failed to send test webhook');
      }
    }
  };

  const renderTypeSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Choose Your Automation Type</h3>
        <p className="text-sm text-gray-600">
          Select how you want to receive geofence notifications
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AUTOMATION_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.kind;

          return (
            <div
              key={type.kind}
              onClick={() => setSelectedType(type.kind)}
              className={`relative cursor-pointer rounded-md border-2 p-3 hover:border-blue-300 transition-all duration-200 ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {type.popular && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs px-3 py-2 rounded-full">
                  Popular
                </div>
              )}
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-md bg-${type.color}-100`}>
                  <Icon className={`h-6 w-6 text-${type.color}-600`} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">{type.name}</h4>
                  <p className="text-xs text-gray-600">{type.description}</p>
                </div>
                {isSelected && (
                  <div className="text-blue-600">
                    <Check className="h-5 w-5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {errors.type && <p className="text-sm text-red-600 text-center">{errors.type}</p>}
    </div>
  );

  const renderConfiguration = () => {
    const selectedTypeInfo = AUTOMATION_TYPES.find((t) => t.kind === selectedType);

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            {selectedTypeInfo && <selectedTypeInfo.icon className="h-5 w-5 text-blue-600" />}
            <h3 className="text-lg font-medium text-gray-900">
              Configure {selectedTypeInfo?.name}
            </h3>
          </div>
          <p className="text-sm text-gray-600">
            Set up your {selectedTypeInfo?.name.toLowerCase()} integration
          </p>
        </div>

        <div className="space-y-4">
          {/* Automation Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Automation Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={automationData.name}
              onChange={(e) => setAutomationData((prev) => ({ ...prev, name: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={`e.g., ${selectedTypeInfo?.name} Office Alerts`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={automationData.description}
              onChange={(e) =>
                setAutomationData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Brief description of this automation..."
            />
          </div>

          {/* Type-specific configuration */}
          {selectedType === 'webhook' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={automationData.config.url || ''}
                  onChange={(e) =>
                    setAutomationData((prev) => ({
                      ...prev,
                      config: { ...prev.config, url: e.target.value },
                    }))
                  }
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.config ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://your-api.com/webhook"
                />
                {errors.config && <p className="mt-1 text-sm text-red-600">{errors.config}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Headers (Optional)
                </label>
                <textarea
                  rows={3}
                  value={JSON.stringify(automationData.config.headers || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const headers = JSON.parse(e.target.value);
                      setAutomationData((prev) => ({
                        ...prev,
                        config: { ...prev.config, headers },
                      }));
                    } catch {}
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                  placeholder='{\n  "Authorization": "Bearer token",\n  "Content-Type": "application/json"\n}'
                />
                <p className="mt-1 text-xs text-gray-500">Valid JSON format for custom headers</p>
              </div>
            </div>
          )}

          {selectedType === 'slack' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-yellow-800">OAuth Setup Required</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You&apos;ll need to connect your Slack workspace in the next step. We&apos;ll
                    redirect you to Slack for authorization.
                  </p>
                  <button className="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900">
                    Learn more about Slack setup →
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedType === 'notion' && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
              <div className="flex items-start space-x-3">
                <Database className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Notion Integration</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Connect your Notion workspace to create database entries for geofence events.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRulesSetup = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Create Automation Rules</h3>
        <p className="text-sm text-gray-600">Define when this automation should trigger</p>
      </div>

      <div className="space-y-4">
        {/* Rule Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rule Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={ruleData.name || ''}
            onChange={(e) => setRuleData((prev) => ({ ...prev, name: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.ruleName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Office Entry Detection"
          />
          {errors.ruleName && <p className="mt-1 text-sm text-red-600">{errors.ruleName}</p>}
        </div>

        {/* Geofence Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="h-4 w-4 inline mr-1" />
            Geofence <span className="text-red-500">*</span>
          </label>
          <select
            value={ruleData.geofence_id || ''}
            onChange={(e) => setRuleData((prev) => ({ ...prev, geofence_id: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.geofence ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select a geofence...</option>
            {geofences.map((geofence) => (
              <option key={geofence.id} value={geofence.id}>
                {geofence.name} ({geofence.geofence_type})
              </option>
            ))}
          </select>
          {errors.geofence && <p className="mt-1 text-sm text-red-600">{errors.geofence}</p>}
        </div>

        {/* Device Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Smartphone className="h-4 w-4 inline mr-1" />
            Device (Optional)
          </label>
          <select
            value={ruleData.device_id || ''}
            onChange={(e) =>
              setRuleData((prev) => ({ ...prev, device_id: e.target.value || undefined }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All devices</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </div>

        {/* Trigger Events */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Target className="h-4 w-4 inline mr-1" />
            Trigger Events <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {[
              { value: 'enter', label: 'Enter Geofence' },
              { value: 'exit', label: 'Exit Geofence' },
              { value: 'dwell', label: 'Dwell in Geofence' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleData.on_events?.includes(value as any) || false}
                  onChange={(e) => {
                    const events = ruleData.on_events || [];
                    setRuleData((prev) => ({
                      ...prev,
                      on_events: e.target.checked
                        ? [...events, value as any]
                        : events.filter((evt) => evt !== value),
                    }));
                  }}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          {errors.events && <p className="mt-1 text-sm text-red-600">{errors.events}</p>}
        </div>

        {/* Dwell Time */}
        {ruleData.on_events?.includes('dwell') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="h-4 w-4 inline mr-1" />
              Minimum Dwell Time (seconds) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={ruleData.min_dwell_seconds || ''}
              onChange={(e) =>
                setRuleData((prev) => ({
                  ...prev,
                  min_dwell_seconds: parseInt(e.target.value) || undefined,
                }))
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.dwell ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="300"
            />
            {errors.dwell && <p className="mt-1 text-sm text-red-600">{errors.dwell}</p>}
          </div>
        )}
      </div>
    </div>
  );

  const renderTestReview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Test & Review</h3>
        <p className="text-sm text-gray-600">
          Review your automation setup and test the connection
        </p>
      </div>

      {createdAutomation && (
        <div className="space-y-4">
          {/* Automation Summary */}
          <div className="bg-green-50 border border-green-200 rounded-md p-2">
            <div className="flex items-center space-x-2 mb-2">
              <Check className="h-5 w-5 text-green-600" />
              <h4 className="font-semibold text-green-800">Automation Created Successfully</h4>
            </div>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Name:</span> {createdAutomation.name}
              </p>
              <p>
                <span className="font-medium">Type:</span>{' '}
                {createdAutomation.kind.charAt(0).toUpperCase() + createdAutomation.kind.slice(1)}
              </p>
              {createdAutomation.kind === 'webhook' && (
                <p>
                  <span className="font-medium">URL:</span> {createdAutomation.config.url}
                </p>
              )}
            </div>
          </div>

          {/* Test Button */}
          {createdAutomation.kind === 'webhook' && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
              <h4 className="font-semibold text-blue-800 mb-2">Test Your Webhook</h4>
              <p className="text-sm text-blue-700 mb-3">
                Send a test webhook to verify your endpoint is working correctly.
              </p>
              <button
                onClick={handleTest}
                disabled={testMutation.isPending}
                className="flex items-center space-x-2 bg-blue-600 text-white  rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                <Zap className="h-4 w-4" />
                <span>{testMutation.isPending ? 'Sending Test...' : 'Send Test Webhook'}</span>
              </button>
            </div>
          )}

          {/* Rule Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
            <h4 className="font-semibold text-gray-800 mb-2">Rule Configuration</h4>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Rule Name:</span> {ruleData.name}
              </p>
              <p>
                <span className="font-medium">Geofence:</span>{' '}
                {geofences.find((g) => g.id === ruleData.geofence_id)?.name}
              </p>
              <p>
                <span className="font-medium">Device:</span>{' '}
                {ruleData.device_id
                  ? devices.find((d) => d.id === ruleData.device_id)?.name
                  : 'All devices'}
              </p>
              <p>
                <span className="font-medium">Triggers:</span> {ruleData.on_events?.join(', ')}
              </p>
              {ruleData.min_dwell_seconds && (
                <p>
                  <span className="font-medium">Dwell Time:</span> {ruleData.min_dwell_seconds}{' '}
                  seconds
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  const isLoading = createAutomationMutation.isPending || createRuleMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header with Progress */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-md">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Create Automation</h2>
                <p className="text-sm text-gray-500">Set up geofence-triggered automations</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md">
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center space-x-4">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < currentStep
                      ? 'bg-blue-600 text-white'
                      : index === currentStep
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div className="hidden md:block">
                  <div
                    className={`text-sm font-medium ${index <= currentStep ? 'text-gray-900' : 'text-gray-500'}`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`hidden md:block w-8 h-0.5 ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-3">
          {currentStep === 0 && renderTypeSelection()}
          {currentStep === 1 && renderConfiguration()}
          {currentStep === 2 && renderRulesSetup()}
          {currentStep === 3 && renderTestReview()}

          {errors.submit && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-2">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center space-x-2  text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-3">
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <span>{isLoading ? 'Processing...' : 'Next'}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={isLoading}
                className="flex items-center space-x-2 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>{isLoading ? 'Finishing...' : 'Complete Setup'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
