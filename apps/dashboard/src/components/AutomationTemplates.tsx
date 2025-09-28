'use client';

import { useState } from 'react';
import {
  X,
  Search,
  Filter,
  Star,
  Clock,
  MapPin,
  Users,
  Building2,
  Car,
  Home,
  Briefcase,
  ShoppingBag,
  Webhook,
  MessageSquare,
  Database,
  FileSpreadsheet,
  MessageCircle,
  Copy,
  Play
} from 'lucide-react';

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'personal' | 'security' | 'analytics';
  popularity: number;
  icon: any;
  integrationTypes: ('webhook' | 'slack' | 'notion' | 'sheets' | 'whatsapp')[];
  useCase: string;
  template: {
    automation: {
      name: string;
      kind: string;
      config: Record<string, any>;
    };
    rule: {
      name: string;
      on_events: string[];
      min_dwell_seconds?: number;
    };
  };
  preview: {
    title: string;
    description: string;
    samplePayload?: any;
  };
}

const TEMPLATES: AutomationTemplate[] = [
  {
    id: 'office-entry-alert',
    name: 'Office Entry Notifications',
    description: 'Get notified when employees arrive at or leave the office',
    category: 'business',
    popularity: 95,
    icon: Building2,
    integrationTypes: ['slack', 'webhook'],
    useCase: 'Employee attendance tracking and office security',
    template: {
      automation: {
        name: 'Office Entry Notifications',
        kind: 'slack',
        config: {
          channel: '#general',
          template: '👋 {{device.name}} has {{event.type}}ed the office at {{timestamp}}'
        }
      },
      rule: {
        name: 'Office Entry Rule',
        on_events: ['enter', 'exit'],
      }
    },
    preview: {
      title: 'Slack Message Preview',
      description: 'Messages sent to your Slack channel when employees enter/exit',
      samplePayload: '👋 John Smith has entered the office at 9:23 AM'
    }
  },
  {
    id: 'customer-arrival',
    name: 'Customer Arrival Alerts',
    description: 'Alert staff when VIP customers arrive at your store or venue',
    category: 'business',
    popularity: 88,
    icon: Users,
    integrationTypes: ['whatsapp', 'slack', 'webhook'],
    useCase: 'Retail customer service and VIP guest management',
    template: {
      automation: {
        name: 'VIP Customer Alert',
        kind: 'whatsapp',
        config: {
          template: '🌟 VIP Customer Alert: {{device.name}} has arrived at {{geofence.name}}!'
        }
      },
      rule: {
        name: 'VIP Customer Arrival',
        on_events: ['enter'],
      }
    },
    preview: {
      title: 'WhatsApp Message Preview',
      description: 'Staff receive instant WhatsApp notifications',
      samplePayload: '🌟 VIP Customer Alert: Sarah Johnson has arrived at Main Store!'
    }
  },
  {
    id: 'delivery-tracking',
    name: 'Delivery Fleet Tracking',
    description: 'Track delivery vehicles and notify customers of arrivals',
    category: 'business',
    popularity: 92,
    icon: Car,
    integrationTypes: ['webhook', 'whatsapp'],
    useCase: 'Logistics and delivery management',
    template: {
      automation: {
        name: 'Delivery Notifications',
        kind: 'webhook',
        config: {
          url: 'https://your-api.com/delivery-updates',
          template: JSON.stringify({
            event: '{{event.type}}',
            driver: '{{device.name}}',
            location: '{{geofence.name}}',
            timestamp: '{{timestamp}}'
          })
        }
      },
      rule: {
        name: 'Delivery Zone Entry',
        on_events: ['enter'],
      }
    },
    preview: {
      title: 'Webhook Payload Preview',
      description: 'JSON data sent to your delivery management system',
      samplePayload: {
        event: 'enter',
        driver: 'Mike Wilson',
        location: 'Customer Zone A',
        timestamp: '2024-01-15T14:30:00Z'
      }
    }
  },
  {
    id: 'home-security',
    name: 'Home Security Monitoring',
    description: 'Monitor who enters and leaves your home while you\'re away',
    category: 'security',
    popularity: 89,
    icon: Home,
    integrationTypes: ['whatsapp', 'webhook', 'slack'],
    useCase: 'Home security and family safety monitoring',
    template: {
      automation: {
        name: 'Home Security Alert',
        kind: 'whatsapp',
        config: {
          template: '🏠 Home Alert: {{device.name}} {{event.type}}ed home at {{timestamp}}'
        }
      },
      rule: {
        name: 'Home Entry/Exit',
        on_events: ['enter', 'exit'],
      }
    },
    preview: {
      title: 'Security Alert Preview',
      description: 'Get instant notifications about home activity',
      samplePayload: '🏠 Home Alert: Emma entered home at 3:45 PM'
    }
  },
  {
    id: 'event-attendance',
    name: 'Event Attendance Tracking',
    description: 'Log attendee arrivals and departures to spreadsheets',
    category: 'analytics',
    popularity: 84,
    icon: Briefcase,
    integrationTypes: ['sheets', 'notion'],
    useCase: 'Conference and event management',
    template: {
      automation: {
        name: 'Event Attendance Log',
        kind: 'sheets',
        config: {
          spreadsheet_id: 'your-sheet-id',
          range: 'A:D',
          columns: ['Name', 'Event', 'Action', 'Timestamp']
        }
      },
      rule: {
        name: 'Event Check-in',
        on_events: ['enter', 'exit'],
      }
    },
    preview: {
      title: 'Spreadsheet Entry Preview',
      description: 'Automatic logging to Google Sheets',
      samplePayload: 'John Smith | Tech Conference | Enter | 2024-01-15 09:30:00'
    }
  },
  {
    id: 'retail-dwell-time',
    name: 'Customer Dwell Time Analytics',
    description: 'Track how long customers spend in different store areas',
    category: 'analytics',
    popularity: 78,
    icon: ShoppingBag,
    integrationTypes: ['notion', 'sheets', 'webhook'],
    useCase: 'Retail analytics and customer behavior insights',
    template: {
      automation: {
        name: 'Dwell Time Analytics',
        kind: 'notion',
        config: {
          database_id: 'your-notion-db',
          properties: {
            'Customer': '{{device.name}}',
            'Area': '{{geofence.name}}',
            'Duration': '{{dwell.minutes}} minutes'
          }
        }
      },
      rule: {
        name: 'Store Area Dwell',
        on_events: ['dwell'],
        min_dwell_seconds: 300
      }
    },
    preview: {
      title: 'Notion Entry Preview',
      description: 'Structured data added to Notion database',
      samplePayload: 'Customer: Anonymous | Area: Electronics Section | Duration: 12 minutes'
    }
  },
  {
    id: 'parking-management',
    name: 'Smart Parking Notifications',
    description: 'Track vehicle entries and exits in parking areas',
    category: 'business',
    popularity: 91,
    icon: Car,
    integrationTypes: ['webhook', 'slack'],
    useCase: 'Parking lot management and space optimization',
    template: {
      automation: {
        name: 'Parking Management',
        kind: 'webhook',
        config: {
          url: 'https://parking-system.com/api/events',
          template: JSON.stringify({
            vehicle: '{{device.name}}',
            zone: '{{geofence.name}}',
            action: '{{event.type}}',
            timestamp: '{{timestamp}}'
          })
        }
      },
      rule: {
        name: 'Parking Zone Activity',
        on_events: ['enter', 'exit'],
      }
    },
    preview: {
      title: 'Parking System Integration',
      description: 'Real-time updates to your parking management system',
      samplePayload: {
        vehicle: 'License ABC123',
        zone: 'Zone A',
        action: 'enter',
        timestamp: '2024-01-15T10:15:00Z'
      }
    }
  },
  {
    id: 'work-from-home',
    name: 'Remote Work Check-in',
    description: 'Automatic check-ins when employees work from home locations',
    category: 'personal',
    popularity: 73,
    icon: Home,
    integrationTypes: ['slack', 'webhook', 'sheets'],
    useCase: 'Remote work tracking and team coordination',
    template: {
      automation: {
        name: 'WFH Check-in',
        kind: 'slack',
        config: {
          channel: '#team-status',
          template: '🏠 {{device.name}} is working from {{geofence.name}} today'
        }
      },
      rule: {
        name: 'Home Office Entry',
        on_events: ['enter'],
      }
    },
    preview: {
      title: 'Team Status Update',
      description: 'Let your team know when you start working from home',
      samplePayload: '🏠 Alex Chen is working from Home Office today'
    }
  }
];

interface AutomationTemplatesProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: AutomationTemplate) => void;
}

export function AutomationTemplates({ isOpen, onClose, onSelectTemplate }: AutomationTemplatesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [integrationFilter, setIntegrationFilter] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null);

  const filteredTemplates = TEMPLATES.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.useCase.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;

    const matchesIntegration = integrationFilter === 'all' ||
      template.integrationTypes.includes(integrationFilter as any);

    return matchesSearch && matchesCategory && matchesIntegration;
  });

  const handleUseTemplate = (template: AutomationTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-md w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Automation Templates</h2>
              <p className="text-gray-600">Get started quickly with pre-built automation templates</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md">
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="business">Business</option>
                <option value="personal">Personal</option>
                <option value="security">Security</option>
                <option value="analytics">Analytics</option>
              </select>
            </div>

            <select
              value={integrationFilter}
              onChange={(e) => setIntegrationFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Integrations</option>
              <option value="slack">Slack</option>
              <option value="webhook">Webhook</option>
              <option value="notion">Notion</option>
              <option value="sheets">Google Sheets</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>

        <div className="flex h-[calc(90vh-10rem)]">
          {/* Templates List */}
          <div className="flex-1 overflow-auto p-2">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No templates found matching your criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplate?.id === template.id;

                  return (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`border-2 rounded-md p-2 cursor-pointer transition-all duration-200 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-md">
                            <Icon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{template.name}</h3>
                            <p className="text-xs text-gray-500 capitalize">{template.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 text-yellow-500 fill-current" />
                          <span className="text-xs text-gray-500">{template.popularity}</span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">{template.description}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {template.integrationTypes.slice(0, 3).map((type) => {
                            const icons = {
                              webhook: Webhook,
                              slack: MessageSquare,
                              notion: Database,
                              sheets: FileSpreadsheet,
                              whatsapp: MessageCircle
                            };
                            const IntegrationIcon = icons[type];
                            return (
                              <div key={type} className="p-1 bg-gray-100 rounded">
                                <IntegrationIcon className="h-3 w-3 text-gray-600" />
                              </div>
                            );
                          })}
                          {template.integrationTypes.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{template.integrationTypes.length - 3}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseTemplate(template);
                          }}
                          className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Use</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Template Preview */}
          {selectedTemplate && (
            <div className="w-96 border-l border-gray-200 bg-gray-50 overflow-auto">
              <div className="p-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Template Preview</h3>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <selectedTemplate.icon className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{selectedTemplate.description}</p>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-xs font-medium text-blue-900 mb-1">Use Case</p>
                      <p className="text-sm text-blue-800">{selectedTemplate.useCase}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Integration Types</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.integrationTypes.map((type) => (
                        <span key={type} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-full text-xs capitalize">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">{selectedTemplate.preview.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{selectedTemplate.preview.description}</p>
                    <div className="bg-gray-100 rounded-md p-3">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {typeof selectedTemplate.preview.samplePayload === 'string'
                          ? selectedTemplate.preview.samplePayload
                          : JSON.stringify(selectedTemplate.preview.samplePayload, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUseTemplate(selectedTemplate)}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4" />
                    <span>Use This Template</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}