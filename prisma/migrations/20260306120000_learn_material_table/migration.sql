-- CreateEnum
CREATE TYPE "LearnMaterialType" AS ENUM ('VIDEO', 'ARTICLE');

-- CreateEnum
CREATE TYPE "LearnProvider" AS ENUM ('YOUTUBE', 'VIMEO', 'WEB');

-- CreateEnum
CREATE TYPE "LearnProblemType" AS ENUM ('DIRECTION', 'MOMENTUM', 'FEEDBACK', 'RELEASE_PLANNING');

-- CreateTable
CREATE TABLE "LearnMaterial" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "LearnMaterialType" NOT NULL,
    "title" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "tags" TEXT[],
    "sourceUrl" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "readingMinutes" INTEGER,
    "provider" "LearnProvider" NOT NULL,
    "embedUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stageOrders" INTEGER[],
    "goalTypes" "ArtistGoalType"[],
    "trackStates" "TrackWorkbenchState"[],
    "problemTypes" "LearnProblemType"[],
    "preferredSurfaces" "LearnContextSurface"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnMaterial_slug_key" ON "LearnMaterial"("slug");

-- CreateIndex
CREATE INDEX "LearnMaterial_isFeatured_sortOrder_idx" ON "LearnMaterial"("isFeatured", "sortOrder");

-- CreateIndex
CREATE INDEX "LearnMaterial_type_idx" ON "LearnMaterial"("type");
