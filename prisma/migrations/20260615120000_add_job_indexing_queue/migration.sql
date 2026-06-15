-- CreateTable
CREATE TABLE "JobIndexingQueue" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dedupeKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "googleResponse" TEXT,
    "notBefore" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobIndexingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobIndexingQueue_dedupeKey_key" ON "JobIndexingQueue"("dedupeKey");

-- CreateIndex
CREATE INDEX "JobIndexingQueue_status_idx" ON "JobIndexingQueue"("status");

-- CreateIndex
CREATE INDEX "JobIndexingQueue_notBefore_idx" ON "JobIndexingQueue"("notBefore");

-- CreateIndex
CREATE INDEX "JobIndexingQueue_createdAt_idx" ON "JobIndexingQueue"("createdAt");
