-- DropForeignKey
ALTER TABLE "Snapshot" DROP CONSTRAINT IF EXISTS "Snapshot_scenarioId_fkey";

-- DropForeignKey
ALTER TABLE "Scenario" DROP CONSTRAINT IF EXISTS "Scenario_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Snapshot";

-- DropTable
DROP TABLE IF EXISTS "Scenario";
