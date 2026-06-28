'use strict';

/**
 * Phone normalization & display formatting for Indian (10-digit) numbers.
 *
 * Canonical stored form is the bare 10-digit number (e.g. "9876543210") so the
 * same subscriber always maps to a single User regardless of how it was typed:
 *   "9876543210", "+91 98765 43210", "+919876543210", "09876543210",
 *   "91-9876543210" -> all normalize to "9876543210".
 *
 * The 10-digit form is what the Flutter app assumes everywhere (the login field
 * accepts 10 digits, the OTP screen renders "+91 <phone>", payments pass it to
 * Razorpay as-is), so we keep storage in that shape and only prettify for
 * display via formatPhone().
 */

/**
 * Reduce any user-entered phone string to its canonical 10-digit form.
 * Returns the cleaned digits as-is when it can't confidently extract 10 digits
 * (so we never silently corrupt unexpected input).
 */
function normalizePhone(raw) {
  let digits = String(raw == null ? '' : raw).replace(/\D/g, '');
  // Drop the +91 / 91 country code when present on a 12-digit string.
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  // Drop a domestic trunk "0" prefix (e.g. "09876543210").
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * Pretty display form "+91 98765 43210". Falls back to a "+91 " prefix on the
 * raw normalized digits when the number isn't a clean 10-digit Indian mobile.
 */
function formatPhone(raw) {
  const d = normalizePhone(raw);
  if (!d) return '';
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return `+91 ${d}`;
}

module.exports = { normalizePhone, formatPhone };
