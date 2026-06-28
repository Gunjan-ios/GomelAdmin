'use strict';

/**
 * Seeds the database with the same demo data the Flutter app shipped with
 * (mock_data.dart): 5 Ahmedabad cars, reviews, subscription plans, a demo
 * user, broadcast notifications, plus the default admin account.
 *
 * Run:  npm run seed
 * This WIPES the cars / reviews / plans / notifications rows first.
 */

const env = require('../config/env');
const prisma = require('../db/prisma');
const { hashPassword } = require('../db/helpers');

const CAR_IMG = {
  c1: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800',
  c2: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800',
  c3: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800',
  c4: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
  c5: 'https://images.unsplash.com/photo-1542362567-b07e54358753?w=800',
};
const AV1 = 'https://i.pravatar.cc/150?img=12';
const AV2 = 'https://i.pravatar.cc/150?img=32';
const AV3 = 'https://i.pravatar.cc/150?img=45';

const cars = [
  {
    id: 'c1', name: 'Hyundai Creta', type: 'SUV',
    images: [CAR_IMG.c1, CAR_IMG.c4, CAR_IMG.c5],
    pricePerHour: 180, pricePerDay: 2400, rating: 4.7, reviewCount: 128, distanceKm: 1.2,
    transmission: 'automatic', fuel: 'petrol', seats: 5,
    features: ['Air Conditioning', 'Bluetooth', 'Sunroof', 'Rear Camera'],
    pickupAddress: 'Satellite, SG Highway, Ahmedabad', lat: 23.0276, lng: 72.5074,
    fuelPolicy: 'Same-to-same fuel level',
    cancellationPolicy: 'Free cancellation up to 6 hrs before trip',
    host: { name: 'Rahul M', avatarUrl: AV1, rating: 4.8, trips: 210 },
  },
  {
    id: 'c2', name: 'Maruti Swift', type: 'Hatchback',
    images: [CAR_IMG.c2, CAR_IMG.c3],
    pricePerHour: 90, pricePerDay: 1200, rating: 4.5, reviewCount: 86, distanceKm: 2.8,
    transmission: 'manual', fuel: 'petrol', seats: 5,
    features: ['Air Conditioning', 'Bluetooth', 'USB Charging'],
    pickupAddress: 'Navrangpura, CG Road, Ahmedabad', lat: 23.0382, lng: 72.5614,
    fuelPolicy: 'Same-to-same fuel level',
    cancellationPolicy: 'Free cancellation up to 12 hrs before trip',
    host: { name: 'Priya S', avatarUrl: AV2, rating: 4.6, trips: 95 },
  },
  {
    id: 'c3', name: 'Tata Nexon EV', type: 'SUV',
    images: [CAR_IMG.c3, CAR_IMG.c1],
    pricePerHour: 150, pricePerDay: 2000, rating: 4.8, reviewCount: 64, distanceKm: 3.5,
    transmission: 'automatic', fuel: 'electric', seats: 5,
    features: ['Air Conditioning', 'Fast Charging', 'Sunroof', 'Cruise Control'],
    pickupAddress: 'Bopal, Ambli Road, Ahmedabad', lat: 23.0303, lng: 72.4690,
    fuelPolicy: 'Return with 80%+ charge',
    cancellationPolicy: 'Free cancellation up to 6 hrs before trip',
    host: { name: 'Arjun K', avatarUrl: AV3, rating: 4.9, trips: 312 },
  },
  {
    id: 'c4', name: 'Honda City', type: 'Sedan',
    images: [CAR_IMG.c4, CAR_IMG.c5],
    pricePerHour: 160, pricePerDay: 2200, rating: 4.6, reviewCount: 142, distanceKm: 4.1,
    transmission: 'automatic', fuel: 'petrol', seats: 5,
    features: ['Air Conditioning', 'Bluetooth', 'Leather Seats', 'Rear Camera'],
    pickupAddress: 'Prahlad Nagar, Ahmedabad', lat: 23.0120, lng: 72.5070,
    fuelPolicy: 'Same-to-same fuel level',
    cancellationPolicy: 'Free cancellation up to 6 hrs before trip',
    host: { name: 'Sneha R', avatarUrl: AV2, rating: 4.7, trips: 178 },
  },
  {
    id: 'c5', name: 'Mahindra Thar', type: 'SUV',
    images: [CAR_IMG.c5, CAR_IMG.c2],
    pricePerHour: 250, pricePerDay: 3500, rating: 4.9, reviewCount: 53, distanceKm: 5.6,
    transmission: 'manual', fuel: 'diesel', seats: 4,
    features: ['Air Conditioning', '4x4', 'Convertible Top', 'Bluetooth'],
    pickupAddress: 'Maninagar, Ahmedabad', lat: 22.9985, lng: 72.6020,
    fuelPolicy: 'Same-to-same fuel level',
    cancellationPolicy: 'No free cancellation within 24 hrs',
    host: { name: 'Vikram D', avatarUrl: AV1, rating: 5.0, trips: 88 },
  },
];

function reviewsFor(carId) {
  return [
    { id: `${carId}-r1`, carId, author: 'Aman Gupta', avatarUrl: AV1, rating: 5,
      comment: 'Super clean car and smooth pickup. Host was very helpful!',
      date: new Date('2026-05-18') },
    { id: `${carId}-r2`, carId, author: 'Neha Verma', avatarUrl: AV2, rating: 4.5,
      comment: 'Great drive overall. Fuel level was as described.',
      date: new Date('2026-05-02') },
    { id: `${carId}-r3`, carId, author: 'Karthik N', avatarUrl: AV3, rating: 4,
      comment: 'Good experience, would book again. AC could be stronger.',
      date: new Date('2026-04-21') },
  ];
}

const plans = [
  { id: 'basic', name: 'GoMel Cars Lite', monthlyPrice: 199, tagline: 'For occasional drivers',
    perks: ['5% off every trip', 'No booking fee', 'Priority support'],
    discountPct: 0.05, waiveDeposit: false, loyaltyMultiplier: 1 },
  { id: 'plus', name: 'GoMel Cars Plus', monthlyPrice: 499, tagline: 'Best for regulars',
    perks: ['12% off every trip', 'Free doorstep delivery', 'Zero security deposit', '2x loyalty points'],
    highlighted: true,
    discountPct: 0.12, waiveDeposit: true, loyaltyMultiplier: 2 },
  { id: 'pro', name: 'GoMel Cars Pro', monthlyPrice: 999, tagline: 'For frequent renters',
    perks: ['20% off every trip', 'Free delivery + pickup', 'Zero deposit', '3x loyalty points', 'Free cancellation anytime'],
    discountPct: 0.20, waiveDeposit: true, loyaltyMultiplier: 3 },
];

const broadcasts = [
  { type: 'offer', title: 'Weekend getaway? 🚗',
    body: 'Use SAVE15 for 15% off your next self-drive trip.', date: new Date('2026-06-03T09:30:00') },
  { type: 'system', title: 'Welcome to GoMel Cars',
    body: 'Self-drive cars across Ahmedabad. Book in minutes.', date: new Date('2026-05-28T11:00:00') },
];

// Promo codes (mock_data.promoCodes).
const promos = [
  { id: 'FIRST20', code: 'FIRST20', discountPct: 0.20, title: '20% off your first trip',
    description: 'New users — apply at checkout.' },
  { id: 'WEEKEND10', code: 'WEEKEND10', discountPct: 0.10, title: '10% off weekend trips',
    description: 'Valid on self-drive bookings.' },
  { id: 'SAVE15', code: 'SAVE15', discountPct: 0.15, title: '15% off any trip',
    description: 'Limited-time saver.' },
];

// Loyalty redeem catalogue (mock_data.redeemOptions).
const redeemOptions = [
  { id: 'r1', title: '₹100 off next trip', description: 'Apply to any booking', cost: 300, value: 100 },
  { id: 'r2', title: 'Free delivery', description: 'Doorstep car delivery, one-time', cost: 500, value: 0 },
  { id: 'r3', title: '₹250 off weekend trip', description: 'Valid Sat–Sun', cost: 700, value: 250 },
];

async function run() {
  console.log('🧹 Clearing cars / reviews / plans / promos / redeem options / broadcasts…');
  await Promise.all([
    prisma.car.deleteMany({}),
    prisma.review.deleteMany({}),
    prisma.subscriptionPlan.deleteMany({}),
    prisma.notification.deleteMany({ where: { user: null } }),
    prisma.promoCode.deleteMany({}),
    prisma.redeemOption.deleteMany({}),
  ]);

  console.log('🚗 Inserting cars + reviews…');
  await prisma.car.createMany({ data: cars });
  for (const c of cars) await prisma.review.createMany({ data: reviewsFor(c.id) });

  console.log('💳 Inserting subscription plans…');
  await prisma.subscriptionPlan.createMany({ data: plans });

  console.log('🏷  Inserting promo codes + redeem options…');
  await prisma.promoCode.createMany({ data: promos });
  await prisma.redeemOption.createMany({ data: redeemOptions });

  console.log('🔔 Inserting broadcast notifications…');
  await prisma.notification.createMany({ data: broadcasts.map((b) => ({ ...b, user: null })) });

  // Demo customer (matches mock_data.dart "John Doe").
  console.log('👤 Upserting demo user…');
  const demoPhone = '+91 98765 43210';
  let demo = await prisma.user.findUnique({ where: { phone: demoPhone } });
  if (!demo) {
    demo = await prisma.user.create({
      data: {
        phone: demoPhone, name: 'John Doe', email: 'john.doe@example.com',
        avatarUrl: AV1, licenseStatus: 'verified', walletBalance: 850, role: 'user',
      },
    });
  }
  // Referral code shown on the app's referral screen.
  demo = await prisma.user.update({
    where: { id: demo.id },
    data: { referralCode: 'JOHN500' },
  });

  // Demo loyalty balance + history (mock_data.loyalty).
  await prisma.loyalty.deleteMany({ where: { user: demo.id } });
  await prisma.loyalty.create({
    data: {
      user: demo.id,
      points: 1850,
      history: [
        { title: 'Trip completed — Hyundai Creta', points: 240, date: new Date('2026-05-18') },
        { title: 'Referral bonus', points: 500, date: new Date('2026-05-02') },
        { title: 'Redeemed — ₹100 off', points: -300, date: new Date('2026-04-25') },
        { title: 'Trip completed — Tata Nexon EV', points: 210, date: new Date('2026-04-10') },
      ],
    },
  });

  // Default admin account for the admin panel.
  console.log('🛡  Upserting admin account…');
  const adminEmail = env.adminEmail.toLowerCase();
  const passwordHash = await hashPassword(env.adminPassword);
  let admin = await prisma.user.findFirst({ where: { email: adminEmail, role: 'admin' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        phone: 'admin', name: 'Administrator',
        email: adminEmail, role: 'admin', passwordHash,
      },
    });
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash },
    });
  }

  console.log('');
  console.log('✅ Seed complete.');
  console.log(`   Cars: ${cars.length}  |  Plans: ${plans.length}`);
  console.log(`   Admin login → ${env.adminEmail} / ${env.adminPassword}`);
  console.log('');

  await prisma.$disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Seed failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
