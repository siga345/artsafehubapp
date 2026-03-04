-- CreateEnum
CREATE TYPE "ArtistWorldThemePreset" AS ENUM ('EDITORIAL', 'STUDIO', 'CINEMATIC', 'MINIMAL');

-- CreateEnum
CREATE TYPE "ArtistWorldBackgroundMode" AS ENUM ('GRADIENT', 'IMAGE');

-- AlterTable
ALTER TABLE "ArtistIdentityProfile"
ADD COLUMN "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "worldThemePreset" "ArtistWorldThemePreset" NOT NULL DEFAULT 'EDITORIAL',
ADD COLUMN "worldBackgroundMode" "ArtistWorldBackgroundMode" NOT NULL DEFAULT 'GRADIENT',
ADD COLUMN "worldBackgroundColorA" TEXT,
ADD COLUMN "worldBackgroundColorB" TEXT,
ADD COLUMN "worldBackgroundImageUrl" TEXT,
ADD COLUMN "worldBlockOrder" JSONB,
ADD COLUMN "worldHiddenBlocks" JSONB;

-- CreateTable
CREATE TABLE "ArtistWorldProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "linkUrl" TEXT,
    "coverImageUrl" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistWorldProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistWorldReference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creator" TEXT,
    "note" TEXT,
    "linkUrl" TEXT,
    "imageUrl" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistWorldReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistWorldProject_userId_sortIndex_idx" ON "ArtistWorldProject"("userId", "sortIndex");

-- CreateIndex
CREATE INDEX "ArtistWorldReference_userId_sortIndex_idx" ON "ArtistWorldReference"("userId", "sortIndex");

-- AddForeignKey
ALTER TABLE "ArtistWorldProject" ADD CONSTRAINT "ArtistWorldProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistWorldReference" ADD CONSTRAINT "ArtistWorldReference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
