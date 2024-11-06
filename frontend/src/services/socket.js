import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://rifascai.com';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
    this.isConnected = false;
    this.eventQueue = [];
    this.initialize();
  }

  initialize() {
    console.log('Initializing socket connection...');

    this.socket = io(`${SOCKET_URL}/raffle`, {
      path: '/socket.io/', // Ensure the path matches the server
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    this.setupEventHandlers();
    this.setupRaffleEventHandlers();
    this.connect();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.processEventQueue();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      this.handleConnectionError(error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;

      if (reason === 'io server disconnect') {
        console.log('Server disconnected the client');
        this.connect();
      }

      toast.error('Conexión perdida. Intentando reconectar...');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.processEventQueue();
      toast.success('Conexión reestablecida');
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
      this.reconnectAttempts = attemptNumber;
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      this.handleReconnectionError(error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      this.handleReconnectionFailure();
    });
  }

  setupRaffleEventHandlers() {
    const formatTicketNumbers = (tickets) => {
      return tickets.map((ticket) => String(ticket).padStart(3, '0'));
    };

    // Payment Rejected Handler
    this.socket.on('payment_rejected', (data) => {
      console.log('Payment rejected event received:', data);
      if (data?.tickets) {
        const formattedTickets = formatTicketNumbers(data.tickets);

        // Emit events to update the UI
        this.emit('eventReceived', {
          type: 'payment_rejected',
          data: {
            tickets: formattedTickets,
            status: 'available',
            raffleId: data.raffleId,
          },
        });

        this.emit('eventReceived', {
          type: 'ticket_status_changed',
          data: {
            tickets: formattedTickets,
            status: 'available',
            raffleId: data.raffleId,
          },
        });
      }
    });

    // Ticket Status Changed Handler
    this.socket.on('ticket_status_changed', (data) => {
      console.log('Ticket status changed event received:', data);
      if (data?.tickets) {
        const formattedData = {
          tickets: formatTicketNumbers(data.tickets),
          status: data.status.toLowerCase(),
          raffleId: data.raffleId,
        };
        // Broadcast the status change
        this.emit('eventReceived', {
          type: 'ticket_status_changed',
          data: formattedData,
        });
      }
    });

    // Tickets Released Handler
    this.socket.on('tickets_released', (data) => {
      console.log('tickets_released event received:', data);
      if (data?.tickets) {
        const formattedData = {
          tickets: formatTicketNumbers(data.tickets),
          status: 'available',
          raffleId: data.raffleId,
        };
        this.emit('ticket_status_changed', formattedData);
        this.emit('event_received', {
          type: 'tickets_released',
          data: formattedData,
        });
      }
    });

    // Tickets Reserved Handler
    this.socket.on('tickets_reserved', (data) => {
      console.log('tickets_reserved event received:', data);
      if (data?.tickets) {
        const formattedData = {
          tickets: formatTicketNumbers(data.tickets),
          status: 'reserved',
          raffleId: data.raffleId,
        };
        this.emit('ticket_status_changed', formattedData);
        this.emit('event_received', {
          type: 'tickets_reserved',
          data: formattedData,
        });
      }
    });

    // Payment Confirmed Handler
    this.socket.on('payment_confirmed', (data) => {
      console.log('payment_confirmed event received:', data);
      if (data?.tickets) {
        const formattedData = {
          tickets: formatTicketNumbers(data.tickets),
          status: 'sold',
          raffleId: data.raffleId,
        };
        this.emit('ticket_status_changed', formattedData);
        this.emit('event_received', {
          type: 'payment_confirmed',
          data: formattedData,
        });
      }
    });

    // Tickets Sold Handler
    this.socket.on('tickets_sold', (data) => {
      console.log('tickets_sold event received:', data);
      if (data?.tickets) {
        const formattedData = {
          tickets: formatTicketNumbers(data.tickets),
          status: 'sold',
          raffleId: data.raffleId,
        };
        this.emit('ticket_status_changed', formattedData);
        this.emit('event_received', {
          type: 'tickets_sold',
          data: formattedData,
        });
      }
    });
  }

  handleConnectionError(error) {
    if (error.message === 'xhr poll error') {
      console.error('Network connection issue');
      toast.error('Error de conexión con el servidor');
    } else if (error.message === 'Invalid namespace') {
      console.error('Invalid socket namespace');
      toast.error('Error de configuración del socket');
    }
  }

  handleReconnectionError(error) {
    console.error('Reconnection error:', error);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      toast.error('No se pudo reestablecer la conexión');
    }
  }

  handleReconnectionFailure() {
    toast.error(
      'No se pudo reestablecer la conexión. Por favor, recarga la página.'
    );
  }

  connect() {
    console.log('Connecting socket...');
    if (this.socket && !this.isConnected) {
      this.socket.connect();
    }
  }

  disconnect() {
    console.log('Disconnecting socket...');
    if (this.socket && this.isConnected) {
      this.socket.disconnect();
    }
  }

  emit(eventName, data) {
    if (!this.socket) {
      console.error('Socket not initialized');
      this.queueEvent(eventName, data);
      return false;
    }

    if (!this.isConnected) {
      console.warn('Socket is not connected. Queueing event:', eventName);
      this.queueEvent(eventName, data);
      return false;
    }

    try {
      console.log('Emitting event:', eventName, data);
      this.socket.emit(eventName, data);
      return true;
    } catch (error) {
      console.error('Error emitting event:', error);
      this.queueEvent(eventName, data);
      return false;
    }
  }

  send(eventName, data) {
    return this.emit(eventName, data);
  }

  queueEvent(eventName, data) {
    this.eventQueue.push({ eventName, data });
  }

  processEventQueue() {
    while (this.eventQueue.length > 0) {
      const { eventName, data } = this.eventQueue.shift();
      this.emit(eventName, data);
    }
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
    this.socket.on(eventName, callback);
  }

  off(eventName, callback) {
    if (callback && this.listeners.has(eventName)) {
      const callbacks = this.listeners.get(eventName);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
    this.socket.off(eventName, callback);
  }

  isSocketConnected() {
    return this.isConnected;
  }

  getSocket() {
    return this.socket;
  }

  updateAuthToken(token) {
    if (this.socket) {
      this.socket.auth = { token };
      if (this.isConnected) {
        this.disconnect();
        this.connect();
      }
    }
  }

  ensureConnection() {
    if (!this.isConnected) {
      this.connect();
    }
    return this.isConnected;
  }
}

const socketService = new SocketService();

if (process.env.NODE_ENV === 'development') {
  window.socketService = socketService;
}

export const updateSocketAuth = () => {
  const token = localStorage.getItem('token');
  if (token) {
    socketService.updateAuthToken(token);
    if (!socketService.isConnected) {
      socketService.connect();
    }
  } else {
    socketService.disconnect();
  }
};

export default socketService;
