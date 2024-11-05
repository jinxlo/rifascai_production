import React, { createContext, useContext, useEffect, useCallback } from 'react';
import socketService from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const handleConnectionChange = useCallback((isConnected) => {
    console.log('Socket connection status changed:', isConnected);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('SocketProvider: Initializing with token:', !!token);

    if (token) {
      socketService.updateAuthToken(token);
      socketService.connect();
    }

    // Set up connection status listener
    socketService.on('connect', () => handleConnectionChange(true));
    socketService.on('disconnect', () => handleConnectionChange(false));

    // Set up event logging for debugging
    const logEvent = (eventName) => (data) => {
      console.log(`SocketContext: ${eventName} event received:`, data);
    };

    // Register listeners for all relevant events
    const events = [
      'tickets_reserved',
      'tickets_sold',
      'payment_confirmed',
      'payment_rejected',
      'tickets_released',
      'ticket_status_changed'
    ];

    events.forEach(eventName => {
      socketService.on(eventName, logEvent(eventName));
    });

    return () => {
      console.log('SocketProvider: Cleaning up...');
      // Remove all event listeners
      events.forEach(eventName => {
        socketService.off(eventName, logEvent(eventName));
      });
      socketService.off('connect', () => handleConnectionChange(true));
      socketService.off('disconnect', () => handleConnectionChange(false));
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