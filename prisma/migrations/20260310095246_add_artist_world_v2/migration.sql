-- AlterTable
ALTER TABLE "ArtistGoal" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ArtistIdentityProfile" ADD COLUMN     "artistAge" INTEGER,
ADD COLUMN     "artistCity" TEXT,
ADD COLUMN     "artistName" TEXT,
ADD COLUMN     "favoriteArtists" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lifeValues" TEXT,
ADD COLUMN     "playlistUrl" TEXT,
ADD COLUMN     "teamPreference" TEXT,
ADD COLUMN     "worldCreated" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GoalTask" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InAppRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserOnboardingState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ArtistWorldVisualBoard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistWorldVisualBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistWorldVisualBoardImage" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistWorldVisualBoardImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistWorldVisualBoard_userId_sortIndex_idx" ON "ArtistWorldVisualBoard"("userId", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistWorldVisualBoard_userId_slug_key" ON "ArtistWorldVisualBoard"("userId", "slug");

-- CreateIndex
CREATE INDEX "ArtistWorldVisualBoardImage_boardId_sortIndex_idx" ON "ArtistWorldVisualBoardImage"("boardId", "sortIndex");

-- AddForeignKey
ALTER TABLE "ArtistWorldVisualBoard" ADD CONSTRAINT "ArtistWorldVisualBoard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistWorldVisualBoardImage" ADD CONSTRAINT "ArtistWorldVisualBoardImage_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ArtistWorldVisualBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
