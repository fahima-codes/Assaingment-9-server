const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { verifyToken, verifyTechnician } = require('./middlewares/auth');

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

// @route   POST /api/services
// @desc    Technician create service kore -> approvalStatus pending
app.post('/api/services', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const service = await Service.create({
      technicianName: req.user.name || req.user.email,
      technicianEmail: req.user.email,
      approvalStatus: 'pending',
      isAvailable: true,
      createdAt: new Date(),
    });
    res.status(201).json(service);
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
    if (!service || service.approvalStatus !== 'approved' || !service.isAvailable) {
      return res.status(404).json({ message: 'Service not found' });
    }
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
