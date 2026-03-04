CREATE TYPE "CommunityPostKind" AS ENUM ('PROGRESS', 'FEEDBACK_REQUEST', 'CREATIVE_QUESTION', 'GENERAL');

CREATE TYPE "CommunityHelpfulActionType" AS ENUM ('I_CAN_HELP', 'I_RELATED', 'KEEP_GOING');

CREATE TYPE "ArtistSupportNeedType" AS ENUM ('FEEDBACK', 'ACCOUNTABILITY', 'CREATIVE_DIRECTION', 'COLLABORATION');

CREATE TYPE "CommunityFeedbackThreadStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

ALTER TYPE "FeedbackRecipientMode" ADD VALUE IF NOT EXISTS 'COMMUNITY';

ALTER TYPE "CommunityAchievementType" ADD VALUE IF NOT EXISTS 'TRACK_RETURNED';
ALTER TYPE "CommunityAchievementType" ADD VALUE IF NOT EXISTS 'DEMO_COMPLETED';
ALTER TYPE "CommunityAchievementType" ADD VALUE IF NOT EXISTS 'FEEDBACK_REQUESTED';
ALTER TYPE "CommunityAchievementType" ADD VALUE IF NOT EXISTS 'ARTIST_HELPED';

ALTER TABLE "ArtistIdentityProfile"
ADD COLUMN     "currentFocusTitle" TEXT,
ADD COLUMN     "currentFocusDetail" TEXT,
ADD COLUMN     "seekingSupportDetail" TEXT,
ADD COLUMN     "supportNeedTypes" "ArtistSupportNeedType"[] NOT NULL DEFAULT ARRAY[]::"ArtistSupportNeedType"[];

ALTER TABLE "CommunityPost"
ADD COLUMN     "kind" "CommunityPostKind" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "trackId" TEXT,
ADD COLUMN     "demoId" TEXT,
ADD COLUMN     "feedbackRequestId" TEXT,
ADD COLUMN     "metadata" JSONB;

ALTER TABLE "FeedbackItem"
ADD COLUMN     "authorUserId" TEXT,
ADD COLUMN     "communityReplyId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'OWNER_ENTRY';

CREATE TABLE "CommunityFeedbackThread" (
    "id" TEXT NOT NULL,
    "feedbackRequestId" TEXT NOT NULL,
    "communityPostId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "demoId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "status" "CommunityFeedbackThreadStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityFeedbackThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityFeedbackReply" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "helpfulActionType" "CommunityHelpfulActionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityFeedbackReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityFeedbackReplyItem" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "category" "FeedbackItemCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityFeedbackReplyItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityPost_feedbackRequestId_key" ON "CommunityPost"("feedbackRequestId");
CREATE INDEX "CommunityPost_kind_createdAt_idx" ON "CommunityPost"("kind", "createdAt");
CREATE INDEX "CommunityPost_trackId_createdAt_idx" ON "CommunityPost"("trackId", "createdAt");
CREATE INDEX "CommunityPost_demoId_createdAt_idx" ON "CommunityPost"("demoId", "createdAt");

CREATE INDEX "FeedbackItem_authorUserId_createdAt_idx" ON "FeedbackItem"("authorUserId", "createdAt");
CREATE INDEX "FeedbackItem_communityReplyId_idx" ON "FeedbackItem"("communityReplyId");

CREATE UNIQUE INDEX "CommunityFeedbackThread_feedbackRequestId_key" ON "CommunityFeedbackThread"("feedbackRequestId");
CREATE UNIQUE INDEX "CommunityFeedbackThread_communityPostId_key" ON "CommunityFeedbackThread"("communityPostId");
CREATE INDEX "CommunityFeedbackThread_authorUserId_status_updatedAt_idx" ON "CommunityFeedbackThread"("authorUserId", "status", "updatedAt");
CREATE INDEX "CommunityFeedbackThread_trackId_status_updatedAt_idx" ON "CommunityFeedbackThread"("trackId", "status", "updatedAt");
CREATE INDEX "CommunityFeedbackThread_demoId_idx" ON "CommunityFeedbackThread"("demoId");

CREATE INDEX "CommunityFeedbackReply_threadId_createdAt_idx" ON "CommunityFeedbackReply"("threadId", "createdAt");
CREATE INDEX "CommunityFeedbackReply_authorUserId_createdAt_idx" ON "CommunityFeedbackReply"("authorUserId", "createdAt");

CREATE INDEX "CommunityFeedbackReplyItem_replyId_category_sortIndex_idx" ON "CommunityFeedbackReplyItem"("replyId", "category", "sortIndex");

ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_feedbackRequestId_fkey" FOREIGN KEY ("feedbackRequestId") REFERENCES "FeedbackRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_communityReplyId_fkey" FOREIGN KEY ("communityReplyId") REFERENCES "CommunityFeedbackReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityFeedbackThread" ADD CONSTRAINT "CommunityFeedbackThread_feedbackRequestId_fkey" FOREIGN KEY ("feedbackRequestId") REFERENCES "FeedbackRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityFeedbackThread" ADD CONSTRAINT "CommunityFeedbackThread_communityPostId_fkey" FOREIGN KEY ("communityPostId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityFeedbackThread" ADD CONSTRAINT "CommunityFeedbackThread_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityFeedbackThread" ADD CONSTRAINT "CommunityFeedbackThread_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityFeedbackThread" ADD CONSTRAINT "CommunityFeedbackThread_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityFeedbackReply" ADD CONSTRAINT "CommunityFeedbackReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunityFeedbackThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityFeedbackReply" ADD CONSTRAINT "CommunityFeedbackReply_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityFeedbackReplyItem" ADD CONSTRAINT "CommunityFeedbackReplyItem_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "CommunityFeedbackReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
