import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket from '../services/socket';
import { Package, DollarSign, Ticket } from 'lucide-react';
import '../assets/styles/SelectNumbersPage.css';

const formatTicketNumber = (number) => String(number).padStart(3, '0');

const SelectNumbersPage = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeRaffle, setActiveRaffle] = useState(null);
  const navigate = useNavigate();

  const fetchRaffleAndTickets = async () => {
    try {
      const raffleResponse = await axios.get('https://rifascai.com/api/raffle');
      const raffle = raffleResponse.data;
      setActiveRaffle(raffle);

      const ticketsResponse = await axios.get('https://rifascai.com/api/tickets');
      console.log('Raw tickets from server:', ticketsResponse.data);

      const processedTickets = ticketsResponse.data
        .filter(ticket => ticket.ticketNumber <= raffle.totalTickets)
        .map(ticket => ({
          ...ticket,
          status: ticket.status.toLowerCase(),
          ticketNumber: formatTicketNumber(ticket.ticketNumber)
        }));
      
      console.log('Processed tickets:', processedTickets);
      setTickets(processedTickets);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      setError('Error al cargar la información de la rifa.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleTicketStatusChange = (data) => {
      console.log('Handling ticket status change:', data);
      if (!data.tickets) return;

      const formattedTickets = data.tickets.map(num => String(num).padStart(3, '0'));
      console.log('Formatted tickets to update:', formattedTickets);
      
      setTickets(prevTickets => {
        const updatedTickets = prevTickets.map(ticket => {
          if (formattedTickets.includes(ticket.ticketNumber)) {
            console.log(`Updating ticket ${ticket.ticketNumber} from ${ticket.status} to ${data.status}`);
            return {
              ...ticket,
              status: data.status.toLowerCase(),
              reservedAt: null, // Clear reservation data
              userId: null      // Clear user data
            };
          }
          return ticket;
        });
        console.log('Updated tickets state:', updatedTickets);
        return updatedTickets;
      });
    };

    const handlePaymentRejected = async (data) => {
      console.log('Payment rejected event received:', data);
      if (data.tickets) {
        const formattedTickets = data.tickets.map(num => String(num).padStart(3, '0'));
        console.log('Tickets to release:', formattedTickets);
        
        // Force immediate state update for rejected tickets
        setTickets(prevTickets => {
          const updatedTickets = prevTickets.map(ticket => {
            if (formattedTickets.includes(ticket.ticketNumber)) {
              console.log(`Releasing ticket ${ticket.ticketNumber}`);
              return {
                ...ticket,
                status: 'available',
                reservedAt: null,
                userId: null
              };
            }
            return ticket;
          });
          return updatedTickets;
        });

        // Clear these numbers from selection if they were selected
        setSelectedNumbers(prev => 
          prev.filter(num => !formattedTickets.includes(num))
        );

        // Force a refresh of the tickets data
        await fetchRaffleAndTickets();
      }
    };

    // Add handler for tickets_released event
    const handleTicketsReleased = (data) => {
      console.log('Tickets released event received:', data);
      if (data.tickets) {
        const formattedTickets = data.tickets.map(num => String(num).padStart(3, '0'));
        handleTicketStatusChange({
          tickets: formattedTickets,
          status: 'available'
        });
      }
    };

    fetchRaffleAndTickets();

    // Socket event handlers with proper cleanup
    socket.on('ticket_status_changed', handleTicketStatusChange);
    socket.on('payment_rejected', handlePaymentRejected);
    socket.on('tickets_released', handleTicketsReleased);

    return () => {
      socket.off('ticket_status_changed', handleTicketStatusChange);
      socket.off('payment_rejected', handlePaymentRejected);
      socket.off('tickets_released', handleTicketsReleased);
    };
  }, []);

  const handleNumberClick = (number) => {
    setError(null);

    const ticket = tickets.find(t => t.ticketNumber === number);
    if (!ticket || ticket.status !== 'available') {
      return;
    }

    setSelectedNumbers(prevNumbers => {
      const updated = prevNumbers.includes(number)
        ? prevNumbers.filter(n => n !== number)
        : [...prevNumbers, number];
      return updated.sort((a, b) => a - b);
    });
  };

  const handleContinue = () => {
    if (!selectedNumbers.length) {
      setError("Por favor, seleccione al menos un ticket para continuar.");
      return;
    }

    navigate('/payment-method', { 
      state: { 
        selectedNumbers: [...selectedNumbers].sort((a, b) => a - b),
        raffleId: activeRaffle._id
      } 
    });
  };

  const createNumberGrid = () => {
    if (!activeRaffle) return [];
    
    return Array.from({ length: activeRaffle.totalTickets }, (_, i) => {
      const formattedNumber = String(i).padStart(3, '0');
      const existingTicket = tickets.find(t => t.ticketNumber === formattedNumber);
      
      // Default to available
      let status = 'available';
      
      if (existingTicket) {
        // Only accept 'sold' or 'reserved' if they're explicitly set and valid
        const currentStatus = existingTicket.status.toLowerCase();
        if (currentStatus === 'sold') {
          status = 'sold';
        } else if (currentStatus === 'reserved' && existingTicket.reservedAt) {
          status = 'reserved';
        } else {
          status = 'available';
        }
        
        console.log(`Grid: Ticket ${formattedNumber} final status: ${status}`);
      }
      
      return {
        ticketNumber: formattedNumber,
        status: status
      };
    });
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
      
      <div className="numbers-selection-card">
        <h3>Selecciona Tus Números</h3>
        <div className="numbers-grid">
          {createNumberGrid().map((ticket) => {
            const status = String(ticket.status).toLowerCase();
            const isDisabled = status === 'reserved' || status === 'sold';
            const buttonClass = `number-button ${status} ${
              selectedNumbers.includes(ticket.ticketNumber) ? 'selected' : ''
            }`;

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

      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', bottom: '10px', right: '10px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={fetchRaffleAndTickets}
            style={{ 
              padding: '5px 10px',
              background: '#ddd',
              border: '1px solid #999',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Tickets
          </button>
          <button 
            onClick={() => {
              console.log('Current tickets state:', tickets);
            }}
            style={{ 
              padding: '5px 10px',
              background: '#ddd',
              border: '1px solid #999',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Log Tickets
          </button>
        </div>
      )}
    </div>
  );
};

export default SelectNumbersPage;
