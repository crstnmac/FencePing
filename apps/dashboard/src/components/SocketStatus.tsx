'use client';

import { useSocket } from '../providers/SocketProvider';

export function SocketStatus() {
  const { isConnected, error } = useSocket();

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span>Socket Error: {error}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 text-xs px-2 py-1 rounded ${
      isConnected 
        ? 'text-green-600 bg-green-50' 
        : 'text-yellow-600 bg-yellow-50'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        isConnected 
          ? 'bg-green-500' 
          : 'bg-yellow-500 animate-pulse'
      }`}></div>
      <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
    </div>
  );
}