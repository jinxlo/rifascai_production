const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    unique: true, 
    required: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    select: false,
    minlength: 6
  },
  fullName: { 
    type: String, 
    required: true,
    trim: true
  },
  idNumber: { 
    type: String, 
    required: true,
    trim: true,
    unique: true // Added unique constraint for ID number
  },
  phoneNumber: { 
    type: String, 
    required: true,
    trim: true
  },
  isAdmin: { 
    type: Boolean, 
    default: false 
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lastFailedLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ idNumber: 1 });
userSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 });
userSchema.index({ status: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    console.log('Hashing password for user:', this.email);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.password, salt);

    this.password = hashedPassword;
    this.passwordChangedAt = Date.now() - 1000;

    console.log('Password hashed successfully:', {
      email: this.email,
      hashLength: hashedPassword.length,
      hashedPasswordSample: hashedPassword.substring(0, 10) + '...'
    });

    next();
  } catch (error) {
    console.error('Error in password hashing:', {
      email: this.email,
      error: error.message
    });
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    console.log('Password comparison initiated for:', this.email);

    let userPassword = this.password;
    if (!userPassword) {
      const user = await this.constructor.findById(this._id)
        .select('+password')
        .lean();

      if (!user || !user.password) {
        console.error('User or password not found for comparison:', this.email);
        return false;
      }
      userPassword = user.password;
    }

    console.log('Comparing passwords:', {
      email: this.email,
      hasStoredPassword: !!userPassword,
      storedPasswordLength: userPassword?.length,
      candidatePasswordLength: candidatePassword?.length
    });

    const isMatch = await bcrypt.compare(candidatePassword, userPassword);
    
    // Update login attempts
    if (!isMatch) {
      this.loginAttempts += 1;
      this.lastFailedLogin = new Date();
      if (this.loginAttempts >= 5) {
        this.status = 'suspended';
      }
      await this.save();
    } else {
      if (this.loginAttempts > 0) {
        this.loginAttempts = 0;
        await this.save();
      }
    }

    console.log('Password comparison result:', {
      email: this.email,
      isMatch,
      loginAttempts: this.loginAttempts,
      storedPasswordSample: userPassword.substring(0, 10) + '...'
    });

    return isMatch;
  } catch (error) {
    console.error('Error in password comparison:', {
      email: this.email,
      error: error.message
    });
    return false;
  }
};

// Static password hashing
userSchema.statics.hashPassword = async function(password) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log('Static password hashing completed:', {
      hashLength: hashedPassword.length,
      hashSample: hashedPassword.substring(0, 10) + '...'
    });
    
    return hashedPassword;
  } catch (error) {
    console.error('Error in static password hashing:', error);
    throw error;
  }
};

// Update password securely
userSchema.methods.updatePassword = async function(newPassword) {
  try {
    console.log('Updating password for user:', this.email);
    const hashedPassword = await this.constructor.hashPassword(newPassword);
    
    this.password = hashedPassword;
    this.passwordChangedAt = Date.now() - 1000;
    this.loginAttempts = 0;
    this.lastFailedLogin = null;
    
    await this.save();
    console.log('Password updated successfully for:', this.email);
    return true;
  } catch (error) {
    console.error('Error updating password:', {
      email: this.email,
      error: error.message
    });
    throw error;
  }
};

// Password change verification
userSchema.methods.changedPasswordAfter = function(timestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return timestamp < changedTimestamp;
  }
  return false;
};

// Password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
  
  return resetToken;
};

// Find admin users
userSchema.statics.findAdmins = function() {
  return this.find({ isAdmin: true });
};

// New method to check if account is locked
userSchema.methods.isAccountLocked = function() {
  return this.status === 'suspended' || this.loginAttempts >= 5;
};

// New method to reactivate account
userSchema.methods.reactivateAccount = async function() {
  this.status = 'active';
  this.loginAttempts = 0;
  this.lastFailedLogin = null;
  await this.save();
};

// User's full information virtual
userSchema.virtual('fullInfo').get(function() {
  return {
    id: this._id,
    email: this.email,
    fullName: this.fullName,
    idNumber: this.idNumber,
    phoneNumber: this.phoneNumber,
    isAdmin: this.isAdmin,
    status: this.status,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
    lastFailedLogin: this.lastFailedLogin,
    loginAttempts: this.loginAttempts
  };
});

// JSON transformation
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    return ret;
  }
});

// Enhanced validation rules
userSchema.path('email').validate(function(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}, 'Invalid email format');

userSchema.path('password').validate(function(password) {
  return password && password.length >= 6;
}, 'Password must be at least 6 characters');

userSchema.path('phoneNumber').validate(function(phone) {
  const phoneRegex = /^\+?[\d\s-]{8,}$/;
  return phoneRegex.test(phone);
}, 'Invalid phone number format');

userSchema.path('idNumber').validate(function(id) {
  return id && id.length >= 5;
}, 'ID number must be at least 5 characters');

const User = mongoose.model('User', userSchema);

module.exports = User;