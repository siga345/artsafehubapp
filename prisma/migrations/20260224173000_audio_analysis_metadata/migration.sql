ALTER TABLE "Track"
ADD COLUMN "displayBpm" DOUBLE PRECISION,
ADD COLUMN "displayBpmConfidence" DOUBLE PRECISION,
ADD COLUMN "displayKeyRoot" TEXT,
ADD COLUMN "displayKeyMode" TEXT,
ADD COLUMN "displayKeyConfidence" DOUBLE PRECISION,
ADD COLUMN "displayAnalysisSource" TEXT,
ADD COLUMN "displayAnalysisUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Demo"
ADD COLUMN "detectedBpm" DOUBLE PRECISION,
ADD COLUMN "detectedBpmConfidence" DOUBLE PRECISION,
ADD COLUMN "detectedKeyRoot" TEXT,
ADD COLUMN "detectedKeyMode" TEXT,
ADD COLUMN "detectedKeyConfidence" DOUBLE PRECISION,
ADD COLUMN "detectedAnalysisSource" TEXT,
ADD COLUMN "detectedAnalysisVersion" TEXT,
ADD COLUMN "detectedAt" TIMESTAMP(3);
