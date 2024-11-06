const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { verifyToken, isUser, isAdmin } = require('../middleware/auth');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const upload = multer();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Get JWT_SECRET from environment variables with validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not defined in environment variables!');
  process.exit(1);
}

// Get SMTP configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SUPPORT_EMAIL) {
  console.error('ERROR: SMTP configuration is incomplete in environment variables!');
  process.exit(1);
}

// Configure the email transporter using nodemailer
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

// Admin route to get all users
router.get('/all', isAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort('-createdAt');
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
});

// Get user profile
router.get('/profile', isUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    res.json({
      success: true,
      user: user.fullInfo
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil'
    });
  }
});

// Update profile route
router.put('/profile', isUser, upload.none(), async (req, res) => {
  try {
    const { fullName, idNumber, phoneNumber, email } = req.body;

    console.log('Profile update attempt:', {
      userId: req.user._id,
      updateFields: {
        fullName: !!fullName,
        idNumber: !!idNumber,
        phoneNumber: !!phoneNumber,
        email: !!email
      }
    });

    // Validate required fields
    if (!fullName || !idNumber || !phoneNumber || !email) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already taken by another user
    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico ya está en uso'
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          fullName,
          idNumber,
          phoneNumber,
          email: normalizedEmail,
          updatedAt: new Date()
        }
      },
      {
        new: true,
        select: '-password'
      }
    );

    if (!updatedUser) {
      console.log('User not found for update:', req.user._id);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('Profile updated successfully:', {
      userId: req.user._id,
      email: normalizedEmail
    });

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: updatedUser
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor durante la actualización del perfil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update password route
router.put('/password', isUser, upload.none(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    console.log('Password update attempt:', {
      userId: req.user._id,
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword,
      currentPasswordLength: currentPassword?.length,
      newPasswordLength: newPassword?.length,
      contentType: req.headers['content-type']
    });

    // Validate password fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren la contraseña actual y la nueva'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      console.log('User not found for password update:', req.user._id);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verify current password using the model's method
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      console.log('Invalid current password for user:', req.user._id);
      return res.status(400).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Update password using the model's method
    await user.updatePassword(newPassword);

    // Generate new token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Password update successful:', {
      userId: user._id,
      tokenGenerated: !!token,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
      token
    });

  } catch (error) {
    console.error('Password update error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id
    });

    res.status(500).json({
      success: false,
      message: 'Error del servidor durante la actualización de la contraseña',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Forgot Password route
router.post('/forgot-password', upload.none(), async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el correo electrónico'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Prevent account enumeration
      return res.status(200).json({
        success: true,
        message: 'Se ha enviado un enlace de restablecimiento de contraseña si el correo electrónico existe en nuestro sistema'
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send email with reset link
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

    // Email options
    const mailOptions = {
      from: `"Your App" <${SMTP_USER}>`,
      to: user.email,
      subject: 'Restablecimiento de contraseña',
      text: `Hola ${user.fullName},\n\nPor favor, haz clic en el siguiente enlace para restablecer tu contraseña:\n\n${resetLink}\n\nSi no solicitaste este cambio, ignora este correo.\n`
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Se ha enviado un enlace de restablecimiento de contraseña si el correo electrónico existe en nuestro sistema'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor durante el proceso de restablecimiento de contraseña'
    });
  }
});

// Reset Password route
router.post('/reset-password', upload.none(), async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate input
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el token y la nueva contraseña'
      });
    }

    // Hash the token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user by hashed token and check token expiration
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Update password
    await user.updatePassword(newPassword);

    // Clear reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error del servidor durante el restablecimiento de contraseña'
    });
  }
});

// Admin route to update user status
router.put('/:userId/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    user.status = status;
    if (status === 'active') {
      user.loginAttempts = 0;
      user.lastFailedLogin = null;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Estado del usuario actualizado exitosamente',
      user: user.fullInfo
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estado del usuario'
    });
  }
});

// Admin route to delete user
router.delete('/:userId', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el usuario'
    });
  }
});

// Get user by ID (admin only)
router.get('/:userId', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    res.json({
      success: true,
      user: user.fullInfo
    });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el usuario'
    });
  }
});

// Admin route to update user role
router.put('/:userId/role', isAdmin, async (req, res) => {
  try {
    const { isAdmin: newIsAdmin } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    user.isAdmin = newIsAdmin;
    await user.save();

    res.json({
      success: true,
      message: 'Rol del usuario actualizado exitosamente',
      user: user.fullInfo
    });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el rol del usuario'
    });
  }
});

module.exports = router;
