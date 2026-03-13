-- CreateTable
CREATE TABLE "DetectionFeedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guardrailType" TEXT NOT NULL,
    "originalAction" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "notes" TEXT,
    "promptHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DetectionFeedback_eventId_userId_guardrailType_key" ON "DetectionFeedback"("eventId", "userId", "guardrailType");

-- CreateIndex
CREATE INDEX "DetectionFeedback_projectId_guardrailType_idx" ON "DetectionFeedback"("projectId", "guardrailType");

-- CreateIndex
CREATE INDEX "DetectionFeedback_projectId_createdAt_idx" ON "DetectionFeedback"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "DetectionFeedback_eventId_idx" ON "DetectionFeedback"("eventId");

-- AddForeignKey
ALTER TABLE "DetectionFeedback" ADD CONSTRAINT "DetectionFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
