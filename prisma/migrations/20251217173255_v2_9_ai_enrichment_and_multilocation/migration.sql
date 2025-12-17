-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "aiEnrichedAt" TIMESTAMP(3),
ADD COLUMN     "aiOneLiner" VARCHAR(180),
ADD COLUMN     "locationsJson" JSONB,
ADD COLUMN     "primaryLocation" JSONB;

-- CreateTable
CREATE TABLE "AiRunLedger" (
    "id" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "jobsProcessed" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRunLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiRunLedger_day_key" ON "AiRunLedger"("day");

