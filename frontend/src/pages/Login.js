import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock } from 'lucide-react';
import '../assets/styles/Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const [showEmailIcon, setShowEmailIcon] = useState(true);
  const [showPasswordIcon, setShowPasswordIcon] = useState(true);

  const token = localStorage.getItem('token');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  if (token) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create FormData to match registration
      const loginData = new FormData();
      loginData.append('email', formData.email.toLowerCase().trim());
      loginData.append('password', formData.password); // Send raw password

      console.log('Login attempt:', {
        email: formData.email.toLowerCase().trim(),
        passwordLength: formData.password.length
      });

      const response = await axios.post(
        'http://localhost:5000/api/auth/login',
        loginData,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );
      
      if (response.data.token) {
        localStorage.clear(); // Clear existing data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('isAdmin', response.data.isAdmin.toString());
        
        if (response.data.user) {
          localStorage.setItem('userData', JSON.stringify(response.data.user));
        }

        console.log('Login successful:', {
          hasToken: true,
          isAdmin: response.data.isAdmin,
          hasUserData: !!response.data.user
        });

        navigate(response.data.isAdmin ? '/admin' : '/dashboard', { replace: true });
      }
    } catch (error) {
      console.error('Login error:', {
        status: error.response?.status,
        message: error.response?.data?.message
      });
      setError(error.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'email') {
      setShowEmailIcon(value === ''); // Mostrar ícono si el campo está vacío
    } else if (name === 'password') {
      setShowPasswordIcon(value === ''); // Mostrar ícono si el campo está vacío
    }

    if (error) setError('');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-box">
          {/* Sección de Logo */}
          <div className="logo-section">
            <img
              src="/cailogo.png"
              alt="Logo CAI"
              className="login-logo"
            />
          </div>

          <h1 className="login-title">Bienvenido de Nuevo</h1>
          <p className="login-subtitle">Por favor ingrese sus credenciales para continuar</p>

          {error && (
            <div className="error-alert">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="error-icon">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <div className="input-with-icon">
                {showEmailIcon && <User className="input-icon" size={20} />} {/* Ícono de email */}
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="                Ingrese su email"  // Texto del placeholder actualizado
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  autoComplete="email"
                  className={error ? 'error' : ''}
                />
              </div>
            </div>

            <div className="form-group">
              <div className="input-with-icon">
                {showPasswordIcon && <Lock className="input-icon" size={20} />} {/* Ícono de contraseña */}
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="                Ingrese su contraseña"  // Texto del placeholder actualizado
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  autoComplete="current-password"
                  className={error ? 'error' : ''}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="login-button"
            >
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <span>Iniciando Sesión...</span>
                </div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>Sistema de Rifas CAI - 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
