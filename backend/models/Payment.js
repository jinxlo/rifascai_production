const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  raffle: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Raffle', 
    required: true,
    immutable: true,
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Invalid raffle ID'
    }
  },
  fullName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  idNumber: { 
    type: String, 
    required: true, 
    trim: true 
  },
  phoneNumber: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    trim: true, 
    lowercase: true 
  },
  selectedNumbers: [{ 
    type: Number, 
    required: true,
    immutable: true 
  }],
  method: { 
    type: String, 
    required: true, 
    enum: ['Binance Pay', 'Pagomovil', 'Zelle', 'Cash']
  },
  totalAmountUSD: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  proofOfPayment: { 
    type: String, 
    required: true 
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Rejected'],
    default: 'Pending',
    index: true
  },
  rejectionReason: {
    type: String,
    required: function() {
      return this.status === 'Rejected';
    },
    validate: {
      validator: function(v) {
        if (this.status === 'Rejected') {
          return v && v.trim().length > 0;
        }
        return true;
      },
      message: 'Rejection reason is required when rejecting a payment and cannot be empty'
    }
  },
  isNewUser: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Add compound indexes for common queries
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ raffle: 1, status: 1 });
paymentSchema.index({ method: 1, status: 1 });

// Pre-save middleware to validate status changes
paymentSchema.pre('save', async function(next) {
  // Validate raffle reference for all status changes
  if (!this.raffle) {
    throw new Error('Raffle reference is required');
  }

  // Skip status transition validation for new documents
  if (this.isNew) {
    return next();
  }

  // Only validate status transitions for existing documents when status is modified
  if (this.isModified('status')) {
    const validTransitions = {
      'Pending': ['Confirmed', 'Rejected'],
      'Confirmed': [],
      'Rejected': []
    };

    const previousStatus = this._previousStatus || this.status;
    
    // Check if the transition is valid
    if (this.status !== previousStatus && !validTransitions[previousStatus]?.includes(this.status)) {
      throw new Error(`Invalid status transition from ${previousStatus} to ${this.status}`);
    }

    // Validate rejection reason only when transitioning to Rejected status
    if (this.status === 'Rejected' && !this.rejectionReason?.trim()) {
      throw new Error('Rejection reason is required when rejecting a payment');
    }
  }
  next();
});

// Save the previous status before any updates
paymentSchema.pre('save', function(next) {
  if (!this.isNew) {
    this._previousStatus = this.$__.previousStatus || this.status;
  }
  next();
});

// Instance method to get payment summary
paymentSchema.methods.getSummary = function() {
  return {
    id: this._id,
    user: this.user,
    fullName: this.fullName,
    method: this.method,
    amount: this.totalAmountUSD,
    status: this.status,
    rejectionReason: this.status === 'Rejected' ? this.rejectionReason : undefined,
    ticketCount: this.selectedNumbers.length,
    createdAt: this.createdAt
  };
};

// Instance method to reject a payment
paymentSchema.methods.reject = async function(reason) {
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is required');
  }
  
  this.status = 'Rejected';
  this.rejectionReason = reason.trim();
  return await this.save();
};

// Static method to get payment statistics
paymentSchema.statics.getStats = async function(startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        createdAt: { 
          $gte: startDate, 
          $lte: endDate 
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmountUSD' }
      }
    }
  ]);
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;