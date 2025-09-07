'use client';

import { useState } from 'react';
import { Device, SendDeviceCommandRequest } from '../services/api';
import { X, Terminal, Loader2 } from 'lucide-react';

interface DeviceCommandModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSendCommand: (deviceId: string, command: SendDeviceCommandRequest) => void;
  isLoading?: boolean;
}

export function DeviceCommandModal({
  device,
  isOpen,
  onClose,
  onSendCommand,
  isLoading = false
}: DeviceCommandModalProps) {
  const [selectedCommand, setSelectedCommand] = useState<'restart' | 'update_config' | 'ping' | 'get_status' | 'update_firmware' | 'factory_reset'>('ping');
  const [parameters, setParameters] = useState<string>('{}');
  const [timeout, setTimeout] = useState(30);

  const commands = [
    { value: 'ping', label: 'Ping Device', description: 'Send a ping command to test connectivity' },
    { value: 'restart', label: 'Restart Device', description: 'Restart the device remotely' },
    { value: 'get_status', label: 'Get Status', description: 'Retrieve current device status and diagnostics' },
    { value: 'update_config', label: 'Update Config', description: 'Update device configuration' },
    { value: 'update_firmware', label: 'Update Firmware', description: 'Trigger firmware update' },
    { value: 'factory_reset', label: 'Factory Reset', description: 'Reset device to factory defaults' }
  ] as const;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;

    let parsedParameters = {};
    try {
      parsedParameters = JSON.parse(parameters);
    } catch (err) {
      alert('Invalid JSON in parameters field');
      return;
    }

    onSendCommand(device.id, {
      command: selectedCommand,
      parameters: parsedParameters,
      timeout
    });
  };

  if (!isOpen || !device) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <Terminal className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-lg font-semibold text-gray-900">Send Command</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <span className="text-sm text-gray-500">Device:</span>
            <div className="text-sm font-medium text-gray-900">{device.name}</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Command Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Command
              </label>
              <select
                value={selectedCommand}
                onChange={(e) => setSelectedCommand(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {commands.map(cmd => (
                  <option key={cmd.value} value={cmd.value}>
                    {cmd.label}
                  </option>
                ))}
              </select>
              {commands.find(cmd => cmd.value === selectedCommand) && (
                <p className="mt-1 text-xs text-gray-500">
                  {commands.find(cmd => cmd.value === selectedCommand)?.description}
                </p>
              )}
            </div>

            {/* Parameters */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parameters (JSON)
              </label>
              <textarea
                value={parameters}
                onChange={(e) => setParameters(e.target.value)}
                placeholder="{}"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={3}
              />
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeout (seconds)
              </label>
              <input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                min="1"
                max="300"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Warning for destructive commands */}
            {(selectedCommand === 'factory_reset' || selectedCommand === 'restart' || selectedCommand === 'update_firmware') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-yellow-800 text-sm">
                  <strong>Warning:</strong> This command may cause device downtime. Proceed with caution.
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Command
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}