ALTER TABLE "Demo"
ADD COLUMN "releaseDate" DATE;

UPDATE "Demo" AS d
SET "releaseDate" = tdr."releaseDate"
FROM "TrackDistributionRequest" AS tdr
WHERE d."trackId" = tdr."trackId"
  AND d."versionType" = 'RELEASE'
  AND d."releaseDate" IS NULL;
