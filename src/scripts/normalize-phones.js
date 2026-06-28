'use strict';

/**
 * One-off migration: normalize every User.phone to its canonical 10-digit form
 * and MERGE accounts that collapse to the same number (the exact problem where
 * "9876543210" and "+919876543210" showed up as two separate users).
 *
 * For each duplicate group one "primary" user is kept (richest profile, then
 * oldest) and every reference in other tables is repointed to it; the
 * loser accounts' wallet balance and loyalty points are folded into the primary
 * before the losers are deleted.
 *
 * Safe by default: runs as a DRY RUN and only prints what it would do. Pass
 * --apply to actually write.
 *
 *   node src/scripts/normalize-phones.js          # preview
 *   node src/scripts/normalize-phones.js --apply   # execute
 */

const prisma = require('../db/prisma');
const { normalizePhone } = require('../utils/phone');

const APPLY = process.argv.includes('--apply');

// (model accessor, label, field) triples that hold a single user id.
const SINGLE_REFS = [
  [prisma.booking, 'Booking', 'user'],
  [prisma.payout, 'Payout', 'host'],
  [prisma.notification, 'Notification', 'user'],
  [prisma.damageClaim, 'DamageClaim', 'user'],
  [prisma.rewardCredit, 'RewardCredit', 'user'],
  [prisma.walletTransaction, 'WalletTransaction', 'user'],
  [prisma.car, 'Car', 'ownerId'],
  [prisma.payment, 'Payment', 'user'],
  [prisma.inspection, 'Inspection', 'user'],
  [prisma.referral, 'Referral', 'referrer'],
  [prisma.referral, 'Referral', 'referee'],
  [prisma.message, 'Message', 'sender'],
];

/** Higher score = better candidate to keep as the surviving account. */
function score(u) {
  let s = 0;
  if ((u.name || '').trim()) s += 4;
  if ((u.email || '').trim()) s += 2;
  if (u.role === 'host' || u.role === 'admin') s += 8;
  if (u.subscription && u.subscription.status === 'active') s += 4;
  if (u.walletBalance > 0) s += 1;
  return s;
}

/** Pick the primary: best score, then oldest createdAt. */
function pickPrimary(users) {
  return [...users].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return new Date(a.createdAt) - new Date(b.createdAt);
  })[0];
}

/** Repoint every reference from `fromId` to `toId` across all tables. */
async function repointRefs(fromId, toId) {
  for (const [model, label, field] of SINGLE_REFS) {
    const r = await model.updateMany({
      where: { [field]: fromId },
      data: { [field]: toId },
    });
    const n = r.count ?? 0;
    if (n) console.log(`      • ${label}.${field}: ${n}`);
  }
  // Conversation participants is an array of user ids.
  const convs = await prisma.conversation.findMany({ where: { participants: { has: fromId } } });
  for (const c of convs) {
    const participants = [...new Set(c.participants.map((p) => (p === fromId ? toId : p)))];
    await prisma.conversation.update({ where: { id: c.id }, data: { participants } });
  }
  if (convs.length) console.log(`      • Conversation.participants: ${convs.length}`);
}

/** Fold the loser's loyalty (unique-per-user) into the primary's. */
async function mergeLoyalty(fromId, toId) {
  const loserLoy = await prisma.loyalty.findUnique({ where: { user: fromId } });
  if (!loserLoy) return;
  const primaryLoy = await prisma.loyalty.findUnique({ where: { user: toId } });
  if (!primaryLoy) {
    // No clash — just hand the record over to the primary.
    await prisma.loyalty.update({ where: { id: loserLoy.id }, data: { user: toId } });
    console.log('      • Loyalty: reassigned');
    return;
  }
  await prisma.loyalty.update({
    where: { id: primaryLoy.id },
    data: {
      points: primaryLoy.points + loserLoy.points,
      history: [...(primaryLoy.history || []), ...(loserLoy.history || [])],
    },
  });
  await prisma.loyalty.delete({ where: { id: loserLoy.id } });
  console.log(`      • Loyalty: merged ${loserLoy.points} pts`);
}

async function main() {
  console.log(`\n=== normalize-phones (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`);

  const users = await prisma.user.findMany();
  const groups = new Map(); // normalized phone -> users[]
  for (const u of users) {
    const norm = normalizePhone(u.phone);
    if (!groups.has(norm)) groups.set(norm, []);
    groups.get(norm).push(u);
  }

  let renamed = 0;
  let merged = 0;

  for (const [norm, group] of groups) {
    if (group.length === 1) {
      const u = group[0];
      if (u.phone !== norm) {
        console.log(`RENAME  ${u.id}: "${u.phone}" -> "${norm}"`);
        renamed++;
        if (APPLY) await prisma.user.update({ where: { id: u.id }, data: { phone: norm } });
      }
      continue;
    }

    // Duplicate group — merge into one primary.
    const primary = pickPrimary(group);
    const losers = group.filter((u) => u.id !== primary.id);
    console.log(`MERGE   ${norm}: keep ${primary.id} ("${primary.name || '—'}"), merge ${losers.map((l) => l.id).join(', ')}`);
    merged += losers.length;

    if (APPLY) {
      let walletBalance = primary.walletBalance || 0;
      let name = primary.name;
      let email = primary.email;
      let avatarUrl = primary.avatarUrl;
      for (const loser of losers) {
        console.log(`    repointing ${loser.id} -> ${primary.id}`);
        await repointRefs(loser.id, primary.id);
        await mergeLoyalty(loser.id, primary.id);
        walletBalance += (loser.walletBalance || 0);
        // Backfill empty primary fields from the loser so we don't lose data.
        if (!(name || '').trim() && (loser.name || '').trim()) name = loser.name;
        if (!(email || '').trim() && (loser.email || '').trim()) email = loser.email;
        if (!(avatarUrl || '').trim() && (loser.avatarUrl || '').trim()) avatarUrl = loser.avatarUrl;
        await prisma.user.delete({ where: { id: loser.id } });
      }
      await prisma.user.update({
        where: { id: primary.id },
        data: { phone: norm, walletBalance, name, email, avatarUrl },
      });
    }
  }

  console.log(`\nDone. ${renamed} renamed, ${merged} merged.${APPLY ? '' : '  (dry run — re-run with --apply)'}\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
