import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import { Eye } from 'lucide-react';
import '../../assets/styles/adminSections/PendingPayments.css';

// Utility functions remain the same
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatTicketNumber = (number) => String(number).padStart(3, '0');

// RejectionDialog component remains the same
const RejectionDialog = ({ payment, onClose, onReject, loading }) => {
  const [localRejectionReason, setLocalRejectionReason] = useState('');

  const handleSubmit = () => {
    if (localRejectionReason.trim()) {
      onReject(payment._id, localRejectionReason);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content rejection-dialog">
        <h3>Rechazar Pago</h3>
        <div className="rejection-form">
          <label>Razón del rechazo:</label>
          <textarea
            value={localRejectionReason}
            onChange={(e) => setLocalRejectionReason(e.target.value)}
            placeholder="Ingrese la razón del rechazo"
            className="rejection-textarea"
            required
          />
        </div>
        <div className="modal-actions">
          <button
            className="reject-button"
            onClick={handleSubmit}
            disabled={loading || !localRejectionReason.trim()}
          >
            {loading ? 'Procesando...' : 'Confirmar Rechazo'}
          </button>
          <button
            className="cancel-button"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// PaymentDetailsModal component remains the same
const PaymentDetailsModal = ({ payment, onClose, onConfirm, onReject, loading }) => (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Detalles del Pago</h3>

      <div className="payment-details">
        <div className="detail-group">
          <label>Cliente:</label>
          <p>{payment.fullName}</p>
        </div>

        <div className="detail-group">
          <label>Cédula:</label>
          <p>{payment.idNumber}</p>
        </div>

        <div className="detail-group">
          <label>Email:</label>
          <p>{payment.email}</p>
        </div>

        <div className="detail-group">
          <label>Teléfono:</label>
          <p>{payment.phoneNumber}</p>
        </div>

        <div className="detail-group">
          <label>Método de Pago:</label>
          <p>{payment.method}</p>
        </div>

        <div className="detail-group">
          <label>Monto:</label>
          <p>{formatCurrency(payment.totalAmountUSD)}</p>
        </div>

        <div className="detail-group">
          <label>Números Seleccionados:</label>
          <p>
            {payment.selectedNumbers
              .map(formatTicketNumber)
              .join(', ')}
          </p>
        </div>

        <div className="detail-group">
          <label>Comprobante de Pago:</label>
          {payment.proofOfPayment && (
            <img
              src={`http://localhost:5000${payment.proofOfPayment}`}
              alt="Comprobante de pago"
              className="proof-image"
            />
          )}
        </div>
      </div>

      <div className="modal-actions">
        <button
          className="confirm-button"
          onClick={() => onConfirm(payment._id)}
          disabled={loading}
        >
          {loading ? 'Procesando...' : 'Confirmar Pago'}
        </button>
        <button
          className="reject-button"
          onClick={() => onReject()}
          disabled={loading}
        >
          {loading ? 'Procesando...' : 'Rechazar Pago'}
        </button>
        <button
          className="cancel-button"
          onClick={onClose}
          disabled={loading}
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
);

const PendingPayments = () => {
  const socket = useSocket();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);

  useEffect(() => {
    console.log('Setting up socket listeners for payments...');
    fetchPayments();

    const handlePaymentConfirmed = (data) => {
      console.log('Payment confirmed event received:', data);
      setPayments((prev) => prev.filter((p) => p._id !== data.paymentId));
      setSuccess('Pago confirmado exitosamente');
    };

    const handlePaymentRejected = (data) => {
      console.log('Payment rejected event received:', data);
      setPayments((prev) => prev.filter((p) => p._id !== data.paymentId));
      setSuccess('Pago rechazado exitosamente');
    };

    socket.on('payment_confirmed', handlePaymentConfirmed);
    socket.on('payment_rejected', handlePaymentRejected);

    return () => {
      console.log('Cleaning up socket listeners...');
      socket.off('payment_confirmed', handlePaymentConfirmed);
      socket.off('payment_rejected', handlePaymentRejected);
    };
  }, [socket]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/payments/pending', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Fetched pending payments:', response.data);
      setPayments(response.data);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError('Error al cargar los pagos pendientes');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (paymentId) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('token');
      console.log('Confirming payment:', paymentId);

      const response = await axios.post(
        `http://localhost:5000/api/payments/${paymentId}/confirm`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        console.log('Payment confirmed successfully:', response.data);
        setShowModal(false);
        setSelectedPayment(null);
        setSuccess('Pago confirmado exitosamente');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      setError(error.response?.data?.message || 'Error al confirmar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPayment = async (paymentId, reason) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      
      const payment = payments.find(p => p._id === paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      const ticketNumbers = payment.selectedNumbers.map(formatTicketNumber);
      console.log('Rejecting payment. Ticket numbers to release:', ticketNumbers);

      const response = await axios.post(
        `http://localhost:5000/api/payments/${paymentId}/reject`,
        { 
          rejectionReason: reason,
          tickets: ticketNumbers
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        console.log('Payment rejected successfully. Response:', response.data);
        
        setShowRejectionDialog(false);
        setShowModal(false);
        setSelectedPayment(null);
        setSuccess('Pago rechazado exitosamente');
        
        fetchPayments();
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      setError(error.response?.data?.message || 'Error al rechazar el pago');
    } finally {
      setLoading(false);
    }
  };

  // Rest of the JSX remains the same
  return (
    <div className="pending-payments">
      <h2 className="page-title">Pagos Pendientes</h2>
      <p className="page-description">Confirmar o rechazar pagos pendientes</p>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {payments.length === 0 ? (
        <div className="no-payments">
          <p>No hay pagos pendientes en este momento</p>
        </div>
      ) : (
        <div className="payments-table-container">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Cédula</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Números</th>
                <th>Método</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id}>
                  <td>{payment.fullName}</td>
                  <td>{payment.idNumber}</td>
                  <td>{formatCurrency(payment.totalAmountUSD)}</td>
                  <td>{formatDate(payment.createdAt)}</td>
                  <td>
                    {payment.selectedNumbers
                      .map(formatTicketNumber)
                      .join(', ')}
                  </td>
                  <td>{payment.method}</td>
                  <td className="action-buttons">
                    <button
                      className="view-button"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setShowModal(true);
                      }}
                      title="Ver detalles"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedPayment && (
        <PaymentDetailsModal
          payment={selectedPayment}
          onClose={() => {
            setShowModal(false);
            setSelectedPayment(null);
          }}
          onConfirm={handleConfirmPayment}
          onReject={() => setShowRejectionDialog(true)}
          loading={loading}
        />
      )}

      {showRejectionDialog && selectedPayment && (
        <RejectionDialog
          payment={selectedPayment}
          onClose={() => {
            setShowRejectionDialog(false);
          }}
          onReject={handleRejectPayment}
          loading={loading}
        />
      )}
    </div>
  );
};

export default PendingPayments;