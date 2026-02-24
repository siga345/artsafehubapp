ALTER TABLE "Folder"
    ADD COLUMN "parentFolderId" TEXT,
    ADD COLUMN "pinnedAt" TIMESTAMP(3),
    ADD COLUMN "sortIndex" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Project"
    ADD COLUMN "pinnedAt" TIMESTAMP(3),
    ADD COLUMN "sortIndex" INTEGER NOT NULL DEFAULT 0;

-- Backfill deterministic sort order for root folders.
WITH ranked_folders AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "parentFolderId"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" ASC
        ) - 1 AS "rankIndex"
    FROM "Folder"
)
UPDATE "Folder" AS f
SET "sortIndex" = ranked_folders."rankIndex"
FROM ranked_folders
WHERE f."id" = ranked_folders."id";

-- Backfill deterministic sort order for projects inside each folder/root scope.
WITH ranked_projects AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "folderId"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" ASC
        ) - 1 AS "rankIndex"
    FROM "Project"
)
UPDATE "Project" AS p
SET "sortIndex" = ranked_projects."rankIndex"
FROM ranked_projects
WHERE p."id" = ranked_projects."id";

ALTER TABLE "Folder"
    DROP CONSTRAINT IF EXISTS "Folder_userId_title_key";

CREATE INDEX "Folder_parentFolderId_idx" ON "Folder"("parentFolderId");
CREATE INDEX "Folder_pinnedAt_idx" ON "Folder"("pinnedAt");
CREATE INDEX "Folder_userId_parentFolderId_updatedAt_idx" ON "Folder"("userId", "parentFolderId", "updatedAt");
CREATE INDEX "Project_pinnedAt_idx" ON "Project"("pinnedAt");

ALTER TABLE "Folder"
    ADD CONSTRAINT "Folder_parentFolderId_fkey"
    FOREIGN KEY ("parentFolderId") REFERENCES "Folder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
