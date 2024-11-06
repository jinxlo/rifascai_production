import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Package, DollarSign, CheckCircle, Clock, XCircle, Loader, Settings, LogOut, Ticket } from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../assets/styles/UserDashboard.css';

const API_URL = 'https://rifascai.com/api'; // Ensure this is defined for all API calls

const SettingsModal = React.memo(({ 
  isOpen, 
  onClose, 
  userFormData, 
  onUserFormChange, 
  passwordData, 
  onPasswordChange, 
  onUpdateProfile, 
  onUpdatePassword, 
  isSubmitting 
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="settings-modal-overlay" 
      onClick={(e) => {
        if (e.target.className === 'settings-modal-overlay') {
          onClose();
        }
      }}
    >
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuración de Cuenta</h2>
          <button 
            onClick={onClose} 
            className="close-button"
            type="button"
            aria-label="Cerrar configuración"
          >×</button>
        </div>

        <div className="modal-content">
          <form onSubmit={onUpdateProfile} className="settings-form">
            <h3>Actualizar Perfil</h3>
            <div className="form-group">
              <label htmlFor="fullName">
                <span className="field-label">Nombre Completo</span>
                <span className="field-description">Ingresa tu nombre completo como aparece en tu documento de identidad</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={userFormData.fullName || ''}
                onChange={(e) => onUserFormChange('fullName', e.target.value)}
                placeholder="Ej: Juan Antonio Pérez González"
                required
                disabled={isSubmitting}
                aria-describedby="fullNameDesc"
              />
              <small id="fullNameDesc" className="field-hint">Este nombre será usado para todas las transacciones oficiales</small>
            </div>
            <div className="form-group">
              <label htmlFor="idNumber">
                <span className="field-label">Número de Cédula</span>
                <span className="field-description">Ingresa tu número de cédula sin guiones ni espacios</span>
              </label>
              <input
                id="idNumber"
                type="text"
                value={userFormData.idNumber || ''}
                onChange={(e) => onUserFormChange('idNumber', e.target.value)}
                placeholder="Ej: 8123456789"
                required
                disabled={isSubmitting}
                aria-describedby="idNumberDesc"
                pattern="[0-9]*"
              />
              <small id="idNumberDesc" className="field-hint">Número de identificación personal, solo números</small>
            </div>
            <div className="form-group">
              <label htmlFor="phoneNumber">
                <span className="field-label">Número de Teléfono</span>
                <span className="field-description">Ingresa tu número de teléfono móvil</span>
              </label>
              <input
                id="phoneNumber"
                type="tel"
                value={userFormData.phoneNumber || ''}
                onChange={(e) => onUserFormChange('phoneNumber', e.target.value)}
                placeholder="Ej: +507 6123-4567"
                required
                disabled={isSubmitting}
                aria-describedby="phoneNumberDesc"
              />
              <small id="phoneNumberDesc" className="field-hint">Será usado para notificaciones importantes sobre tus compras</small>
            </div>
            <button 
              type="submit" 
              className={`submit-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Actualizando...' : 'Actualizar Perfil'}
            </button>
          </form>

          <form onSubmit={onUpdatePassword} className="settings-form">
            <h3>Cambiar Contraseña</h3>
            <div className="form-group">
              <label htmlFor="currentPassword">
                <span className="field-label">Contraseña Actual</span>
                <span className="field-description">Ingresa tu contraseña actual para verificar tu identidad</span>
              </label>
              <input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => onPasswordChange('currentPassword', e.target.value)}
                placeholder="Ingresa tu contraseña actual"
                required
                disabled={isSubmitting}
                aria-describedby="currentPasswordDesc"
              />
              <small id="currentPasswordDesc" className="field-hint">Necesaria para confirmar el cambio de contraseña</small>
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">
                <span className="field-label">Nueva Contraseña</span>
                <span className="field-description">Crea una contraseña segura de al menos 6 caracteres</span>
              </label>
              <input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => onPasswordChange('newPassword', e.target.value)}
                placeholder="Ingresa tu nueva contraseña"
                required
                minLength="6"
                disabled={isSubmitting}
                aria-describedby="newPasswordDesc"
              />
              <small id="newPasswordDesc" className="field-hint">Mínimo 6 caracteres, usa letras, números y símbolos</small>
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">
                <span className="field-label">Confirmar Nueva Contraseña</span>
                <span className="field-description">Repite tu nueva contraseña para confirmar</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => onPasswordChange('confirmPassword', e.target.value)}
                placeholder="Repite tu nueva contraseña"
                required
                minLength="6"
                disabled={isSubmitting}
                aria-describedby="confirmPasswordDesc"
              />
              <small id="confirmPasswordDesc" className="field-hint">Debe coincidir exactamente con la nueva contraseña</small>
            </div>
            <button 
              type="submit" 
              className={`submit-button ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});

const UserDashboard = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [userFormData, setUserFormData] = useState({
    fullName: '',
    idNumber: '',
    phoneNumber: '',
    email: ''
  });
  
  const [userData, setUserData] = useState({
    fullName: '',
    idNumber: '',
    phoneNumber: '',
    email: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    setUserFormData(userData);
  }, [userData]);

  const fetchUserData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(response.data.user);
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
      toast.error('Error al cargar los datos del usuario');
    }
  }, [token]);

  const fetchUserPurchases = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/payments/my-payments`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setPurchases(response.data);
    } catch (error) {
      console.error('Error al cargar compras:', error);
      setError('Error al cargar tus compras. Por favor, intenta más tarde.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUserData();
      fetchUserPurchases();
    }
  }, [token, fetchUserData, fetchUserPurchases]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Confirmed':
        return <CheckCircle className="status-icon confirmed" size={20} />;
      case 'Rejected':
        return <XCircle className="status-icon rejected" size={20} />;
      default:
        return <Clock className="status-icon pending" size={20} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Confirmed':
        return 'Confirmado';
      case 'Rejected':
        return 'Rechazado';
      default:
        return 'Pendiente';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    window.location.href = '/login';
  };

  const handleUserFormChange = useCallback((field, value) => {
    setUserFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handlePasswordChange = useCallback((field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await axios.put(`${API_URL}/users/profile`, userFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(userFormData);
      toast.success('Perfil actualizado exitosamente');
      setShowSettings(false);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      toast.error(error.response?.data?.message || 'Error al actualizar el perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
  
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
  
    if (passwordData.newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
  
    setIsSubmitting(true);
    try {
      const response = await axios.put(
        `${API_URL}/users/password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
  
      if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        toast.success('Contraseña actualizada exitosamente');
        setShowSettings(false);
        await fetchUserData();
      } else {
        toast.success('Contraseña actualizada exitosamente');
        setShowSettings(false);
      }
    } catch (error) {
      console.error('Password update error:', error);
  
      if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'La contraseña actual es incorrecta');
      } else if (error.response?.status === 401) {
        toast.error('Sesión expirada. Por favor, inicie sesión nuevamente');
        handleLogout();
      } else {
        toast.error(
          error.response?.data?.message || 
          'Error al actualizar la contraseña. Por favor, intente nuevamente'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <Loader className="loading-spinner" size={40} />
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <img src="/cailogo.png" alt="Logo CAI" className="header-logo" />
            <h1>Mi Panel</h1>
          </div>
          <div className="header-right">
            <Link to="/" className="raffle-button">
              <Ticket size={20} />
              <span>Comprar Tickets</span>
            </Link>
            <button onClick={() => setShowSettings(true)} className="settings-button">
              <Settings size={20} />
              <span>Configuración</span>
            </button>
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-container">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-icon">
                <Package size={24} />
              </div>
              <div className="stat-info">
                <dt>Total de Compras</dt>
                <dd>{purchases.length}</dd>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-icon">
                <DollarSign size={24} />
              </div>
              <div className="stat-info">
                <dt>Total Gastado</dt>
                <dd>
                  {formatCurrency(
                    purchases.reduce((sum, purchase) => sum + purchase.totalAmountUSD, 0)
                  )}
                </dd>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-icon">
                <CheckCircle size={24} />
              </div>
              <div className="stat-info">
                <dt>Compras Confirmadas</dt>
                <dd>{purchases.filter(p => p.status === 'Confirmed').length}</dd>
              </div>
            </div>
          </div>
        </div>

        <div className="purchases-table-container">
          <div className="table-header">
            <h3>Historial de Compras</h3>
          </div>
          
          {error ? (
            <div className="error-message">
              <p>{error}</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="empty-state">
              <Package />
              <h3>No hay compras aún</h3>
              <p>Comienza participando en nuestras rifas activas.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Números</th>
                    <th>Monto</th>
                    <th>Método de Pago</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase._id}>
                      <td>{formatDate(purchase.createdAt)}</td>
                      <td>
                        {purchase.selectedNumbers
                          .map(num => String(num).padStart(3, '0'))
                          .join(', ')}
                      </td>
                      <td>{formatCurrency(purchase.totalAmountUSD)}</td>
                      <td>{purchase.method}</td>
                      <td>
                        <div className="status-container">
                          {getStatusIcon(purchase.status)}
                          <span className={`status-text ${purchase.status.toLowerCase()}`}>
                            {getStatusText(purchase.status)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <footer className="dashboard-footer">
        <p>© {new Date().getFullYear()} RifasCAI. Todos los derechos reservados.</p>
      </footer>

      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        userFormData={userFormData}
        onUserFormChange={handleUserFormChange}
        passwordData={passwordData}
        onPasswordChange={handlePasswordChange}
        onUpdateProfile={handleUpdateProfile}
        onUpdatePassword={handleUpdatePassword}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default UserDashboard;
