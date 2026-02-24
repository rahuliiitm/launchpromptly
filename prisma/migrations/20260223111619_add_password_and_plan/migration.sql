-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;
