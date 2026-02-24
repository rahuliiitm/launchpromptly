/*
  Warnings:

  - You are about to drop the column `sourceTemplateId` on the `ManagedPrompt` table. All the data in the column will be lost.
  - You are about to drop the `PromptTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PromptTemplate" DROP CONSTRAINT "PromptTemplate_projectId_fkey";

-- AlterTable
ALTER TABLE "ManagedPrompt" DROP COLUMN "sourceTemplateId";

-- DropTable
DROP TABLE "PromptTemplate";
