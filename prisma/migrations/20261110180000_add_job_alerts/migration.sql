-- Email job alerts: saved searches mailed daily or weekly (lib/alerts), and the jobs each alert has already sent.
-- Two new tables; no existing table changes.
-- CreateTable
CREATE TABLE "JobAlert" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "filtersKey" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAlertSent" (
    "alertId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAlertSent_pkey" PRIMARY KEY ("alertId","jobId")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobAlert_token_key" ON "JobAlert"("token");

-- CreateIndex
CREATE INDEX "JobAlert_status_lastSentAt_idx" ON "JobAlert"("status", "lastSentAt");

-- CreateIndex
CREATE INDEX "JobAlert_email_createdAt_idx" ON "JobAlert"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobAlert_email_filtersKey_key" ON "JobAlert"("email", "filtersKey");

-- CreateIndex
CREATE INDEX "JobAlertSent_sentAt_idx" ON "JobAlertSent"("sentAt");

-- AddForeignKey
ALTER TABLE "JobAlertSent" ADD CONSTRAINT "JobAlertSent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "JobAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

