-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "requiresClearance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viaRecruiter" BOOLEAN NOT NULL DEFAULT false;

