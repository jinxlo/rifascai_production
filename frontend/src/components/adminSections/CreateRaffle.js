import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socketService from '../../services/socket'; // Use socketService directly
import { Loader, AlertCircle, Check, UploadIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../../assets/styles/adminSections/CreateRaffle.css';

const CreateRaffle = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    price: '',
    totalTickets: '',
    productImage: null
  });

  const [validation, setValidation] = useState({
    productName: true,
    description: true,
    price: true,
    totalTickets: true,
    productImage: true
  });

  const errorMessages = {
    productName: 'El nombre del producto es requerido',
    description: 'La descripción debe tener al menos 20 caracteres',
    price: 'El precio debe ser mayor a 0',
    totalTickets: 'Debe tener al menos 10 tickets',
    productImage: 'La imagen es requerida'
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no debe exceder 5MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        productImage: file
      }));

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newValidation = {
      productName: formData.productName.length >= 3,
      description: formData.description.length >= 10,
      price: parseFloat(formData.price) > 0,
      totalTickets: parseInt(formData.totalTickets) >= 10,
      productImage: formData.productImage !== null
    };

    setValidation(newValidation);
    return Object.values(newValidation).every(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setError('Por favor, corrija los errores en el formulario');
      return;
    }

    setLoading(true);
    setError(null);
    setProcessingStatus('Creando nueva rifa...');

    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        data.append(key, formData[key]);
      });

      const token = localStorage.getItem('token');
      const response = await axios.post(
        'https://rifascai.com/api/raffle/create',
        data,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data) {
        setSuccess(true);
        setProcessingStatus('¡Rifa creada exitosamente!');

        // Emit the 'raffle_created' event directly through socketService
        if (socketService.isSocketConnected()) {
          socketService.emit('raffle_created', response.data.raffle);
        } else {
          console.warn('Socket is not connected. Event not emitted.');
        }

        // Show immediate success toast
        toast.success('¡Rifa creada exitosamente!', {
          duration: 4000,
          position: 'top-right',
        });

        // Add a slight delay before navigation
        setTimeout(() => {
          navigate('/admin/dashboard', { 
            state: { 
              message: 'Se ha creado una nueva rifa exitosamente',
              type: 'success' 
            },
            replace: true  // Replace the current entry in the history stack
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Error creating raffle:', error);
      setError(error.response?.data?.message || 'Error al crear la rifa');
      toast.error('Error al crear la rifa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-raffle">
      <div className="page-header">
        <h2 className="page-title">Crear Nueva Rifa</h2>
        <p className="page-description">Configure los detalles para crear un nuevo evento de rifa</p>
      </div>

      {error && (
        <div className="status-message error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="status-message success-message">
          <Check size={20} />
          <span>{processingStatus}</span>
          <span className="text-sm">Redirigiendo al panel de administración...</span>
        </div>
      )}

      <div className="form-container">
        <form onSubmit={handleSubmit} className="raffle-form">
          <div className="form-group">
            <label htmlFor="productName">Nombre del Producto</label>
            <input
              type="text"
              id="productName"
              name="productName"
              placeholder="Ej: iPhone 14 Pro Max"
              value={formData.productName}
              onChange={handleInputChange}
              className={!validation.productName ? 'invalid' : ''}
              required
              disabled={loading}
              title="Nombre del Producto"
              aria-label="Ingrese el nombre del producto para la rifa. Mínimo 3 caracteres."
            />
            {!validation.productName && (
              <span className="error-text">{errorMessages.productName}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              name="description"
              placeholder="Ingrese la descripción del producto"
              value={formData.description}
              onChange={handleInputChange}
              className={!validation.description ? 'invalid' : ''}
              required
              disabled={loading}
              title="Descripción del Producto"
              aria-label="Proporcione una descripción detallada del producto. Mínimo 20 caracteres."
            />
            {!validation.description && (
              <span className="error-text">{errorMessages.description}</span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="price">Precio por Ticket (USD)</label>
              <input
                type="number"
                id="price"
                name="price"
                placeholder="Ingrese el precio"
                value={formData.price}
                onChange={handleInputChange}
                className={!validation.price ? 'invalid' : ''}
                min="0.01"
                step="0.01"
                required
                disabled={loading}
                title="Precio del Ticket"
                aria-label="Establezca el precio por ticket en dólares. Debe ser mayor a 0."
              />
              {!validation.price && (
                <span className="error-text">{errorMessages.price}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="totalTickets">Cantidad Total de Tickets</label>
              <input
                type="number"
                id="totalTickets"
                name="totalTickets"
                placeholder="Ingrese el total de tickets"
                value={formData.totalTickets}
                onChange={handleInputChange}
                className={!validation.totalTickets ? 'invalid' : ''}
                min="10"
                required
                disabled={loading}
                title="Total de Tickets"
                aria-label="Especifique el número total de tickets disponibles. Mínimo 10 tickets."
              />
              {!validation.totalTickets && (
                <span className="error-text">{errorMessages.totalTickets}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Imagen del Producto</label>
            <div 
              className="file-upload-container"
              onClick={() => document.getElementById('productImage').click()}
            >
              <UploadIcon size={24} className="upload-icon" />
              <p>{formData.productImage ? 'Cambiar imagen' : 'Subir imagen del producto'}</p>
              <span className="text-sm text-muted">
                PNG, JPG o GIF hasta 5MB
              </span>
              <input
                type="file"
                id="productImage"
                name="productImage"
                accept="image/*"
                onChange={handleImageChange}
                className={!validation.productImage ? 'invalid' : ''}
                required
                disabled={loading}
                title="Imagen del Producto"
                aria-label="Suba una imagen del producto. Formatos permitidos: PNG, JPG o GIF. Tamaño máximo: 5MB."
              />
            </div>
            {!validation.productImage && (
              <span className="error-text">{errorMessages.productImage}</span>
            )}
          </div>

          {imagePreview && (
            <div className="image-preview">
              <img
                src={imagePreview}
                alt="Vista previa del producto"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/placeholder-image.jpg';
                }}
              />
            </div>
          )}

          <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="spin" size={20} />
                <span>{processingStatus}</span>
              </>
            ) : (
              'Crear Rifa'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateRaffle;
