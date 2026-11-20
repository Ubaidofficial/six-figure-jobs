-- CreateTable
CREATE TABLE "AutoApplyRun" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "filledCount" INTEGER NOT NULL DEFAULT 0,
    "unfilled" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoApplyRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoApplyRun_board_createdAt_idx" ON "AutoApplyRun"("board", "createdAt");

-- CreateIndex
CREATE INDEX "AutoApplyRun_createdAt_idx" ON "AutoApplyRun"("createdAt");

