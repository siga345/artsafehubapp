CREATE TYPE "ProjectCoverType" AS ENUM ('GRADIENT', 'IMAGE');

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL,
    "artistLabel" TEXT,
    "coverType" "ProjectCoverType" NOT NULL DEFAULT 'GRADIENT',
    "coverImageUrl" TEXT,
    "coverPresetKey" TEXT,
    "coverColorA" TEXT,
    "coverColorB" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Track"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "sortIndex" INTEGER NOT NULL DEFAULT 0;

-- Backfill 1: every existing folder becomes a project (keeps old grouping intact).
INSERT INTO "Project" (
    "id",
    "userId",
    "folderId",
    "title",
    "coverType",
    "coverPresetKey",
    "coverColorA",
    "coverColorB",
    "createdAt",
    "updatedAt"
)
SELECT
    'prj_f_' || md5("Folder"."id") AS "id",
    "Folder"."userId",
    "Folder"."id" AS "folderId",
    "Folder"."title",
    'GRADIENT'::"ProjectCoverType",
    'untitled-pink',
    '#F6B4E6',
    '#E46AE8',
    "Folder"."createdAt",
    "Folder"."updatedAt"
FROM "Folder";

UPDATE "Track"
SET "projectId" = 'prj_f_' || md5("folderId")
WHERE "folderId" IS NOT NULL
  AND "projectId" IS NULL;

-- Backfill 2: tracks without folders get their own projects (song-as-project container).
INSERT INTO "Project" (
    "id",
    "userId",
    "folderId",
    "title",
    "coverType",
    "coverPresetKey",
    "coverColorA",
    "coverColorB",
    "createdAt",
    "updatedAt"
)
SELECT
    'prj_t_' || md5("Track"."id") AS "id",
    "Track"."userId",
    NULL,
    CASE
        WHEN btrim("Track"."title") = '' THEN 'Untitled project'
        ELSE "Track"."title"
    END AS "title",
    'GRADIENT'::"ProjectCoverType",
    'untitled-pink',
    '#F6B4E6',
    '#E46AE8',
    "Track"."createdAt",
    "Track"."updatedAt"
FROM "Track"
WHERE "Track"."projectId" IS NULL;

UPDATE "Track"
SET "projectId" = 'prj_t_' || md5("id")
WHERE "projectId" IS NULL;

-- Deterministic order inside a project for future playlist UI.
WITH ranked_tracks AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC, "id" ASC) - 1 AS "rankIndex"
    FROM "Track"
    WHERE "projectId" IS NOT NULL
)
UPDATE "Track" AS t
SET "sortIndex" = ranked_tracks."rankIndex"
FROM ranked_tracks
WHERE t."id" = ranked_tracks."id";

CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");
CREATE INDEX "Project_folderId_idx" ON "Project"("folderId");
CREATE INDEX "Track_projectId_sortIndex_idx" ON "Track"("projectId", "sortIndex");

ALTER TABLE "Project"
    ADD CONSTRAINT "Project_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
    ADD CONSTRAINT "Project_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "Folder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Track"
    ADD CONSTRAINT "Track_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
