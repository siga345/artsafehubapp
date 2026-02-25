CREATE TYPE "ProjectReleaseKind" AS ENUM ('SINGLE', 'ALBUM');

ALTER TABLE "Project"
ADD COLUMN "releaseKind" "ProjectReleaseKind" NOT NULL DEFAULT 'ALBUM';

UPDATE "Project" AS p
SET "releaseKind" = 'SINGLE'
FROM (
  SELECT "projectId"
  FROM "Track"
  WHERE "projectId" IS NOT NULL
  GROUP BY "projectId"
  HAVING COUNT(*) = 1
) AS singles
WHERE p."id" = singles."projectId";
