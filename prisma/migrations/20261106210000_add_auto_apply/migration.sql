-- CreateTable
CREATE TABLE "ApplyProfile" (
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "linkedin" TEXT,
    "website" TEXT,
    "github" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplyProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AutoApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobSlug" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "ghJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "plan" JSONB NOT NULL,
    "planHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "reason" TEXT,
    "evidence" TEXT,
    "charge" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoApplication_userId_createdAt_idx" ON "AutoApplication"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoApplication_status_idx" ON "AutoApplication"("status");

-- AddForeignKey
ALTER TABLE "ApplyProfile" ADD CONSTRAINT "ApplyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoApplication" ADD CONSTRAINT "AutoApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
