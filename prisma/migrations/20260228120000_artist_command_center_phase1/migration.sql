-- CreateEnum
CREATE TYPE "ArtistGoalType" AS ENUM ('ALBUM_RELEASE', 'MINI_TOUR', 'FESTIVAL_RUN', 'SOLO_SHOW', 'MERCH_DROP', 'CUSTOM_CAREER');

-- CreateEnum
CREATE TYPE "ArtistGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GoalFactor" AS ENUM ('DIRECTION', 'ARTIST_WORLD', 'CATALOG', 'AUDIENCE', 'LIVE', 'TEAM', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "GoalTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskOwnerType" AS ENUM ('SELF', 'TEAM', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "DailyFocusSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "ArtistIdentityProfile" (
    "userId" TEXT NOT NULL,
    "identityStatement" TEXT,
    "mission" TEXT,
    "philosophy" TEXT,
    "coreThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aestheticKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visualDirection" TEXT,
    "audienceCore" TEXT,
    "differentiator" TEXT,
    "fashionSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistIdentityProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ArtistGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ArtistGoalType" NOT NULL,
    "title" TEXT NOT NULL,
    "whyNow" TEXT,
    "successDefinition" TEXT,
    "targetDate" DATE,
    "status" "ArtistGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdFromPathStageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalPillar" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "factor" "GoalFactor" NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GoalPillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalTask" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "GoalTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerType" "TaskOwnerType" NOT NULL DEFAULT 'SELF',
    "dueDate" DATE,
    "linkedTrackId" TEXT,
    "linkedProjectId" TEXT,
    "linkedSpecialistCategory" "FindCategory",
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GoalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyFocus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "goalId" TEXT NOT NULL,
    "goalTaskId" TEXT NOT NULL,
    "source" "DailyFocusSource" NOT NULL DEFAULT 'AUTO',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DailyFocus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistGoal_userId_status_updatedAt_idx" ON "ArtistGoal"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ArtistGoal_userId_isPrimary_idx" ON "ArtistGoal"("userId", "isPrimary");

-- CreateIndex
CREATE INDEX "ArtistGoal_createdFromPathStageId_idx" ON "ArtistGoal"("createdFromPathStageId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalPillar_goalId_factor_key" ON "GoalPillar"("goalId", "factor");

-- CreateIndex
CREATE INDEX "GoalPillar_goalId_sortIndex_idx" ON "GoalPillar"("goalId", "sortIndex");

-- CreateIndex
CREATE INDEX "GoalTask_pillarId_status_sortIndex_idx" ON "GoalTask"("pillarId", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "GoalTask_linkedTrackId_idx" ON "GoalTask"("linkedTrackId");

-- CreateIndex
CREATE INDEX "GoalTask_linkedProjectId_idx" ON "GoalTask"("linkedProjectId");

-- CreateIndex
CREATE INDEX "GoalTask_linkedSpecialistCategory_idx" ON "GoalTask"("linkedSpecialistCategory");

-- CreateIndex
CREATE UNIQUE INDEX "DailyFocus_userId_date_key" ON "DailyFocus"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyFocus_goalTaskId_date_idx" ON "DailyFocus"("goalTaskId", "date");

-- CreateIndex
CREATE INDEX "DailyFocus_goalId_date_idx" ON "DailyFocus"("goalId", "date");

-- AddForeignKey
ALTER TABLE "ArtistIdentityProfile" ADD CONSTRAINT "ArtistIdentityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistGoal" ADD CONSTRAINT "ArtistGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistGoal" ADD CONSTRAINT "ArtistGoal_createdFromPathStageId_fkey" FOREIGN KEY ("createdFromPathStageId") REFERENCES "PathStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPillar" ADD CONSTRAINT "GoalPillar_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "ArtistGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTask" ADD CONSTRAINT "GoalTask_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "GoalPillar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTask" ADD CONSTRAINT "GoalTask_linkedTrackId_fkey" FOREIGN KEY ("linkedTrackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalTask" ADD CONSTRAINT "GoalTask_linkedProjectId_fkey" FOREIGN KEY ("linkedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyFocus" ADD CONSTRAINT "DailyFocus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyFocus" ADD CONSTRAINT "DailyFocus_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "ArtistGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyFocus" ADD CONSTRAINT "DailyFocus_goalTaskId_fkey" FOREIGN KEY ("goalTaskId") REFERENCES "GoalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
