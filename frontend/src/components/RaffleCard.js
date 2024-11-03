import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { SocketContext } from '../index';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Edit, Trash2, StopCircle, PlayCircle, Upload, Check, X } from 'lucide-react';
import '../assets/styles/RaffleCard.css';

const RaffleCard = ({ onBuyTickets, isAdmin, raffle, onToggleStatus, onModify, onDelete }) => {
  const { socket } = useContext(SocketContext);
  const navigate = useNavigate();
  
  const [raffleItem, setRaffleItem] = useState(raffle || {
    _id: '',
    productName: 'Loading...',
    description: '',
    productImage: '',
    price: 0,
    totalTickets: 0,
    soldTickets: 0,
    reservedTickets: 0,
    ticketStats: {}
  });

  const [ticketsAvailable, setTicketsAvailable] = useState(0);
  const [loading, setLoading] = useState(!raffle);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    price: '',
    productImage: null
  });

  // Helper function to construct image URL
  const getImageUrl = useCallback((imagePath) => {
    if (!imagePath) return '/placeholder-image.jpg';
    if (imagePath.startsWith('http')) return imagePath;
    try {
      return `http://localhost:5000${imagePath}`;
    } catch (error) {
      console.error('Error constructing image URL:', error);
      return '/placeholder-image.jpg';
    }
  }, []);

  const updateAvailableTickets = useCallback((data) => {
    const available = data.totalTickets - (data.soldTickets + data.reservedTickets);
    setTicketsAvailable(available);
    setLastUpdate(new Date());
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const fetchRaffleData = useCallback(async () => {
    if (raffle) {
      setRaffleItem(raffle);
      updateAvailableTickets(raffle);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Fetching raffle data...');
      
      const response = await axios.get('http://localhost:5000/api/raffle');
      console.log('Raffle data received:', response.data);
      
      if (response.data) {
        setRaffleItem(response.data);
        updateAvailableTickets(response.data);
      } else {
        const errorMsg = 'No hay rifas activas';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error al cargar la rifa';
      console.error('Error fetching raffle:', error);
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [raffle, updateAvailableTickets]);

  useEffect(() => {
    fetchRaffleData();

    if (!isAdmin) {
      const handleRaffleCreated = (newRaffle) => {
        console.log('New raffle created:', newRaffle);
        setRaffleItem(newRaffle);
        updateAvailableTickets(newRaffle);
        toast.success('¡Nueva rifa creada!');
      };

      const handleRaffleUpdated = (updatedRaffle) => {
        console.log('Raffle updated:', updatedRaffle);
        if (updatedRaffle._id === raffleItem._id) {
          setRaffleItem(updatedRaffle);
          updateAvailableTickets(updatedRaffle);
          toast.success('Rifa actualizada');
        }
      };

      socket.on('raffle_created', handleRaffleCreated);
      socket.on('raffle_updated', handleRaffleUpdated);

      return () => {
        socket.off('raffle_created', handleRaffleCreated);
        socket.off('raffle_updated', handleRaffleUpdated);
      };
    }
  }, [socket, raffleItem._id, updateAvailableTickets, fetchRaffleData, isAdmin]);

  const handleBuyClick = () => {
    if (ticketsAvailable > 0) {
      navigate('/select-numbers');
    } else {
      toast.error('No hay tickets disponibles');
    }
  };

  const handleImageError = (e) => {
    if (!imageError) {
      console.log('Image failed to load:', raffleItem.productImage);
      setImageError(true);
      e.target.onerror = null;
      e.target.src = '/placeholder-image.jpg';
      toast.error('Error al cargar la imagen');
    }
  };

  const progress = Math.min(
    ((raffleItem.totalTickets - ticketsAvailable) / raffleItem.totalTickets) * 100,
    100
  );

  // Function to handle modal opening
  const handleOpenModal = () => {
    setFormData({
      productName: raffleItem.productName,
      description: raffleItem.description,
      price: raffleItem.price,
      productImage: null
    });
    setShowModal(true);
  };

  // Function to handle modal closing
  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      productName: '',
      description: '',
      price: '',
      productImage: null
    });
  };

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onModify(formData);
      handleCloseModal();
      toast.success('Rifa actualizada exitosamente');
    } catch (error) {
      toast.error('Error al actualizar la rifa');
    }
  };

  const renderModal = () => {
    if (!showModal) return null;

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h3>Modificar Rifa</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="productName">Nombre del Producto</label>
              <input
                type="text"
                id="productName"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                placeholder="Ingrese el nombre del producto"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Descripción</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ingrese la descripción"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Precio (USD)</label>
              <input
                type="number"
                id="price"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="Ingrese el precio"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="file-upload">
              <label htmlFor="productImage">
                <Upload size={18} />
                {formData.productImage ? 'Cambiar Imagen' : 'Subir Nueva Imagen'}
              </label>
              <input
                type="file"
                id="productImage"
                onChange={(e) => setFormData({ ...formData, productImage: e.target.files[0] })}
                accept="image/*"
              />
            </div>

            <div className="modal-actions">
              <button type="submit" className="confirm">
                <Check size={18} /> Guardar Cambios
              </button>
              <button type="button" className="cancel" onClick={handleCloseModal}>
                <X size={18} /> Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderActions = () => {
    if (isAdmin) {
      return (
        <div className="admin-actions">
          <button 
            className="action-button end-button" 
            onClick={onToggleStatus}
          >
            {raffleItem.active ? (
              <><StopCircle size={18} /> Finalizar Rifa</>
            ) : (
              <><PlayCircle size={18} /> Activar</>
            )}
          </button>
          <button 
            className="action-button" 
            onClick={handleOpenModal}
          >
            <Edit size={18} /> Modificar
          </button>
          <button 
            className="action-button delete-button"
            onClick={onDelete}
          >
            <Trash2 size={18} /> Eliminar
          </button>
        </div>
      );
    }

    return (
      <button
        className="buy-ticket-button"
        onClick={handleBuyClick}
        disabled={ticketsAvailable === 0}
      >
        {ticketsAvailable > 0 ? 'Comprar Tickets' : 'Agotado'}
      </button>
    );
  };

  // Update the loading state render:
if (loading) {
  return (
    <div className="raffle-card loading">
      <div className="loading-spinner" />
      <span className="loading-text">Cargando rifa...</span>
    </div>
  );
}

// Update the error state render:
if (error) {
  return (
    <div className="raffle-card error">
      <p className="error-message">No hay Rifas Activas</p>
      <button 
        className="retry-button"
        onClick={fetchRaffleData}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 16 16" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M1.33333 8C1.33333 4.31333 4.31333 1.33333 8 1.33333C11.6867 1.33333 14.6667 4.31333 14.6667 8C14.6667 11.6867 11.6867 14.6667 8 14.6667" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round"
          />
        </svg>
        Intentar nuevamente
      </button>
    </div>
  );
}

  return (
    <div className="raffle-card">
      <div className="image-container">
        <img
          src={getImageUrl(raffleItem.productImage)}
          alt={raffleItem.productName}
          className="raffle-image"
          onError={handleImageError}
          loading="lazy"
        />
      </div>

      <h2 className="raffle-name">{raffleItem.productName}</h2>
      
      {raffleItem.description && (
        <p className="raffle-description">{raffleItem.description}</p>
      )}

      <div className="raffle-info">
        <p className="raffle-price">
          Precio por Ticket: <span>{formatCurrency(raffleItem.price)}</span>
        </p>
        <p className="raffle-tickets">
          Tickets Disponibles: <span>{ticketsAvailable}</span>
        </p>
        <p className="raffle-total-tickets">
          Tickets Total: <span>{raffleItem.totalTickets}</span>
        </p>
      </div>

      <div className="ticket-stats">
        <div className="stat-item">
          <span className="stat-label">Vendidos</span>
          <span className="stat-value sold">{raffleItem.soldTickets}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Reservados</span>
          <span className="stat-value reserved">{raffleItem.reservedTickets}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Disponibles</span>
          <span className="stat-value available">{ticketsAvailable}</span>
        </div>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar">
          <div
            className="progress"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="progress-text">
          {`${Math.floor(progress)}% Vendido`}
        </p>
      </div>

      {renderActions()}
      {renderModal()}

      {lastUpdate && (
        <p className="last-updated">
          Última actualización: {new Date(lastUpdate).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default RaffleCard;
