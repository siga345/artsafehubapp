-- Stage 1 Architecture Reset for ART SAFE PLACE MVP
-- Scope: safe_id, folders, demos in tracks, 9 PATH stages, daily check-in, weekly activity

-- Drop legacy tables
DROP TABLE IF EXISTS "LearningItem" CASCADE;
DROP TABLE IF EXISTS "Booking" CASCADE;
DROP TABLE IF EXISTS "SongBudgetItem" CASCADE;
DROP TABLE IF EXISTS "PathProgressLog" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "SongMember" CASCADE;
DROP TABLE IF EXISTS "AudioClip" CASCADE;
DROP TABLE IF EXISTS "Idea" CASCADE;
DROP TABLE IF EXISTS "Song" CASCADE;
DROP TABLE IF EXISTS "ArtistProfile" CASCADE;
DROP TABLE IF EXISTS "SpecialistProfile" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "PathLevel" CASCADE;

-- Drop legacy enum types
DROP TYPE IF EXISTS "LearningType" CASCADE;
DROP TYPE IF EXISTS "BookingStatus" CASCADE;
DROP TYPE IF EXISTS "BudgetCategory" CASCADE;
DROP TYPE IF EXISTS "PathLogType" CASCADE;
DROP TYPE IF EXISTS "TaskStatus" CASCADE;
DROP TYPE IF EXISTS "SongStatus" CASCADE;
DROP TYPE IF EXISTS "SpecialistType" CASCADE;
DROP TYPE IF EXISTS "AvailabilityStatus" CASCADE;
DROP TYPE IF EXISTS "UserRole" CASCADE;

-- Create new enum types
CREATE TYPE "UserRole" AS ENUM ('ARTIST', 'SPECIALIST', 'STUDIO', 'ADMIN');
CREATE TYPE "FindCategory" AS ENUM ('PRODUCER', 'AUDIO_ENGINEER', 'RECORDING_STUDIO', 'PROMO_CREW');
CREATE TYPE "CheckInMood" AS ENUM ('NORMAL', 'TOUGH', 'FLYING');

-- Create tables
CREATE TABLE "PathStage" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "PathStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "safeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "links" JSONB,
    "role" "UserRole" NOT NULL DEFAULT 'ARTIST',
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "demosPrivate" BOOLEAN NOT NULL DEFAULT true,
    "pathStageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialistProfile" (
    "userId" TEXT NOT NULL,
    "category" "FindCategory" NOT NULL,
    "city" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "isAvailableNow" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "portfolioLinks" TEXT[] NOT NULL,
    "budgetFrom" INTEGER,
    "contactTelegram" TEXT,
    "contactUrl" TEXT,
    CONSTRAINT "SpecialistProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "folderId" TEXT,
    "pathStageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Demo" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "textNote" TEXT,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Demo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood" "CheckInMood" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyMicroStep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pathStageId" INTEGER,
    "text" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "DailyMicroStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeeklyActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyActivity_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PathStage_order_key" ON "PathStage"("order");
CREATE UNIQUE INDEX "PathStage_name_key" ON "PathStage"("name");

CREATE UNIQUE INDEX "User_safeId_key" ON "User"("safeId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "Folder_userId_title_key" ON "Folder"("userId", "title");
CREATE UNIQUE INDEX "DailyCheckIn_userId_date_key" ON "DailyCheckIn"("userId", "date");
CREATE UNIQUE INDEX "DailyMicroStep_userId_date_key" ON "DailyMicroStep"("userId", "date");
CREATE UNIQUE INDEX "WeeklyActivity_userId_weekStartDate_key" ON "WeeklyActivity"("userId", "weekStartDate");

-- Foreign keys
ALTER TABLE "User"
    ADD CONSTRAINT "User_pathStageId_fkey"
    FOREIGN KEY ("pathStageId") REFERENCES "PathStage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecialistProfile"
    ADD CONSTRAINT "SpecialistProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Folder"
    ADD CONSTRAINT "Folder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Track"
    ADD CONSTRAINT "Track_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Track"
    ADD CONSTRAINT "Track_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "Folder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Track"
    ADD CONSTRAINT "Track_pathStageId_fkey"
    FOREIGN KEY ("pathStageId") REFERENCES "PathStage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Demo"
    ADD CONSTRAINT "Demo_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "Track"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyCheckIn"
    ADD CONSTRAINT "DailyCheckIn_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyMicroStep"
    ADD CONSTRAINT "DailyMicroStep_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyMicroStep"
    ADD CONSTRAINT "DailyMicroStep_pathStageId_fkey"
    FOREIGN KEY ("pathStageId") REFERENCES "PathStage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklyActivity"
    ADD CONSTRAINT "WeeklyActivity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
