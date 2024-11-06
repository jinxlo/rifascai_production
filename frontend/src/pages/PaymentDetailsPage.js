import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getExchangeRate } from '../services/api';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import '../assets/styles/PaymentDetailsPage.css';

const PaymentMethodDetails = {
  'Binance Pay': {
    title: 'Binance Pay',
    details: [
      { label: 'ID de Binance Pay', value: '35018921', copyable: true },
    ],
    showQR: true,
    qrPath: '/binancepayQR.png'
  },
  'Pagomovil': {
    title: 'Pagomóvil',
    details: [
      { label: 'Número', value: '04122986051', copyable: true },
      { label: 'Cédula', value: '19993150', copyable: true },
      { label: 'Banco', value: 'Banesco', copyable: false }
    ]
  },
  'Zelle': {
    title: 'Zelle',
    details: [
      { label: 'Email', value: 'Desireelegon5@gmail.com', copyable: true },
      { label: 'Nombre', value: 'Desiree Legon', copyable: false }
    ]
  }
};

const PaymentDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    selectedNumbers, 
    method, 
    raffleName, 
    raffleId,
    exchangeRate: initialExchangeRate
  } = location.state || {
    selectedNumbers: [],
    method: '',
    raffleName: '',
    raffleId: null,
    exchangeRate: null
  };
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(initialExchangeRate);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    proofOfPayment: null,
  });

  const [validation, setValidation] = useState({
    fullName: true,
    idNumber: true,
    phoneNumber: true,
    email: true,
    password: true,
    confirmPassword: true,
    proofOfPayment: true,
  });

  const ticketPrice = 10;
  const pagomovilSurcharge = 1.20; // 20% surcharge
  const baseAmountUSD = selectedNumbers.length * ticketPrice;
  const totalAmountUSD = method === 'Pagomovil' ? baseAmountUSD * pagomovilSurcharge : baseAmountUSD;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const fetchExchangeRate = useCallback(async () => {
    if (method !== 'Pagomovil') return;
    
    setExchangeRateLoading(true);
    setExchangeRateError(null);
    try {
      const result = await getExchangeRate();
      if (result.success && result.rate) {
        setExchangeRate(result.rate);
      } else {
        throw new Error(result.error || 'Error fetching exchange rate');
      }
    } catch (error) {
      console.error('Exchange rate error:', error);
      setExchangeRate(35.0); // Default fallback rate
      setExchangeRateError('Error al obtener la tasa. Usando tasa por defecto.');
    } finally {
      setExchangeRateLoading(false);
    }
  }, [method]);

  useEffect(() => {
    if (method === 'Pagomovil' && !exchangeRate) {
      fetchExchangeRate();
    }
  }, [method, exchangeRate, fetchExchangeRate]);

  useEffect(() => {
    if (!selectedNumbers.length) {
      navigate('/select-numbers');
      return;
    }

    if (method === 'Pagomovil') {
      fetchExchangeRate();
      const interval = setInterval(fetchExchangeRate, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [selectedNumbers, navigate, method, fetchExchangeRate]);

  const calculateAmounts = useCallback(() => {
    const isPagomovil = method === 'Pagomovil';
    const pricePerNumberUSD = isPagomovil ? ticketPrice * pagomovilSurcharge : ticketPrice;
    const pricePerNumberBS = exchangeRate ? (pricePerNumberUSD * exchangeRate).toFixed(2) : null;
    const totalAmountBS = exchangeRate ? (totalAmountUSD * exchangeRate).toFixed(2) : null;

    return {
      pricePerNumberBS,
      pricePerNumberUSD,
      totalAmountBS
    };
  }, [exchangeRate, ticketPrice, totalAmountUSD, method]);

  const validateForm = () => {
    const validationRules = {
      fullName: {
        isValid: formData.fullName.length >= 3,
        message: 'El nombre debe tener al menos 3 caracteres'
      },
      idNumber: {
        isValid: formData.idNumber.length >= 5,
        message: 'El número de identificación debe tener al menos 5 caracteres'
      },
      phoneNumber: {
        isValid: formData.phoneNumber.length >= 10,
        message: 'El número de teléfono debe tener al menos 10 caracteres'
      },
      proofOfPayment: {
        isValid: formData.proofOfPayment !== null,
        message: 'Debe adjuntar un comprobante de pago'
      }
    };

    if (!isAuthenticated) {
      validationRules.email = {
        isValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
        message: 'Ingrese un correo electrónico válido'
      };
      validationRules.password = {
        isValid: formData.password.length >= 6,
        message: 'La contraseña debe tener al menos 6 caracteres'
      };
      validationRules.confirmPassword = {
        isValid: formData.password === formData.confirmPassword,
        message: 'Las contraseñas no coinciden'
      };
    }

    const newValidation = {};
    let isValid = true;
    const errors = [];

    Object.entries(validationRules).forEach(([field, rule]) => {
      newValidation[field] = rule.isValid;
      if (!rule.isValid) {
        isValid = false;
        errors.push(rule.message);
      }
    });

    setValidation(newValidation);

    if (!isValid) {
      const errorMessage = errors.join('\n');
      toast.error(errorMessage);
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!raffleId) {
      toast.error('Error: No se pudo identificar la rifa');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submitData = new FormData();
      submitData.append('raffleId', raffleId);
      submitData.append('fullName', formData.fullName);
      submitData.append('idNumber', formData.idNumber);
      submitData.append('phoneNumber', formData.phoneNumber);
      submitData.append('selectedNumbers', JSON.stringify(selectedNumbers));
      submitData.append('method', method);
      submitData.append('totalAmountUSD', totalAmountUSD);
      submitData.append('proofOfPayment', formData.proofOfPayment);

      if (!isAuthenticated) {
        submitData.append('email', formData.email);
        submitData.append('password', formData.password);
      }

      const headers = {};
      if (isAuthenticated) {
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await axios.post(
        'https://rifascai.com/api/payments/create-and-pay',
        submitData,
        { headers }
      );

      if (response.data.success) {
        if (!isAuthenticated) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('isAdmin', response.data.isAdmin);
          localStorage.setItem('userEmail', formData.email);
          localStorage.setItem('userData', JSON.stringify({
            fullName: formData.fullName,
            email: formData.email,
            idNumber: formData.idNumber,
            phoneNumber: formData.phoneNumber,
          }));
        }

        toast.success('Pago reportado exitosamente');
        navigate('/payment-verification', {
          state: {
            paymentId: response.data.paymentId,
            selectedNumbers,
          }
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error al procesar el pago';
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = (text, isPhoneNumber = false) => {
    const textToCopy = isPhoneNumber ? text.substring(4) : text;
    navigator.clipboard.writeText(textToCopy);
    toast.success('Copiado al portapapeles');
  };

  const renderPaymentDetails = () => {
    const methodConfig = PaymentMethodDetails[method];
    if (!methodConfig) return null;

    return (
      <div className="payment-method-details">
        <h3>{methodConfig.title}</h3>
        <div className="account-info-highlight">
          {methodConfig.details.map((detail, index) => (
            <div key={index} className="info-row">
              <span className="label">{detail.label}:</span>
              <span className="value">{detail.value}</span>
              {detail.copyable && (
                <button 
                  onClick={() => handleCopyToClipboard(
                    detail.value, 
                    detail.label === 'Número'
                  )} 
                  className="copy-button"
                >
                  📋 Copiar
                </button>
              )}
            </div>
          ))}
          
          {methodConfig.showQR && (
            <img 
              src={methodConfig.qrPath} 
              alt={`${methodConfig.title} QR Code`} 
              className="qr-code"
            />
          )}

          {method === 'Pagomovil' && (
            <div className="exchange-rate-info">
              {exchangeRateLoading ? (
                <p className="exchange-rate loading">Cargando tasa del día...</p>
              ) : exchangeRateError ? (
                <p className="exchange-rate error">{exchangeRateError}</p>
              ) : (
                <>
                  <p className="exchange-rate">Tasa del día: $1 = {exchangeRate} BS</p>
                  <p className="surcharge-notice">*Incluye cargo adicional del 20%</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPaymentSummary = () => {
    const isPagomovil = method === 'Pagomovil';
    const { pricePerNumberBS, pricePerNumberUSD, totalAmountBS } = calculateAmounts();
    const formattedSelectedNumbers = selectedNumbers.map(number => String(number).padStart(3, '0'));

    return (
      <div className="payment-summary">
        <div className="summary-header">
          <h3>Resumen de Pago</h3>
          <div className="divider"></div>
        </div>

        <div className="summary-content">
          <div className="numbers-section">
            <div className="section-title">Números Seleccionados:</div>
            <div className="numbers-grid">
              {formattedSelectedNumbers.map((number) => (
                <span key={number} className="number-badge">
                  {number}
                </span>
              ))}
            </div>
          </div>

          <div className="price-details">
            <div className="price-row quantity">
              <span>Cantidad de números</span>
              <span className="value">{selectedNumbers.length}</span>
            </div>
            
            <div className="price-row">
              <span>Precio por número {isPagomovil && '(+20%)'}</span>
              <span className="value">
                {isPagomovil && pricePerNumberBS 
                  ? (
                    <>
                      <span>{pricePerNumberBS} BS</span>
                      <span className="reference-price">(${pricePerNumberUSD.toFixed(2)} USD)</span>
                    </>
                  )
                  : `$${ticketPrice}`
                }
              </span>
            </div>
            
            {isPagomovil && (
              <div className="price-row surcharge-info">
                <span>Incluye cargo del 20%</span>
              </div>
            )}
            
            <div className={`price-row total ${isPagomovil ? 'bs' : ''}`}>
              <span>Total a pagar</span>
              <div className="total-amount">
                {isPagomovil && totalAmountBS ? (
                  <>
                    <span className="main-amount">{totalAmountBS} BS</span>
                    <span className="reference-amount">${totalAmountUSD.toFixed(2)} USD</span>
                  </>
                ) : (
                  <span className="main-amount">${totalAmountUSD.toFixed(2)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => {
    return (
      <form onSubmit={handleSubmit} className="payment-form">
        <div className="form-section">
          <h3>Información Personal</h3>
          <div className="form-group">
            <label htmlFor="fullName">Nombre Completo</label>
            <input
              type="text"
              id="fullName"
              placeholder="Ej: Juan Pérez"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={!validation.fullName ? 'invalid' : ''}
              required
            />
            {!validation.fullName && (
              <span className="error-message">El nombre debe tener al menos 3 caracteres</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="idNumber">Número de Identificación</label>
            <input
              type="text"
              id="idNumber"
              placeholder="Ej: V-12345678"
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              className={!validation.idNumber ? 'invalid' : ''}
              required
            />
            {!validation.idNumber && (
              <span className="error-message">El número de identificación debe tener al menos 5 caracteres</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Número de Teléfono</label>
            <input
              type="tel"
              id="phoneNumber"
              placeholder="Ej: 0414-1234567"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className={!validation.phoneNumber ? 'invalid' : ''}
              required
            />
            {!validation.phoneNumber && (
              <span className="error-message">El número de teléfono debe tener al menos 10 caracteres</span>
            )}
          </div>
        </div>

        {/* Account Creation Section - Only show for non-authenticated users */}
        {!isAuthenticated && (
          <>
            <div className="form-section">
              <h3>Crear Cuenta</h3>
              <p className="section-description">
                Esta será tu cuenta para acceder al sistema y verificar el estado de tus números
              </p>

              <div className="form-group">
                <label htmlFor="email">Correo Electrónico</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Ej: correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={!validation.email ? 'invalid' : ''}
                  required
                />
                {!validation.email && (
                  <span className="error-message">Ingrese un correo electrónico válido</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Crear clave"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={!validation.password ? 'invalid' : ''}
                  required
                />
                {!validation.password && (
                  <span className="error-message">La contraseña debe tener al menos 6 caracteres</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <input
                  type="password"
                  id="confirmPassword"
                  placeholder="Repetir clave nuevamente"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={!validation.confirmPassword ? 'invalid' : ''}
                  required
                />
                {!validation.confirmPassword && (
                  <span className="error-message">Las contraseñas no coinciden</span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Payment Proof Section */}
        <div className="form-section">
          <h3>Comprobante de Pago</h3>
          <p className="section-description">
            Por favor, adjunte una captura de pantalla o foto de su comprobante de pago
          </p>
          <div className="upload-container">
            <label htmlFor="proofOfPayment" className="upload-label">
              <div className="upload-content">
                <i className="upload-icon">📤</i>
                <span className="upload-text">
                  {formData.proofOfPayment 
                    ? formData.proofOfPayment.name 
                    : 'Haga clic o arrastre su comprobante aquí'}
                </span>
              </div>
            </label>
            <input
              type="file"
              id="proofOfPayment"
              name="proofOfPayment"
              accept="image/*"
              onChange={(e) => setFormData({ ...formData, proofOfPayment: e.target.files[0] })}
              className={!validation.proofOfPayment ? 'invalid' : ''}
              required
            />
            {!validation.proofOfPayment && (
              <span className="error-message">Debe adjuntar un comprobante de pago</span>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`submit-button ${loading ? 'loading' : ''}`}
        >
          {loading ? (
            <span className="loading-text">
              <span className="loading-spinner"></span>
              Procesando...
            </span>
          ) : (
            'Confirmar Pago'
          )}
        </button>
      </form>
    );
  };

  return (
    <div className="payment-details-page">
      <div className="payment-container">
        <h1>{raffleName || 'Detalles de Pago'}</h1>
        
        {error && <div className="error-message">{error}</div>}

        <div className="payment-content">
          {renderPaymentDetails()}
          {renderPaymentSummary()}
          
          {!showForm ? (
            <div className="payment-action">
              <div className="instructions-box">
                <h3>Instrucciones de Pago</h3>
                <p>
                  Por favor, realice el pago utilizando los datos proporcionados.
                  Una vez completada la transferencia, haga clic en el botón para
                  {isAuthenticated 
                    ? ' subir su comprobante.'
                    : ' registrar su información y subir el comprobante.'
                  }
                </p>
              </div>
              <button
                className="report-button"
                onClick={() => setShowForm(true)}
              >
                Reportar Pago
              </button>
            </div>
          ) : (
            renderForm()
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsPage;