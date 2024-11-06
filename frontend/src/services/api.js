import axios from 'axios';

const API_URL = 'https://rifascai.com/api';

// Create an axios instance with the base URL
const api = axios.create({
  baseURL: API_URL,
});

// Create a separate instance for external APIs
const externalApi = axios.create();

// Add a request interceptor to include JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't override Content-Type for FormData
    if (config.data instanceof FormData) {
      // Let the browser set the Content-Type with boundary
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 400:
          // Handle validation errors
          console.error('Validation error:', error.response.data);
          const errorMessage =
            error.response.data.message ||
            (error.response.data.errors && error.response.data.errors[0]?.msg) ||
            'Error en la validación de datos';
          error.message = errorMessage;
          break;
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('isAdmin');
          window.location.href = '/login';
          break;
        case 403:
          // Forbidden - handle access denied
          console.error('Access denied:', error.response.data);
          error.message = 'No tiene permisos para realizar esta acción';
          break;
        default:
          // Handle other error cases
          console.error('API Error:', error.response.data);
          error.message = error.response.data.message || 'Error en el servidor';
      }
    } else if (error.request) {
      error.message = 'No se pudo conectar con el servidor';
    }
    return Promise.reject(error);
  }
);

//// EXCHANGE RATE APIs ////

// Get current exchange rate directly from pydolarve.org
export const getExchangeRate = async () => {
  try {
    const response = await externalApi.get('https://pydolarve.org/api/v1/dollar?monitor=bcv', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    console.log('Exchange rate API response:', response.data);

    if (response.data && response.data.price) {
      return {
        success: true,
        rate: parseFloat(response.data.price), // Use the 'price' from the response
        source: 'pydolarve.org',
        timestamp: new Date().toISOString(),
      };
    } else {
      throw new Error('Invalid response format from exchange rate API');
    }
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return {
      success: false,
      rate: 35.0, // Default fallback rate
      error: error.message,
      source: 'fallback',
      timestamp: new Date().toISOString(),
    };
  }
};

//// AUTHENTICATION APIs ////

// Login with email and password
export const loginWithPassword = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

// Send login code to email
export const sendLoginCode = async (email) => {
  const response = await api.post('/auth/send-login-code', { email });
  return response.data;
};

// Verify login code and log in
export const verifyLoginCode = async (email, code) => {
  const response = await api.post('/auth/verify-login-code', { email, code });
  return response.data;
};

//// TICKETS APIs ////

// Get all tickets
export const getTickets = async () => {
  const response = await api.get('/tickets');
  return response.data;
};

// Reserve tickets
export const reserveTickets = async (userId, tickets) => {
  const response = await api.post('/tickets/reserve', { userId, tickets });
  return response.data;
};

// Check if tickets are available
export const checkTicketsAvailability = async (tickets) => {
  const response = await api.post('/tickets/check-reserved', { tickets });
  return response.data;
};

// Confirm tickets
export const confirmTickets = async (userId, tickets) => {
  const response = await api.post('/tickets/confirm', { userId, tickets });
  return response.data;
};

//// PAYMENTS APIs ////

// Create payment and user account
export const createPaymentAndUser = async (formData) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'multipart/form-data',
  };

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await api.post('/payments/create-and-pay', formData, { headers });
  return response.data;
};

// Get payment status
export const getPaymentStatus = async (paymentId) => {
  const response = await api.get(`/payments/${paymentId}/status`);
  return response.data;
};

// Get pending payments (admin only)
export const getPendingPayments = async () => {
  const response = await api.get('/payments/pending');
  return response.data;
};

// Confirm payment (admin only)
export const confirmPayment = async (paymentId) => {
  const response = await api.post(`/payments/${paymentId}/confirm`);
  return response.data;
};

// Reject payment (admin only)
export const rejectPayment = async (paymentId) => {
  const response = await api.post(`/payments/${paymentId}/reject`);
  return response.data;
};

// Get confirmed payments (admin only)
export const getConfirmedPayments = async () => {
  const response = await api.get('/payments/confirmed', {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.data;
};

//// RAFFLE APIs ////

// Get active raffle
export const getActiveRaffle = async () => {
  const response = await api.get('/raffle');
  return response.data;
};

// Get all raffles (admin only)
export const getAllRaffles = async () => {
  const response = await api.get('/raffle/all');
  return response.data;
};

// Create new raffle (admin only)
export const createRaffle = async (raffleData) => {
  const response = await api.post('/raffle/create', raffleData);
  return response.data;
};

// Update raffle (admin only)
export const updateRaffle = async (raffleId, updates) => {
  const response = await api.put(`/raffle/${raffleId}`, updates);
  return response.data;
};

// Delete raffle (admin only)
export const deleteRaffle = async (raffleId) => {
  const response = await api.delete(`/raffle/${raffleId}`);
  return response.data;
};

// Toggle raffle status (activate or pause)
export const toggleRaffleStatus = async (raffleId, isActive) => {
  const response = await api.patch(`/raffle/${raffleId}/status`, { active: isActive });
  return response.data;
};

//// Error Handling Helper ////
export const handleApiError = (error) => {
  if (error.response) {
    return {
      status: error.response.status,
      message: error.response.data.message || 'An error occurred',
      data: error.response.data,
    };
  } else if (error.request) {
    return {
      status: 0,
      message: 'No response received from server',
      data: null,
    };
  } else {
    return {
      status: 0,
      message: error.message,
      data: null,
    };
  }
};

// Export both API instances
export { api as default, externalApi };
