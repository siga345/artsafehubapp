CREATE TYPE "GoalMotionType" AS ENUM ('CRAFT', 'CREATIVE');

ALTER TABLE "GoalPillar"
ADD COLUMN "defaultMotionType" "GoalMotionType";

UPDATE "GoalPillar"
SET "defaultMotionType" = CASE
  WHEN "factor" IN ('DIRECTION', 'ARTIST_WORLD', 'CATALOG') THEN 'CREATIVE'::"GoalMotionType"
  ELSE 'CRAFT'::"GoalMotionType"
END;

ALTER TABLE "GoalPillar"
ALTER COLUMN "defaultMotionType" SET NOT NULL;

ALTER TABLE "GoalTask"
ADD COLUMN "motionType" "GoalMotionType",
ADD COLUMN "startedAt" TIMESTAMP(3);

UPDATE "GoalTask" AS task
SET
  "motionType" = pillar."defaultMotionType",
  "startedAt" = CASE
    WHEN task."status" = 'IN_PROGRESS' THEN task."updatedAt"
    WHEN task."status" = 'DONE' THEN COALESCE(task."completedAt", task."updatedAt")
    ELSE NULL
  END
FROM "GoalPillar" AS pillar
WHERE task."pillarId" = pillar."id";

ALTER TABLE "GoalTask"
ALTER COLUMN "motionType" SET NOT NULL;
