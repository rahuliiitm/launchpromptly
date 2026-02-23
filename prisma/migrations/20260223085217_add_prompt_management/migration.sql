-- AlterTable
ALTER TABLE "LLMEvent" ADD COLUMN     "managedPromptId" TEXT,
ADD COLUMN     "promptVersionId" TEXT;

-- CreateTable
CREATE TABLE "ManagedPrompt" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sourceTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "managedPromptId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABTest" (
    "id" TEXT NOT NULL,
    "managedPromptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ABTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABTestVariant" (
    "id" TEXT NOT NULL,
    "abTestId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "trafficPercent" INTEGER NOT NULL,

    CONSTRAINT "ABTestVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagedPrompt_projectId_idx" ON "ManagedPrompt"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedPrompt_projectId_slug_key" ON "ManagedPrompt"("projectId", "slug");

-- CreateIndex
CREATE INDEX "PromptVersion_managedPromptId_status_idx" ON "PromptVersion"("managedPromptId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_managedPromptId_version_key" ON "PromptVersion"("managedPromptId", "version");

-- CreateIndex
CREATE INDEX "ABTest_managedPromptId_status_idx" ON "ABTest"("managedPromptId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ABTestVariant_abTestId_promptVersionId_key" ON "ABTestVariant"("abTestId", "promptVersionId");

-- CreateIndex
CREATE INDEX "LLMEvent_projectId_managedPromptId_idx" ON "LLMEvent"("projectId", "managedPromptId");

-- AddForeignKey
ALTER TABLE "LLMEvent" ADD CONSTRAINT "LLMEvent_managedPromptId_fkey" FOREIGN KEY ("managedPromptId") REFERENCES "ManagedPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMEvent" ADD CONSTRAINT "LLMEvent_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedPrompt" ADD CONSTRAINT "ManagedPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_managedPromptId_fkey" FOREIGN KEY ("managedPromptId") REFERENCES "ManagedPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTest" ADD CONSTRAINT "ABTest_managedPromptId_fkey" FOREIGN KEY ("managedPromptId") REFERENCES "ManagedPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTestVariant" ADD CONSTRAINT "ABTestVariant_abTestId_fkey" FOREIGN KEY ("abTestId") REFERENCES "ABTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTestVariant" ADD CONSTRAINT "ABTestVariant_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
