-- DropForeignKey
ALTER TABLE "ABTest" DROP CONSTRAINT "ABTest_managedPromptId_fkey";

-- DropForeignKey
ALTER TABLE "ABTestVariant" DROP CONSTRAINT "ABTestVariant_abTestId_fkey";

-- DropForeignKey
ALTER TABLE "ABTestVariant" DROP CONSTRAINT "ABTestVariant_promptVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ConsentRecord" DROP CONSTRAINT "ConsentRecord_projectId_fkey";

-- DropForeignKey
ALTER TABLE "EvalCase" DROP CONSTRAINT "EvalCase_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "EvalDataset" DROP CONSTRAINT "EvalDataset_managedPromptId_fkey";

-- DropForeignKey
ALTER TABLE "EvalResult" DROP CONSTRAINT "EvalResult_evalCaseId_fkey";

-- DropForeignKey
ALTER TABLE "EvalResult" DROP CONSTRAINT "EvalResult_evalRunId_fkey";

-- DropForeignKey
ALTER TABLE "EvalRun" DROP CONSTRAINT "EvalRun_datasetId_fkey";

-- DropForeignKey
ALTER TABLE "EvalRun" DROP CONSTRAINT "EvalRun_promptVersionId_fkey";

-- DropForeignKey
ALTER TABLE "LLMEvent" DROP CONSTRAINT "LLMEvent_managedPromptId_fkey";

-- DropForeignKey
ALTER TABLE "LLMEvent" DROP CONSTRAINT "LLMEvent_promptVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ManagedPrompt" DROP CONSTRAINT "ManagedPrompt_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ManagedPrompt" DROP CONSTRAINT "ManagedPrompt_teamId_fkey";

-- DropForeignKey
ALTER TABLE "PromptDeployment" DROP CONSTRAINT "PromptDeployment_environmentId_fkey";

-- DropForeignKey
ALTER TABLE "PromptDeployment" DROP CONSTRAINT "PromptDeployment_managedPromptId_fkey";

-- DropForeignKey
ALTER TABLE "PromptDeployment" DROP CONSTRAINT "PromptDeployment_promptVersionId_fkey";

-- DropForeignKey
ALTER TABLE "PromptFetchLog" DROP CONSTRAINT "PromptFetchLog_managedPromptId_fkey";

-- DropForeignKey
ALTER TABLE "PromptVersion" DROP CONSTRAINT "PromptVersion_managedPromptId_fkey";

-- DropForeignKey
ALTER TABLE "RagEvaluation" DROP CONSTRAINT "RagEvaluation_eventId_fkey";

-- DropForeignKey
ALTER TABLE "SecurityIncident" DROP CONSTRAINT "SecurityIncident_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_userId_fkey";

-- DropIndex
DROP INDEX "LLMEvent_projectId_environmentId_managedPromptId_idx";

-- DropIndex
DROP INDEX "LLMEvent_projectId_managedPromptId_idx";

-- DropIndex
DROP INDEX "LLMEvent_projectId_ragPipelineId_idx";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "hash",
DROP COLUMN "prevHash";

-- AlterTable
ALTER TABLE "Environment" DROP COLUMN "evalGateEnabled";

-- AlterTable
ALTER TABLE "LLMEvent" DROP COLUMN "encRagQuery",
DROP COLUMN "managedPromptId",
DROP COLUMN "promptVersionId",
DROP COLUMN "ragChunkCount",
DROP COLUMN "ragChunks",
DROP COLUMN "ragContextTokens",
DROP COLUMN "ragPipelineId",
DROP COLUMN "ragQuery",
DROP COLUMN "ragRetrievalMs";

-- DropTable
DROP TABLE "ABTest";

-- DropTable
DROP TABLE "ABTestVariant";

-- DropTable
DROP TABLE "ConsentRecord";

-- DropTable
DROP TABLE "EvalCase";

-- DropTable
DROP TABLE "EvalDataset";

-- DropTable
DROP TABLE "EvalResult";

-- DropTable
DROP TABLE "EvalRun";

-- DropTable
DROP TABLE "ManagedPrompt";

-- DropTable
DROP TABLE "PromptDeployment";

-- DropTable
DROP TABLE "PromptFetchLog";

-- DropTable
DROP TABLE "PromptVersion";

-- DropTable
DROP TABLE "RagEvaluation";

-- DropTable
DROP TABLE "SecurityIncident";

-- DropTable
DROP TABLE "Team";

-- DropTable
DROP TABLE "TeamMember";
