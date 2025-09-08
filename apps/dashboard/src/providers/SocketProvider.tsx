'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  error: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  error: null
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { organization, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only connect if user is authenticated and has an organization
    if (!isAuthenticated || !organization?.id) {
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    console.log('🔌 Connecting to Socket.IO server:', socketUrl);
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      retries: 3
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('🔌 Socket.IO connected:', newSocket.id);
      setIsConnected(true);
      setError(null);
      
      // Join the organization room
      newSocket.emit('join-room', organization.id);
      console.log('🏠 Joined room:', organization.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('🔌 Socket.IO connection error:', err);
      setError(`Connection failed: ${err.message}`);
      setIsConnected(false);
    });

    // Business logic event handlers
    newSocket.on('deliveryUpdate', (data) => {
      console.log('📦 Delivery update received:', data);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      
      if (data.automationId) {
        queryClient.invalidateQueries({ 
          queryKey: ['deliveries', { automation_id: data.automationId }] 
        });
      }
    });

    newSocket.on('automationUpdate', (data) => {
      console.log('🤖 Automation update received:', data);
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    });

    newSocket.on('deviceUpdate', (data) => {
      console.log('📱 Device update received:', data);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    });

    newSocket.on('geofenceUpdate', (data) => {
      console.log('🗺️ Geofence update received:', data);
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    });

    newSocket.on('eventUpdate', (data) => {
      console.log('📍 Event update received:', data);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'recent-events'] });
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Cleaning up Socket.IO connection');
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setError(null);
    };
  }, [isAuthenticated, organization?.id, queryClient]);

  const contextValue: SocketContextType = {
    socket,
    isConnected,
    error
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};