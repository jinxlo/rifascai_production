// src/pages/SelectNumbersPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket from '../services/socket';
import { Package, DollarSign, Ticket } from 'lucide-react';
import '../assets/styles/SelectNumbersPage.css';

const SelectNumbersPage = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeRaffle, setActiveRaffle] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRaffleAndTickets = async () => {
      try {
        // Primero obtenemos la rifa activa
        const raffleResponse = await axios.get('http://localhost:5000/api/raffle');
        const raffle = raffleResponse.data;
        setActiveRaffle(raffle);

        // Luego obtenemos los tickets
        const ticketsResponse = await axios.get('http://localhost:5000/api/tickets');
        console.log('Raw tickets from server:', ticketsResponse.data);

        const processedTickets = ticketsResponse.data
          .filter(ticket => ticket.ticketNumber <= raffle.totalTickets)
          .map(ticket => {
            console.log(`Processing ticket ${ticket.ticketNumber}:`, ticket.status); // Debug log
            return {
              ...ticket,
              status: ticket.status.toLowerCase(),
              ticketNumber: String(ticket.ticketNumber).padStart(3, '0')
            };
          });
        
        console.log('Processed tickets:', processedTickets);
        setTickets(processedTickets);
        setLoading(false);
      } catch (error) {
        console.error('Error al obtener datos:', error);
        setError('Error al cargar la información de la rifa. Por favor, inténtelo de nuevo más tarde.');
        setLoading(false);
      }
    };

    fetchRaffleAndTickets();

    // Update socket event handlers
    socket.on('ticketsReserved', (data) => {
      console.log('Tickets reserved event:', data); // Debug log
      setTickets((prevTickets) =>
        [...prevTickets].map((ticket) => ({
          ...ticket,
          status: data.tickets.includes(String(ticket.ticketNumber).padStart(3, '0')) 
            ? 'reserved' 
            : ticket.status
        }))
      );
    });

    socket.on('tickets_sold', (data) => {
      console.log('Tickets sold event:', data); // Debug log
      setTickets((prevTickets) =>
        [...prevTickets].map((ticket) => ({
          ...ticket,
          status: data.tickets.includes(String(ticket.ticketNumber).padStart(3, '0'))
            ? 'sold'
            : ticket.status
        }))
      );
    });

    socket.on('payment_confirmed', (data) => {
      console.log('Payment confirmed event received:', data);
      if (data.tickets) {
        setTickets(prevTickets => {
          const updatedTickets = prevTickets.map(ticket => {
            const formattedNumber = String(ticket.ticketNumber).padStart(3, '0');
            const isSold = data.tickets.includes(formattedNumber);
            
            // Debug log
            if (isSold) {
              console.log(`Marking ticket ${formattedNumber} as sold`);
            }
            
            return {
              ...ticket,
              status: isSold ? 'sold' : ticket.status
            };
          });
          
          // Debug log the updated tickets
          console.log('Tickets after update:', updatedTickets);
          return updatedTickets;
        });
      }
    });

    socket.on('raffle_updated', (updatedRaffle) => {
      setActiveRaffle(updatedRaffle);
    });

    return () => {
      socket.off('ticketsReserved');
      socket.off('tickets_sold');
      socket.off('payment_confirmed');
      socket.off('raffle_updated');
    };
  }, []);

  const handleNumberClick = (number) => {
    setError(null);

    // Find the ticket
    const ticket = tickets.find(t => t.ticketNumber === number);
    
    // Check if ticket is available
    if (ticket && ticket.status !== 'available') {
      console.log(`Ticket ${number} is not available. Status:`, ticket.status);
      return;
    }

    if (selectedNumbers.includes(number)) {
      setSelectedNumbers(prevNumbers => 
        prevNumbers.filter(n => n !== number).sort((a, b) => a - b)
      );
    } else {
      setSelectedNumbers(prevNumbers => 
        [...prevNumbers, number].sort((a, b) => a - b)
      );
    }
  };

  const handleContinue = async () => {
    if (!selectedNumbers.length) {
      setError("Por favor, seleccione al menos un ticket para continuar.");
      return;
    }

    try {
      navigate('/payment-method', { 
        state: { 
          selectedNumbers: [...selectedNumbers].sort((a, b) => a - b),
          raffleId: activeRaffle._id
        } 
      });
    } catch (error) {
      console.error('Error al proceder al pago:', error);
      setError('Error al proceder al pago. Por favor, inténtelo de nuevo.');
    }
  };

  const createNumberGrid = () => {
    if (!activeRaffle) return [];
    
    const numbers = [];
    for (let i = 0; i < activeRaffle.totalTickets; i++) {
      const formattedNumber = String(i).padStart(3, '0');
      const existingTicket = tickets.find(t => t.ticketNumber === formattedNumber);
      const ticket = existingTicket || {
        ticketNumber: formattedNumber,
        status: 'available'
      };
      
      // Ensure status is lowercase and properly formatted
      ticket.status = String(ticket.status).toLowerCase();
      
      // Debug log for ticket status
      console.log(`Ticket ${formattedNumber} status:`, ticket.status);
      
      numbers.push(ticket);
    }
    return numbers;
  };

  if (loading) {
    return (
      <div className="select-numbers-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando información de la rifa...</p>
        </div>
      </div>
    );
  }

  if (!activeRaffle) {
    return (
      <div className="select-numbers-page">
        <div className="no-raffle-card">
          <Package size={48} />
          <h2>No hay Rifa Activa</h2>
          <p>No hay rifa activa en este momento. Por favor, vuelva más tarde.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="select-numbers-page">
      {/* Tarjeta de Información de Rifa */}
      <div className="raffle-info-card">
        <img 
          src={activeRaffle.productImage} 
          alt={activeRaffle.productName}
          className="raffle-image"
        />
        <div className="raffle-details">
          <h2>{activeRaffle.productName}</h2>
          <p className="description">{activeRaffle.description}</p>
          
          <div className="stats-grid">
            <div className="stat-item">
              <DollarSign size={20} />
              <div className="stat-info">
                <span className="label">Precio por Ticket</span>
                <span className="value">${activeRaffle.price}</span>
              </div>
            </div>
            
            <div className="stat-item">
              <Ticket size={20} />
              <div className="stat-info">
                <span className="label">Tickets Disponibles</span>
                <span className="value">
                  {activeRaffle.totalTickets - (activeRaffle.soldTickets || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      {/* Tarjeta de Selección de Números */}
      <div className="numbers-selection-card">
        <h3>Selecciona Tus Números</h3>
        <div className="numbers-grid">
          {createNumberGrid().map((ticket) => {
            const status = String(ticket.status).toLowerCase();
            const isDisabled = status === 'reserved' || status === 'sold';
            
            // Create the class string
            const buttonClass = `number-button ${status} ${
              selectedNumbers.includes(ticket.ticketNumber) ? 'selected' : ''
            }`;
            
            // Debug log
            console.log(`Rendering ticket ${ticket.ticketNumber}:`, {
              status,
              isDisabled,
              buttonClass
            });

            return (
              <button
                key={ticket.ticketNumber}
                className={buttonClass}
                onClick={() => handleNumberClick(ticket.ticketNumber)}
                disabled={isDisabled}
                title={status !== 'available' ? `Número ${status === 'sold' ? 'vendido' : 'reservado'}` : ''}
              >
                {ticket.ticketNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tarjeta Resumen Fija */}
      <div className="sticky-summary">
        <div className="summary-content">
          <div className="summary-details">
            <p className="total-amount">
              Monto Total: ${selectedNumbers.length * activeRaffle.price}
            </p>
            <p className="selected-numbers">
              Números Seleccionados: {selectedNumbers.length ? selectedNumbers.join(', ') : 'Ninguno'}
            </p>
          </div>
          <button 
            onClick={handleContinue} 
            disabled={selectedNumbers.length === 0}
            className="continue-button"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectNumbersPage;
