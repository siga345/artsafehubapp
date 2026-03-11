-- CreateTable
CREATE TABLE "CommunityEventAttendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityEventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityEventAttendance_eventId_userId_key" ON "CommunityEventAttendance"("eventId", "userId");

-- CreateIndex
CREATE INDEX "CommunityEventAttendance_eventId_createdAt_idx" ON "CommunityEventAttendance"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityEventAttendance_userId_createdAt_idx" ON "CommunityEventAttendance"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunityEventAttendance" ADD CONSTRAINT "CommunityEventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEventAttendance" ADD CONSTRAINT "CommunityEventAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
