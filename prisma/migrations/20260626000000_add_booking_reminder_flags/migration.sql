-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "startReminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "endReminderSent" BOOLEAN NOT NULL DEFAULT false;
