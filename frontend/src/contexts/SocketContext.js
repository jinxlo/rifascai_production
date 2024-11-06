import React, { createContext, useContext, useEffect, useCallback } from 'react';
import socketService from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const handleConnectionChange = useCallback((isConnected) => {
    console.log('Socket connection status changed:', isConnected);
  }, []);

  useEffect(() => {
    // Initialize socket connection
    const token = localStorage.getItem('token');
    console.log('SocketProvider: Initializing with token:', !!token);

    // Update token and connect socket
    socketService.updateAuthToken(token);
    socketService.connect();

    // Connection status listeners
    const handleConnect = () => handleConnectionChange(true);
    const handleDisconnect = () => handleConnectionChange(false);

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);

    // Event logging for debugging
    const logEvent = (eventName) => (data) => {
      console.log(`SocketContext: ${eventName} event received:`, data);
    };

    // List of events to listen to
    const events = [
      'raffle_created',
      'raffle_updated',
      'tickets_reserved',
      'tickets_sold',
      'payment_confirmed',
      'payment_rejected',
      'tickets_released',
      'ticket_status_changed',
    ];

    // Register event listeners
    events.forEach((eventName) => {
      socketService.on(eventName, logEvent(eventName));
    });

    // Clean up on unmount
    return () => {
      console.log('SocketProvider: Cleaning up...');
      events.forEach((eventName) => {
        socketService.off(eventName, logEvent(eventName));
      });
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.disconnect();
    };
  }, [handleConnectionChange]);

  return (
    <SocketContext.Provider value={socketService}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
