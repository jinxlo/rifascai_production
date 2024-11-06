import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import '../assets/styles/PaymentVerificationPage.css';

const PaymentVerificationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  // State variables
  const [status, setStatus] = useState('pending');
  const [error, setError] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);

  // Destructure paymentId from location.state
  const { paymentId } = location.state || {};

  useEffect(() => {
    if (!paymentId) {
      navigate('/');
      return;
    }

    // Function to check payment status
    const checkPaymentStatus = async () => {
      try {
        const token = localStorage.getItem('token');

        // Include the authorization token in the request headers
        const response = await axios.get(
          `https://rifascai.com/api/payments/${paymentId}/status`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        // Update status and selectedNumbers from response data
        setStatus(response.data.status.toLowerCase());
        setSelectedNumbers(response.data.selectedNumbers || []);
      } catch (error) {
        console.error('Error al verificar el estado del pago:', error);

        // Handle different error statuses
        if (error.response && error.response.status === 403) {
          setError('No tiene permiso para ver este pago.');
        } else if (error.response && error.response.status === 404) {
          setError('El pago no fue encontrado.');
        } else {
          setError('Error al obtener el estado del pago');
        }
      }
    };

    // Call the function to check payment status
    checkPaymentStatus();

    // Socket event listeners for real-time updates
    socket.on('payment_confirmed', (data) => {
      if (data.paymentId === paymentId) {
        setStatus('confirmed');
      }
    });

    socket.on('payment_rejected', (data) => {
      if (data.paymentId === paymentId) {
        setStatus('rejected');
      }
    });

    // Clean up socket listeners on component unmount
    return () => {
      socket.off('payment_confirmed');
      socket.off('payment_rejected');
    };
  }, [paymentId, socket, navigate]);

  // Function to render the appropriate status icon
  const renderStatusIcon = () => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="status-icon confirmed" size={64} />;
      case 'rejected':
        return <AlertCircle className="status-icon rejected" size={64} />;
      default:
        return <Clock className="status-icon pending" size={64} />;
    }
  };

  // Function to render the status message based on payment status
  const renderStatusMessage = () => {
    switch (status) {
      case 'confirmed':
        return (
          <div className="status-message confirmed">
            <h2>¡Pago Confirmado!</h2>
            <p>Sus boletos han sido comprados exitosamente.</p>
            <p>Se ha enviado un correo de confirmación a su dirección de correo registrada.</p>
            {selectedNumbers.length > 0 && (
              <div className="ticket-numbers">
                <h3>Sus Números de Boleto:</h3>
                <p>{selectedNumbers.join(', ')}</p>
              </div>
            )}
            <button
              className="action-button"
              onClick={() => navigate('/')}
            >
              Regresar a Inicio
            </button>
          </div>
        );
      case 'rejected':
        return (
          <div className="status-message rejected">
            <h2>Pago Rechazado</h2>
            <p>Desafortunadamente, no se pudo verificar su pago.</p>
            <p>Por favor, inténtelo de nuevo o contacte con soporte para asistencia.</p>
            <div className="action-buttons">
              <button
                className="action-button retry"
                onClick={() => navigate('/payment-method')}
              >
                Intentar Nuevamente
              </button>
              <button
                className="action-button support"
                onClick={() => window.location.href = 'mailto:support@example.com'}
              >
                Contactar Soporte
              </button>
            </div>
          </div>
        );
      default:
        return (
          <div className="status-message pending">
            <h2>Verificando Pago</h2>
            <p>Su pago está siendo verificado por nuestro equipo.</p>
            <p>Recibirá un correo una vez que la verificación esté completa.</p>
            <div className="verification-steps">
              <div className="step completed">
                <span className="step-number">1</span>
                <span className="step-text">Pago Enviado</span>
              </div>
              <div className="step active">
                <span className="step-number">2</span>
                <span className="step-text">Verificación en Progreso</span>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <span className="step-text">Confirmación</span>
              </div>
            </div>
          </div>
        );
    }
  };

  // Render error message if there is an error
  if (error) {
    return (
      <div className="payment-verification-page error">
        <AlertCircle className="error-icon" size={64} />
        <h2>Error</h2>
        <p>{error}</p>
        <button
          className="action-button"
          onClick={() => navigate('/')}
        >
          Regresar a Inicio
        </button>
      </div>
    );
  }

  // Main render function
  return (
    <div className="payment-verification-page">
      <div className="verification-card">
        {renderStatusIcon()}
        {renderStatusMessage()}
      </div>
    </div>
  );
};

export default PaymentVerificationPage;
