-- CreateEnum
CREATE TYPE "CommunityPostVisibility" AS ENUM ('COMMUNITY');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunityFeedItemType" AS ENUM ('POST', 'ACHIEVEMENT', 'EVENT');

-- CreateEnum
CREATE TYPE "CommunityAchievementType" AS ENUM ('PATH_STAGE_REACHED', 'TRACK_CREATED', 'DEMO_UPLOADED', 'REQUEST_SUBMITTED', 'RELEASE_READY');

-- CreateEnum
CREATE TYPE "CommunityLikeTargetType" AS ENUM ('POST', 'ACHIEVEMENT', 'EVENT');

-- CreateEnum
CREATE TYPE "CommunityEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "addresseeUserId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "visibility" "CommunityPostVisibility" NOT NULL DEFAULT 'COMMUNITY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CommunityAchievementType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "sourceTrackId" TEXT,
    "sourceDemoId" TEXT,
    "sourceRequestId" TEXT,
    "sourcePathStageId" INTEGER,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "city" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "coverImageUrl" TEXT,
    "hostLabel" TEXT NOT NULL,
    "status" "CommunityEventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "CommunityLikeTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedCreator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedCreator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Friendship_requesterUserId_status_updatedAt_idx" ON "Friendship"("requesterUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Friendship_addresseeUserId_status_updatedAt_idx" ON "Friendship"("addresseeUserId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterUserId_addresseeUserId_key" ON "Friendship"("requesterUserId", "addresseeUserId");

-- CreateIndex
CREATE INDEX "CommunityPost_authorUserId_createdAt_idx" ON "CommunityPost"("authorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityAchievement_dedupeKey_key" ON "CommunityAchievement"("dedupeKey");

-- CreateIndex
CREATE INDEX "CommunityAchievement_userId_createdAt_idx" ON "CommunityAchievement"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityAchievement_type_createdAt_idx" ON "CommunityAchievement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityAchievement_sourceTrackId_idx" ON "CommunityAchievement"("sourceTrackId");

-- CreateIndex
CREATE INDEX "CommunityAchievement_sourceDemoId_idx" ON "CommunityAchievement"("sourceDemoId");

-- CreateIndex
CREATE INDEX "CommunityAchievement_sourceRequestId_idx" ON "CommunityAchievement"("sourceRequestId");

-- CreateIndex
CREATE INDEX "CommunityAchievement_sourcePathStageId_idx" ON "CommunityAchievement"("sourcePathStageId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityEvent_slug_key" ON "CommunityEvent"("slug");

-- CreateIndex
CREATE INDEX "CommunityEvent_status_startsAt_idx" ON "CommunityEvent"("status", "startsAt");

-- CreateIndex
CREATE INDEX "CommunityEvent_createdByUserId_createdAt_idx" ON "CommunityEvent"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityLike_targetType_targetId_createdAt_idx" ON "CommunityLike"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityLike_userId_targetType_targetId_key" ON "CommunityLike"("userId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedCreator_userId_key" ON "FeaturedCreator"("userId");

-- CreateIndex
CREATE INDEX "FeaturedCreator_isActive_sortIndex_idx" ON "FeaturedCreator"("isActive", "sortIndex");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeUserId_fkey" FOREIGN KEY ("addresseeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAchievement" ADD CONSTRAINT "CommunityAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAchievement" ADD CONSTRAINT "CommunityAchievement_sourceTrackId_fkey" FOREIGN KEY ("sourceTrackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAchievement" ADD CONSTRAINT "CommunityAchievement_sourceDemoId_fkey" FOREIGN KEY ("sourceDemoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAchievement" ADD CONSTRAINT "CommunityAchievement_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "InAppRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAchievement" ADD CONSTRAINT "CommunityAchievement_sourcePathStageId_fkey" FOREIGN KEY ("sourcePathStageId") REFERENCES "PathStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityLike" ADD CONSTRAINT "CommunityLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedCreator" ADD CONSTRAINT "FeaturedCreator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
