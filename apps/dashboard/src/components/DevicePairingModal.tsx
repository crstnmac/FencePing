'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { X, QrCode, Copy, RefreshCw, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import {
  useGeneratePairingCode,
  useCompletePairing
} from '../hooks/useApi';
import {
  type PairingCodeResponse,
  type PairingRequest
} from '../services/api';

// QR Code generation library (we'll use a simple implementation)
const generateQRCode = (text: string): string => {
  // In a real implementation, you would use a QR code library like qrcode.js
  // For now, we'll return a data URL placeholder
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
};

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DevicePairingModal({ isOpen, onClose, onSuccess }: DevicePairingModalProps) {
  const [pairingCode, setPairingCode] = useState<PairingCodeResponse | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const generatePairingCodeMutation = useGeneratePairingCode();
  const completePairingMutation = useCompletePairing();
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isGeneratingRef = useRef(false);

  // Memoize generateNewPairingCode function to prevent useEffect re-runs
  const generateNewPairingCode = useCallback(async () => {
    if (isGeneratingRef.current) return; // Prevent multiple simultaneous generations
    
    isGeneratingRef.current = true;
    try {
      const result = await generatePairingCodeMutation.mutateAsync();
      setPairingCode(result);
      setCountdown(600); // 10 minutes in seconds
      setCopySuccess(false);
    } catch (error) {
      console.error('Failed to generate pairing code:', error);
    } finally {
      isGeneratingRef.current = false;
    }
  }, [generatePairingCodeMutation]);

  // Auto-generate pairing code when modal opens (run only once per modal open)
  useEffect(() => {
    if (isOpen && !pairingCode && !isGeneratingRef.current) {
      generateNewPairingCode();
    }
  }, [isOpen, pairingCode, generateNewPairingCode]);

  // Countdown timer for pairing code expiration
  useEffect(() => {
    if (!pairingCode || countdown <= 0) {
      return; // Don't start countdown if no pairing code or countdown finished
    }

    countdownRef.current = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown, pairingCode]);

  // Handle pairing code expiration (separate effect to avoid infinite loop)
  useEffect(() => {
    if (pairingCode && countdown === 0) {
      // Clear expired pairing code and allow user to manually regenerate
      setPairingCode(null);
    }
  }, [countdown, pairingCode]);

  // Generate QR code URL when pairing code is available
  useEffect(() => {
    if (pairingCode) {
      const qrData = JSON.stringify({
        type: 'device_pairing',
        pairingCode: pairingCode.pairingCode,
        accountId: 'current-account', // This should come from auth context
        timestamp: Date.now()
      });
      setQrCodeUrl(generateQRCode(qrData));
    } else {
      setQrCodeUrl('');
    }
  }, [pairingCode]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    setPairingCode(null);
    setCopySuccess(false);
    setCountdown(0);
    setShowQR(false);
    setQrCodeUrl('');
    onClose();
  };

  const handleSuccess = () => {
    onSuccess();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">Device Pairing</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Step 1: Pairing Code */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-medium">1</span>
              </div>
              <span>Generate pairing code</span>
            </div>

            {pairingCode ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      Pairing Code
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        Expires in: {formatCountdown(countdown)}
                      </span>
                      <button
                        onClick={generateNewPairingCode}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={generatePairingCodeMutation.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 ${generatePairingCodeMutation.isPending ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <code className="flex-1 bg-white px-3 py-2 rounded text-center font-mono text-lg font-medium">
                      {pairingCode.pairingCode.match(/.{2}/g)?.join(' ')}
                    </code>
                    <button
                      onClick={() => copyToClipboard(pairingCode.pairingCode)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>

                  {copySuccess && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Code copied to clipboard!</span>
                    </div>
                  )}
                </div>

                {/* QR Code Button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>{showQR ? 'Hide' : 'Show'} QR Code</span>
                  </button>
                </div>

                {/* QR Code Display */}
                {showQR && qrCodeUrl && (
                  <div className="flex flex-col items-center space-y-2 p-4 bg-gray-50 rounded-lg">
                    <Image
                      src={qrCodeUrl}
                      alt="Pairing QR Code"
                      width={192}
                      height={192}
                      className="border-2 border-white"
                    />
                    <p className="text-sm text-gray-600 text-center">
                      Scan this QR code from your device to start pairing
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <RefreshCw className={`h-8 w-8 animate-spin text-blue-600 mx-auto mb-4 ${!generatePairingCodeMutation.isPending ? 'hidden' : ''}`} />
                <button
                  onClick={generateNewPairingCode}
                  disabled={generatePairingCodeMutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {generatePairingCodeMutation.isPending ? 'Generating...' : 'Generate Pairing Code'}
                </button>
              </div>
            )}
          </div>

          {generatePairingCodeMutation.error && (
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Failed to generate pairing code</span>
            </div>
          )}

          {/* Step 2: Instructions */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-medium">2</span>
              </div>
              <span>Connect your device</span>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 space-y-2">
                <p>On your device:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Open the device pairing app</li>
                  <li>Enter the pairing code above</li>
                  <li>Or scan the QR code</li>
                  <li>Complete the pairing process</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Mobile App Links */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Smartphone className="h-4 w-4" />
              <span>Mobile Apps</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=com.geofence.device"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm">Android</span>
              </a>
              <a
                href="https://apps.apple.com/app/geofence-device/id123456789"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm">iOS</span>
              </a>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleClose}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Device pairing completion component (for devices to complete pairing)
export function DevicePairingCompletion({ pairingCode }: { pairingCode: string }) {
  const [deviceInfo, setDeviceInfo] = useState({
    name: '',
    deviceModel: '',
    deviceFirmwareVersion: '',
    deviceOs: '',
  });

  const completePairingMutation = useCompletePairing();

  const handleCompletePairing = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceInfo.name.trim()) {
      alert('Device name is required');
      return;
    }

    try {
      const pairingRequest: PairingRequest = {
        pairingCode,
        deviceData: {
          name: deviceInfo.name.trim(),
          deviceModel: deviceInfo.deviceModel.trim(),
          deviceFirmwareVersion: deviceInfo.deviceFirmwareVersion.trim(),
          deviceOs: deviceInfo.deviceOs.trim(),
          capabilities: {
            geofencing: true,
            location: true,
            battery: true,
            wifi: true,
          },
        },
      };

      const result = await completePairingMutation.mutateAsync(pairingRequest);

      // Store tokens (in real app, this would be handled by the device app)
      console.log('Pairing successful:', result);

    } catch (error) {
      console.error('Pairing failed:', error);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Complete Device Pairing</h2>
        <p className="text-gray-600 mt-2">Enter your device information to complete the pairing</p>
      </div>

      <form onSubmit={handleCompletePairing} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Device Name *
          </label>
          <input
            type="text"
            required
            value={deviceInfo.name}
            onChange={(e) => setDeviceInfo(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="My IoT Device"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Device Model
          </label>
          <input
            type="text"
            value={deviceInfo.deviceModel}
            onChange={(e) => setDeviceInfo(prev => ({ ...prev, deviceModel: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Raspberry Pi 4"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Firmware Version
          </label>
          <input
            type="text"
            value={deviceInfo.deviceFirmwareVersion}
            onChange={(e) => setDeviceInfo(prev => ({ ...prev, deviceFirmwareVersion: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="1.2.3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Operating System
          </label>
          <input
            type="text"
            value={deviceInfo.deviceOs}
            onChange={(e) => setDeviceInfo(prev => ({ ...prev, deviceOs: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ubuntu 22.04"
          />
        </div>

        <button
          type="submit"
          disabled={completePairingMutation.isPending}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
        >
          {completePairingMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Pairing...
            </>
          ) : (
            'Complete Pairing'
          )}
        </button>

        {completePairingMutation.error && (
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Pairing failed. Please try again.</span>
          </div>
        )}
      </form>
    </div>
  );
}
