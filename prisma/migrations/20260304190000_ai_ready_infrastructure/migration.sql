CREATE TYPE "RecommendationSource" AS ENUM ('MANUAL', 'SYSTEM', 'AI');
CREATE TYPE "RecommendationSurface" AS ENUM ('HOME_COMMAND_CENTER', 'TODAY', 'SONGS', 'LEARN');
CREATE TYPE "RecommendationKind" AS ENUM ('NEXT_STEP', 'DIAGNOSTIC', 'GOAL_ACTION', 'TODAY_FOCUS', 'LEARN_CONTEXT');
CREATE TYPE "RecommendationEventType" AS ENUM ('VIEWED', 'CLICKED_PRIMARY', 'CLICKED_SECONDARY', 'DISMISSED', 'APPLIED', 'COMPLETED');
CREATE TYPE "NextStepOrigin" AS ENUM ('SONG_DETAIL', 'MORNING_FOCUS', 'WRAP_UP');
CREATE TYPE "TrackDecisionType" AS ENUM (
  'NEXT_STEP_SET',
  'NEXT_STEP_COMPLETED',
  'NEXT_STEP_CANCELED',
  'FEEDBACK_OUTCOME_RECORDED',
  'WRAP_UP_RECORDED',
  'REFLECTION_CAPTURED'
);

ALTER TABLE "TrackNextStep" RENAME COLUMN "title" TO "text";
ALTER TABLE "TrackNextStep" RENAME COLUMN "detail" TO "reason";

ALTER TABLE "TrackNextStep"
ADD COLUMN     "recommendationSource" "RecommendationSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "origin" "NextStepOrigin" NOT NULL DEFAULT 'SONG_DETAIL';

UPDATE "TrackNextStep"
SET "origin" = CASE "source"::text
  WHEN 'MORNING_FOCUS' THEN 'MORNING_FOCUS'::"NextStepOrigin"
  WHEN 'WRAP_UP' THEN 'WRAP_UP'::"NextStepOrigin"
  ELSE 'SONG_DETAIL'::"NextStepOrigin"
END;

ALTER TABLE "TrackNextStep" DROP COLUMN "source";
DROP TYPE "NextStepSource";

CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surface" "RecommendationSurface" NOT NULL,
    "kind" "RecommendationKind" NOT NULL,
    "eventType" "RecommendationEventType" NOT NULL,
    "source" "RecommendationSource" NOT NULL,
    "recommendationKey" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "trackId" TEXT,
    "goalId" TEXT,
    "materialKey" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "demoId" TEXT,
    "nextStepId" TEXT,
    "feedbackItemId" TEXT,
    "type" "TrackDecisionType" NOT NULL,
    "source" "RecommendationSource" NOT NULL,
    "reason" TEXT,
    "summary" TEXT NOT NULL,
    "recommendationKey" TEXT,
    "contextSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearnApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialKey" TEXT NOT NULL,
    "surface" "LearnContextSurface" NOT NULL,
    "targetType" "LearnApplicationTargetType" NOT NULL,
    "targetTrackId" TEXT,
    "targetGoalId" TEXT,
    "source" "RecommendationSource" NOT NULL,
    "reason" TEXT,
    "recommendationKey" TEXT,
    "contextSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecommendationEvent_userId_createdAt_idx" ON "RecommendationEvent"("userId", "createdAt");
CREATE INDEX "RecommendationEvent_surface_kind_createdAt_idx" ON "RecommendationEvent"("surface", "kind", "createdAt");
CREATE INDEX "RecommendationEvent_recommendationKey_createdAt_idx" ON "RecommendationEvent"("recommendationKey", "createdAt");
CREATE INDEX "RecommendationEvent_trackId_idx" ON "RecommendationEvent"("trackId");
CREATE INDEX "RecommendationEvent_goalId_idx" ON "RecommendationEvent"("goalId");

CREATE INDEX "TrackDecision_trackId_createdAt_idx" ON "TrackDecision"("trackId", "createdAt");
CREATE INDEX "TrackDecision_userId_createdAt_idx" ON "TrackDecision"("userId", "createdAt");
CREATE INDEX "TrackDecision_type_createdAt_idx" ON "TrackDecision"("type", "createdAt");
CREATE INDEX "TrackDecision_nextStepId_idx" ON "TrackDecision"("nextStepId");
CREATE INDEX "TrackDecision_feedbackItemId_idx" ON "TrackDecision"("feedbackItemId");

CREATE INDEX "LearnApplication_userId_createdAt_idx" ON "LearnApplication"("userId", "createdAt");
CREATE INDEX "LearnApplication_materialKey_createdAt_idx" ON "LearnApplication"("materialKey", "createdAt");
CREATE INDEX "LearnApplication_targetTrackId_idx" ON "LearnApplication"("targetTrackId");
CREATE INDEX "LearnApplication_targetGoalId_idx" ON "LearnApplication"("targetGoalId");

ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "ArtistGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TrackDecision" ADD CONSTRAINT "TrackDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackDecision" ADD CONSTRAINT "TrackDecision_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackDecision" ADD CONSTRAINT "TrackDecision_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackDecision" ADD CONSTRAINT "TrackDecision_nextStepId_fkey" FOREIGN KEY ("nextStepId") REFERENCES "TrackNextStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrackDecision" ADD CONSTRAINT "TrackDecision_feedbackItemId_fkey" FOREIGN KEY ("feedbackItemId") REFERENCES "FeedbackItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LearnApplication" ADD CONSTRAINT "LearnApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearnApplication" ADD CONSTRAINT "LearnApplication_targetTrackId_fkey" FOREIGN KEY ("targetTrackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearnApplication" ADD CONSTRAINT "LearnApplication_targetGoalId_fkey" FOREIGN KEY ("targetGoalId") REFERENCES "ArtistGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "TrackDecision" (
  "id",
  "userId",
  "trackId",
  "nextStepId",
  "type",
  "source",
  "reason",
  "summary",
  "createdAt"
)
SELECT
  CONCAT('td_next_', "id"),
  "userId",
  "trackId",
  "id",
  'NEXT_STEP_SET'::"TrackDecisionType",
  'MANUAL'::"RecommendationSource",
  "reason",
  "text",
  "createdAt"
FROM "TrackNextStep";

INSERT INTO "TrackDecision" (
  "id",
  "userId",
  "trackId",
  "nextStepId",
  "type",
  "source",
  "reason",
  "summary",
  "createdAt"
)
SELECT
  CONCAT('td_next_done_', "id"),
  "userId",
  "trackId",
  "id",
  'NEXT_STEP_COMPLETED'::"TrackDecisionType",
  'MANUAL'::"RecommendationSource",
  "reason",
  "text",
  COALESCE("completedAt", "updatedAt")
FROM "TrackNextStep"
WHERE "status" = 'DONE';

INSERT INTO "TrackDecision" (
  "id",
  "userId",
  "trackId",
  "nextStepId",
  "type",
  "source",
  "reason",
  "summary",
  "createdAt"
)
SELECT
  CONCAT('td_next_cancel_', "id"),
  "userId",
  "trackId",
  "id",
  'NEXT_STEP_CANCELED'::"TrackDecisionType",
  'MANUAL'::"RecommendationSource",
  "reason",
  "text",
  COALESCE("canceledAt", "updatedAt")
FROM "TrackNextStep"
WHERE "status" = 'CANCELED';

INSERT INTO "TrackDecision" (
  "id",
  "userId",
  "trackId",
  "nextStepId",
  "type",
  "source",
  "reason",
  "summary",
  "createdAt"
)
SELECT
  CONCAT('td_wrap_', "id"),
  "userId",
  "trackId",
  "nextStepId",
  'WRAP_UP_RECORDED'::"TrackDecisionType",
  'MANUAL'::"RecommendationSource",
  "whatNotWorking",
  "whatChanged",
  "createdAt"
FROM "DailyWrapUp";

INSERT INTO "TrackDecision" (
  "id",
  "userId",
  "trackId",
  "demoId",
  "type",
  "source",
  "reason",
  "summary",
  "createdAt"
)
SELECT
  CONCAT('td_reflection_', vr."demoId"),
  t."userId",
  d."trackId",
  vr."demoId",
  'REFLECTION_CAPTURED'::"TrackDecisionType",
  'MANUAL'::"RecommendationSource",
  COALESCE(vr."whatNotWorking", vr."whatChanged"),
  COALESCE(NULLIF(vr."whyMade", ''), 'Reflection captured'),
  vr."createdAt"
FROM "VersionReflection" vr
JOIN "Demo" d ON d."id" = vr."demoId"
JOIN "Track" t ON t."id" = d."trackId";

INSERT INTO "TrackDecision" (
  "id",
  "userId",
  "trackId",
  "demoId",
  "feedbackItemId",
  "type",
  "source",
  "reason",
  "summary",
  "createdAt"
)
SELECT
  CONCAT('td_feedback_', fr."id"),
  fr."userId",
  req."trackId",
  fr."targetDemoId",
  fr."feedbackItemId",
  'FEEDBACK_OUTCOME_RECORDED'::"TrackDecisionType",
  'MANUAL'::"RecommendationSource",
  fr."note",
  fr."status"::text,
  fr."createdAt"
FROM "FeedbackResolution" fr
JOIN "FeedbackItem" fi ON fi."id" = fr."feedbackItemId"
JOIN "FeedbackRequest" req ON req."id" = fi."requestId";

INSERT INTO "LearnApplication" (
  "id",
  "userId",
  "materialKey",
  "surface",
  "targetType",
  "targetTrackId",
  "targetGoalId",
  "source",
  "reason",
  "createdAt"
)
SELECT
  CONCAT('learn_app_', lmp."id"),
  lmp."userId",
  lmp."materialKey",
  COALESCE(lmp."lastSurface", 'LEARN'::"LearnContextSurface"),
  lmp."lastAppliedTargetType",
  lmp."lastAppliedTrackId",
  lmp."lastAppliedGoalId",
  'SYSTEM'::"RecommendationSource",
  'Backfilled from LearnMaterialProgress snapshot',
  COALESCE(lmp."appliedAt", lmp."updatedAt")
FROM "LearnMaterialProgress" lmp
WHERE lmp."appliedAt" IS NOT NULL
  AND lmp."lastAppliedTargetType" IS NOT NULL;
