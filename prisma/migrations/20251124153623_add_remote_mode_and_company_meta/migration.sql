-- AlterTable
ALTER TABLE "Company" ADD COLUMN "fundingSummary" TEXT;
ALTER TABLE "Company" ADD COLUMN "sizeBucket" TEXT;
ALTER TABLE "Company" ADD COLUMN "tagsJson" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "remoteMode" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Skill" ("createdAt", "id", "name", "slug", "updatedAt") SELECT "createdAt", "id", "name", "slug", "updatedAt" FROM "Skill";
DROP TABLE "Skill";
ALTER TABLE "new_Skill" RENAME TO "Skill";
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Company_sizeBucket_idx" ON "Company"("sizeBucket");

-- CreateIndex
CREATE INDEX "Job_remoteMode_idx" ON "Job"("remoteMode");
