'use client';

import { useState } from 'react';
import {
  Building2,
  Home,
  Car,
  School,
  ShoppingCart,
  MapPin,
  Plus,
  Copy,
  Download,
  Upload,
  Trash2,
  Search,
  Filter,
  Grid3X3,
  Zap,
  Target,
  Clock
} from 'lucide-react';

interface GeofenceTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'residential' | 'transport' | 'education' | 'retail' | 'custom';
  icon: React.ComponentType<{ className?: string }>;
  radius?: number;
  shape: 'circle' | 'polygon';
  coordinates?: number[][];
  center?: [number, number];
  automationRules?: Array<{
    event: 'enter' | 'exit' | 'dwell';
    condition?: string;
    action: string;
  }>;
  tags: string[];
  usageCount: number;
  color: string;
}

const defaultTemplates: GeofenceTemplate[] = [
  {
    id: 'office-building',
    name: 'Office Building',
    description: 'Standard office building perimeter with entrance/exit tracking',
    category: 'business',
    icon: Building2,
    radius: 50,
    shape: 'circle',
    automationRules: [
      { event: 'enter', action: 'Send arrival notification to Slack' },
      { event: 'exit', action: 'Log departure time to Google Sheets' },
      { event: 'dwell', condition: 'duration > 8 hours', action: 'Send overtime alert' }
    ],
    tags: ['office', 'work', 'attendance', 'business'],
    usageCount: 45,
    color: '#3B82F6'
  },
  {
    id: 'warehouse-complex',
    name: 'Warehouse Complex',
    description: 'Large industrial facility with loading dock zones',
    category: 'business',
    icon: Building2,
    shape: 'polygon',
    coordinates: [
      [-122.4194, 37.7749], [-122.4194, 37.7759],
      [-122.4184, 37.7759], [-122.4184, 37.7749],
      [-122.4194, 37.7749]
    ],
    automationRules: [
      { event: 'enter', action: 'Check-in delivery vehicles' },
      { event: 'exit', action: 'Update inventory management system' }
    ],
    tags: ['warehouse', 'logistics', 'inventory', 'industrial'],
    usageCount: 28,
    color: '#6B7280'
  },
  {
    id: 'residential-home',
    name: 'Home Perimeter',
    description: 'Family home with security and automation features',
    category: 'residential',
    icon: Home,
    radius: 30,
    shape: 'circle',
    automationRules: [
      { event: 'enter', action: 'Turn on smart lights and heating' },
      { event: 'exit', action: 'Activate security system' },
      { event: 'enter', action: 'Send arrival notification to family' }
    ],
    tags: ['home', 'security', 'smart-home', 'family'],
    usageCount: 156,
    color: '#10B981'
  },
  {
    id: 'parking-garage',
    name: 'Parking Garage',
    description: 'Multi-level parking facility with space management',
    category: 'transport',
    icon: Car,
    shape: 'polygon',
    coordinates: [
      [-122.4200, 37.7750], [-122.4200, 37.7755],
      [-122.4195, 37.7755], [-122.4195, 37.7750],
      [-122.4200, 37.7750]
    ],
    automationRules: [
      { event: 'enter', action: 'Reserve parking space via app' },
      { event: 'dwell', condition: 'duration > 24 hours', action: 'Send overstay notice' }
    ],
    tags: ['parking', 'vehicle', 'payment', 'urban'],
    usageCount: 73,
    color: '#8B5CF6'
  },
  {
    id: 'school-campus',
    name: 'School Campus',
    description: 'Educational facility with student safety monitoring',
    category: 'education',
    icon: School,
    radius: 200,
    shape: 'circle',
    automationRules: [
      { event: 'enter', action: 'Mark student attendance' },
      { event: 'exit', action: 'Send departure notification to parents' }
    ],
    tags: ['school', 'education', 'safety', 'children', 'attendance'],
    usageCount: 34,
    color: '#F59E0B'
  },
  {
    id: 'retail-store',
    name: 'Retail Store',
    description: 'Shopping location with customer analytics',
    category: 'retail',
    icon: ShoppingCart,
    radius: 25,
    shape: 'circle',
    automationRules: [
      { event: 'enter', action: 'Send welcome offer via WhatsApp' },
      { event: 'dwell', condition: 'duration > 30 minutes', action: 'Trigger loyalty program bonus' }
    ],
    tags: ['retail', 'shopping', 'customer', 'marketing', 'loyalty'],
    usageCount: 89,
    color: '#EF4444'
  }
];

interface GeofenceTemplatesProps {
  onTemplateSelect?: (template: GeofenceTemplate) => void;
  onTemplateCreate?: (template: Omit<GeofenceTemplate, 'id' | 'usageCount'>) => void;
  onBulkImport?: (templates: GeofenceTemplate[]) => void;
  customTemplates?: GeofenceTemplate[];
}

export function GeofenceTemplates({
  onTemplateSelect,
  onTemplateCreate,
  onBulkImport,
  customTemplates = []
}: GeofenceTemplatesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'category'>('usage');

  const categories = [
    { id: 'all', name: 'All Categories', count: defaultTemplates.length + customTemplates.length },
    { id: 'business', name: 'Business', count: defaultTemplates.filter(t => t.category === 'business').length },
    { id: 'residential', name: 'Residential', count: defaultTemplates.filter(t => t.category === 'residential').length },
    { id: 'transport', name: 'Transport', count: defaultTemplates.filter(t => t.category === 'transport').length },
    { id: 'education', name: 'Education', count: defaultTemplates.filter(t => t.category === 'education').length },
    { id: 'retail', name: 'Retail', count: defaultTemplates.filter(t => t.category === 'retail').length },
    { id: 'custom', name: 'Custom', count: customTemplates.length }
  ];

  const allTemplates = [...defaultTemplates, ...customTemplates];

  const filteredTemplates = allTemplates
    .filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

  const handleTemplateSelect = (template: GeofenceTemplate) => {
    onTemplateSelect?.(template);
  };

  const handleBulkAction = (action: 'select' | 'export' | 'delete') => {
    const templates = selectedTemplates.map(id => allTemplates.find(t => t.id === id)).filter(Boolean);

    switch (action) {
      case 'export':
        const dataStr = JSON.stringify(templates, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `geofence-templates-${new Date().toISOString().split('T')[0]}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        break;
      case 'delete':
        console.log('Deleting templates:', templates);
        setSelectedTemplates([]);
        break;
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedTemplates = JSON.parse(e.target?.result as string);
          onBulkImport?.(importedTemplates);
        } catch (error) {
          console.error('Failed to import templates:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Geofence Templates</h2>
            <p className="text-sm text-gray-600">Pre-configured templates for common use cases</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Create</span>
            </button>
            <button
              onClick={handleImport}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
            >
              <Upload className="h-4 w-4" />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-3 mb-3">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
          >
            <option value="usage">Most Used</option>
            <option value="name">Name A-Z</option>
            <option value="category">Category</option>
          </select>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs transition-colors ${selectedCategory === category.id
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <span>{category.name}</span>
              <span className="bg-white/50 px-1 rounded-full">{category.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedTemplates.length > 0 && (
        <div className="border-b border-gray-200 p-3 bg-blue-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('export')}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
              >
                <Download className="h-3 w-3" />
                <span>Export</span>
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
              <button
                onClick={() => setSelectedTemplates([])}
                className="flex items-center space-x-1 px-3 py-2 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => {
            const Icon = template.icon;
            const isSelected = selectedTemplates.includes(template.id);

            return (
              <div
                key={template.id}
                className={`relative bg-white border border-gray-200 rounded-md p-2 hover:shadow-lg transition-all cursor-pointer group ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
              >
                {/* Selection Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTemplates(prev => [...prev, template.id]);
                    } else {
                      setSelectedTemplates(prev => prev.filter(id => id !== template.id));
                    }
                  }}
                  className="absolute top-2 right-2 rounded"
                />

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: template.color + '20', color: template.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Target className="h-3 w-3" />
                    <span>{template.usageCount}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-3">
                  <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">{template.description}</p>

                  {/* Shape and Size Info */}
                  <div className="flex items-center space-x-3 text-xs text-gray-500 mb-2">
                    <div className="flex items-center space-x-1">
                      {template.shape === 'circle' ? (
                        <div className="w-3 h-3 rounded-full border border-current" />
                      ) : (
                        <Grid3X3 className="h-3 w-3" />
                      )}
                      <span className="capitalize">{template.shape}</span>
                    </div>
                    {template.radius && (
                      <div className="flex items-center space-x-1">
                        <Target className="h-3 w-3" />
                        <span>{template.radius}m</span>
                      </div>
                    )}
                  </div>

                  {/* Automation Rules Count */}
                  {template.automationRules && template.automationRules.length > 0 && (
                    <div className="flex items-center space-x-1 text-xs text-gray-500 mb-2">
                      <Zap className="h-3 w-3" />
                      <span>{template.automationRules.length} automation rules</span>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {template.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {template.tags.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        +{template.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500 capitalize">{template.category}</span>
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTemplateSelect(template);
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="Use template"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Edit template:', template);
                      }}
                      className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Edit template"
                    >
                      <MapPin className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}