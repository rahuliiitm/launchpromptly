-- AlterTable
ALTER TABLE "Environment" ADD COLUMN     "evalGateEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EvalResult" ADD COLUMN     "response" TEXT NOT NULL DEFAULT '';
