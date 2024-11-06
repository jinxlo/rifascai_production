const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: [true, 'Ticket number is required'],
    match: [/^\d{3}$/, 'Ticket number must be a 3-digit string'],
  },
  raffleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Raffle',
    required: [true, 'Raffle ID is required']
  },
  status: {
    type: String,
    enum: {
      values: ['available', 'reserved', 'sold'],
      message: '{VALUE} is not a valid status'
    },
    default: 'available'
  },
  reservedAt: {
    type: Date,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  purchasedAt: {
    type: Date,
    default: null
  },
  transactionId: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Define indexes after schema but before creating the model
const defineIndexes = async () => {
  try {
    await mongoose.model('Ticket', TicketSchema).collection.dropIndexes();
  } catch (err) {
    console.log('No indexes to drop or error dropping indexes:', err?.message);
  }

  TicketSchema.index({ raffleId: 1, ticketNumber: 1 }, { unique: true });
  TicketSchema.index({ raffleId: 1, status: 1 });
  TicketSchema.index({ userId: 1, status: 1 });
  
  TicketSchema.index(
    { reservedAt: 1 }, 
    { 
      expireAfterSeconds: 24 * 60 * 60,
      sparse: true,
      name: 'reservation_ttl_index'
    }
  );
};

// Virtual for time until reservation expires
TicketSchema.virtual('reservationTimeLeft').get(function() {
  if (!this.reservedAt || this.status !== 'reserved') return null;
  const now = new Date();
  const expiresAt = new Date(this.reservedAt.getTime() + 24 * 60 * 60 * 1000);
  return Math.max(0, expiresAt - now);
});

// Instance methods
TicketSchema.methods.reserve = async function(userId) {
  if (this.status !== 'available') {
    throw new Error('Ticket is not available');
  }
  this.status = 'reserved';
  this.userId = userId;
  this.reservedAt = new Date();
  return await this.save();
};

TicketSchema.methods.purchase = async function(userId, transactionId) {
  if (this.status !== 'reserved' || this.userId.toString() !== userId.toString()) {
    throw new Error('Ticket is not reserved by this user');
  }
  this.status = 'sold';
  this.purchasedAt = new Date();
  this.transactionId = transactionId;
  this.reservedAt = null;
  return await this.save();
};

TicketSchema.methods.release = async function() {
  if (this.status === 'sold') {
    throw new Error('Cannot release sold ticket');
  }
  this.status = 'available';
  this.userId = null;
  this.reservedAt = null;
  return await this.save();
};

// Static methods
TicketSchema.statics.getTicketsStats = async function(raffleId) {
  return await this.aggregate([
    { 
      $match: { 
        raffleId: new mongoose.Types.ObjectId(raffleId) 
      } 
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1
      }
    }
  ]);
};

TicketSchema.statics.releaseExpiredReservations = async function() {
  const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await this.updateMany(
    {
      status: 'reserved',
      reservedAt: { $lt: expiryTime }
    },
    {
      $set: {
        status: 'available',
        userId: null,
        reservedAt: null
      }
    }
  );
};

// Middleware
TicketSchema.pre('save', function(next) {
  if (this.status !== 'reserved') {
    this.reservedAt = null;
  }
  next();
});

// Create model
const Ticket = mongoose.model('Ticket', TicketSchema);

// Initialize indexes when the model is first created
defineIndexes().catch(err => {
  console.error('Error initializing indexes:', err);
});

module.exports = Ticket;
