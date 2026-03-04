-- Learn in workflow persistence

CREATE TYPE "LearnProgressStatus" AS ENUM ('OPEN', 'APPLIED', 'NOT_RELEVANT', 'LATER');

CREATE TYPE "LearnContextSurface" AS ENUM ('LEARN', 'TODAY', 'GOALS', 'SONGS');

CREATE TYPE "LearnApplicationTargetType" AS ENUM ('TRACK', 'GOAL');

CREATE TABLE "LearnMaterialProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialKey" TEXT NOT NULL,
    "status" "LearnProgressStatus" NOT NULL,
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "laterAt" TIMESTAMP(3),
    "notRelevantAt" TIMESTAMP(3),
    "lastSurface" "LearnContextSurface",
    "lastAppliedTargetType" "LearnApplicationTargetType",
    "lastAppliedTrackId" TEXT,
    "lastAppliedGoalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnMaterialProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearnMaterialProgress_userId_materialKey_key" ON "LearnMaterialProgress"("userId", "materialKey");
CREATE INDEX "LearnMaterialProgress_userId_status_updatedAt_idx" ON "LearnMaterialProgress"("userId", "status", "updatedAt");
CREATE INDEX "LearnMaterialProgress_lastAppliedTrackId_idx" ON "LearnMaterialProgress"("lastAppliedTrackId");
CREATE INDEX "LearnMaterialProgress_lastAppliedGoalId_idx" ON "LearnMaterialProgress"("lastAppliedGoalId");

ALTER TABLE "LearnMaterialProgress" ADD CONSTRAINT "LearnMaterialProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearnMaterialProgress" ADD CONSTRAINT "LearnMaterialProgress_lastAppliedTrackId_fkey" FOREIGN KEY ("lastAppliedTrackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearnMaterialProgress" ADD CONSTRAINT "LearnMaterialProgress_lastAppliedGoalId_fkey" FOREIGN KEY ("lastAppliedGoalId") REFERENCES "ArtistGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
