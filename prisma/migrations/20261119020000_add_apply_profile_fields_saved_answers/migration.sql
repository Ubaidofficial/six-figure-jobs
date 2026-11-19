-- AlterTable
ALTER TABLE "ApplyProfile" ADD COLUMN     "currentCompany" TEXT,
ADD COLUMN     "currentTitle" TEXT,
ADD COLUMN     "languages" TEXT,
ADD COLUMN     "noticePeriod" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "salaryExpectation" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "SavedAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedAnswer_userId_idx" ON "SavedAnswer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAnswer_userId_questionKey_type_key" ON "SavedAnswer"("userId", "questionKey", "type");

-- AddForeignKey
ALTER TABLE "SavedAnswer" ADD CONSTRAINT "SavedAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

