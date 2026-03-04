-- CreateEnum
CREATE TYPE "FeedbackRequestType" AS ENUM ('TEXT', 'DEMO', 'ARRANGEMENT', 'GENERAL_IMPRESSION');

-- CreateEnum
CREATE TYPE "FeedbackRequestStatus" AS ENUM ('PENDING', 'RECEIVED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "FeedbackRecipientMode" AS ENUM ('INTERNAL_USER', 'EXTERNAL_CONTACT');

-- CreateEnum
CREATE TYPE "FeedbackItemCategory" AS ENUM ('WHAT_WORKS', 'NOT_READING', 'SAGS', 'WANT_TO_HEAR_NEXT');

-- CreateEnum
CREATE TYPE "FeedbackResolutionStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'NEXT_VERSION');

-- CreateTable
CREATE TABLE "FeedbackRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "demoId" TEXT,
    "type" "FeedbackRequestType" NOT NULL,
    "status" "FeedbackRequestStatus" NOT NULL DEFAULT 'PENDING',
    "recipientMode" "FeedbackRecipientMode" NOT NULL,
    "recipientUserId" TEXT,
    "recipientLabel" TEXT NOT NULL,
    "recipientChannel" TEXT,
    "recipientContact" TEXT,
    "requestMessage" TEXT,
    "lyricsSnapshot" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "category" "FeedbackItemCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackResolution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackItemId" TEXT NOT NULL,
    "status" "FeedbackResolutionStatus" NOT NULL,
    "note" TEXT,
    "targetDemoId" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackRequest_trackId_updatedAt_idx" ON "FeedbackRequest"("trackId", "updatedAt");

-- CreateIndex
CREATE INDEX "FeedbackRequest_userId_status_updatedAt_idx" ON "FeedbackRequest"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FeedbackRequest_recipientUserId_status_updatedAt_idx" ON "FeedbackRequest"("recipientUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FeedbackItem_requestId_category_sortIndex_idx" ON "FeedbackItem"("requestId", "category", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackResolution_feedbackItemId_key" ON "FeedbackResolution"("feedbackItemId");

-- CreateIndex
CREATE INDEX "FeedbackResolution_userId_status_updatedAt_idx" ON "FeedbackResolution"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FeedbackResolution_targetDemoId_idx" ON "FeedbackResolution"("targetDemoId");

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FeedbackRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResolution" ADD CONSTRAINT "FeedbackResolution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResolution" ADD CONSTRAINT "FeedbackResolution_feedbackItemId_fkey" FOREIGN KEY ("feedbackItemId") REFERENCES "FeedbackItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResolution" ADD CONSTRAINT "FeedbackResolution_targetDemoId_fkey" FOREIGN KEY ("targetDemoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
