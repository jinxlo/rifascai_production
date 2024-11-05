// payments.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');
const Raffle = require('../models/Raffle');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const auth = require('../middleware/auth');
const EmailService = require('../services/emailService'); // Import EmailService

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (upload, io) => {
  // Middleware to parse JSON bodies (if not already included in main server)
  router.use(express.json());

  // Get payment status
  router.get('/:id/status', auth.isUser, async (req, res) => {
    try {
      console.log(`Received GET request at /api/payments/${req.params.id}/status`);

      const payment = await Payment.findById(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      if (!req.user.isAdmin && payment.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json({
        status: payment.status,
        selectedNumbers: payment.selectedNumbers,
        method: payment.method,
        totalAmountUSD: payment.totalAmountUSD,
        createdAt: payment.createdAt
      });
    } catch (error) {
      console.error('Error fetching payment status:', error);
      res.status(500).json({ message: 'Error fetching payment status' });
    }
  });

  // Get all payments (admin only)
  router.get('/all', auth.isAdmin, async (req, res) => {
    try {
      const payments = await Payment.find()
        .populate('user', 'fullName email')
        .sort('-createdAt');
      res.json(payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ message: 'Error fetching payments' });
    }
  });

  // Get pending payments (admin only)
  router.get('/pending', auth.isAdmin, async (req, res) => {
    try {
      const payments = await Payment.find({ status: 'Pending' })
        .populate('user', 'fullName email')
        .sort('-createdAt');
      res.json(payments);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      res.status(500).json({ message: 'Error fetching pending payments' });
    }
  });

  // Get user's payments
  router.get('/my-payments', auth.isUser, async (req, res) => {
    try {
      const payments = await Payment.find({ user: req.user._id })
        .sort('-createdAt');
      res.json(payments);
    } catch (error) {
      console.error('Error fetching user payments:', error);
      res.status(500).json({ message: 'Error fetching your payments' });
    }
  });

  // Create payment and user account route with EmailService integration
  router.post(
    '/create-and-pay',
    upload.single('proofOfPayment'),
    [
      body('fullName').notEmpty().withMessage('Full Name is required'),
      body('idNumber').notEmpty().withMessage('ID Number is required'),
      body('phoneNumber').notEmpty().withMessage('Phone Number is required'),
      body('selectedNumbers').notEmpty().withMessage('Selected ticket numbers are required'),
      body('method')
        .notEmpty()
        .withMessage('Payment method is required')
        .isIn(['Binance Pay', 'Pagomovil', 'Zelle', 'Cash'])
        .withMessage('Invalid payment method'),
      body('totalAmountUSD').isFloat({ gt: 0 }).withMessage('Total Amount USD must be a positive number'),
      body('email')
        .if((value, { req }) => !req.headers.authorization)
        .isEmail().withMessage('Valid email is required'),
      body('password')
        .if((value, { req }) => !req.headers.authorization)
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ],
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ errors: errors.array() });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const {
          fullName,
          idNumber,
          phoneNumber,
          email: emailFromReq,
          password,
          selectedNumbers,
          method,
          totalAmountUSD,
        } = req.body;

        let email = emailFromReq?.toLowerCase().trim();
        let user;

        // Check for authentication token
        const token = req.headers.authorization?.split(' ')[1];

        if (token) {
          // For authenticated users
          try {
            const decoded = jwt.verify(token, JWT_SECRET);
            user = await User.findById(decoded.userId).session(session);
            if (!user) {
              throw new Error('User not found');
            }
            email = user.email;
          } catch (error) {
            throw new Error('Invalid authentication token');
          }
        } else {
          // Enhanced user creation with fixed password handling
          console.log('Creating new user:', {
            email,
            passwordReceived: !!password,
            passwordLength: password?.length
          });

          const existingUser = await User.findOne({ email }).session(session);
          if (existingUser) {
            throw new Error('User with this email already exists');
          }

          // Create user without hashing the password manually
          user = new User({
            fullName: fullName.trim(),
            email,
            password, // Pass plain password; the model will handle hashing
            idNumber: idNumber.trim(),
            phoneNumber: phoneNumber.trim(),
          });

          // Save user - password will be hashed by the model's pre-save middleware
          await user.save({ session });

          // Verify the saved user immediately
          const savedUser = await User.findById(user._id)
            .select('+password')
            .session(session);

          if (!savedUser) {
            throw new Error('User creation verification failed');
          }

          // Verify password using the model's comparePassword method
          const isPasswordValid = await savedUser.comparePassword(password);

          console.log('User creation verification:', {
            email,
            passwordVerified: isPasswordValid,
            savedHashLength: savedUser.password.length
          });

          if (!isPasswordValid) {
            throw new Error('Password verification failed after user creation');
          }

          // Send account creation email
          await EmailService.sendAccountCreationEmail(email, fullName);
        }

        // Get active raffle
        const activeRaffle = await Raffle.findOne({ active: true }).session(session);
        if (!activeRaffle) {
          throw new Error('No active raffle found');
        }

        // Parse and validate selected numbers
        let tickets = [];
        try {
          tickets = JSON.parse(selectedNumbers);
          if (!Array.isArray(tickets)) throw new Error();
        } catch (err) {
          throw new Error('Invalid selectedNumbers format');
        }

        // Format selected numbers as padded strings
        const formattedTickets = tickets.map(num => String(num).padStart(3, '0'));

        // Reserve tickets
        const unavailableTickets = [];
        for (const ticketNumber of formattedTickets) {
          const ticket = await Ticket.findOneAndUpdate(
            {
              ticketNumber,
              status: 'available',
              raffleId: activeRaffle._id
            },
            {
              $set: {
                status: 'reserved',
                reservedAt: new Date(),
                userId: user._id
              }
            },
            { session, new: true }
          );

          if (!ticket) {
            unavailableTickets.push(ticketNumber);
          }
        }

        if (unavailableTickets.length > 0) {
          throw new Error(`Tickets not available: ${unavailableTickets.join(', ')}`);
        }

        // Create payment record with formattedTickets
        const payment = new Payment({
          user: user._id,
          raffle: activeRaffle._id,
          fullName: fullName.trim(),
          idNumber: idNumber.trim(),
          phoneNumber: phoneNumber.trim(),
          email,
          selectedNumbers: formattedTickets, // Store as formatted strings
          method,
          totalAmountUSD: parseFloat(totalAmountUSD),
          proofOfPayment: req.file ? `/uploads/proofs/${req.file.filename}` : '',
          status: 'Pending',
        });

        await payment.save({ session });

        // Update raffle statistics
        activeRaffle.reservedTickets += formattedTickets.length;
        await activeRaffle.save({ session });

        await session.commitTransaction();

        // Emit socket events after committing the transaction
        io.emit('ticketsReserved', {
          tickets: formattedTickets,
          raffleId: activeRaffle._id.toString()
        });
        io.emit('payment_created', {
          paymentId: payment._id.toString(),
          tickets: formattedTickets,
          raffleId: activeRaffle._id.toString(),
          status: payment.status,
          // Add other payment details as needed
        });

        // Send payment verification email
        await EmailService.sendPaymentVerificationEmail(email, fullName);

        // Prepare response
        const responseData = {
          success: true,
          message: token
            ? 'Payment submitted successfully'
            : 'Account created and payment submitted successfully',
          paymentId: payment._id,
        };

        // Include authentication data for new users
        if (!token) {
          responseData.token = jwt.sign(
            {
              userId: user._id,
              email: user.email,
              isAdmin: user.isAdmin
            },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          responseData.isAdmin = user.isAdmin;
          responseData.user = {
            id: user._id,
            email: user.email,
            fullName: user.fullName
          };
        }

        res.status(201).json(responseData);

      } catch (error) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        console.error('Error in create-and-pay:', error);
        res.status(400).json({
          success: false,
          message: error.message || 'Server error'
        });
      } finally {
        session.endSession();
      }
    }
  );

  // Confirm payment (admin only)
  router.post('/:id/confirm', auth.isAdmin, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payment = await Payment.findById(req.params.id)
        .session(session);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'Pending') {
        throw new Error('Payment is not in pending status');
      }

      // Update payment status
      payment.status = 'Confirmed';
      await payment.save({ session });

      // Format selectedNumbers as padded strings
      const formattedTickets = payment.selectedNumbers.map(num => String(num).padStart(3, '0'));

      // Update tickets status to 'sold'
      const ticketUpdates = await Ticket.updateMany(
        {
          ticketNumber: { $in: formattedTickets },
          status: 'reserved'
        },
        {
          $set: {
            status: 'sold',
            soldAt: new Date()
          }
        },
        { session }
      );

      console.log(`Sold ${ticketUpdates.modifiedCount} tickets.`);

      // Update raffle statistics
      const raffle = await Raffle.findById(payment.raffle).session(session);
      if (raffle) {
        raffle.soldTickets += formattedTickets.length;
        raffle.reservedTickets = Math.max(0, raffle.reservedTickets - formattedTickets.length);
        await raffle.save({ session });
      }

      await session.commitTransaction();

      // Emit socket events after committing the transaction
      io.emit('payment_confirmed', {
        paymentId: payment._id.toString(),
        tickets: formattedTickets,
        raffleId: payment.raffle.toString()
      });

      io.emit('ticket_status_changed', {
        tickets: formattedTickets,
        status: 'sold',
        raffleId: payment.raffle.toString()
      });

      // Send confirmation email
      await EmailService.sendPaymentConfirmationEmail(
        payment.email,
        payment.fullName,
        formattedTickets,
        raffle
      );

      res.json({
        success: true,
        message: 'Payment confirmed successfully'
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Error confirming payment:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error confirming payment'
      });
    } finally {
      session.endSession();
    }
  });

  // Reject payment (admin only)
  router.post('/:id/reject', auth.isAdmin, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { rejectionReason } = req.body;

      if (!rejectionReason || !rejectionReason.trim()) {
        throw new Error('Rejection reason is required');
      }

      const payment = await Payment.findById(req.params.id).session(session);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'Pending') {
        throw new Error('Payment is not in pending status');
      }

      // Update payment status to 'Rejected'
      payment.status = 'Rejected';
      payment.rejectionReason = rejectionReason.trim();
      await payment.save({ session });

      // Format selectedNumbers as padded strings
      const formattedTickets = payment.selectedNumbers.map(num => String(num).padStart(3, '0'));

      // Update tickets to 'available'
      const ticketUpdates = await Ticket.updateMany(
        {
          raffleId: payment.raffle, // Correct field name
          ticketNumber: { $in: formattedTickets }
        },
        {
          $set: {
            status: 'available',
            userId: null, // Ensure 'userId' matches the model
            reservedAt: null,
            soldAt: null
          }
        },
        { session }
      );

      console.log(`Released ${ticketUpdates.modifiedCount} tickets to 'available' status.`);

      // Update raffle statistics
      const raffle = await Raffle.findById(payment.raffle).session(session);
      if (raffle) {
        raffle.reservedTickets = Math.max(0, raffle.reservedTickets - formattedTickets.length);
        await raffle.save({ session });
      }

      await session.commitTransaction();

      // Emit socket events after committing the transaction
      io.emit('payment_rejected', {
        paymentId: payment._id.toString(),
        tickets: formattedTickets,
        raffleId: payment.raffle.toString()
      });

      io.emit('ticket_status_changed', {
        tickets: formattedTickets,
        status: 'available',
        raffleId: payment.raffle.toString()
      });

      // Send rejection email
      await EmailService.sendPaymentRejectionEmail(
        payment.email,
        payment.fullName,
        rejectionReason
      );

      res.json({
        success: true,
        message: 'Payment rejected successfully'
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Error rejecting payment:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error rejecting payment'
      });
    } finally {
      session.endSession();
    }
  });

  // Get payment statistics
  router.get('/stats', auth.isAdmin, async (req, res) => {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      const payments = await Payment.find({
        status: 'Confirmed'
      });

      const totalAmount = payments.reduce((sum, payment) => sum + payment.totalAmountUSD, 0);

      const lastMonthPayments = await Payment.find({
        status: 'Confirmed',
        createdAt: { $gte: lastMonth }
      });

      const lastMonthAmount = lastMonthPayments.reduce((sum, payment) => sum + payment.totalAmountUSD, 0);

      const growth = lastMonthAmount === 0 ? 0 :
        ((totalAmount - lastMonthAmount) / lastMonthAmount) * 100;

      res.json({
        totalAmount,
        growth,
        count: payments.length,
        lastMonthCount: lastMonthPayments.length
      });
    } catch (error) {
      console.error('Error getting payment stats:', error);
      res.status(500).json({ message: 'Error getting payment statistics' });
    }
  });

  // Get confirmed payments
  router.get('/confirmed', auth.isAdmin, async (req, res) => {
    try {
      const payments = await Payment.find({ status: 'Confirmed' })
        .sort('-createdAt')
        .populate('user', 'fullName email')
        .limit(100);

      res.json(payments);
    } catch (error) {
      console.error('Error getting confirmed payments:', error);
      res.status(500).json({ message: 'Error getting confirmed payments' });
    }
  });

  return router;
};
