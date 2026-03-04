-- CreateEnum
CREATE TYPE "InAppRequestType" AS ENUM ('PRODUCTION', 'MIX_MASTER', 'STUDIO_SESSION', 'PROMO_PRODUCTION');

-- CreateEnum
CREATE TYPE "InAppRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InAppRequestActionType" AS ENUM ('SUBMIT', 'MARK_VIEWED', 'ACCEPT', 'DECLINE', 'CANCEL', 'ARCHIVE');

-- CreateTable
CREATE TABLE "InAppRequest" (
    "id" TEXT NOT NULL,
    "type" "InAppRequestType" NOT NULL,
    "status" "InAppRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "artistUserId" TEXT NOT NULL,
    "specialistUserId" TEXT NOT NULL,
    "trackId" TEXT,
    "demoId" TEXT,
    "serviceLabel" TEXT,
    "brief" TEXT NOT NULL,
    "preferredStartAt" TIMESTAMP(3),
    "city" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppRequestAction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "InAppRequestActionType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppRequestAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnboardingState" (
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOnboardingState_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "InAppRequest_artistUserId_createdAt_idx" ON "InAppRequest"("artistUserId", "createdAt");

-- CreateIndex
CREATE INDEX "InAppRequest_specialistUserId_createdAt_idx" ON "InAppRequest"("specialistUserId", "createdAt");

-- CreateIndex
CREATE INDEX "InAppRequest_status_createdAt_idx" ON "InAppRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InAppRequest_trackId_idx" ON "InAppRequest"("trackId");

-- CreateIndex
CREATE INDEX "InAppRequestAction_requestId_createdAt_idx" ON "InAppRequestAction"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "InAppRequestAction_actorUserId_createdAt_idx" ON "InAppRequestAction"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "InAppRequest" ADD CONSTRAINT "InAppRequest_artistUserId_fkey" FOREIGN KEY ("artistUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppRequest" ADD CONSTRAINT "InAppRequest_specialistUserId_fkey" FOREIGN KEY ("specialistUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppRequest" ADD CONSTRAINT "InAppRequest_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppRequest" ADD CONSTRAINT "InAppRequest_demoId_fkey" FOREIGN KEY ("demoId") REFERENCES "Demo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppRequestAction" ADD CONSTRAINT "InAppRequestAction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "InAppRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppRequestAction" ADD CONSTRAINT "InAppRequestAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnboardingState" ADD CONSTRAINT "UserOnboardingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
