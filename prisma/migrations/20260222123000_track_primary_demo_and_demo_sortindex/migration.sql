ALTER TABLE "Track"
ADD COLUMN "primaryDemoId" TEXT;

ALTER TABLE "Demo"
ADD COLUMN "sortIndex" INTEGER NOT NULL DEFAULT 0;

WITH ranked_demos AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "trackId", "versionType"
            ORDER BY "createdAt" DESC, "id" DESC
        ) - 1 AS "rankIndex"
    FROM "Demo"
)
UPDATE "Demo" AS d
SET "sortIndex" = ranked_demos."rankIndex"
FROM ranked_demos
WHERE d."id" = ranked_demos."id";

CREATE INDEX "Track_primaryDemoId_idx" ON "Track"("primaryDemoId");
CREATE INDEX "Demo_trackId_versionType_sortIndex_idx" ON "Demo"("trackId", "versionType", "sortIndex");

ALTER TABLE "Track"
    ADD CONSTRAINT "Track_primaryDemoId_fkey"
    FOREIGN KEY ("primaryDemoId") REFERENCES "Demo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
