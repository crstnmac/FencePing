// Simple Socket.IO connection test utility
import io from 'socket.io-client';

export function testSocketConnection() {
  const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  console.log('🧪 Testing Socket.IO connection to:', socketUrl);

  const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    timeout: 5000
  });

  socket.on('connect', () => {
    console.log('✅ Socket.IO connected successfully:', socket.id);
    
    // Join test room
    const testAccountId = 'b6f18620-065b-4f77-b3ae-653748307ef7';
    socket.emit('join-room', testAccountId);
    console.log('🏠 Joined room:', testAccountId);

    // Listen for test events
    socket.on('deliveryUpdate', (data) => {
      console.log('📦 Received deliveryUpdate:', data);
    });

    socket.on('automationUpdate', (data) => {
      console.log('🤖 Received automationUpdate:', data);
    });

    // Clean up after 10 seconds
    setTimeout(() => {
      console.log('🧹 Cleaning up test connection');
      socket.disconnect();
    }, 10000);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket.IO connection error:', error);
    socket.disconnect();
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.IO disconnected:', reason);
  });

  return socket;
}

// Export for console testing
if (typeof window !== 'undefined') {
  (window as any).testSocket = testSocketConnection;
}