-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "lsCustomerId" TEXT,
ADD COLUMN     "lsSubscriptionId" TEXT,
ADD COLUMN     "lsSubscriptionStatus" TEXT,
ADD COLUMN     "lsVariantId" TEXT,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3);
