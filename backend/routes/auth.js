// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer();

const JWT_SECRET = process.env.JWT_SECRET;

// Add multer middleware to parse FormData
router.post('/login', upload.none(), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('Login attempt details:', {
      email: normalizedEmail,
      passwordReceived: !!password,
      passwordLength: password?.length,
      bodyType: typeof req.body,
      contentType: req.headers['content-type']
    });

    // Find user with password included
    const user = await User.findOne({ email: normalizedEmail })
      .select('+password')
      .lean();
    
    if (!user) {
      console.log('User not found:', normalizedEmail);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Found user, attempting password verification:', {
      email: normalizedEmail,
      hasStoredPassword: !!user.password,
      storedPasswordLength: user.password?.length,
      passwordType: typeof password
    });

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    console.log('Password verification result:', {
      email: normalizedEmail,
      isMatch,
      hashedPasswordSample: user.password?.substring(0, 10) + '...'
    });

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        isAdmin: user.isAdmin
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date()
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      isAdmin: user.isAdmin,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;