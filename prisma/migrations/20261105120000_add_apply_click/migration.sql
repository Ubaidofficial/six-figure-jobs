-- CreateTable
CREATE TABLE "ApplyClick" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplyClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplyClick_jobId_createdAt_idx" ON "ApplyClick"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplyClick_createdAt_idx" ON "ApplyClick"("createdAt");
