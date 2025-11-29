-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyLogo" TEXT,
    "locationRaw" TEXT NOT NULL,
    "city" TEXT,
    "citySlug" TEXT,
    "countryCode" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "remoteRegion" TEXT,
    "salaryRaw" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "salaryPeriod" TEXT,
    "isHundredKLocal" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "source" TEXT NOT NULL,
    "applyUrl" TEXT,
    "url" TEXT,
    "roleSlug" TEXT,
    "skillsJson" TEXT,
    "requirementsJson" TEXT,
    "benefitsJson" TEXT,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobSlice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "filtersJson" TEXT,
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "JobSlice_slug_key" ON "JobSlice"("slug");
