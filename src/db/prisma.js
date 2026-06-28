'use strict';

const { PrismaClient } = require('@prisma/client');
const { genId, genBookingId } = require('../utils/id');

/**
 * Map of Prisma model name -> id prefix, mirroring the old Mongoose
 * `_id: () => genId('<prefix>')` defaults. Models that supply their own human
 * ids on create (PromoCode, SubscriptionPlan, RedeemOption, Setting) are absent
 * here and just pass `id` explicitly.
 */
const ID_PREFIX = {
  User: 'user',
  Car: 'car',
  Payment: 'pmt',
  DamageClaim: 'clm',
  Conversation: 'conv',
  Message: 'msg',
  Inspection: 'insp',
  Loyalty: 'loy',
  Notification: 'ntf',
  Otp: 'otp',
  Payout: 'pay',
  Referral: 'refl',
  Review: 'rev',
  RewardCredit: 'rc',
  WalletTransaction: 'wtx',
};

/** Generate the right id for a model (Booking has its own "BK…" format). */
function newId(model) {
  if (model === 'Booking') return genBookingId();
  if (ID_PREFIX[model]) return genId(ID_PREFIX[model]);
  return undefined; // caller supplies the id (PromoCode/Plan/RedeemOption/Setting)
}

const base = new PrismaClient();

/**
 * Client extension that assigns a string id on create/createMany when the
 * caller didn't provide one — so controllers keep calling `prisma.x.create({
 * data: {...} })` exactly like the old `Model.create({...})`.
 */
const prisma = base.$extends({
  query: {
    $allModels: {
      create({ model, args, query }) {
        if (args.data && args.data.id == null) {
          const id = newId(model);
          if (id) args.data.id = id;
        }
        return query(args);
      },
      createMany({ model, args, query }) {
        const fill = (row) => {
          if (row && row.id == null) {
            const id = newId(model);
            if (id) row.id = id;
          }
          return row;
        };
        if (Array.isArray(args.data)) args.data = args.data.map(fill);
        else fill(args.data);
        return query(args);
      },
    },
  },
});

module.exports = prisma;
module.exports.raw = base;
