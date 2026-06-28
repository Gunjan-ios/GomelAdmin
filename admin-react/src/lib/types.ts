// Domain types for the admin panel. These mirror the JSON the backend's
// /api/admin/* endpoints return. Fields are intentionally loose (optional)
// because the original vanilla panel coded defensively against missing data.

export interface AdminUser {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface Stats {
  revenue: number;
  bookings: number;
  cars: number;
  users: number;
  hosts: number;
  pendingKyc: number;
  openClaims: number;
  pendingPayouts: number;
}

export interface Host {
  name?: string;
  phone?: string;
  email?: string;
  upiId?: string;
}

export interface Car {
  id: string;
  name?: string;
  type?: string;
  transmission?: string;
  fuel?: string;
  seats?: number;
  pricePerHour?: number;
  pricePerDay?: number;
  pickupAddress?: string;
  images?: string[];
  rcBook?: string[];
  features?: string[];
  host?: Host;
  rating?: number;
  active?: boolean;
}

export interface Fare {
  base?: number;
  taxes?: number;
  addOns?: number;
  deposit?: number;
  discount?: number;
  rewardDiscount?: number;
}

export type BookingStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface BookingUser {
  name?: string;
  phone?: string;
  email?: string;
}

export interface Booking {
  id: string;
  car?: Car;
  user?: BookingUser;
  fare?: Fare;
  status: BookingStatus;
  start?: string;
  end?: string;
  package?: string;
  tripStarted?: boolean;
  isVerifiedByHost?: boolean;
  unlockOtp?: string;
  createdAt?: string;
}

export interface Inspection {
  type: 'preTrip' | 'postTrip';
  photos?: string[];
  fuelLevel?: number;
  odometer?: number;
  at?: string;
  notes?: string;
}

export type LicenseStatus = 'verified' | 'pending' | 'notSubmitted';
export type UserRole = 'user' | 'host' | 'admin';

export interface Kyc {
  licenseNumber?: string;
  frontImage?: string;
  backImage?: string;
}

export interface User {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  role: UserRole;
  licenseStatus: LicenseStatus;
  walletBalance?: number;
  upiId?: string;
  referralCode?: string;
  avatarUrl?: string;
  kyc?: Kyc;
  createdAt?: string;
}

export type ClaimStatus = 'submitted' | 'underReview' | 'resolved';

export interface Claim {
  id: string;
  carName?: string;
  severity?: string;
  description?: string;
  status: ClaimStatus;
  bookingId?: string;
  insurer?: string;
  processingFee?: number;
  photos?: string[];
  createdAt?: string;
}

export interface Offer {
  id: string;
  discountPct?: number;
  title?: string;
  description?: string;
  minFare?: number;
  maxDiscount?: number;
  active?: boolean;
}

export interface Reward {
  id: string;
  title?: string;
  description?: string;
  cost?: number;
  value?: number;
  active?: boolean;
}

export interface Plan {
  id: string;
  name?: string;
  monthlyPrice?: number;
  tagline?: string;
  perks?: string[];
  highlighted?: boolean;
  discountPct?: number;
  loyaltyMultiplier?: number;
  waiveDeposit?: boolean;
}

export interface Subscription {
  planId?: string;
  status?: string;
  startedAt?: string;
  expiresAt?: string;
}

export interface Subscriber {
  id: string;
  name?: string;
  phone?: string;
  subscription?: Subscription;
}

export type PayoutStatus = 'requested' | 'paid' | 'rejected';

export interface Payout {
  id: string;
  hostName?: string;
  host?: Host | string;
  amount?: number;
  upiId?: string;
  status: PayoutStatus;
  createdAt?: string;
  paidAt?: string;
}

export interface Review {
  id?: string;
  carName?: string;
  carId?: string;
  author?: string;
  rating?: number;
  comment?: string;
  date?: string;
}

export interface LoyaltyTier {
  tier: string;
  min: number;
}

export interface AppConfig {
  platformCommissionRate?: number;
  referralReward?: number;
  loyaltyEarnRate?: number;
  loyaltyTiers?: LoyaltyTier[];
}

export interface Maintenance {
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
}

export interface SupportConvo {
  id: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  lastMessage?: string;
  lastAt?: string;
}

export interface SupportMessage {
  id: string;
  text?: string;
  images?: string[];
  fromMe?: boolean;
  time?: string;
}

// Standard envelope: most endpoints return { data: T }.
export interface Envelope<T> {
  data: T;
  message?: string;
}
