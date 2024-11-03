import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, QrCode, Wallet, DollarSign } from 'lucide-react';
import { getExchangeRate } from '../services/api';
import '../assets/styles/PaymentMethodPage.css';

const PaymentMethodPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedNumbers, raffleId, raffleName } = location.state || {};

  const [exchangeRate, setExchangeRate] = useState(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState(null);

  // Fetch exchange rate function
  const fetchExchangeRate = async () => {
    setExchangeRateLoading(true);
    setExchangeRateError(null);
    try {
      const result = await getExchangeRate();
      if (result.success && result.rate) {
        setExchangeRate(result.rate);
      } else {
        setExchangeRateError(result.error || 'Error fetching exchange rate.');
        setExchangeRate(35.0); // Default fallback rate
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      setExchangeRate(35.0); // Default fallback rate
      setExchangeRateError('Error fetching exchange rate. Using default rate.');
    } finally {
      setExchangeRateLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRate();
    // Fetch exchange rate every 5 minutes
    const exchangeRateInterval = setInterval(fetchExchangeRate, 5 * 60 * 1000);
    return () => clearInterval(exchangeRateInterval);
  }, []);

  const handleMethodSelect = (method) => {
    navigate('/payment-details', {
      state: {
        selectedNumbers,
        method: method.name,
        raffleId,
        raffleName,
        exchangeRate: method.id === 'pagomovil' ? exchangeRate : null,
        // Pass the adjusted amount for Pagomovil
        amount: method.id === 'pagomovil' ? method.adjustedAmountUSD : method.baseAmountUSD
      }
    });
  };

  const ticketPrice = 10; // Base ticket price in USD
  const baseAmountUSD = selectedNumbers.length * ticketPrice;
  const pagomovilSurcharge = 1.20; // 20% more
  const pagomovilAmountUSD = baseAmountUSD * pagomovilSurcharge;
  const pagomovilAmountBS = exchangeRate ? (pagomovilAmountUSD * exchangeRate).toFixed(2) : 'Calculando...';

  // Format selectedNumbers with leading zeros
  const formattedSelectedNumbers = selectedNumbers.map(num => String(num).padStart(3, '0'));

  // Define payment methods with conditional rendering for Zelle
  const paymentMethods = [
    {
      id: 'binance',
      name: 'Binance Pay',
      icon: <QrCode size={32} />,
      description: 'Pagos rápidos y seguros en criptomonedas',
      tag: 'Recomendado',
      amount: `$${baseAmountUSD} USD`,
      baseAmountUSD
    },
    {
      id: 'pagomovil',
      name: 'Pagomovil',
      icon: <Wallet size={32} />,
      description: 'Transferencia bancaria directa a través de móvil',
      tag: 'Transferencia Local',
      amount: `${pagomovilAmountBS} BS`,
      exchangeRate: exchangeRate ? `Tasa del día: $1 = ${exchangeRate} BS` : 'Cargando tasa...',
      usdAmount: `($${pagomovilAmountUSD.toFixed(2)} USD)`,
      isLoading: exchangeRateLoading,
      error: exchangeRateError,
      baseAmountUSD,
      adjustedAmountUSD: pagomovilAmountUSD
    },
    {
      id: 'cash',
      name: 'Cash',
      icon: <DollarSign size={32} />,
      description: 'Pago en efectivo al recoger',
      tag: 'En persona',
      amount: `$${baseAmountUSD} USD`,
      baseAmountUSD
    }
  ];

  // Add Zelle option only if 5 or more tickets are selected
  if (selectedNumbers.length >= 5) {
    paymentMethods.push({
      id: 'zelle',
      name: 'Zelle',
      icon: <CreditCard size={32} />,
      description: 'Servicio de transferencia bancaria en EE. UU.',
      tag: 'Internacional',
      amount: `$${baseAmountUSD} USD`,
      baseAmountUSD
    });
  }

  if (!selectedNumbers.length) {
    navigate('/select-numbers');
    return null;
  }

  return (
    <div className="payment-method-page">
      <div className="payment-method-container">
        <div className="header-section">
          <h2>Selecciona Método de Pago</h2>
          <p className="subtitle">Elige tu opción de pago preferida para continuar</p>
        </div>

        <div className="selected-numbers-summary">
          <span className="summary-label">Números Seleccionados:</span>
          <span className="summary-numbers">{formattedSelectedNumbers.join(', ')}</span>
        </div>

        <div className="payment-methods-grid">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              className="payment-method-card"
              onClick={() => handleMethodSelect(method)}
            >
              <div className="method-tag">{method.tag}</div>
              <div className="method-icon">
                {method.icon}
              </div>
              <h3 className="method-name">{method.name}</h3>
              <p className="method-description">{method.description}</p>
              <div className="method-amount">
                <span className="amount">{method.amount}</span>
                {method.id === 'pagomovil' && (
                  <div className="exchange-rate-info">
                    {method.isLoading ? (
                      <span className="loading">Cargando tasa del día...</span>
                    ) : method.error ? (
                      <span className="error">{method.error}</span>
                    ) : (
                      <>
                        <span className="rate">{method.exchangeRate}</span>
                        <span className="usd-reference">{method.usdAmount}</span>
                        <span className="surcharge-notice">*Incluye cargo adicional del 20%</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="info-section">
          <h4>Información de Pago</h4>
          <ul>
            <li>Todos los pagos se procesan de forma segura</li>
            <li>Los boletos se reservan durante 24 horas después de la selección</li>
            <li>Equipo de soporte disponible 24/7 para asistencia</li>
            <li>Pagomovil incluye un cargo adicional del 20% sobre el precio base</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodPage;