-- AlterTable
ALTER TABLE "LLMEvent" ADD COLUMN     "ragChunkCount" INTEGER,
ADD COLUMN     "ragChunks" JSONB,
ADD COLUMN     "ragContextTokens" INTEGER,
ADD COLUMN     "ragPipelineId" TEXT,
ADD COLUMN     "ragQuery" TEXT,
ADD COLUMN     "ragRetrievalMs" INTEGER;

-- CreateIndex
CREATE INDEX "LLMEvent_projectId_ragPipelineId_idx" ON "LLMEvent"("projectId", "ragPipelineId");
