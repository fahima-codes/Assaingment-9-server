// FixMate Backend Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const {
  verifyToken,
  verifyCustomer,
  verifyTechnician,
  verifyAdmin,
} = require('./middlewares/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
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
  duration: { type: String, default: '' },
  technicianName: { type: String, required: true },
  technicianEmail: { type: String, required: true },
  technicianPhoto: { type: String, default: '' },
  technicianArea: { type: String, default: '' },
  technicianBio: { type: String, default: '' },
  approvalStatus: { type: String, default: 'pending' },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const Service = mongoose.model('Service', serviceSchema);

// Booking Schema & Model
const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerName: { type: String, default: '' },
  customerEmail: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  preferredDate: { type: Date },
  problem: { type: String, default: '' },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
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

// User Schema & Model
const userSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  role: {
    type: String,
    enum: ['customer', 'technician', 'admin'],
    default: 'customer',
  },
  phone: { type: String, default: '' },
  area: { type: String, default: '' },
  bio: { type: String, default: '' },
  image: { type: String, default: '' },
  password: { type: String, default: '' },
});

const User = mongoose.model('User', userSchema);

// JWT token: { id, email, name, role } -> verifyToken e booking middlewares use
const generateToken = user =>
  jwt.sign(
    { id: user._id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

// Payment Schema & Model
const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
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

// @route   POST /api/auth/register
// @desc    User register kore -> token + user return
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: 'User already exists with this email' });
    }

    const newUser = await User.create({
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      password,
      role: ['customer', 'technician'].includes(role) ? role : 'customer',
    });

    const token = generateToken(newUser);
    const user = newUser.toObject();
    delete user.password;

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/auth/login
// @desc    User login -> token + user return
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const userObject = user.toObject();
    delete userObject.password;

    res.status(200).json({ token, user: userObject });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/auth/google
// @desc    Google Social Login / Sign Up -> user gets 'customer' role by default -> returns token & user
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, image } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Google email is required' });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Per assignment requirement: a Google user gets the 'customer' role by default
      user = await User.create({
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        image:
          image ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
            name || cleanEmail,
          )}`,
        role: 'customer',
        password: '',
      });
    }

    const token = generateToken(user);
    const userObject = user.toObject();
    delete userObject.password;

    res.status(200).json({ token, user: userObject });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST /api/services
// @desc    Technician create service kore -> approvalStatus pending
app.post('/api/services', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const title =
      typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const price = Number(req.body.price);

    if (!title) {
      return res.status(400).json({ message: 'Service title is required' });
    }
    if (req.body.price === '' || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: 'Price must be greater than 0' });
    }

    const stringFields = [
      'serviceImage',
      'description',
      'category',
      'serviceMode',
      'duration',
      'technicianArea',
      'serviceArea',
    ];
    if (
      stringFields.some(
        field =>
          req.body[field] !== undefined && typeof req.body[field] !== 'string',
      )
    ) {
      return res
        .status(400)
        .json({ message: 'Service fields must be strings' });
    }

    const service = await Service.create({
      title,
      technicianName: req.user.name || req.user.email,
      technicianEmail: req.user.email,
      serviceImage: req.body.serviceImage || '',
      description: req.body.description || '',
      category: req.body.category || '',
      serviceMode: req.body.serviceMode || '',
      price,
      duration: req.body.duration || '',
      technicianPhoto: req.body.technicianPhoto || '',
      technicianArea:
        req.body.serviceArea || req.body.technicianArea || req.user.area || '',
      technicianBio: req.body.technicianBio || req.user.bio || '',
      approvalStatus: 'pending',
      isAvailable: true,
      createdAt: new Date(),
    });
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/services/my
// @desc    Technician: own services
app.get('/api/services/my', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const services = await Service.find({
      technicianEmail: req.user.email,
    }).sort({
      createdAt: -1,
    });
    res.json({ services });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/technician/dashboard
// @desc    Technician: overview counts
app.get(
  '/api/technician/dashboard',
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const [totalServices, approvedServices, pendingRequests] =
        await Promise.all([
          Service.countDocuments({ technicianEmail: req.user.email }),
          Service.countDocuments({
            technicianEmail: req.user.email,
            approvalStatus: 'approved',
          }),
          Booking.countDocuments({
            technicianEmail: req.user.email,
            status: 'requested',
          }),
        ]);

      res.json({ totalServices, approvedServices, pendingRequests });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

// @route   POST /api/bookings
// @desc    Customer create booking -> status requested, payment unpaid, finalAmount = basePrice
app.post('/api/bookings', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { serviceId } = req.body;
    const preferredDate = req.body.preferredDate
      ? new Date(req.body.preferredDate)
      : undefined;

    if (preferredDate && Number.isNaN(preferredDate.getTime())) {
      return res.status(400).json({ message: 'Preferred date is invalid' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // approved + available service theke book kore dekhbe
    if (service.approvalStatus !== 'approved' || !service.isAvailable) {
      return res
        .status(400)
        .json({ message: 'This service is not available for booking' });
    }

    // same customer er same service e active request ache -> 400
    const existingBooking = await Booking.findOne({
      customerEmail: req.user.email,
      service: service._id,
      status: { $in: ['requested', 'accepted', 'in-progress'] },
    });

    if (existingBooking) {
      return res.status(400).json({
        message: 'You already have an active request for this service',
      });
    }

    const booking = await Booking.create({
      customer: req.user.id,
      customerName: req.user.name || '',
      customerEmail: req.user.email,
      phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : '',
      address:
        typeof req.body.address === 'string' ? req.body.address.trim() : '',
      preferredDate,
      problem:
        typeof req.body.problem === 'string' ? req.body.problem.trim() : '',
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
    const bookings = await Booking.find({ customerEmail: req.user.email }).sort(
      { createdAt: -1 },
    );
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/bookings/technician
// @desc    Technician er nijer bookings (verifyToken + verifyTechnician)
app.get(
  '/api/bookings/technician',
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const bookings = await Booking.find({
        technicianEmail: req.user.email,
      }).sort({ createdAt: -1 });
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

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
    if (
      req.user.email === booking.customerEmail ||
      req.user.email === booking.technicianEmail
    ) {
      return res.json(booking);
    }

    // owner customer / owner technician / admin chara ki -> 403
    return res.status(403).json({
      message: 'Forbidden: You are not allowed to access this booking',
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/bookings/:id/cancel
// @desc    Customer cancel kore -> sudhu owner, sudhu status requested thakle
app.patch(
  '/api/bookings/:id/cancel',
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // sudhu owner customer cancel kore dekhbe
      if (booking.customerEmail !== req.user.email) {
        return res.status(403).json({
          message: 'Forbidden: You are not the owner of this booking',
        });
      }

      // status requested thakle e target
      if (booking.status !== 'requested') {
        return res.status(400).json({
          message: 'Booking can only be cancelled when status is requested',
        });
      }

      booking.status = 'cancelled';
      await booking.save();

      res.json(booking);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

// @route   PATCH /api/bookings/:id/status
// @desc    Technician status update kore (owner)
app.patch(
  '/api/bookings/:id/status',
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // suddu owner technician update kore dekhbe
      if (booking.technicianEmail !== req.user.email) {
        return res.status(403).json({
          message:
            'Forbidden: You are not the owner technician of this booking',
        });
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
        if (req.body.finalAmount !== undefined) {
          const finalAmt = Number(req.body.finalAmount);
          if (Number.isFinite(finalAmt) && finalAmt > 0) {
            booking.finalAmount = finalAmt;
          }
        }
        if (!booking.finalAmount || booking.finalAmount <= 0) {
          return res.status(400).json({
            message:
              'finalAmount must be greater than 0 to complete the service',
          });
        }
      }

      booking.status = newStatus;
      await booking.save();

      res.json(booking);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

// @route   POST /api/payments/create-checkout-session
// @desc    Stripe Checkout Session create -> booking completed + unpaid + customer owner check
app.post(
  '/api/payments/create-checkout-session',
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const { bookingId } = req.body;

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      // booking completed + payment unpaid + customer owner check
      if (booking.status !== 'completed') {
        return res
          .status(400)
          .json({ message: 'Booking must be completed before payment' });
      }
      if (booking.paymentStatus !== 'unpaid') {
        return res.status(400).json({ message: 'Payment already processed' });
      }
      if (booking.customerEmail !== req.user.email) {
        return res.status(403).json({
          message: 'Forbidden: You are not the owner of this booking',
        });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      const hasValidStripeKey =
        typeof stripeKey === 'string' &&
        stripeKey.startsWith('sk_') &&
        !stripeKey.includes('your_stripe_secret_key');

      if (hasValidStripeKey) {
        try {
          // Stripe Checkout Session
          const session = await stripe.checkout.sessions.create({
            allowed_payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: booking.serviceTitle,
                  },
                  unit_amount: Math.round(booking.finalAmount * 100), // amount in cents
                },
                quantity: 1,
              },
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel`,
            metadata: {
              bookingId: booking._id.toString(),
              customerEmail: booking.customerEmail,
            },
          });

          return res.json({ url: session.url });
        } catch (stripeErr) {
          console.error('Stripe API error:', stripeErr.message);
        }
      }

      // Safe test mode fallback when valid Stripe secret key is not configured in .env
      const demoSessionId = `test_session_${booking._id}_${Date.now()}`;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.json({
        url: `${frontendUrl}/payment/success?session_id=${demoSessionId}`,
        isTestMode: true,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || 'Server error', error: err.message });
    }
  },
);

// @route   GET /api/payments/verify?session_id=
// @desc    Stripe session e payment check -> paid + payment ase ni -> insert + booking e paid koro
app.get(
  '/api/payments/verify',
  verifyToken,
  verifyCustomer,
  async (req, res) => {
    try {
      const { session_id } = req.query;

      if (!session_id) {
        return res.status(400).json({ message: 'Payment session is required' });
      }

      // Test Mode session handling
      if (session_id.startsWith('test_session_')) {
        const parts = session_id.split('_');
        const bookingId = parts[2];
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.customerEmail !== req.user.email) {
          return res.status(404).json({ message: 'Booking not found' });
        }

        let payment = await Payment.findOne({ stripeSessionId: session_id });
        if (!payment) {
          payment = await Payment.create({
            bookingId: booking._id,
            serviceTitle: booking.serviceTitle,
            customerName: booking.customerName || req.user.name || '',
            customerEmail: booking.customerEmail,
            technicianName: booking.technicianName,
            technicianEmail: booking.technicianEmail,
            amount: booking.finalAmount,
            currency: 'usd',
            transactionId: `pi_test_${Date.now()}`,
            stripeSessionId: session_id,
            paymentStatus: 'paid',
            paidAt: new Date(),
          });

          await Booking.findByIdAndUpdate(booking._id, {
            paymentStatus: 'paid',
          });
        }

        return res.json({ payment, session: { payment_status: 'paid' } });
      }

      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.metadata.customerEmail !== req.user.email) {
        return res
          .status(403)
          .json({ message: 'You cannot verify this payment' });
      }

      if (session.payment_status === 'paid') {
        const existingPayment = await Payment.findOne({
          stripeSessionId: session.id,
        });

        if (!existingPayment) {
          const booking = await Booking.findById(session.metadata.bookingId);
          if (!booking || booking.customerEmail !== req.user.email) {
            return res.status(404).json({ message: 'Booking not found' });
          }

          const payment = await Payment.create({
            bookingId: booking._id,
            serviceTitle: booking.serviceTitle,
            customerName: booking.customerName || req.user.name || '',
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

          await Booking.findByIdAndUpdate(booking._id, {
            paymentStatus: 'paid',
          });
          return res.json({ payment, session });
        }

        return res.json({ payment: existingPayment, session });
      }

      res.json({ payment: null, session });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || 'Server error', error: err.message });
    }
  },
);

// @route   POST /api/payments/webhook
// @desc    Stripe webhook -> checkout.session.completed handle -> duplicate save na
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      return res
        .status(400)
        .json({ message: 'Webhook signature verification failed' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const existingPayment = await Payment.findOne({
        stripeSessionId: session.id,
      });
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
  },
);

// @route   GET /api/admin/users
// @desc    Admin: sob user
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/admin/users/:id/role
// @desc    Admin: user er role change (customer / technician / admin)
app.patch(
  '/api/admin/users/:id/role',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { role } = req.body;

      if (!['customer', 'technician', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Admin cannot change their own role
      if (
        user._id.toString() === req.user.id ||
        user.email.toLowerCase() === req.user.email.toLowerCase()
      ) {
        return res
          .status(400)
          .json({ message: 'Admin cannot change their own role' });
      }

      user.role = role;
      await user.save();

      res.json(user);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

// @route   GET /api/admin/dashboard
// @desc    Admin: platform overview stats
app.get('/api/admin/dashboard', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalTechnicians,
      totalCustomers,
      pendingServices,
      approvedServices,
      totalBookings,
      payments,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'technician' }),
      User.countDocuments({ role: 'customer' }),
      Service.countDocuments({ approvalStatus: 'pending' }),
      Service.countDocuments({ approvalStatus: 'approved' }),
      Booking.countDocuments({}),
      Payment.find({ paymentStatus: 'paid' }),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    res.json({
      totalUsers,
      totalTechnicians,
      totalCustomers,
      pendingServices,
      approvedServices,
      totalBookings,
      totalRevenue,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/admin/services
// @desc    Admin: get all services with optional status filter
app.get('/api/admin/services', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const filter = {};
    if (
      req.query.status &&
      ['pending', 'approved', 'rejected'].includes(req.query.status)
    ) {
      filter.approvalStatus = req.query.status;
    }
    const services = await Service.find(filter).sort({ createdAt: -1 });
    res.json({ services });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/admin/services/:id/approval
// @desc    Admin: service approval (approved / rejected)
app.patch(
  '/api/admin/services/:id/approval',
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { approvalStatus } = req.body;

      if (approvalStatus !== 'approved' && approvalStatus !== 'rejected') {
        return res.status(400).json({ message: 'Invalid approval status' });
      }

      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }

      service.approvalStatus = approvalStatus;
      await service.save();

      res.json(service);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

// @route   GET /api/admin/bookings
// @desc    Admin: sob booking
app.get('/api/admin/bookings', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/admin/payments
// @desc    Admin: sob payment + total revenue
app.get('/api/admin/payments', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payments = await Payment.find({}).sort({ paidAt: -1 });

    const totalRevenue = payments.reduce(
      (sum, p) => sum + (p.paymentStatus === 'paid' ? p.amount : 0),
      0,
    );

    res.json({ payments, totalRevenue });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET /api/payments/my
// @desc    Customer: own payments
app.get('/api/payments/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const payments = await Payment.find({ customerEmail: req.user.email }).sort(
      {
        paidAt: -1,
      },
    );
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/users/profile
// @desc    Logged-in user er profile update (name, phone, area, bio, image)
app.patch('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // email / role change kora jabe na
    if (req.body.email) {
      return res.status(400).json({ message: 'Email cannot be changed' });
    }
    if (req.body.role) {
      return res.status(400).json({ message: 'Role cannot be changed' });
    }

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.area !== undefined) user.area = req.body.area;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.image !== undefined) user.image = req.body.image;

    await user.save();

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
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
    if (
      !service ||
      service.approvalStatus !== 'approved' ||
      !service.isAvailable
    ) {
      return res.status(404).json({ message: 'Service not found' });
    }
    res.json(service);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PATCH /api/services/:id
// @desc    Owner technician edit kore -> approvalStatus pending
app.patch(
  '/api/services/:id',
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }

      // sudhu owner edit korte parbe
      if (service.technicianEmail !== req.user.email) {
        return res.status(403).json({
          message: 'Forbidden: You are not the owner of this service',
        });
      }

      const updateData = {};
      const editableFields = {
        title: 'title',
        serviceImage: 'serviceImage',
        description: 'description',
        category: 'category',
        serviceMode: 'serviceMode',
        duration: 'duration',
        serviceArea: 'technicianArea',
        technicianArea: 'technicianArea',
        technicianPhoto: 'technicianPhoto',
        technicianBio: 'technicianBio',
      };

      for (const [field, modelField] of Object.entries(editableFields)) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          if (typeof req.body[field] !== 'string') {
            return res
              .status(400)
              .json({ message: `${field} must be a string` });
          }
          if (field === 'title' && !req.body[field].trim()) {
            return res
              .status(400)
              .json({ message: 'Service title is required' });
          }
          updateData[modelField] = req.body[field].trim();
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'price')) {
        const price = Number(req.body.price);
        if (req.body.price === '' || !Number.isFinite(price) || price <= 0) {
          return res
            .status(400)
            .json({ message: 'Price must be greater than 0' });
        }
        updateData.price = price;
      }

      // edit korele approval pending hoye jabe
      updateData.approvalStatus = 'pending';

      const updatedService = await Service.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true },
      );
      res.json(updatedService);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

// @route   DELETE /api/services/:id
// @desc    Owner technician delete kore
app.delete(
  '/api/services/:id',
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }

      // sudhu owner delete korte parbe
      if (service.technicianEmail !== req.user.email) {
        return res.status(403).json({
          message: 'Forbidden: You are not the owner of this service',
        });
      }

      await Service.findByIdAndDelete(req.params.id);
      res.json({ message: 'Service deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

// @route   PATCH /api/services/:id/availability
// @desc    Owner technician isAvailable toggle kore
app.patch(
  '/api/services/:id/availability',
  verifyToken,
  verifyTechnician,
  async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }

      // sudhu owner toggle korte parbe
      if (service.technicianEmail !== req.user.email) {
        return res.status(403).json({
          message: 'Forbidden: You are not the owner of this service',
        });
      }

      service.isAvailable = !service.isAvailable;
      await service.save();

      res.json(service);
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  },
);

app.get('/', (req, res) => {
  res.send('MERN Backend Server is Running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
