import React, { useEffect } from 'react';
import { toast } from 'react-hot-toast';

const AdminDashboard = () => {
  useEffect(() => {
    // Check for admin message
    const adminMessageJSON = localStorage.getItem('adminMessage');
    
    if (adminMessageJSON) {
      try {
        const adminMessage = JSON.parse(adminMessageJSON);
        
        // Only show messages that are less than 5 seconds old
        if (Date.now() - adminMessage.timestamp < 5000) {
          if (adminMessage.type === 'success') {
            toast.success(adminMessage.message);
          }
        }
        
        // Remove the message from localStorage
        localStorage.removeItem('adminMessage');
      } catch (error) {
        console.error('Error parsing admin message:', error);
      }
    }
  }, []);

  return (
    <div>
      {/* Your dashboard content */}
    </div>
  );
};

export default AdminDashboard; 