-- CreateTable
CREATE TABLE "JobLifecycle" (
    "jobId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyId" TEXT,
    "roleSlug" TEXT,
    "countryCode" TEXT,
    "currency" TEXT,
    "firstSeenAt" TIMESTAMPTZ(6) NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "lastObservedLiveAt" TIMESTAMPTZ(6) NOT NULL,
    "expiredObservedAt" TIMESTAMPTZ(6),
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "lastMinAnnual" BIGINT,
    "lastMaxAnnual" BIGINT,
    "payChangeCount" INTEGER NOT NULL DEFAULT 0,
    "payHistory" JSONB,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLifecycle_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "JobEvidence" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "extractor" TEXT NOT NULL,
    "extractorVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "jobs" INTEGER NOT NULL,
    "companies" INTEGER NOT NULL,
    "p25" INTEGER NOT NULL,
    "median" INTEGER NOT NULL,
    "p75" INTEGER NOT NULL,
    "newJobs7d" INTEGER NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataScorecard" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "DataScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplyClickWeekly" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "jobs" INTEGER NOT NULL,
    "mobile" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplyClickWeekly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobLifecycle_source_idx" ON "JobLifecycle"("source");

-- CreateIndex
CREATE INDEX "JobLifecycle_expiredObservedAt_idx" ON "JobLifecycle"("expiredObservedAt");

-- CreateIndex
CREATE INDEX "JobLifecycle_roleSlug_countryCode_idx" ON "JobLifecycle"("roleSlug", "countryCode");

-- CreateIndex
CREATE INDEX "JobEvidence_field_value_idx" ON "JobEvidence"("field", "value");

-- CreateIndex
CREATE UNIQUE INDEX "JobEvidence_jobId_field_value_key" ON "JobEvidence"("jobId", "field", "value");

-- CreateIndex
CREATE INDEX "MarketSnapshot_dimension_key_currency_snapshotDate_idx" ON "MarketSnapshot"("dimension", "key", "currency", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSnapshot_snapshotDate_dimension_key_currency_key" ON "MarketSnapshot"("snapshotDate", "dimension", "key", "currency");

-- CreateIndex
CREATE INDEX "DataScorecard_capturedAt_idx" ON "DataScorecard"("capturedAt");

-- CreateIndex
CREATE INDEX "ApplyClickWeekly_dimension_key_weekStart_idx" ON "ApplyClickWeekly"("dimension", "key", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "ApplyClickWeekly_weekStart_dimension_key_key" ON "ApplyClickWeekly"("weekStart", "dimension", "key");

