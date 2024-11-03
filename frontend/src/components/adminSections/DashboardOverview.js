import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Users, Package } from 'lucide-react';
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import '../../assets/styles/adminSections/DashboardOverview.css';

const DashboardOverview = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    totalSales: 0,
    confirmedPayments: 0,
    activeRaffles: 0,
    salesGrowth: 0,
    paymentsGrowth: 0,
    rafflesGrowth: 0,
  });
  const [pendingPayments, setPendingPayments] = useState([]); // New state for pending payments
  const socket = useSocket();

  const formatCurrency = (amount) => (amount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount) : '$0.00');

  const formatGrowth = (value) => (value ? `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%` : '+0.0%');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsResponse, rafflesResponse, pendingPaymentsResponse] = await Promise.all([
        axios.get('http://localhost:5000/api/payments/stats', { headers }),
        axios.get('http://localhost:5000/api/raffle/all', { headers }),
        axios.get('http://localhost:5000/api/payments/pending', { headers }), // Fetch pending payments
      ]);

      const activeRaffles = rafflesResponse.data.filter((raffle) => raffle.active);
      const previousTotal = statsResponse.data.totalAmount - (statsResponse.data.growth * statsResponse.data.totalAmount) / 100;
      const rafflesGrowth =
        activeRaffles.length > 0
          ? ((activeRaffles.length - rafflesResponse.data.lastMonthCount) / rafflesResponse.data.lastMonthCount) * 100
          : 0;

      setDashboardData({
        totalSales: statsResponse.data.totalAmount || 0,
        confirmedPayments: statsResponse.data.count || 0,
        activeRaffles: activeRaffles.length,
        salesGrowth: ((statsResponse.data.totalAmount - previousTotal) / previousTotal) * 100,
        paymentsGrowth: statsResponse.data.growth || 0,
        rafflesGrowth: rafflesGrowth,
      });
      setPendingPayments(pendingPaymentsResponse.data); // Set pending payments data

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Error al cargar los datos del panel. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    if (socket) {
      const events = ['payment_confirmed', 'raffle_created', 'raffle_updated'];
      events.forEach((event) => {
        socket.on(event, () => fetchDashboardData());
      });

      return () => events.forEach((event) => socket.off(event));
    }
  }, [socket, fetchDashboardData]);

  const summaryData = [
    {
      title: 'Ventas Totales',
      value: formatCurrency(dashboardData.totalSales),
      change: `${formatGrowth(dashboardData.salesGrowth)} desde el mes pasado`,
      icon: <DollarSign className="summary-icon" />,
      color: 'blue',
    },
    {
      title: 'Pagos Confirmados',
      value: dashboardData.confirmedPayments.toString(),
      change: `${formatGrowth(dashboardData.paymentsGrowth)} desde la última hora`,
      icon: <Users className="summary-icon" />,
      color: 'green',
    },
    {
      title: 'Rifas Activas',
      value: dashboardData.activeRaffles.toString(),
      change: `${formatGrowth(dashboardData.rafflesGrowth)} desde el mes pasado`,
      icon: <Package className="summary-icon" />,
      color: 'purple',
    },
  ];

  if (loading) {
    return (
      <div className="dashboard-overview">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Cargando datos del panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-overview">
        <div className="error-state">
          <div className="error-message">{error}</div>
          <button onClick={fetchDashboardData} className="retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <h2 className="page-title">Panel de Control</h2>
        <button onClick={fetchDashboardData} className="refresh-button">
          Actualizar
        </button>
      </div>

      <div className="summary-cards">
        {summaryData.map((item, index) => (
          <div key={index} className={`summary-card ${item.color}`}>
            <div className="card-header">
              <h3 className="card-title">{item.title}</h3>
              {item.icon}
            </div>
            <div className="card-value">{item.value}</div>
            <p className="card-change">{item.change}</p>
          </div>
        ))}
      </div>

      {/* Pending Payments Section */}
      <div className="pending-payments-section">
        <h3>Pagos Pendientes</h3>
        {pendingPayments.length === 0 ? (
          <p>No hay pagos pendientes en este momento.</p>
        ) : (
          <table className="pending-payments-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map((payment) => (
                <tr key={payment._id}>
                  <td>{payment.fullName}</td>
                  <td>{formatCurrency(payment.totalAmountUSD)}</td>
                  <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                  <td>{payment.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
