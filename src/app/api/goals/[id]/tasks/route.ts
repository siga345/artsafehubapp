import { FindCategory, GoalMotionType, TaskOwnerType, TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { getGoalDetailForUser, getGoalTrajectoryReview, getIdentityProfile, serializeGoalDetail, todayToDateOnly } from "@/lib/artist-growth";
import { resolveUserGoalTaskLinks } from "@/lib/goal-task-links";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const createTaskSchema = z.object({
  pillarId: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(600).optional().nullable(),
  motionType: z.nativeEnum(GoalMotionType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  ownerType: z.nativeEnum(TaskOwnerType).optional(),
  dueDate: z.string().trim().max(40).optional().nullable(),
  linkedTrackId: z.string().trim().optional().nullable(),
  linkedProjectId: z.string().trim().optional().nullable(),
  linkedSpecialistCategory: z.nativeEnum(FindCategory).optional().nullable()
});

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw apiError(400, "Некорректная дата задачи.");
  }
  return parsed;
}

export const POST = withApiHandler(async (request: Request, context: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createTaskSchema);
  const dueDate = parseOptionalDate(body.dueDate);
  const identityProfile = await getIdentityProfile(prisma, user.id);
  const today = todayToDateOnly(new Date());

  const updatedGoal = await prisma.$transaction(async (tx) => {
    const goal = await tx.artistGoal.findFirst({
      where: {
        id: context.params.id,
        userId: user.id
      },
      select: {
        id: true
      }
    });

    if (!goal) {
      throw apiError(404, "Цель не найдена.");
    }

    const pillar = await tx.goalPillar.findFirst({
      where: {
        id: body.pillarId,
        goalId: goal.id
      },
      select: {
        id: true,
        defaultMotionType: true
      }
    });

    if (!pillar) {
      throw apiError(400, "Стратегический блок не найден.");
    }

    const links = await resolveUserGoalTaskLinks(tx, user.id, {
      linkedTrackId: body.linkedTrackId,
      linkedProjectId: body.linkedProjectId
    });

    const lastTask = await tx.goalTask.findFirst({
      where: {
        pillarId: pillar.id
      },
      select: {
        sortIndex: true
      },
      orderBy: {
        sortIndex: "desc"
      }
    });

    await tx.goalTask.create({
      data: {
        pillarId: pillar.id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        motionType: body.motionType ?? pillar.defaultMotionType,
        priority: body.priority ?? TaskPriority.MEDIUM,
        ownerType: body.ownerType ?? TaskOwnerType.SELF,
        dueDate,
        linkedTrackId: links.linkedTrackId,
        linkedProjectId: links.linkedProjectId,
        linkedSpecialistCategory: body.linkedSpecialistCategory ?? null,
        sortIndex: (lastTask?.sortIndex ?? -1) + 1
      }
    });

    return getGoalDetailForUser(tx, user.id, goal.id);
  });

  if (!updatedGoal) {
    throw apiError(404, "Цель не найдена.");
  }

  const trajectoryReview = await getGoalTrajectoryReview(prisma, user.id, updatedGoal, today);

  return NextResponse.json(
    serializeGoalDetail(updatedGoal, identityProfile, {
      trajectoryReview
    }),
    { status: 201 }
  );
});
