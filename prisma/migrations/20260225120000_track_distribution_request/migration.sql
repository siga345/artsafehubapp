CREATE TYPE "DistributionRequestStatus" AS ENUM ('SUBMITTED');

CREATE TYPE "DistributionYesNo" AS ENUM ('YES', 'NO');

CREATE TYPE "DistributionDistributor" AS ENUM (
  'ONE_RPM',
  'DISTROKID',
  'TUNECORE',
  'FRESHTUNES',
  'ZVONKO',
  'BELIEVE',
  'OTHER'
);

CREATE TABLE "TrackDistributionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "masterDemoId" TEXT NOT NULL,
  "artistName" TEXT NOT NULL,
  "releaseTitle" TEXT NOT NULL,
  "releaseDate" DATE NOT NULL,
  "genre" TEXT NOT NULL,
  "explicitContent" "DistributionYesNo" NOT NULL,
  "usesAi" "DistributionYesNo" NOT NULL,
  "promoPitchText" TEXT,
  "managerHelpRequested" BOOLEAN NOT NULL DEFAULT false,
  "distributor" "DistributionDistributor" NOT NULL,
  "distributorOtherName" TEXT,
  "status" "DistributionRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrackDistributionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackDistributionRequest_trackId_key" ON "TrackDistributionRequest"("trackId");
CREATE INDEX "TrackDistributionRequest_userId_submittedAt_idx" ON "TrackDistributionRequest"("userId", "submittedAt");
CREATE INDEX "TrackDistributionRequest_masterDemoId_idx" ON "TrackDistributionRequest"("masterDemoId");
CREATE INDEX "TrackDistributionRequest_status_idx" ON "TrackDistributionRequest"("status");

ALTER TABLE "TrackDistributionRequest"
ADD CONSTRAINT "TrackDistributionRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackDistributionRequest"
ADD CONSTRAINT "TrackDistributionRequest_trackId_fkey"
FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackDistributionRequest"
ADD CONSTRAINT "TrackDistributionRequest_masterDemoId_fkey"
FOREIGN KEY ("masterDemoId") REFERENCES "Demo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
