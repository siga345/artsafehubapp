import { DailyFocusSource, FindCategory, GoalMotionType, GoalTaskStatus, TaskPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { resolveUserGoalTaskLinks } from "@/lib/goal-task-links";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const updateTaskSchema = z.object({
  status: z.nativeEnum(GoalTaskStatus).optional(),
  motionType: z.nativeEnum(GoalMotionType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().trim().max(40).optional().nullable(),
  linkedTrackId: z.string().trim().optional().nullable(),
  linkedProjectId: z.string().trim().optional().nullable(),
  linkedSpecialistCategory: z.nativeEnum(FindCategory).optional().nullable()
});

function parseOptionalDate(value?: string | null) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw apiError(400, "Некорректная дата задачи.");
  }
  return parsed;
}

export const PATCH = withApiHandler(async (request: Request, context: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateTaskSchema);
  const parsedDueDate = parseOptionalDate(body.dueDate);

  const updated = await prisma.$transaction(async (tx) => {
    const task = await tx.goalTask.findFirst({
      where: {
        id: context.params.id,
        pillar: {
          goal: {
            userId: user.id
          }
        }
      },
      include: {
        pillar: {
          select: {
            goalId: true
          }
        }
      }
    });

    if (!task) {
      throw apiError(404, "Задача не найдена.");
    }

    const links = await resolveUserGoalTaskLinks(tx, user.id, {
      linkedTrackId: body.linkedTrackId === undefined ? task.linkedTrackId : body.linkedTrackId,
      linkedProjectId: body.linkedProjectId === undefined ? task.linkedProjectId : body.linkedProjectId
    });

    const nextStatus = body.status ?? task.status;
    let startedAt = task.startedAt;
    if (nextStatus === GoalTaskStatus.IN_PROGRESS) {
      if (task.status === GoalTaskStatus.DONE || !task.startedAt) {
        startedAt = new Date();
      }
    } else if (nextStatus === GoalTaskStatus.DONE) {
      startedAt = task.startedAt ?? new Date();
    } else if (task.status === GoalTaskStatus.DONE) {
      startedAt = null;
    }
    const completedAt = nextStatus === GoalTaskStatus.DONE ? task.completedAt ?? new Date() : null;

    const saved = await tx.goalTask.update({
      where: { id: task.id },
      data: {
        status: nextStatus,
        motionType: body.motionType ?? task.motionType,
        priority: body.priority ?? task.priority,
        dueDate: parsedDueDate === undefined ? task.dueDate : parsedDueDate,
        linkedTrackId: body.linkedTrackId === undefined ? task.linkedTrackId : links.linkedTrackId,
        linkedProjectId: body.linkedProjectId === undefined ? task.linkedProjectId : links.linkedProjectId,
        linkedSpecialistCategory:
          body.linkedSpecialistCategory === undefined ? task.linkedSpecialistCategory : body.linkedSpecialistCategory,
        startedAt,
        completedAt
      }
    });

    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const focus = await tx.dailyFocus.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: todayDate
        }
      }
    });

    if (focus?.goalTaskId === task.id) {
      await tx.dailyFocus.update({
        where: { id: focus.id },
        data: {
          source: focus.source ?? DailyFocusSource.AUTO,
          isCompleted: nextStatus === GoalTaskStatus.DONE,
          completedAt: nextStatus === GoalTaskStatus.DONE ? focus.completedAt ?? new Date() : null
        }
      });
    }

    return saved;
  });

  return NextResponse.json(updated);
});
