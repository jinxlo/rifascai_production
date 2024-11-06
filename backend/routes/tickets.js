const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const auth = require('../middleware/auth');

module.exports = (ioInstance) => {
  router.use((req, res, next) => {
    req.io = ioInstance;
    next();
  });

  // @route   GET /api/tickets
  // @desc    Get all tickets for active raffle
  // @access  Public
  router.get('/', async (req, res) => {
    try {
      const tickets = await Ticket.find()
        .sort({ ticketNumber: 1 })
        .select('-__v')
        .lean();
      
      // Normalize status values and ticket numbers
      const normalizedTickets = tickets.map(ticket => ({
        ...ticket,
        status: ticket.status.toLowerCase(),
        ticketNumber: String(ticket.ticketNumber).padStart(3, '0')
      }));

      console.log('Sending normalized tickets:', 
        normalizedTickets.map(t => ({
          number: t.ticketNumber,
          status: t.status
        }))
      );
      
      res.json(normalizedTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
    }
  });

  // @route   POST /api/tickets/initialize
  // @desc    Initialize tickets for a new raffle
  // @access  Admin only
  router.post('/initialize', auth.isAdmin, async (req, res) => {
    const { raffleId, totalTickets } = req.body;

    if (!raffleId || !totalTickets) {
      return res.status(400).json({ 
        success: false, 
        message: 'Raffle ID and total tickets are required' 
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Ticket.deleteMany({ raffleId }, { session });

      const tickets = Array.from({ length: totalTickets }, (_, index) => ({
        raffleId,
        ticketNumber: String(index).padStart(3, '0'),
        status: 'available',
        createdAt: new Date()
      }));

      await Ticket.insertMany(tickets, { session });
      await session.commitTransaction();

      req.io.emit('ticketsInitialized', {
        raffleId,
        totalTickets,
        status: 'available'
      });

      res.status(201).json({
        success: true,
        message: 'Tickets initialized successfully',
        count: totalTickets
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Error initializing tickets:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to initialize tickets'
      });
    } finally {
      session.endSession();
    }
  });

  // @route   POST /api/tickets/release
  // @desc    Release a reserved ticket
  // @access  Public
  router.post('/release', async (req, res) => {
    const { ticketNumber, raffleId } = req.body;

    if (!ticketNumber || !raffleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ticket number and raffle ID are required' 
      });
    }

    try {
      const formattedTicketNumber = String(ticketNumber).padStart(3, '0');
      const ticket = await Ticket.findOneAndUpdate(
        { 
          ticketNumber: formattedTicketNumber,
          raffleId,
          status: 'reserved' 
        },
        { 
          $set: { 
            status: 'available', 
            reservedAt: null, 
            userId: null 
          } 
        },
        { new: true }
      );

      if (!ticket) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ticket is not reserved or does not exist' 
        });
      }

      // Emit normalized status
      req.io.emit('ticketStatusChanged', {
        ticketNumber: formattedTicketNumber,
        status: 'available',
        raffleId
      });

      res.json({ success: true, message: 'Ticket released successfully' });
    } catch (error) {
      console.error('Error releasing ticket:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to release ticket' 
      });
    }
  });

  // @route   POST /api/tickets/check-reserved
  // @desc    Check if selected tickets are still available
  // @access  Public
  router.post('/check-reserved', async (req, res) => {
    const { tickets, raffleId } = req.body;

    if (!tickets || !Array.isArray(tickets) || !raffleId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tickets array and raffle ID are required' 
      });
    }

    try {
      const formattedTickets = tickets.map(num => String(num).padStart(3, '0'));
      const unavailableTickets = await Ticket.find({
        ticketNumber: { $in: formattedTickets },
        raffleId,
        status: { $ne: 'available' }
      }).select('ticketNumber status').lean();

      if (unavailableTickets.length > 0) {
        const message = unavailableTickets
          .map(t => `Ticket ${t.ticketNumber} is ${t.status.toLowerCase()}`)
          .join(', ');
        return res.status(200).json({ success: false, message });
      }

      res.json({ 
        success: true, 
        message: 'All selected tickets are available' 
      });
    } catch (error) {
      console.error('Error checking reserved tickets:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to check ticket availability' 
      });
    }
  });

  // @route   GET /api/tickets/raffle/:raffleId
  // @desc    Get all tickets for a specific raffle
  // @access  Public
  router.get('/raffle/:raffleId', async (req, res) => {
    try {
      const tickets = await Ticket.find({ 
        raffleId: req.params.raffleId 
      })
        .sort({ ticketNumber: 1 })
        .select('-__v')
        .lean();

      // Normalize status values for consistency
      const normalizedTickets = tickets.map(ticket => ({
        ...ticket,
        status: ticket.status.toLowerCase(),
        ticketNumber: String(ticket.ticketNumber).padStart(3, '0')
      }));

      console.log('Sending raffle tickets:', 
        normalizedTickets.map(t => ({
          number: t.ticketNumber,
          status: t.status
        }))
      );

      res.json(normalizedTickets);
    } catch (error) {
      console.error('Error fetching raffle tickets:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch raffle tickets' 
      });
    }
  });

  // @route   GET /api/tickets/stats/:raffleId
  // @desc    Get ticket statistics for a raffle
  // @access  Public
  router.get('/stats/:raffleId', async (req, res) => {
    try {
      const stats = await Ticket.aggregate([
        { 
          $match: { 
            raffleId: new mongoose.Types.ObjectId(req.params.raffleId) 
          } 
        },
        {
          $group: {
            _id: { $toLower: '$status' }, // Normalize status in aggregation
            count: { $sum: 1 }
          }
        }
      ]);

      const formattedStats = stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

      res.json({
        success: true,
        stats: formattedStats
      });
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch ticket statistics' 
      });
    }
  });

  // @route   GET /api/tickets/status/:ticketNumber
  // @desc    Debug route to check ticket status
  // @access  Public
  router.get('/status/:ticketNumber', async (req, res) => {
    try {
      const ticket = await Ticket.findOne({
        ticketNumber: String(req.params.ticketNumber).padStart(3, '0')
      }).lean();
      
      if (!ticket) {
        return res.status(404).json({ message: 'Ticket not found' });
      }

      res.json({
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        normalizedStatus: ticket.status.toLowerCase()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};