import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCircle, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../assets/styles/Header.css';

export default function Header() {
  const [isHovered, setIsHovered] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    setIsAuthenticated(!!token);
    setIsAdmin(adminStatus);
  }, []);

  const handleLogin = () => {
    navigate('/login');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('isAdmin');
    setIsAuthenticated(false);
    setIsAdmin(false);
    navigate('/');
  };

  const handleDashboardClick = () => {
    if (isAdmin) {
      navigate('/admin/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <header className="header bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <a href="/" className="flex-shrink-0">
            <img
              className="h-10 w-auto max-w-[120px] object-contain"
              src="/cailogo.png"
              alt="RifasCAI Logo"
            />
          </a>

          {/* Auth & Dashboard Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && (
              <motion.button
                className="dashboard-button"
                onClick={handleDashboardClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>{isAdmin ? 'Admin Panel' : 'Dashboard'}</span>
              </motion.button>
            )}

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onHoverStart={() => setIsHovered(true)}
              onHoverEnd={() => setIsHovered(false)}
            >
              {isAuthenticated ? (
                <button
                  className="logout-button"
                  onClick={handleLogout}
                >
                  <motion.div
                    animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <UserCircle className="h-5 w-5" />
                  </motion.div>
                  <span>Logout</span>
                </button>
              ) : (
                <button
                  className="login-button"
                  onClick={handleLogin}
                >
                  <motion.div
                    animate={isHovered ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <UserCircle className="h-5 w-5" />
                  </motion.div>
                  <span>Login</span>
                </button>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </header>
  );
}