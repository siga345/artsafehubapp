import { Prisma, PrismaClient } from "@prisma/client";

import { dayLoopTrackInclude, serializeDailyTrackFocus, serializeDailyWrapUp, serializeDayLoopTrack } from "@/lib/track-workbench";

type DbClient = PrismaClient | Prisma.TransactionClient;

export function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getDailyTrackFocus(db: DbClient, userId: string, date: Date) {
  return db.dailyTrackFocus.findUnique({
    where: {
      userId_date: {
        userId,
        date
      }
    },
    include: {
      track: {
        include: dayLoopTrackInclude
      },
      nextStep: true
    }
  });
}

export async function getDailyWrapUp(db: DbClient, userId: string, date: Date) {
  return db.dailyWrapUp.findUnique({
    where: {
      userId_date: {
        userId,
        date
      }
    },
    include: {
      nextStep: true
    }
  });
}

export async function listActiveWorkshopTracks(db: DbClient, userId: string) {
  const tracks = await db.track.findMany({
    where: { userId },
    include: dayLoopTrackInclude
  });

  return tracks
    .sort((left, right) => {
      const leftHasActive = left.nextSteps.length > 0 ? 1 : 0;
      const rightHasActive = right.nextSteps.length > 0 ? 1 : 0;
      if (leftHasActive !== rightHasActive) return rightHasActive - leftHasActive;

      const leftDeferred = left.workbenchState === "DEFERRED" ? 1 : 0;
      const rightDeferred = right.workbenchState === "DEFERRED" ? 1 : 0;
      if (leftDeferred !== rightDeferred) return leftDeferred - rightDeferred;

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })
    .map(serializeDayLoopTrack);
}

export async function getDayLoopOverview(db: DbClient, userId: string, date: Date) {
  const [focus, wrapUp, activeTracks] = await Promise.all([
    getDailyTrackFocus(db, userId, date),
    getDailyWrapUp(db, userId, date),
    listActiveWorkshopTracks(db, userId)
  ]);

  return {
    focus: serializeDailyTrackFocus(focus),
    wrapUp: serializeDailyWrapUp(wrapUp),
    activeTracks
  };
}

export async function touchTrackAndProject(db: DbClient, trackId: string) {
  const track = await db.track.findUnique({
    where: { id: trackId },
    select: { id: true, projectId: true }
  });
  if (!track) return null;

  await db.track.update({
    where: { id: track.id },
    data: { updatedAt: new Date() }
  });

  if (track.projectId) {
    await db.project.update({
      where: { id: track.projectId },
      data: { updatedAt: new Date() }
    });
  }

  return track;
}
