-- CreateEnum
CREATE TYPE "TrackWorkbenchState" AS ENUM ('IN_PROGRESS', 'STUCK', 'NEEDS_FEEDBACK', 'DEFERRED', 'READY_FOR_NEXT_STEP');

-- CreateEnum
CREATE TYPE "NextStepStatus" AS ENUM ('ACTIVE', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "NextStepSource" AS ENUM ('MANUAL', 'MORNING_FOCUS', 'WRAP_UP');

-- AlterTable
ALTER TABLE "Track"
ADD COLUMN "workbenchState" "TrackWorkbenchState" NOT NULL DEFAULT 'IN_PROGRESS';

-- CreateTable
CREATE TABLE "TrackIntent" (
    "trackId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "whyNow" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackIntent_pkey" PRIMARY KEY ("trackId")
);

-- CreateTable
CREATE TABLE "VersionReflection" (
    "demoId" TEXT NOT NULL,
    "whyMade" TEXT,
    "whatChanged" TEXT,
    "whatNotWorking" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VersionReflection_pkey" PRIMARY KEY ("demoId")
);

-- CreateTable
CREATE TABLE "TrackNextStep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" "NextStepStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "NextStepSource" NOT NULL DEFAULT 'MANUAL',
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackNextStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTrackFocus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trackId" TEXT NOT NULL,
    "nextStepId" TEXT,
    "focusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTrackFocus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWrapUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trackId" TEXT NOT NULL,
    "focusId" TEXT,
    "nextStepId" TEXT NOT NULL,
    "endState" "TrackWorkbenchState" NOT NULL,
    "whatChanged" TEXT NOT NULL,
    "whatNotWorking" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWrapUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyTrackFocus_userId_date_key" ON "DailyTrackFocus"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyTrackFocus_trackId_date_idx" ON "DailyTrackFocus"("trackId", "date");

-- CreateIndex
CREATE INDEX "DailyTrackFocus_nextStepId_idx" ON "DailyTrackFocus"("nextStepId");

-- CreateIndex
CREATE INDEX "TrackNextStep_trackId_status_updatedAt_idx" ON "TrackNextStep"("trackId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "TrackNextStep_userId_updatedAt_idx" ON "TrackNextStep"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrackNextStep_active_track_unique_idx"
ON "TrackNextStep"("trackId")
WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE UNIQUE INDEX "DailyWrapUp_userId_date_key" ON "DailyWrapUp"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWrapUp_focusId_key" ON "DailyWrapUp"("focusId");

-- CreateIndex
CREATE INDEX "DailyWrapUp_trackId_date_idx" ON "DailyWrapUp"("trackId", "date");

-- CreateIndex
CREATE INDEX "DailyWrapUp_focusId_idx" ON "DailyWrapUp"("focusId");

-- CreateIndex
CREATE INDEX "DailyWrapUp_nextStepId_idx" ON "DailyWrapUp"("nextStepId");

-- AddForeignKey
ALTER TABLE "TrackIntent"
ADD CONSTRAINT "TrackIntent_trackId_fkey"
FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionReflection"
ADD CONSTRAINT "VersionReflection_demoId_fkey"
FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackNextStep"
ADD CONSTRAINT "TrackNextStep_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackNextStep"
ADD CONSTRAINT "TrackNextStep_trackId_fkey"
FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTrackFocus"
ADD CONSTRAINT "DailyTrackFocus_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTrackFocus"
ADD CONSTRAINT "DailyTrackFocus_trackId_fkey"
FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTrackFocus"
ADD CONSTRAINT "DailyTrackFocus_nextStepId_fkey"
FOREIGN KEY ("nextStepId") REFERENCES "TrackNextStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWrapUp"
ADD CONSTRAINT "DailyWrapUp_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWrapUp"
ADD CONSTRAINT "DailyWrapUp_trackId_fkey"
FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWrapUp"
ADD CONSTRAINT "DailyWrapUp_focusId_fkey"
FOREIGN KEY ("focusId") REFERENCES "DailyTrackFocus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWrapUp"
ADD CONSTRAINT "DailyWrapUp_nextStepId_fkey"
FOREIGN KEY ("nextStepId") REFERENCES "TrackNextStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
