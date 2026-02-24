-- AlterTable
ALTER TABLE "LLMEvent" ADD COLUMN "traceId" TEXT;
ALTER TABLE "LLMEvent" ADD COLUMN "spanName" TEXT;

-- Backfill: make every existing event its own single-span flow
UPDATE "LLMEvent" SET "traceId" = id WHERE "traceId" IS NULL;

-- CreateIndex
CREATE INDEX "LLMEvent_projectId_traceId_idx" ON "LLMEvent"("projectId", "traceId");
