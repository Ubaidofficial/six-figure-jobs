-- CreateTable
CREATE TABLE "QualitySnapshot" (
    "id" TEXT NOT NULL,
    "capturedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "checks" JSONB NOT NULL,

    CONSTRAINT "QualitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityFinding" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "sample" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "prUrl" TEXT,
    "note" TEXT,
    "firstSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "QualityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualitySnapshot_capturedAt_idx" ON "QualitySnapshot"("capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QualityFinding_key_key" ON "QualityFinding"("key");

-- CreateIndex
CREATE INDEX "QualityFinding_status_area_idx" ON "QualityFinding"("status", "area");

