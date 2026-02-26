/*
  Warnings:

  - Made the column `promptVersionId` on table `PromptFetchLog` required. This step will fail if there are existing NULL values in that column.
  - Made the column `environmentId` on table `PromptFetchLog` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PromptFetchLog" ALTER COLUMN "promptVersionId" SET NOT NULL,
ALTER COLUMN "promptVersionId" SET DEFAULT '',
ALTER COLUMN "environmentId" SET NOT NULL,
ALTER COLUMN "environmentId" SET DEFAULT '';
