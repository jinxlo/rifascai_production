import React, { useState, useEffect } from 'react'; 
import axios from 'axios';
import { useSocket } from '../../contexts/SocketContext';
import RaffleCard from '../RaffleCard';
import { Check, XCircle, Upload, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ActiveRaffles = () => {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRaffle, setSelectedRaffle] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    price: '',
    productImage: null,
  });

  const socket = useSocket();

  // Add handleOpenModal definition
  const handleOpenModal = (raffle) => {
    setSelectedRaffle(raffle);
    setFormData({
      productName: raffle.productName,
      description: raffle.description,
      price: raffle.price,
      productImage: null,
    });
    setShowModal(true);
  };

  // Add handleCloseModal definition
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRaffle(null);
    setFormData({
      productName: '',
      description: '',
      price: '',
      productImage: null,
    });
  };

  const fetchRaffles = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/raffle/all', {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });

      const activeRaffles = response.data.filter(raffle => raffle.active);
      console.log('Fetched raffles:', activeRaffles);
      setRaffles(activeRaffles);
      
    } catch (error) {
      console.error('Error fetching raffles:', error);
      setError(error.response?.data?.message || 'Error al cargar las rifas activas');
      toast.error('No se pudieron cargar las rifas activas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRaffles();

    if (socket) {
      const handleRaffleUpdate = (updatedRaffle) => {
        setRaffles(prevRaffles => 
          prevRaffles.map(raffle => 
            raffle._id === updatedRaffle._id ? updatedRaffle : raffle
          )
        );
        toast.success('Rifa actualizada');
      };

      const handleRaffleCreate = (newRaffle) => {
        if (newRaffle.active) {
          setRaffles(prevRaffles => [...prevRaffles, newRaffle]);
          toast.success('Nueva rifa creada');
        }
      };

      socket.on('raffle_updated', handleRaffleUpdate);
      socket.on('raffle_created', handleRaffleCreate);

      return () => {
        socket.off('raffle_updated', handleRaffleUpdate);
        socket.off('raffle_created', handleRaffleCreate);
      };
    }
  }, [socket]);

  const handleModifyRaffle = async () => {
    if (!selectedRaffle) return;

    try {
      const token = localStorage.getItem('token');
      const updateData = new FormData();
      updateData.append('productName', formData.productName);
      updateData.append('description', formData.description);
      updateData.append('price', formData.price);
      if (formData.productImage) {
        updateData.append('productImage', formData.productImage);
      }

      const response = await axios.put(
        `http://localhost:5000/api/raffle/${selectedRaffle._id}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setRaffles(prevRaffles =>
        prevRaffles.map(raffle =>
          raffle._id === selectedRaffle._id ? response.data.raffle : raffle
        )
      );
      toast.success('Rifa actualizada exitosamente');
      handleCloseModal();
    } catch (error) {
      console.error('Error modifying raffle:', error);
      toast.error('Error al actualizar la rifa');
    }
  };

  const handleToggleStatus = async (raffleId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/raffle/${raffleId}`,
        { active: !currentStatus },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchRaffles();
      toast.success(currentStatus ? 'Rifa desactivada' : 'Rifa activada');
    } catch (error) {
      console.error('Error toggling raffle status:', error);
      toast.error('Error al cambiar el estado de la rifa');
    }
  };

  const handleDeleteRaffle = async (raffleId) => {
    if (!window.confirm('¿Estás seguro que deseas eliminar esta rifa?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/raffle/${raffleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRaffles(prevRaffles => prevRaffles.filter(raffle => raffle._id !== raffleId));
      toast.success('Rifa eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting raffle:', error);
      toast.error('Error al eliminar la rifa');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <RefreshCw className="loading-spinner" size={48} />
        <p className="loading-text">Cargando rifas activas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <AlertCircle size={48} className="error-icon" />
        <p className="error-message">{error}</p>
        <button className="retry-button" onClick={fetchRaffles}>
          <RefreshCw size={16} />
          Intentar nuevamente
        </button>
      </div>
    );
  }

  return (
    <div className="active-raffles">
      <div className="page-header">
        <h2 className="page-title">Rifas Activas</h2>
      </div>
      
      {raffles.length === 0 ? (
        <div className="no-raffles">
          <AlertCircle size={48} className="empty-icon" />
          <p>No hay rifas activas</p>
        </div>
      ) : (
        <div className="raffles-grid">
          {raffles.map((raffle) => (
            <RaffleCard
              key={raffle._id}
              raffle={raffle}
              onToggleStatus={() => handleToggleStatus(raffle._id, raffle.active)}
              onModify={() => handleOpenModal(raffle)}
              onDelete={() => handleDeleteRaffle(raffle._id)}
              isAdmin={true}
            />
          ))}
        </div>
      )}

      {showModal && selectedRaffle && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Modificar Rifa</h3>
            <div className="form-group">
              <label htmlFor="productName">Nombre del Producto</label>
              <input
                type="text"
                id="productName"
                name="productName"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                placeholder="Ingrese el nombre del producto"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Descripción</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ingrese la descripción"
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">Precio</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="Ingrese el precio"
              />
            </div>

            <div className="file-upload">
              <label htmlFor="productImage">
                <Upload size={18} /> 
                {formData.productImage ? 'Cambiar Imagen' : 'Subir Imagen'}
              </label>
              <input
                type="file"
                id="productImage"
                name="productImage"
                onChange={(e) => setFormData({ ...formData, productImage: e.target.files[0] })}
                accept="image/*"
              />
            </div>

            <div className="modal-actions">
              <button className="action-button confirm" onClick={handleModifyRaffle}>
                <Check size={18} /> Guardar
              </button>
              <button className="action-button cancel" onClick={handleCloseModal}>
                <XCircle size={18} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveRaffles;