'use strict';

// One-time backfill: recompute every host's rating from the reviews pooled
// across all their cars, and write it onto each car's embedded `host` object.
// Mirrors recomputeHostRating() in carController.js so existing data reflects
// the "host rating = average of the host's car reviews" rule without waiting
// for a new review.
//
//   node src/scripts/backfill-host-ratings.js

const prisma = require('../db/prisma');

async function main() {
  const cars = await prisma.car.findMany({
    where: { ownerId: { not: null } },
    select: { id: true, ownerId: true, host: true },
  });

  // Group cars by owner.
  const byOwner = new Map();
  for (const c of cars) {
    if (!byOwner.has(c.ownerId)) byOwner.set(c.ownerId, []);
    byOwner.get(c.ownerId).push(c);
  }

  let hostsUpdated = 0;
  let carsUpdated = 0;

  for (const [ownerId, ownerCars] of byOwner) {
    const carIds = ownerCars.map((c) => c.id);
    const reviews = await prisma.review.findMany({ where: { carId: { in: carIds } } });
    if (!reviews.length) continue;
    const avg = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;

    await Promise.all(
      ownerCars.map((c) =>
        prisma.car.update({
          where: { id: c.id },
          data: { host: { ...(c.host || {}), rating: avg } },
        }),
      ),
    );
    hostsUpdated += 1;
    carsUpdated += ownerCars.length;
    console.log(`  host ${ownerId}: ${reviews.length} reviews → rating ${avg} (${ownerCars.length} cars)`);
  }

  console.log(`\nDone. Updated ${hostsUpdated} host(s) across ${carsUpdated} car(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
