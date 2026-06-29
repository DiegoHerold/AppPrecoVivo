-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('system', 'light', 'dark');

-- CreateEnum
CREATE TYPE "CameraFacingMode" AS ENUM ('environment', 'user');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "phone" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT;

-- CreateTable
CREATE TABLE "UserSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "theme" "ThemePreference" NOT NULL DEFAULT 'system',
  "cameraFacingMode" "CameraFacingMode" NOT NULL DEFAULT 'environment',
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "monthlySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "priceAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "compactMode" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- Backfill settings for users that existed before this migration.
INSERT INTO "UserSettings" ("id", "userId", "updatedAt")
SELECT 'settings_' || "id", "id", CURRENT_TIMESTAMP FROM "User";

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE UNIQUE INDEX "UploadedFile_storagePath_key" ON "UploadedFile"("storagePath");
CREATE INDEX "UploadedFile_userId_createdAt_idx" ON "UploadedFile"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
