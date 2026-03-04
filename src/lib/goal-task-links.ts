import { Prisma, PrismaClient } from "@prisma/client";

import { apiError } from "@/lib/api";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function resolveUserGoalTaskLinks(
  db: DbClient,
  userId: string,
  input: {
    linkedTrackId?: string | null;
    linkedProjectId?: string | null;
  }
) {
  const linkedTrackId = input.linkedTrackId?.trim() || null;
  const linkedProjectId = input.linkedProjectId?.trim() || null;

  if (linkedTrackId) {
    const track = await db.track.findFirst({
      where: {
        id: linkedTrackId,
        userId
      },
      select: {
        id: true
      }
    });

    if (!track) {
      throw apiError(400, "Связанный трек не найден.");
    }
  }

  if (linkedProjectId) {
    const project = await db.project.findFirst({
      where: {
        id: linkedProjectId,
        userId
      },
      select: {
        id: true
      }
    });

    if (!project) {
      throw apiError(400, "Связанный проект не найден.");
    }
  }

  return {
    linkedTrackId,
    linkedProjectId
  };
}
