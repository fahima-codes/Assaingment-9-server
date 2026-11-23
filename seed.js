// Database seeder
require('dotenv').config();
const mongoose = require('mongoose');

// Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['customer', 'technician', 'admin'], default: 'customer' },
  phone: { type: String, default: '' },
  area: { type: String, default: '' },
  bio: { type: String, default: '' },
  image: { type: String, default: '' },
  password: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

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

const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, default: '' },
  customerEmail: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  preferredDate: { type: Date },
  problem: { type: String, default: '' },
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

const User = mongoose.model('User', userSchema);
const Service = mongoose.model('Service', serviceSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Payment = mongoose.model('Payment', paymentSchema);

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected! Cleaning existing collections...');

    await Promise.all([
      User.deleteMany({}),
      Service.deleteMany({}),
      Booking.deleteMany({}),
      Payment.deleteMany({}),
    ]);

    console.log('Seeding Users...');
    const adminUser = await User.create({
      name: 'FixMate Administrator',
      email: 'admin@fixmate.com',
      password: 'Admin123!',
      role: 'admin',
      phone: '+8801700000000',
      area: 'Dhaka Central, Bangladesh',
      bio: 'FixMate Platform Operations and System Administrator.',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    });

    const tech1 = await User.create({
      name: 'Rahim Ahmed',
      email: 'rahim@fixmate.com',
      password: 'Tech123!',
      role: 'technician',
      phone: '+8801811122233',
      area: 'Dhanmondi, Dhaka',
      bio: 'Over 8 years experience specializing in smartphones, tablets, and consumer electrical wiring.',
      image: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=400&auto=format&fit=crop&q=80',
    });

    const tech2 = await User.create({
      name: 'Karim Ullah',
      email: 'karim@fixmate.com',
      password: 'Tech123!',
      role: 'technician',
      phone: '+8801922233344',
      area: 'Gulshan, Dhaka',
      bio: 'Certified HVAC & home appliance technician. Specialist in Inverter ACs, refrigerators, and washers.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    });

    const tech3 = await User.create({
      name: 'Tanvir Hasan',
      email: 'tanvir@fixmate.com',
      password: 'Tech123!',
      role: 'technician',
      phone: '+8801733344455',
      area: 'Uttara, Dhaka',
      bio: 'Master technician for Laptops, PC workstations, display panels, and television circuit boards.',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    });

    const customerUser = await User.create({
      name: 'Sakib Chowdhury',
      email: 'sakib@fixmate.com',
      password: 'Customer123!',
      role: 'customer',
      phone: '+8801712345678',
      area: 'Mirpur, Dhaka',
      bio: 'Homeowner and tech enthusiast looking for reliable repair services.',
      image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
    });

    console.log('Seeding Services...');
    const servicesData = [
      {
        title: 'iPhone & Android Screen Replacement',
        category: 'Smartphone',
        description: 'Complete display and touch glass replacement with original OEM grade panels, 90-day warranty included.',
        serviceImage: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop&q=80',
        price: 45,
        duration: '1-2 hours',
        serviceMode: 'Home Visit',
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        technicianPhoto: tech1.image,
        technicianArea: tech1.area,
        technicianBio: tech1.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Smartphone Battery & Charging Port Fix',
        category: 'Smartphone',
        description: 'High capacity battery replacement and Type-C / Lightning port cleaning or microsoldering fix.',
        serviceImage: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80',
        price: 35,
        duration: '45 mins',
        serviceMode: 'Shop Drop-off',
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        technicianPhoto: tech1.image,
        technicianArea: tech1.area,
        technicianBio: tech1.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Laptop Motherboard & Chipset Repair',
        category: 'Laptop & PC',
        description: 'Deep diagnostic and IC replacement for power failure, water damage, or sudden shutdown issues.',
        serviceImage: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
        price: 75,
        duration: '2-3 days',
        serviceMode: 'Shop Drop-off',
        technicianName: tech3.name,
        technicianEmail: tech3.email,
        technicianPhoto: tech3.image,
        technicianArea: tech3.area,
        technicianBio: tech3.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Laptop Deep Clean & Thermal Paste Refresh',
        category: 'Laptop & PC',
        description: 'Internal fan dust-out, heatsink polish, and premium Arctic MX-4 thermal paste application to stop overheating.',
        serviceImage: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&auto=format&fit=crop&q=80',
        price: 30,
        duration: '2 hours',
        serviceMode: 'Home Visit',
        technicianName: tech3.name,
        technicianEmail: tech3.email,
        technicianPhoto: tech3.image,
        technicianArea: tech3.area,
        technicianBio: tech3.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Split AC Jet Pump Master Servicing',
        category: 'AC',
        description: 'High-pressure water jet cleaning of indoor blower, condenser coils, drain pipe clearing, and airflow test.',
        serviceImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop&q=80',
        price: 50,
        duration: '2 hours',
        serviceMode: 'Home Visit',
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        technicianPhoto: tech2.image,
        technicianArea: tech2.area,
        technicianBio: tech2.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'AC Gas Leak Detection & Freon Refill',
        category: 'AC',
        description: 'Complete nitrogen pressure test, copper joint brazing for leak points, and genuine R32/R410A gas recharge.',
        serviceImage: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&auto=format&fit=crop&q=80',
        price: 65,
        duration: '3 hours',
        serviceMode: 'Home Visit',
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        technicianPhoto: tech2.image,
        technicianArea: tech2.area,
        technicianBio: tech2.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Inverter Refrigerator Compressor Repair',
        category: 'Refrigerator',
        description: 'Diagnostics of linear inverter compressor, starter relay replacement, and gas circuit vacuum pump servicing.',
        serviceImage: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80',
        price: 80,
        duration: '1 day',
        serviceMode: 'Home Visit',
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        technicianPhoto: tech2.image,
        technicianArea: tech2.area,
        technicianBio: tech2.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Refrigerator Defrost Heater & Sensor Fix',
        category: 'Refrigerator',
        description: 'Eliminates ice buildup and poor bottom cooling. Replaces bimetal thermostat, sensor and defrost timer.',
        serviceImage: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&auto=format&fit=crop&q=80',
        price: 45,
        duration: '2-3 hours',
        serviceMode: 'Home Visit',
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        technicianPhoto: tech2.image,
        technicianArea: tech2.area,
        technicianBio: tech2.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Smart 4K LED/OLED TV Backlight Replacement',
        category: 'TV',
        description: 'Fixes dark screens, sound without picture, or blue tinting with full strip array LED replacement.',
        serviceImage: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&auto=format&fit=crop&q=80',
        price: 55,
        duration: '1 day',
        serviceMode: 'Shop Drop-off',
        technicianName: tech3.name,
        technicianEmail: tech3.email,
        technicianPhoto: tech3.image,
        technicianArea: tech3.area,
        technicianBio: tech3.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Automatic Washing Machine Drum & Motor Fix',
        category: 'Washing Machine',
        description: 'Solves heavy vibration, water draining failure, and spin cycle stoppage. Genuine belt and clutch assembly.',
        serviceImage: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&auto=format&fit=crop&q=80',
        price: 50,
        duration: '3-4 hours',
        serviceMode: 'Home Visit',
        technicianName: tech2.name,
        technicianEmail: tech2.email,
        technicianPhoto: tech2.image,
        technicianArea: tech2.area,
        technicianBio: tech2.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Home Electrical Wiring & Circuit Breakers',
        category: 'Electrical',
        description: 'Complete inspection of short circuits, earth leakage, and DB panel MCB upgrade with certified electrician.',
        serviceImage: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&auto=format&fit=crop&q=80',
        price: 40,
        duration: '3 hours',
        serviceMode: 'Home Visit',
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        technicianPhoto: tech1.image,
        technicianArea: tech1.area,
        technicianBio: tech1.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'Ceiling Fan, Exhaust & Switchboard Setup',
        category: 'Electrical',
        description: 'Safe and neat installation of smart wall switches, modular plates, regulators, and high-speed ceiling fans.',
        serviceImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
        price: 25,
        duration: '2 hours',
        serviceMode: 'Home Visit',
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        technicianPhoto: tech1.image,
        technicianArea: tech1.area,
        technicianBio: tech1.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      {
        title: 'MacBook Logic Board & Liquid Recovery',
        category: 'Laptop & PC',
        description: 'Ultrasonic cleaning and component replacement for spilled tea/water damage on Apple MacBook Air and Pro.',
        serviceImage: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
        price: 90,
        duration: '2 days',
        serviceMode: 'Shop Drop-off',
        technicianName: tech3.name,
        technicianEmail: tech3.email,
        technicianPhoto: tech3.image,
        technicianArea: tech3.area,
        technicianBio: tech3.bio,
        approvalStatus: 'approved',
        isAvailable: true,
      },
      // 1 Pending service for admin testing
      {
        title: 'Smart Home Security Camera Setup & Wiring',
        category: 'Electrical',
        description: 'IP camera mounting, DVR/NVR configuration, and mobile remote live streaming app setup.',
        serviceImage: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&auto=format&fit=crop&q=80',
        price: 60,
        duration: '4 hours',
        serviceMode: 'Home Visit',
        technicianName: tech1.name,
        technicianEmail: tech1.email,
        technicianPhoto: tech1.image,
        technicianArea: tech1.area,
        technicianBio: tech1.bio,
        approvalStatus: 'pending',
        isAvailable: true,
      },
    ];

    const insertedServices = await Service.insertMany(servicesData);
    console.log(`Inserted ${insertedServices.length} services.`);

    console.log('Seeding Bookings across statuses...');
    // 1. Requested booking
    const booking1 = await Booking.create({
      customer: customerUser._id,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      phone: customerUser.phone,
      address: 'House 42, Road 11, Sector 4, Mirpur-10, Dhaka',
      preferredDate: new Date(Date.now() + 86400000 * 2),
      problem: 'My smartphone screen got cracked after an accidental fall, touch is partially unresponsive.',
      service: insertedServices[0]._id,
      serviceTitle: insertedServices[0].title,
      serviceImage: insertedServices[0].serviceImage,
      category: insertedServices[0].category,
      basePrice: insertedServices[0].price,
      technicianName: insertedServices[0].technicianName,
      technicianEmail: insertedServices[0].technicianEmail,
      status: 'requested',
      paymentStatus: 'unpaid',
      finalAmount: insertedServices[0].price,
    });

    // 2. Accepted booking
    const booking2 = await Booking.create({
      customer: customerUser._id,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      phone: customerUser.phone,
      address: 'House 42, Road 11, Sector 4, Mirpur-10, Dhaka',
      preferredDate: new Date(Date.now() + 86400000 * 3),
      problem: 'Living room split AC is not cooling properly, blowing warm air during afternoon.',
      service: insertedServices[4]._id,
      serviceTitle: insertedServices[4].title,
      serviceImage: insertedServices[4].serviceImage,
      category: insertedServices[4].category,
      basePrice: insertedServices[4].price,
      technicianName: insertedServices[4].technicianName,
      technicianEmail: insertedServices[4].technicianEmail,
      status: 'accepted',
      paymentStatus: 'unpaid',
      finalAmount: insertedServices[4].price,
    });

    // 3. In-Progress booking
    const booking3 = await Booking.create({
      customer: customerUser._id,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      phone: customerUser.phone,
      address: 'House 42, Road 11, Sector 4, Mirpur-10, Dhaka',
      preferredDate: new Date(),
      problem: 'Laptop shuts down suddenly when gaming or compiling code. Need deep cleaning.',
      service: insertedServices[3]._id,
      serviceTitle: insertedServices[3].title,
      serviceImage: insertedServices[3].serviceImage,
      category: insertedServices[3].category,
      basePrice: insertedServices[3].price,
      technicianName: insertedServices[3].technicianName,
      technicianEmail: insertedServices[3].technicianEmail,
      status: 'in-progress',
      paymentStatus: 'unpaid',
      finalAmount: insertedServices[3].price,
    });

    // 4. Completed + Unpaid booking (READY FOR CUSTOMER PAYMENT TEST!)
    const booking4 = await Booking.create({
      customer: customerUser._id,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      phone: customerUser.phone,
      address: 'House 42, Road 11, Sector 4, Mirpur-10, Dhaka',
      preferredDate: new Date(Date.now() - 86400000 * 2),
      problem: 'Washing machine was vibrating violently during spin cycle. Motor suspension was repaired.',
      service: insertedServices[9]._id,
      serviceTitle: insertedServices[9].title,
      serviceImage: insertedServices[9].serviceImage,
      category: insertedServices[9].category,
      basePrice: insertedServices[9].price,
      technicianName: insertedServices[9].technicianName,
      technicianEmail: insertedServices[9].technicianEmail,
      status: 'completed',
      paymentStatus: 'unpaid',
      finalAmount: 50,
    });

    // 5. Completed + Paid booking (With Stripe payment record)
    const booking5 = await Booking.create({
      customer: customerUser._id,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      phone: customerUser.phone,
      address: 'House 42, Road 11, Sector 4, Mirpur-10, Dhaka',
      preferredDate: new Date(Date.now() - 86400000 * 5),
      problem: 'Main circuit breaker kept tripping every evening. Replaced faulty 32A MCB.',
      service: insertedServices[10]._id,
      serviceTitle: insertedServices[10].title,
      serviceImage: insertedServices[10].serviceImage,
      category: insertedServices[10].category,
      basePrice: insertedServices[10].price,
      technicianName: insertedServices[10].technicianName,
      technicianEmail: insertedServices[10].technicianEmail,
      status: 'completed',
      paymentStatus: 'paid',
      finalAmount: 40,
    });

    console.log('Seeding Payment Record...');
    await Payment.create({
      bookingId: booking5._id,
      serviceTitle: booking5.serviceTitle,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      technicianName: booking5.technicianName,
      technicianEmail: booking5.technicianEmail,
      amount: 40,
      currency: 'usd',
      transactionId: 'pi_test_3Nk5X2LkdIwHu7ix1F9sample',
      stripeSessionId: 'cs_test_a1sampleCheckoutSessionId40USD',
      paymentStatus: 'paid',
      paidAt: new Date(Date.now() - 86400000 * 4),
    });

    console.log('Database Seeding Completed Successfully! 🎉');
    console.log('-------------------------------------------');
    console.log('Admin Account:      admin@fixmate.com / Admin123!');
    console.log('Technician 1:       rahim@fixmate.com / Tech123!');
    console.log('Technician 2:       karim@fixmate.com / Tech123!');
    console.log('Customer Account:   sakib@fixmate.com / Customer123!');
    console.log('-------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
}

seed();
