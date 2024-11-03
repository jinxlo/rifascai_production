import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import { Eye } from 'lucide-react';
import '../../assets/styles/adminSections/PendingPayments.css';

// Utility functions moved to the top level
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
              .map(num => String(num).padStart(3, '0'))
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
    fetchPayments();

    socket.on('payment_confirmed', (data) => {
      setPayments((prev) => prev.filter((p) => p._id !== data.paymentId));
      setSuccess('Pago confirmado exitosamente');
    });

    socket.on('payment_rejected', (data) => {
      setPayments((prev) => prev.filter((p) => p._id !== data.paymentId));
      setSuccess('Pago rechazado exitosamente');
    });

    return () => {
      socket.off('payment_confirmed');
      socket.off('payment_rejected');
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
      const response = await axios.post(
        `http://localhost:5000/api/payments/${paymentId}/reject`,
        { rejectionReason: reason },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setShowRejectionDialog(false);
        setShowModal(false);
        setSelectedPayment(null);
        setSuccess('Pago rechazado exitosamente');
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      setError(error.response?.data?.message || 'Error al rechazar el pago');
    } finally {
      setLoading(false);
    }
  };

  if (loading && payments.length === 0) {
    return (
      <div className="pending-payments">
        <h2 className="page-title">Pagos Pendientes</h2>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span className="loading-text">Cargando pagos pendientes...</span>
        </div>
      </div>
    );
  }

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
                      .map(num => String(num).padStart(3, '0'))
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