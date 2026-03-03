-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LLMEvent" ADD COLUMN     "encAuthTag" TEXT,
ADD COLUMN     "encIv" TEXT,
ADD COLUMN     "encPromptPreview" TEXT,
ADD COLUMN     "encRagQuery" TEXT,
ADD COLUMN     "encResponseText" TEXT,
ADD COLUMN     "injectionAction" TEXT,
ADD COLUMN     "injectionRiskScore" DOUBLE PRECISION,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "piiDetectionCount" INTEGER,
ADD COLUMN     "piiTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "redactionApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "securityMetadata" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "retentionDays" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "details" JSONB NOT NULL,
    "eventId" TEXT,
    "customerId" TEXT,
    "actorId" TEXT,
    "hash" TEXT,
    "prevHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPolicy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'llm_processing',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'webhook',
    "webhookUrl" TEXT,
    "email" TEXT,
    "throttleMinutes" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'auto',
    "metadata" JSONB,
    "assigneeId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_eventType_idx" ON "AuditLog"("projectId", "eventType");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_severity_idx" ON "AuditLog"("projectId", "severity");

-- CreateIndex
CREATE INDEX "SecurityPolicy_projectId_isActive_idx" ON "SecurityPolicy"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityPolicy_projectId_name_key" ON "SecurityPolicy"("projectId", "name");

-- CreateIndex
CREATE INDEX "ConsentRecord_projectId_customerId_idx" ON "ConsentRecord"("projectId", "customerId");

-- CreateIndex
CREATE INDEX "ConsentRecord_projectId_customerId_revokedAt_idx" ON "ConsentRecord"("projectId", "customerId", "revokedAt");

-- CreateIndex
CREATE INDEX "AlertRule_projectId_enabled_idx" ON "AlertRule"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "SecurityIncident_projectId_status_idx" ON "SecurityIncident"("projectId", "status");

-- CreateIndex
CREATE INDEX "SecurityIncident_projectId_severity_idx" ON "SecurityIncident"("projectId", "severity");

-- CreateIndex
CREATE INDEX "SecurityIncident_projectId_createdAt_idx" ON "SecurityIncident"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "LLMEvent_projectId_injectionRiskScore_idx" ON "LLMEvent"("projectId", "injectionRiskScore");

-- CreateIndex
CREATE INDEX "LLMEvent_projectId_redactionApplied_idx" ON "LLMEvent"("projectId", "redactionApplied");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityPolicy" ADD CONSTRAINT "SecurityPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityIncident" ADD CONSTRAINT "SecurityIncident_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
