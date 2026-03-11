CREATE TYPE "ExecutionTemplate" AS ENUM (
  'SINGLE_RELEASE',
  'ARTIST_PROFILE_REFRESH',
  'TEAM_SEARCH',
  'CUSTOM_PROJECT'
);

ALTER TABLE "ArtistGoal"
ADD COLUMN "executionTemplate" "ExecutionTemplate";

CREATE INDEX "ArtistGoal_userId_executionTemplate_idx"
ON "ArtistGoal"("userId", "executionTemplate");
