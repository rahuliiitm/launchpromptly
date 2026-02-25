-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "environmentId" TEXT;

-- AlterTable
ALTER TABLE "LLMEvent" ADD COLUMN     "environmentId" TEXT;

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptDeployment" (
    "id" TEXT NOT NULL,
    "managedPromptId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedBy" TEXT,

    CONSTRAINT "PromptDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Environment_projectId_idx" ON "Environment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_projectId_slug_key" ON "Environment"("projectId", "slug");

-- CreateIndex
CREATE INDEX "PromptDeployment_environmentId_idx" ON "PromptDeployment"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptDeployment_managedPromptId_environmentId_key" ON "PromptDeployment"("managedPromptId", "environmentId");

-- CreateIndex
CREATE INDEX "LLMEvent_projectId_environmentId_managedPromptId_idx" ON "LLMEvent"("projectId", "environmentId", "managedPromptId");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptDeployment" ADD CONSTRAINT "PromptDeployment_managedPromptId_fkey" FOREIGN KEY ("managedPromptId") REFERENCES "ManagedPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptDeployment" ADD CONSTRAINT "PromptDeployment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptDeployment" ADD CONSTRAINT "PromptDeployment_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
