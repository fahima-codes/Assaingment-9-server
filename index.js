const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { verifyToken, verifyCustomer, verifyTechnician } = require('./middlewares/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const mongoURI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-nbsuiui-shard-00-00.1eul2tk.mongodb.net:27017,ac-nbsuiui-shard-00-01.1eul2tk.mongodb.net:27017,ac-nbsuiui-shard-00-02.1eul2tk.mongodb.net:27017/myDatabase?ssl=true&replicaSet=atlas-22ujl6-shard-0&authSource=admin&retryWrites=true&w=majority`;

mongoose
  .connect(mongoURI)
  .then(() => console.log('MongoDB Connected Successfully!'))
  .catch(err => console.log('MongoDB Connection Error:', err));

// Services Schema & Model
const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  serviceImage: { type: String, default: '' },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  serviceMode: { type: String, default: '' },
  price: { type: Number, default: 0 },
  technicianName: { type: String, required: true },
  technicianEmail: { type: String, required: true },
  approvalStatus: { type: String, default: 'pending' },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const Service = mongoose.model('Service', serviceSchema);

// Booking Schema & Model
const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerEmail: { type: String, required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  serviceTitle: { type: String, required: true },
  serviceImage: { type: String, default: '' },
  category: { type: String, default: '' },
  basePrice: { type: Number, required: true },
  technicianName: { type: String, required: true },
  technicianEmail: { type: String, required: true },
  status: { type: String, default: 'requested' },
  paymentStatus: { type: String, default: 'unpaid' },
  finalAmount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Booking = mongoose.model('Booking', bookingSchema);

// Payment Schema & Model
const paymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  serviceTitle: { type: String, required: true },
  customerName: { type: String, default: '' },
  customerEmail: { type: String, required: true },
  technicianName: { type: String, default: '' },
  technicianEmail: { type: String, default: '' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  transactionId: { type: String, default: '' },
  stripeSessionId: { type: String, required: true },
  paymentStatus: { type: String, default: 'paid' },
  paidAt: { type: Date, default: Date.now },
});

const Payment = mongoose.model('Payment', paymentSchema);

// @route   POST /api/services
// @desc    Technician create service kore -> approvalStatus pending
app.post('/api/services', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const service = await Service.create({
      technicianName: req.user.name || req.user.email,
      technicianEmail: req.user.email,
      serviceImage: req.body.serviceImage || '',
      approvalStatus: 'pending',
      isAvailable: true,
      createdAt: new Date(),
    });
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/bookings
// @desc    Customer create booking -> status requested, payment unpaid, finalAmount = basePrice
app.post('/api/bookings', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { serviceId } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // approved + available service theke book kore dekhbe
    if (service.approvalStatus !== 'approved' || !service.isAvailable) {
      return res.status(400).json({ message: 'This service is not available for booking' });
    }

    // same customer er same service e active request ache -> 400
    const existingBooking = await Booking.findOne({
      customerEmail: req.user.email,
      service: service._id,
      status: { $in: ['requested', 'accepted', 'in-progress'] },
    });

    if (existingBooking) {
      return res.status(400).json({ message: 'You already have an active request for this service' });
    }

    const booking = await Booking.create({
      customer: req.user.id,
      customerEmail: req.user.email,
      service: service._id,
      serviceTitle: service.title,
      serviceImage: service.serviceImage,
      category: service.category,
      basePrice: service.price,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      status: 'requested',
      paymentStatus: 'unpaid',
      finalAmount: service.price,
    });

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/bookings/my
// @desc    Customer er nijer bookings (verifyToken + verifyCustomer)
app.get('/api/bookings/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const bookings = await Booking.find({ customerEmail: req.user.email }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/bookings/technician
// @desc    Technician er nijer bookings (verifyToken + verifyTechnician)
app.get('/api/bookings/technician', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const bookings = await Booking.find({ technicianEmail: req.user.email }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/bookings/:id
// @desc    Owner (customer / technician) ba admin chara dekhte parbe na
app.get('/api/bookings/:id', verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // admin access
    if (req.user.role === 'admin') {
      return res.json(booking);
    }

    // owner access: customer ba technician
    if (req.user.email === booking.customerEmail || req.user.email === booking.technicianEmail) {
      return res.json(booking);
    }

    // owner customer / owner technician / admin chara ki -> 403
    return res.status(403).json({ message: 'Forbidden: You are not allowed to access this booking' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/bookings/:id/cancel
// @desc    Customer cancel kore -> sudhu owner, sudhu status requested thakle
app.patch('/api/bookings/:id/cancel', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // sudhu owner customer cancel kore dekhbe
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You are not the owner of this booking' });
    }

    // status requested thakle e target
    if (booking.status !== 'requested') {
      return res.status(400).json({ message: 'Booking can only be cancelled when status is requested' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/bookings/:id/status
// @desc    Technician status update kore (owner)
app.patch('/api/bookings/:id/status', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // suddu owner technician update kore dekhbe
    if (booking.technicianEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You are not the owner technician of this booking' });
    }

    const newStatus = req.body.status;

    // Allowed transitions
    const validTransitions = {
      requested: { accepted: true, rejected: true },
      accepted: { 'in-progress': true },
      'in-progress': { completed: true },
    };

    const validNexts = validTransitions[booking.status] || {};

    // Onno transition -> 400
    if (!validNexts[newStatus]) {
      return res.status(400).json({ message: 'Invalid status transition' });
    }

    // completed lagbe finalAmount > 0
    if (newStatus === 'completed') {
      if (!booking.finalAmount || booking.finalAmount <= 0) {
        return res.status(400).json({ message: 'finalAmount must be greater than 0 to complete the service' });
      }
    }

    booking.status = newStatus;
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/payments/create-checkout-session
// @desc    Stripe Checkout Session create -> booking completed + unpaid + customer owner check
app.post('/api/payments/create-checkout-session', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // booking completed + payment unpaid + customer owner check
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Booking must be completed before payment' });
    }
    if (booking.paymentStatus !== 'unpaid') {
      return res.status(400).json({ message: 'Payment already processed' });
    }
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You are not the owner of this booking' });
    }

    // Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: booking.serviceTitle,
            },
            unit_amount: booking.finalAmount * 100, // amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
      metadata: {
        bookingId: booking._id.toString(),
        customerEmail: booking.customerEmail,
      },
    });

    // URL return
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/payments/verify?session_id=
// @desc    Stripe session e payment check -> paid + payment ase ni -> insert + booking e paid koro
app.get('/api/payments/verify', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { session_id } = req.query;

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      const existingPayment = await Payment.findOne({ stripeSessionId: session.id });

      if (!existingPayment) {
        const booking = await Booking.findById(session.metadata.bookingId);

        const payment = await Payment.create({
          bookingId: booking._id,
          serviceTitle: booking.serviceTitle,
          customerEmail: booking.customerEmail,
          technicianName: booking.technicianName,
          technicianEmail: booking.technicianEmail,
          amount: booking.finalAmount,
          currency: 'usd',
          transactionId: session.payment_intent,
          stripeSessionId: session.id,
          paymentStatus: 'paid',
          paidAt: new Date(),
        });

        await Booking.findByIdAndUpdate(booking._id, { paymentStatus: 'paid' });
        return res.json({ payment, session });
      }

      return res.json({ payment: existingPayment, session });
    }

    res.json({ payment: null, session });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/payments/webhook
// @desc    Stripe webhook -> checkout.session.completed handle -> duplicate save na
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: 'Webhook signature verification failed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const existingPayment = await Payment.findOne({ stripeSessionId: session.id });
    if (!existingPayment) {
      const booking = await Booking.findById(session.metadata.bookingId);

      const payment = await Payment.create({
        bookingId: booking._id,
        serviceTitle: booking.serviceTitle,
        customerEmail: booking.customerEmail,
        technicianName: booking.technicianName,
        technicianEmail: booking.technicianEmail,
        amount: booking.finalAmount,
        currency: 'usd',
        transactionId: session.payment_intent,
        stripeSessionId: session.id,
        paymentStatus: 'paid',
        paidAt: new Date(),
      });

      await Booking.findByIdAndUpdate(booking._id, { paymentStatus: 'paid' });
    }
  }

  res.json({ received: true });
});

// @route   GET /api/services
// @desc    Public -> filtering + pagination (approvalStatus approved + isAvailable true)
app.get('/api/services', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { approvalStatus: 'approved', isAvailable: true };

    // search -> title / category te regex (case-insensitive)
    const search = req.query.search;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    // category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // serviceMode filter
    if (req.query.serviceMode) {
      filter.serviceMode = req.query.serviceMode;
    }

    // sort: price-low, price-high, newest
    const sortOption = {};
    if (req.query.sort === 'price-low') {
      sortOption.price = 1;
    } else if (req.query.sort === 'price-high') {
      sortOption.price = -1;
    } else {
      sortOption.createdAt = -1; // default: newest
    }

    const total = await Service.countDocuments(filter);
    const services = await Service.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    res.json({
      services,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/services/:id
// @desc    Public -> ekta service (approved + available)
app.get('/api/services/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service || service.approvalStatus !== 'approved' || !service.isAvailable) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/services/:id
// @desc    Owner technician edit kore -> approvalStatus pending
app.patch('/api/services/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // sudhu owner edit korte parbe
    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You are not the owner of this service' });
    }

    const updateData = {};
    if (req.body.title) updateData.title = req.body.title;
    if (req.body.description) updateData.description = req.body.description;
    if (req.body.category) updateData.category = req.body.category;
    if (req.body.serviceMode) updateData.serviceMode = req.body.serviceMode;
    if (req.body.price) updateData.price = req.body.price;

    // edit korele approval pending hoye jabe
    updateData.approvalStatus = 'pending';

    const updatedService = await Service.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updatedService);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   DELETE /api/services/:id
// @desc    Owner technician delete kore
app.delete('/api/services/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // sudhu owner delete korte parbe
    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You are not the owner of this service' });
    }

    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: 'Service deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/services/:id/availability
// @desc    Owner technician isAvailable toggle kore
app.patch('/api/services/:id/availability', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // sudhu owner toggle korte parbe
    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({ message: 'Forbidden: You are not the owner of this service' });
    }

    service.isAvailable = !service.isAvailable;
    await service.save();

    res.json(service);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('MERN Backend Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
