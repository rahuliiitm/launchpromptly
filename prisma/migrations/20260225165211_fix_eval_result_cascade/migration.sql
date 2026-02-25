-- DropForeignKey
ALTER TABLE "EvalResult" DROP CONSTRAINT "EvalResult_evalCaseId_fkey";

-- AddForeignKey
ALTER TABLE "EvalResult" ADD CONSTRAINT "EvalResult_evalCaseId_fkey" FOREIGN KEY ("evalCaseId") REFERENCES "EvalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
