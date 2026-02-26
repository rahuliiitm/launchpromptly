-- CreateTable
CREATE TABLE "PromptFetchLog" (
    "id" TEXT NOT NULL,
    "managedPromptId" TEXT NOT NULL,
    "promptVersionId" TEXT,
    "environmentId" TEXT,
    "date" DATE NOT NULL,
    "fetchCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PromptFetchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptFetchLog_managedPromptId_date_idx" ON "PromptFetchLog"("managedPromptId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PromptFetchLog_managedPromptId_promptVersionId_environmentI_key" ON "PromptFetchLog"("managedPromptId", "promptVersionId", "environmentId", "date");

-- AddForeignKey
ALTER TABLE "PromptFetchLog" ADD CONSTRAINT "PromptFetchLog_managedPromptId_fkey" FOREIGN KEY ("managedPromptId") REFERENCES "ManagedPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
