-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "avgInputTokens" INTEGER NOT NULL,
    "avgOutputTokens" INTEGER NOT NULL,
    "requestsPerUser" INTEGER NOT NULL,
    "projectedUsers" INTEGER NOT NULL,
    "subscriptionPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_scenarioId_idx" ON "Snapshot"("scenarioId");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
