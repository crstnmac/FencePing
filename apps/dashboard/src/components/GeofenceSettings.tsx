'use client';

import { useState, useCallback } from 'react';
import {
  Settings,
  Shield,
  Zap,
  Clock,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle,
  Sliders,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Gauge,
  MapPin,
  Radio,
  Battery,
  Wifi,
  Volume2,
  VolumeX,
  Globe,
  Lock,
  Unlock,
  Database,
  HardDrive,
  Cpu,
  BarChart3,
  TrendingUp,
  Info
} from 'lucide-react';

interface GeofenceSettings {
  // Accuracy & Performance
  accuracyThreshold: number; // meters
  hysteresisBuffer: number; // meters  
  dwellTimeThreshold: number; // seconds
  updateInterval: number; // seconds
  batchingEnabled: boolean;
  batchSize: number;

  // Reliability & Monitoring
  retryAttempts: number;
  retryDelay: number; // seconds
  healthCheckInterval: number; // seconds
  alertOnFailure: boolean;
  alertThreshold: number; // failure percentage

  // Privacy & Security
  dataEncryption: boolean;
  anonymizeLocation: boolean;
  locationPrecision: number; // decimal places
  dataRetention: number; // days
  auditLogging: boolean;

  // Power & Connectivity
  lowPowerMode: boolean;
  wifiOptimization: boolean;
  cellularFallback: boolean;
  adaptiveSampling: boolean;
  batteryThreshold: number; // percentage

  // Notifications
  silentHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  priorityGeofences: string[];
  notificationCooldown: number; // seconds

  // Advanced Features
  machineLearning: boolean;
  predictiveAnalytics: boolean;
  anomalyDetection: boolean;
  loadBalancing: boolean;
  caching: boolean;
}

interface GeofenceOptimizationProps {
  settings: GeofenceSettings;
  onSettingsChange: (settings: GeofenceSettings) => void;
  onOptimize: () => void;
  onReset: () => void;
  performance: {
    accuracy: number;
    latency: number;
    batteryUsage: number;
    networkUsage: number;
  };
  className?: string;
}

const defaultSettings: GeofenceSettings = {
  accuracyThreshold: 20,
  hysteresisBuffer: 10,
  dwellTimeThreshold: 60,
  updateInterval: 30,
  batchingEnabled: true,
  batchSize: 10,
  retryAttempts: 3,
  retryDelay: 5,
  healthCheckInterval: 300,
  alertOnFailure: true,
  alertThreshold: 15,
  dataEncryption: true,
  anonymizeLocation: false,
  locationPrecision: 4,
  dataRetention: 90,
  auditLogging: true,
  lowPowerMode: false,
  wifiOptimization: true,
  cellularFallback: true,
  adaptiveSampling: false,
  batteryThreshold: 20,
  silentHours: {
    enabled: false,
    start: '22:00',
    end: '07:00'
  },
  priorityGeofences: [],
  notificationCooldown: 300,
  machineLearning: false,
  predictiveAnalytics: false,
  anomalyDetection: false,
  loadBalancing: true,
  caching: true
};

export function GeofenceSettings({
  settings,
  onSettingsChange,
  onOptimize,
  onReset,
  performance,
  className = ''
}: GeofenceOptimizationProps) {
  const [activeTab, setActiveTab] = useState<'accuracy' | 'reliability' | 'privacy' | 'power' | 'notifications' | 'advanced'>('accuracy');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateSetting = useCallback(<K extends keyof GeofenceSettings>(
    key: K,
    value: GeofenceSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    setHasUnsavedChanges(true);
  }, [settings, onSettingsChange]);

  const saveSettings = useCallback(() => {
    // Trigger save action
    setHasUnsavedChanges(false);
  }, []);

  const resetToDefaults = useCallback(() => {
    onSettingsChange(defaultSettings);
    setHasUnsavedChanges(true);
  }, [onSettingsChange]);

  const getPerformanceColor = (value: number, reversed = false) => {
    const threshold1 = reversed ? 70 : 80;
    const threshold2 = reversed ? 90 : 60;

    if (reversed) {
      return value <= threshold1 ? 'text-green-600' :
        value <= threshold2 ? 'text-yellow-600' : 'text-red-600';
    } else {
      return value >= threshold1 ? 'text-green-600' :
        value >= threshold2 ? 'text-yellow-600' : 'text-red-600';
    }
  };

  const tabs = [
    { id: 'accuracy', label: 'Accuracy & Performance', icon: Target },
    { id: 'reliability', label: 'Reliability & Monitoring', icon: Shield },
    { id: 'privacy', label: 'Privacy & Security', icon: Lock },
    { id: 'power', label: 'Power & Connectivity', icon: Battery },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'advanced', label: 'Advanced Features', icon: Cpu }
  ];

  const SettingCard = ({
    title,
    description,
    children,
    warning,
    info
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
    warning?: string;
    info?: string;
  }) => (
    <div className="bg-white border border-neutral-200 rounded-md p-3 shadow-sm hover:shadow-md transition-shadow duration-150">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-neutral-900 mb-2">{title}</h4>
          <p className="text-sm text-neutral-600 leading-relaxed">{description}</p>
          {warning && (
            <div className="flex items-center gap-2 mt-3">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-600">{warning}</span>
            </div>
          )}
          {info && (
            <div className="flex items-center gap-2 mt-3">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-600">{info}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 ml-6">
          {children}
        </div>
      </div>
    </div>
  );

  const SliderSetting = ({
    value,
    onChange,
    min,
    max,
    step = 1,
    unit = '',
    showValue = true
  }: {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    showValue?: boolean;
  }) => (
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-neutral-200 rounded-md appearance-none cursor-pointer accent-blue-600"
      />
      {showValue && (
        <span className="text-sm font-medium text-neutral-900 min-w-16 text-right">
          {value}{unit}
        </span>
      )}
    </div>
  );

  const ToggleSetting = ({
    checked,
    onChange,
    size = 'md'
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    size?: 'sm' | 'md';
  }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center ${size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
        } flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-neutral-200'
        }`}
    >
      <span
        className={`pointer-events-none inline-block ${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
          } transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${checked ? (size === 'sm' ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0'
          }`}
      />
    </button>
  );

  return (
    <div className={`h-full flex flex-col bg-neutral-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 p-3">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-light text-neutral-900 tracking-tight">Geofence Settings & Optimization</h2>
            <p className="text-neutral-600 mt-2">Fine-tune performance, accuracy, and behavior</p>
          </div>
          <div className="flex items-center gap-4">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                <span>Unsaved changes</span>
              </div>
            )}
            <button
              onClick={onOptimize}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-150 font-medium"
            >
              <TrendingUp className="h-5 w-5" />
              <span>Auto-Optimize</span>
            </button>
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-3 py-2 bg-white text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors duration-150 font-medium"
            >
              <RotateCcw className="h-5 w-5" />
              <span>Reset</span>
            </button>
            <button
              onClick={saveSettings}
              disabled={!hasUnsavedChanges}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 font-medium"
            >
              <Save className="h-5 w-5" />
              <span>Save</span>
            </button>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <div className="bg-white border border-neutral-200 rounded-md p-2 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-600">Accuracy</span>
              <Target className="h-5 w-5 text-neutral-400" />
            </div>
            <div className={`text-xl font-light ${getPerformanceColor(performance.accuracy)}`}>
              {performance.accuracy}%
            </div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-md p-2 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-600">Latency</span>
              <Clock className="h-5 w-5 text-neutral-400" />
            </div>
            <div className={`text-xl font-light ${getPerformanceColor(performance.latency, true)}`}>
              {performance.latency}ms
            </div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-md p-2 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-600">Battery</span>
              <Battery className="h-5 w-5 text-neutral-400" />
            </div>
            <div className={`text-xl font-light ${getPerformanceColor(performance.batteryUsage, true)}`}>
              {performance.batteryUsage}%
            </div>
          </div>
          <div className="bg-white border border-neutral-200 rounded-md p-2 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-600">Network</span>
              <Wifi className="h-5 w-5 text-neutral-400" />
            </div>
            <div className={`text-xl font-light ${getPerformanceColor(performance.networkUsage, true)}`}>
              {performance.networkUsage}MB
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-neutral-100 rounded-md p-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md font-medium transition-colors duration-150 ${activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50'
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">{tab.label.split('&')[0].trim()}</span>
                <span className="sm:hidden text-sm">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* Accuracy & Performance Tab */}
        {activeTab === 'accuracy' && (
          <div className="space-y-6">
            <SettingCard
              title="Location Accuracy Threshold"
              description="Minimum GPS accuracy required to trigger geofence events"
              warning={settings.accuracyThreshold < 10 ? "Very low threshold may cause false triggers" : undefined}
            >
              <SliderSetting
                value={settings.accuracyThreshold}
                onChange={(value) => updateSetting('accuracyThreshold', value)}
                min={5}
                max={100}
                step={5}
                unit="m"
              />
            </SettingCard>

            <SettingCard
              title="Hysteresis Buffer"
              description="Buffer zone to prevent boundary flickering"
              info="Recommended: 10-20% of your smallest geofence radius"
            >
              <SliderSetting
                value={settings.hysteresisBuffer}
                onChange={(value) => updateSetting('hysteresisBuffer', value)}
                min={0}
                max={50}
                step={5}
                unit="m"
              />
            </SettingCard>

            <SettingCard
              title="Dwell Time Threshold"
              description="Minimum time inside geofence before triggering dwell event"
            >
              <SliderSetting
                value={settings.dwellTimeThreshold}
                onChange={(value) => updateSetting('dwellTimeThreshold', value)}
                min={10}
                max={600}
                step={10}
                unit="s"
              />
            </SettingCard>

            <SettingCard
              title="Update Interval"
              description="How often to check device locations"
              warning={settings.updateInterval < 15 ? "Short intervals increase battery usage" : undefined}
            >
              <SliderSetting
                value={settings.updateInterval}
                onChange={(value) => updateSetting('updateInterval', value)}
                min={5}
                max={300}
                step={5}
                unit="s"
              />
            </SettingCard>

            <SettingCard
              title="Event Batching"
              description="Batch multiple events together to reduce network calls"
            >
              <div className="space-y-3">
                <ToggleSetting
                  checked={settings.batchingEnabled}
                  onChange={(value) => updateSetting('batchingEnabled', value)}
                />
                {settings.batchingEnabled && (
                  <SliderSetting
                    value={settings.batchSize}
                    onChange={(value) => updateSetting('batchSize', value)}
                    min={5}
                    max={50}
                    step={5}
                    unit=" events"
                  />
                )}
              </div>
            </SettingCard>
          </div>
        )}

        {/* Reliability & Monitoring Tab */}
        {activeTab === 'reliability' && (
          <div className="space-y-6">
            <SettingCard
              title="Retry Attempts"
              description="Number of retry attempts for failed operations"
            >
              <SliderSetting
                value={settings.retryAttempts}
                onChange={(value) => updateSetting('retryAttempts', value)}
                min={1}
                max={10}
                unit=" attempts"
              />
            </SettingCard>

            <SettingCard
              title="Retry Delay"
              description="Delay between retry attempts"
            >
              <SliderSetting
                value={settings.retryDelay}
                onChange={(value) => updateSetting('retryDelay', value)}
                min={1}
                max={60}
                unit="s"
              />
            </SettingCard>

            <SettingCard
              title="Health Check Interval"
              description="How often to perform system health checks"
            >
              <SliderSetting
                value={settings.healthCheckInterval}
                onChange={(value) => updateSetting('healthCheckInterval', value)}
                min={60}
                max={3600}
                step={60}
                unit="s"
              />
            </SettingCard>

            <SettingCard
              title="Failure Alerts"
              description="Get notified when failure rate exceeds threshold"
            >
              <div className="space-y-3">
                <ToggleSetting
                  checked={settings.alertOnFailure}
                  onChange={(value) => updateSetting('alertOnFailure', value)}
                />
                {settings.alertOnFailure && (
                  <SliderSetting
                    value={settings.alertThreshold}
                    onChange={(value) => updateSetting('alertThreshold', value)}
                    min={5}
                    max={50}
                    unit="%"
                  />
                )}
              </div>
            </SettingCard>
          </div>
        )}

        {/* Privacy & Security Tab */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <SettingCard
              title="Data Encryption"
              description="Encrypt all location data in transit and at rest"
            >
              <ToggleSetting
                checked={settings.dataEncryption}
                onChange={(value) => updateSetting('dataEncryption', value)}
              />
            </SettingCard>

            <SettingCard
              title="Location Anonymization"
              description="Remove identifying information from location data"
            >
              <ToggleSetting
                checked={settings.anonymizeLocation}
                onChange={(value) => updateSetting('anonymizeLocation', value)}
              />
            </SettingCard>

            <SettingCard
              title="Location Precision"
              description="Number of decimal places for coordinate precision"
              info="Fewer decimal places = less precise location data"
            >
              <SliderSetting
                value={settings.locationPrecision}
                onChange={(value) => updateSetting('locationPrecision', value)}
                min={2}
                max={8}
                unit=" places"
              />
            </SettingCard>

            <SettingCard
              title="Data Retention"
              description="How long to keep historical location data"
            >
              <SliderSetting
                value={settings.dataRetention}
                onChange={(value) => updateSetting('dataRetention', value)}
                min={7}
                max={365}
                step={7}
                unit=" days"
              />
            </SettingCard>

            <SettingCard
              title="Audit Logging"
              description="Log all system access and data operations"
            >
              <ToggleSetting
                checked={settings.auditLogging}
                onChange={(value) => updateSetting('auditLogging', value)}
              />
            </SettingCard>
          </div>
        )}

        {/* Power & Connectivity Tab */}
        {activeTab === 'power' && (
          <div className="space-y-6">
            <SettingCard
              title="Low Power Mode"
              description="Reduce location accuracy and update frequency to save battery"
            >
              <ToggleSetting
                checked={settings.lowPowerMode}
                onChange={(value) => updateSetting('lowPowerMode', value)}
              />
            </SettingCard>

            <SettingCard
              title="WiFi Optimization"
              description="Use WiFi networks for improved location accuracy"
            >
              <ToggleSetting
                checked={settings.wifiOptimization}
                onChange={(value) => updateSetting('wifiOptimization', value)}
              />
            </SettingCard>

            <SettingCard
              title="Cellular Fallback"
              description="Use cellular data when WiFi is unavailable"
            >
              <ToggleSetting
                checked={settings.cellularFallback}
                onChange={(value) => updateSetting('cellularFallback', value)}
              />
            </SettingCard>

            <SettingCard
              title="Adaptive Sampling"
              description="Automatically adjust update frequency based on device movement"
            >
              <ToggleSetting
                checked={settings.adaptiveSampling}
                onChange={(value) => updateSetting('adaptiveSampling', value)}
              />
            </SettingCard>

            <SettingCard
              title="Battery Threshold"
              description="Switch to low power mode when battery drops below threshold"
            >
              <SliderSetting
                value={settings.batteryThreshold}
                onChange={(value) => updateSetting('batteryThreshold', value)}
                min={5}
                max={50}
                unit="%"
              />
            </SettingCard>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <SettingCard
              title="Silent Hours"
              description="Suppress non-critical notifications during specified hours"
            >
              <div className="space-y-3">
                <ToggleSetting
                  checked={settings.silentHours.enabled}
                  onChange={(value) => updateSetting('silentHours', { ...settings.silentHours, enabled: value })}
                />
                {settings.silentHours.enabled && (
                  <div className="flex items-center gap-4">
                    <input
                      type="time"
                      value={settings.silentHours.start}
                      onChange={(e) => updateSetting('silentHours', { ...settings.silentHours, start: e.target.value })}
                      className="px-3 py-2 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
                    />
                    <span className="text-sm text-neutral-600">to</span>
                    <input
                      type="time"
                      value={settings.silentHours.end}
                      onChange={(e) => updateSetting('silentHours', { ...settings.silentHours, end: e.target.value })}
                      className="px-3 py-2 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300"
                    />
                  </div>
                )}
              </div>
            </SettingCard>

            <SettingCard
              title="Notification Cooldown"
              description="Minimum time between notifications for the same geofence"
            >
              <SliderSetting
                value={settings.notificationCooldown}
                onChange={(value) => updateSetting('notificationCooldown', value)}
                min={30}
                max={3600}
                step={30}
                unit="s"
              />
            </SettingCard>
          </div>
        )}

        {/* Advanced Features Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <SettingCard
              title="Machine Learning"
              description="Use ML to improve geofence accuracy and predictions"
              info="Requires additional processing power and data collection"
            >
              <ToggleSetting
                checked={settings.machineLearning}
                onChange={(value) => updateSetting('machineLearning', value)}
              />
            </SettingCard>

            <SettingCard
              title="Predictive Analytics"
              description="Predict likely geofence events based on historical patterns"
            >
              <ToggleSetting
                checked={settings.predictiveAnalytics}
                onChange={(value) => updateSetting('predictiveAnalytics', value)}
              />
            </SettingCard>

            <SettingCard
              title="Anomaly Detection"
              description="Automatically detect unusual location patterns"
            >
              <ToggleSetting
                checked={settings.anomalyDetection}
                onChange={(value) => updateSetting('anomalyDetection', value)}
              />
            </SettingCard>

            <SettingCard
              title="Load Balancing"
              description="Distribute processing across multiple servers"
            >
              <ToggleSetting
                checked={settings.loadBalancing}
                onChange={(value) => updateSetting('loadBalancing', value)}
              />
            </SettingCard>

            <SettingCard
              title="Response Caching"
              description="Cache frequently accessed data to improve response times"
            >
              <ToggleSetting
                checked={settings.caching}
                onChange={(value) => updateSetting('caching', value)}
              />
            </SettingCard>
          </div>
        )}
      </div>
    </div>
  );
}