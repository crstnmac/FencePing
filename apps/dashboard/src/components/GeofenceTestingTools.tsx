'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  MapPin,
  Route,
  Clock,
  Zap,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Download,
  Upload,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Navigation,
  Timer,
  Activity,
  Plus,
} from 'lucide-react';
import { FrontendGeofence } from '../types/geofence';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  devicePath: Array<{
    lat: number;
    lng: number;
    timestamp: number;
    speed?: number;
  }>;
  expectedEvents: Array<{
    geofenceId: string;
    eventType: 'enter' | 'exit' | 'dwell';
    expectedTimestamp: number;
  }>;
  duration: number;
  isActive: boolean;
  results?: TestResult[];
}

interface TestResult {
  geofenceId: string;
  geofenceName: string;
  eventType: 'enter' | 'exit' | 'dwell';
  expectedTimestamp: number;
  actualTimestamp?: number;
  triggered: boolean;
  automationSuccess: boolean;
  latency: number;
  accuracy: 'perfect' | 'good' | 'poor';
}

interface SimulatedDevice {
  id: string;
  name: string;
  currentPosition: { lat: number; lng: number };
  path: Array<{ lat: number; lng: number; timestamp: number }>;
  pathIndex: number;
  isActive: boolean;
  speed: number; // km/h
  batteryLevel: number;
}

interface GeofenceTestingToolsProps {
  geofences: FrontendGeofence[];
  onEventTrigger?: (event: {
    geofenceId: string;
    deviceId: string;
    eventType: 'enter' | 'exit' | 'dwell';
    timestamp: Date;
  }) => void;
  onTestComplete?: (results: TestResult[]) => void;
  className?: string;
}

export function GeofenceTestingTools({
  geofences,
  onEventTrigger,
  onTestComplete,
  className = '',
}: GeofenceTestingToolsProps) {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'simulation' | 'results'>('scenarios');
  const [testScenarios, setTestScenarios] = useState<TestScenario[]>([
    {
      id: 'daily-commute',
      name: 'Daily Commute Test',
      description: 'Simulate employee daily commute with home → office → home path',
      devicePath: [
        { lat: 37.7749, lng: -122.4194, timestamp: 0, speed: 0 }, // Home
        { lat: 37.7849, lng: -122.4094, timestamp: 1800000, speed: 25 }, // En route
        { lat: 37.7949, lng: -122.3994, timestamp: 3600000, speed: 0 }, // Office
        { lat: 37.7849, lng: -122.4094, timestamp: 32400000, speed: 30 }, // Return trip
        { lat: 37.7749, lng: -122.4194, timestamp: 34200000, speed: 0 }, // Home
      ],
      expectedEvents: [
        { geofenceId: 'home-geofence', eventType: 'exit', expectedTimestamp: 900000 },
        { geofenceId: 'office-geofence', eventType: 'enter', expectedTimestamp: 3600000 },
        { geofenceId: 'office-geofence', eventType: 'dwell', expectedTimestamp: 10800000 },
        { geofenceId: 'office-geofence', eventType: 'exit', expectedTimestamp: 32400000 },
        { geofenceId: 'home-geofence', eventType: 'enter', expectedTimestamp: 34200000 },
      ],
      duration: 36000000, // 10 hours
      isActive: false,
    },
    {
      id: 'delivery-route',
      name: 'Delivery Route Test',
      description: 'Multi-stop delivery route with timing constraints',
      devicePath: [
        { lat: 37.7749, lng: -122.4194, timestamp: 0, speed: 0 }, // Depot
        { lat: 37.7849, lng: -122.4094, timestamp: 600000, speed: 35 }, // Stop 1
        { lat: 37.7949, lng: -122.3994, timestamp: 1800000, speed: 40 }, // Stop 2
        { lat: 37.8049, lng: -122.3894, timestamp: 3000000, speed: 30 }, // Stop 3
        { lat: 37.7749, lng: -122.4194, timestamp: 4800000, speed: 25 }, // Return to depot
      ],
      expectedEvents: [
        { geofenceId: 'depot', eventType: 'exit', expectedTimestamp: 300000 },
        { geofenceId: 'customer-1', eventType: 'enter', expectedTimestamp: 600000 },
        { geofenceId: 'customer-1', eventType: 'exit', expectedTimestamp: 1200000 },
        { geofenceId: 'customer-2', eventType: 'enter', expectedTimestamp: 1800000 },
        { geofenceId: 'customer-2', eventType: 'exit', expectedTimestamp: 2400000 },
        { geofenceId: 'depot', eventType: 'enter', expectedTimestamp: 4800000 },
      ],
      duration: 5400000, // 1.5 hours
      isActive: false,
    },
  ]);

  const [simulatedDevices, setSimulatedDevices] = useState<SimulatedDevice[]>([
    {
      id: 'test-device-1',
      name: 'Test Device 1',
      currentPosition: { lat: 37.7749, lng: -122.4194 },
      path: [],
      pathIndex: 0,
      isActive: false,
      speed: 25,
      batteryLevel: 85,
    },
  ]);

  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult[]>>({});
  const [simulationSpeed, setSimulationSpeed] = useState(1); // 1x, 2x, 5x, 10x
  const [showDevicePaths, setShowDevicePaths] = useState(true);

  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  const stopTest = useCallback(() => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }

    setTestScenarios((prev) => prev.map((s) => ({ ...s, isActive: false })));

    if (currentTest && testResults[currentTest]) {
      onTestComplete?.(testResults[currentTest]);
    }

    setCurrentTest(null);
  }, [currentTest, testResults, onTestComplete]);

  const checkGeofenceEvents = useCallback(
    (lat: number, lng: number, elapsed: number) => {
      // Simplified geofence containment check
      geofences.forEach((geofence) => {
        if (!geofence.is_active) return;

        let isInside = false;

        if (geofence.geometry.type === 'Point' && geofence.radius) {
          // Circle geofence
          const center = geofence.geometry.coordinates as number[];
          const distance = calculateDistance(lat, lng, center[1], center[0]);
          isInside = distance <= geofence.radius;
        } else if (geofence.geometry.type === 'Polygon') {
          // Polygon geofence (simplified point-in-polygon check)
          const coordinates = (geofence.geometry.coordinates as number[][][])[0];
          isInside = pointInPolygon(lat, lng, coordinates);
        }

        // Trigger events based on containment
        if (isInside && currentTest) {
          const event = {
            geofenceId: geofence.id,
            deviceId: 'test-device-1',
            eventType: 'enter' as const,
            timestamp: new Date(Date.now() - elapsed),
          };

          onEventTrigger?.(event);

          // Update test results
          setTestResults((prev) => {
            const scenarioResults = prev[currentTest] || [];
            return {
              ...prev,
              [currentTest]: scenarioResults.map((result) => {
                if (result.geofenceId === geofence.id && !result.triggered) {
                  const latency = elapsed - result.expectedTimestamp;
                  const accuracy =
                    Math.abs(latency) < 30000
                      ? 'perfect'
                      : Math.abs(latency) < 120000
                        ? 'good'
                        : 'poor';

                  return {
                    ...result,
                    actualTimestamp: elapsed,
                    triggered: true,
                    automationSuccess: true, // Assume success for simulation
                    latency: Math.abs(latency),
                    accuracy,
                  };
                }
                return result;
              }),
            };
          });
        }
      });
    },
    [geofences, currentTest, onEventTrigger]
  );

  const startTest = useCallback(
    (scenarioId: string) => {
      const scenario = testScenarios.find((s) => s.id === scenarioId);
      if (!scenario) return;

      setCurrentTest(scenarioId);

      // Update scenario status
      setTestScenarios((prev) =>
        prev.map((s) =>
          s.id === scenarioId ? { ...s, isActive: true } : { ...s, isActive: false }
        )
      );

      // Initialize test results
      const results: TestResult[] = scenario.expectedEvents.map((expectedEvent) => ({
        geofenceId: expectedEvent.geofenceId,
        geofenceName: geofences.find((g) => g.id === expectedEvent.geofenceId)?.name || 'Unknown',
        eventType: expectedEvent.eventType,
        expectedTimestamp: expectedEvent.expectedTimestamp,
        triggered: false,
        automationSuccess: false,
        latency: 0,
        accuracy: 'poor',
      }));

      setTestResults((prev) => ({ ...prev, [scenarioId]: results }));

      // Start simulation
      let pathIndex = 0;
      let startTime = Date.now();

      simulationInterval.current = setInterval(() => {
        if (pathIndex >= scenario.devicePath.length - 1) {
          stopTest();
          return;
        }

        const currentPoint = scenario.devicePath[pathIndex];
        const nextPoint = scenario.devicePath[pathIndex + 1];

        // Calculate progress between points
        const elapsed = (Date.now() - startTime) * simulationSpeed;
        const segmentDuration = nextPoint.timestamp - currentPoint.timestamp;
        const progress = Math.min(elapsed / segmentDuration, 1);

        // Interpolate position
        const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * progress;
        const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * progress;

        // Update simulated device position
        setSimulatedDevices((prev) =>
          prev.map((device) =>
            device.id === 'test-device-1'
              ? { ...device, currentPosition: { lat, lng }, pathIndex }
              : device
          )
        );

        // Check for geofence events
        checkGeofenceEvents(lat, lng, elapsed);

        if (progress >= 1) {
          pathIndex++;
          startTime = Date.now();
        }
      }, 100);
    },
    [testScenarios, geofences, simulationSpeed, stopTest, checkGeofenceEvents]
  );

  // Utility functions
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const pointInPolygon = (lat: number, lng: number, polygon: number[][]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0],
        yi = polygon[i][1];
      const xj = polygon[j][0],
        yj = polygon[j][1];

      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };

  const createCustomScenario = () => {
    const newScenario: TestScenario = {
      id: `custom-${Date.now()}`,
      name: 'Custom Test Scenario',
      description: 'User-defined test scenario',
      devicePath: [{ lat: 37.7749, lng: -122.4194, timestamp: 0, speed: 0 }],
      expectedEvents: [],
      duration: 3600000,
      isActive: false,
    };

    setTestScenarios((prev) => [...prev, newScenario]);
  };

  const exportResults = () => {
    const dataStr = JSON.stringify(testResults, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `geofence-test-results-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className={`h-full flex flex-col bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Geofence Testing & Simulation</h2>
            <p className="text-sm text-gray-600">
              Test geofence accuracy and automation reliability
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {currentTest && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-md text-sm">
                <Activity className="h-4 w-4 animate-pulse" />
                <span>Test Running</span>
              </div>
            )}
            <select
              value={simulationSpeed}
              onChange={(e) => setSimulationSpeed(Number(e.target.value))}
              disabled={!!currentTest}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={1}>1x Speed</option>
              <option value={2}>2x Speed</option>
              <option value={5}>5x Speed</option>
              <option value={10}>10x Speed</option>
            </select>
            <button
              onClick={exportResults}
              disabled={Object.keys(testResults).length === 0}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-md p-1">
          {[
            { id: 'scenarios', label: 'Test Scenarios', icon: Route },
            { id: 'simulation', label: 'Live Simulation', icon: Navigation },
            { id: 'results', label: 'Test Results', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Test Scenarios Tab */}
        {activeTab === 'scenarios' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Available Test Scenarios</h3>
              <button
                onClick={createCustomScenario}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Create Scenario</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testScenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className={`bg-white border rounded-md p-2 ${
                    scenario.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{scenario.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{scenario.description}</p>
                    </div>
                    {scenario.isActive && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{scenario.devicePath.length} waypoints</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Zap className="h-4 w-4 text-gray-400" />
                      <span>{scenario.expectedEvents.length} events</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{Math.round(scenario.duration / 60000)}min</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Target className="h-4 w-4 text-gray-400" />
                      <span>{geofences.length} geofences</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!scenario.isActive ? (
                      <button
                        onClick={() => startTest(scenario.id)}
                        disabled={!!currentTest}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        <Play className="h-4 w-4" />
                        <span>Start Test</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopTest}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                      >
                        <Square className="h-4 w-4" />
                        <span>Stop Test</span>
                      </button>
                    )}

                    <button
                      onClick={() => console.log('Edit scenario:', scenario.id)}
                      className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulation Tab */}
        {activeTab === 'simulation' && (
          <div className="space-y-6">
            <div className="bg-white rounded-md border border-gray-200 p-2">
              <h3 className="font-medium text-gray-900 mb-4">Simulated Devices</h3>

              <div className="space-y-4">
                {simulatedDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          device.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        }`}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{device.name}</div>
                        <div className="text-sm text-gray-600">
                          {device.currentPosition.lat.toFixed(4)},{' '}
                          {device.currentPosition.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <div>Speed: {device.speed} km/h</div>
                      <div>Battery: {device.batteryLevel}%</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={showDevicePaths}
                    onChange={(e) => setShowDevicePaths(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Show device paths on map</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {Object.entries(testResults).map(([scenarioId, results]) => {
              const scenario = testScenarios.find((s) => s.id === scenarioId);
              if (!scenario) return null;

              const successRate =
                results.length > 0
                  ? (results.filter((r) => r.triggered && r.accuracy !== 'poor').length /
                      results.length) *
                    100
                  : 0;

              return (
                <div key={scenarioId} className="bg-white rounded-md border border-gray-200 p-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{scenario.name}</h3>
                      <p className="text-sm text-gray-600">
                        Success Rate: {successRate.toFixed(1)}%
                      </p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        successRate >= 90
                          ? 'bg-green-100 text-green-800'
                          : successRate >= 70
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {successRate >= 90
                        ? 'Excellent'
                        : successRate >= 70
                          ? 'Good'
                          : 'Needs Improvement'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                      >
                        <div className="flex items-center space-x-3">
                          {result.triggered ? (
                            result.accuracy === 'perfect' ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : result.accuracy === 'good' ? (
                              <AlertCircle className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium text-gray-900">
                              {result.geofenceName} - {result.eventType}
                            </div>
                            <div className="text-sm text-gray-600">
                              Expected: {new Date(result.expectedTimestamp).toLocaleTimeString()}
                              {result.actualTimestamp && (
                                <>
                                  {' '}
                                  | Actual: {new Date(result.actualTimestamp).toLocaleTimeString()}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div
                            className={`font-medium ${
                              result.accuracy === 'perfect'
                                ? 'text-green-600'
                                : result.accuracy === 'good'
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {result.triggered ? result.accuracy : 'Failed'}
                          </div>
                          {result.latency > 0 && (
                            <div className="text-gray-600">
                              {(result.latency / 1000).toFixed(1)}s latency
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {Object.keys(testResults).length === 0 && (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Test Results</h3>
                <p className="text-gray-600">Run a test scenario to see results here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
