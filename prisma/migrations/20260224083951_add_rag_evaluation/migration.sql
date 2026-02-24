-- AlterTable
ALTER TABLE "LLMEvent" ADD COLUMN     "responseText" TEXT;

-- CreateTable
CREATE TABLE "RagEvaluation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "faithfulnessScore" DOUBLE PRECISION,
    "faithfulnessReasoning" TEXT,
    "relevanceScore" DOUBLE PRECISION,
    "relevanceReasoning" TEXT,
    "contextRelevanceScore" DOUBLE PRECISION,
    "contextRelevanceReasoning" TEXT,
    "chunkRelevanceScores" JSONB,
    "evaluationModel" TEXT NOT NULL,
    "evaluationCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RagEvaluation_eventId_key" ON "RagEvaluation"("eventId");

-- AddForeignKey
ALTER TABLE "RagEvaluation" ADD CONSTRAINT "RagEvaluation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "LLMEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
