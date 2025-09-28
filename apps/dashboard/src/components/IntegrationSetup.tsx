'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Check,
  ExternalLink,
  AlertTriangle,
  Loader2,
  MessageSquare,
  Database,
  FileSpreadsheet,
  MessageCircle,
  Shield,
  Link,
  Settings,
  Copy,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface IntegrationSetupProps {
  isOpen: boolean;
  onClose: () => void;
  integrationType?: 'slack' | 'notion' | 'sheets' | 'whatsapp';
  onSuccess?: (integration: any) => void;
}

interface IntegrationConfig {
  name: string;
  description: string;
  icon: any;
  color: string;
  features: string[];
  setupSteps: SetupStep[];
  oauthRequired: boolean;
  apiRequired: boolean;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  action?: 'oauth' | 'api-key' | 'config';
}

const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  slack: {
    name: 'Slack',
    description: 'Send geofence alerts to Slack channels',
    icon: MessageSquare,
    color: 'purple',
    features: [
      'Send messages to any Slack channel',
      'Mention specific users or groups',
      'Rich message formatting with device and location info',
      'Real-time delivery notifications',
    ],
    setupSteps: [
      {
        id: 'oauth',
        title: 'Connect Slack Workspace',
        description: 'Authorize GeoFence to access your Slack workspace',
        action: 'oauth',
      },
      {
        id: 'channel',
        title: 'Configure Channels',
        description: 'Select default channels and message templates',
        action: 'config',
      },
    ],
    oauthRequired: true,
    apiRequired: false,
  },
  notion: {
    name: 'Notion',
    description: 'Create database entries for geofence events',
    icon: Database,
    color: 'gray',
    features: [
      'Add rows to Notion databases',
      'Customizable property mapping',
      'Rich event data with timestamps',
      'Automatic page creation',
    ],
    setupSteps: [
      {
        id: 'oauth',
        title: 'Connect Notion Account',
        description: 'Authorize access to your Notion workspace',
        action: 'oauth',
      },
      {
        id: 'database',
        title: 'Select Database',
        description: 'Choose which database to add entries to',
        action: 'config',
      },
    ],
    oauthRequired: true,
    apiRequired: false,
  },
  sheets: {
    name: 'Google Sheets',
    description: 'Log geofence events to Google Sheets',
    icon: FileSpreadsheet,
    color: 'green',
    features: [
      'Append rows to Google Sheets',
      'Automatic column mapping',
      'Real-time data sync',
      'Multiple spreadsheet support',
    ],
    setupSteps: [
      {
        id: 'oauth',
        title: 'Connect Google Account',
        description: 'Authorize access to Google Sheets',
        action: 'oauth',
      },
      {
        id: 'spreadsheet',
        title: 'Configure Spreadsheet',
        description: 'Select spreadsheet and configure columns',
        action: 'config',
      },
    ],
    oauthRequired: true,
    apiRequired: false,
  },
  whatsapp: {
    name: 'WhatsApp Business',
    description: 'Send WhatsApp messages via Business API',
    icon: MessageCircle,
    color: 'emerald',
    features: [
      'Send WhatsApp messages',
      'Template message support',
      'Multiple phone number support',
      'Delivery status tracking',
    ],
    setupSteps: [
      {
        id: 'api-key',
        title: 'Enter API Credentials',
        description: 'Provide your WhatsApp Business API key',
        action: 'api-key',
      },
      {
        id: 'phone',
        title: 'Configure Phone Numbers',
        description: 'Set up verified phone numbers and templates',
        action: 'config',
      },
    ],
    oauthRequired: false,
    apiRequired: true,
  },
};

export function IntegrationSetup({
  isOpen,
  onClose,
  integrationType = 'slack',
  onSuccess,
}: IntegrationSetupProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'success' | 'error'
  >('idle');
  const [error, setError] = useState<string>('');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [copiedText, setCopiedText] = useState('');

  const integrationConfig = INTEGRATION_CONFIGS[integrationType];

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setConnectionStatus('idle');
      setError('');
      setConfig({});
    }
  }, [isOpen, integrationType]);

  const handleOAuthConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    setError('');

    try {
      // Construct OAuth URL
      const oauthUrl = `/api/auth/${integrationType}/authorize`;

      // Open OAuth flow in popup
      const popup = window.open(
        oauthUrl,
        'oauth-popup',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Monitor popup for completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setIsConnecting(false);

          // Check if OAuth was successful
          setTimeout(async () => {
            try {
              const response = await fetch(`/api/auth/${integrationType}/status`);
              if (response.ok) {
                const data = await response.json();
                if (data.connected) {
                  setConnectionStatus('success');
                  setConfig(data.config || {});
                  toast.success(`${integrationConfig.name} connected successfully!`);
                } else {
                  setConnectionStatus('error');
                  setError('Connection was cancelled or failed');
                }
              }
            } catch (err) {
              setConnectionStatus('error');
              setError('Failed to verify connection status');
            }
          }, 1000);
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(
        () => {
          if (!popup?.closed) {
            popup?.close();
            clearInterval(checkClosed);
            setIsConnecting(false);
            setConnectionStatus('error');
            setError('OAuth flow timed out');
          }
        },
        5 * 60 * 1000
      );
    } catch (err) {
      setIsConnecting(false);
      setConnectionStatus('error');
      setError('Failed to start OAuth flow');
    }
  };

  const handleApiKeySetup = () => {
    // For WhatsApp Business API setup
    setConnectionStatus('success');
    toast.success('API credentials configured successfully!');
  };

  const handleFinishSetup = async () => {
    try {
      // Save integration configuration
      const integrationData = {
        name: `${integrationConfig.name} Integration`,
        kind: integrationType,
        config,
        enabled: true,
      };

      // This would typically call the automation creation API
      console.log('Creating integration:', integrationData);

      onSuccess?.(integrationData);
      toast.success(`${integrationConfig.name} integration setup complete!`);
      onClose();
    } catch (err) {
      setError('Failed to save integration configuration');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const renderStepContent = () => {
    const step = integrationConfig.setupSteps[currentStep];
    if (!step) return null;

    if (step.action === 'oauth') {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-gray-600 max-w-md mx-auto">{step.description}</p>
          </div>

          {connectionStatus === 'idle' && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <div className="flex items-start space-x-3">
                <integrationConfig.icon
                  className={`h-6 w-6 text-${integrationConfig.color}-600 mt-1`}
                />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">What you&apos;ll authorize:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {integrationConfig.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {connectionStatus === 'connecting' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Connecting to {integrationConfig.name}...</p>
              <p className="text-sm text-gray-500 mt-2">
                Complete the authorization in the popup window
              </p>
            </div>
          )}

          {connectionStatus === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-900 mb-2">Successfully Connected!</h3>
              <p className="text-green-700">
                Your {integrationConfig.name} account is now connected.
              </p>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <h4 className="font-semibold text-red-900">Connection Failed</h4>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            {connectionStatus === 'idle' && (
              <button
                onClick={handleOAuthConnect}
                disabled={isConnecting}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Connect to {integrationConfig.name}</span>
              </button>
            )}

            {connectionStatus === 'error' && (
              <button
                onClick={handleOAuthConnect}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry Connection</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (step.action === 'api-key' && integrationType === 'whatsapp') {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Settings className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-gray-600 max-w-md mx-auto">{step.description}</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-800">WhatsApp Business API Required</h4>
                <p className="text-yellow-700 text-sm mt-1">
                  You need a WhatsApp Business API account. You can get one from Meta directly or
                  through partners like Twilio.
                </p>
                <div className="mt-3 space-x-3">
                  <a
                    href="https://business.whatsapp.com/products/business-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-yellow-800 underline hover:text-yellow-900"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Meta WhatsApp Business
                  </a>
                  <a
                    href="https://www.twilio.com/whatsapp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-yellow-800 underline hover:text-yellow-900"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Twilio WhatsApp API
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Base URL</label>
              <input
                type="url"
                value={config.apiUrl || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, apiUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://api.whatsapp.com/v1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Token</label>
              <div className="relative">
                <input
                  type="password"
                  value={config.apiToken || ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, apiToken: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your WhatsApp Business API token"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Phone Number ID
              </label>
              <input
                type="text"
                value={config.phoneNumberId || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, phoneNumberId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123456789012345"
              />
            </div>

            <button
              onClick={handleApiKeySetup}
              disabled={!config.apiUrl || !config.apiToken || !config.phoneNumberId}
              className="w-full bg-emerald-600 text-white py-3 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save API Configuration
            </button>
          </div>
        </div>
      );
    }

    // Configuration step
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Settings className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
          <p className="text-gray-600 max-w-md mx-auto">{step.description}</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-md p-2">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h4 className="font-semibold text-green-900">Connection Successful</h4>
              <p className="text-green-700 text-sm">
                Your {integrationConfig.name} integration is ready to use with default settings.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-600 text-sm mb-4">
            You can customize the integration settings later in the automation configuration.
          </p>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const currentStepData = integrationConfig.setupSteps[currentStep];
  const isLastStep = currentStep === integrationConfig.setupSteps.length - 1;
  const canProceed =
    (currentStepData?.action === 'oauth' && connectionStatus === 'success') ||
    (currentStepData?.action === 'api-key' && connectionStatus === 'success') ||
    currentStepData?.action === 'config';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 bg-${integrationConfig.color}-100 rounded-md`}>
                <integrationConfig.icon className={`h-6 w-6 text-${integrationConfig.color}-600`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Setup {integrationConfig.name}
                </h2>
                <p className="text-sm text-gray-600">{integrationConfig.description}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center mt-4 space-x-4">
            {integrationConfig.setupSteps.map((step, index) => (
              <div key={step.id} className="flex items-center space-x-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    index < currentStep
                      ? 'bg-green-600 text-white'
                      : index === currentStep
                        ? `bg-${integrationConfig.color}-600 text-white`
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {index < currentStep ? <Check className="h-3 w-3" /> : index + 1}
                </div>
                {index < integrationConfig.setupSteps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 ${index < currentStep ? 'bg-green-600' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-3">{renderStepContent()}</div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 flex justify-between">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className=" text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {!isLastStep ? (
            <button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={!canProceed}
              className={`px-6 py-2 bg-${integrationConfig.color}-600 text-white rounded-md hover:bg-${integrationConfig.color}-700 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinishSetup}
              disabled={!canProceed}
              className={`px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Complete Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
