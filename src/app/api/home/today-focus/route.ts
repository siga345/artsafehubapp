import { DailyFocusSource, GoalTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import {
  dailyFocusInclude,
  getGoalTrajectoryReview,
  getIdentityProfile,
  getPrimaryGoalDetail,
  serializeTodayFocus,
  todayToDateOnly
} from "@/lib/artist-growth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const selectTaskSchema = z.object({
  taskId: z.string().min(1)
});

const updateFocusSchema = z.object({
  isCompleted: z.boolean()
});

export const PUT = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, selectTaskSchema);
  const today = todayToDateOnly(new Date());
  const identityProfile = await getIdentityProfile(prisma, user.id);

  const result = await prisma.$transaction(async (tx) => {
    const goal = await getPrimaryGoalDetail(tx, user.id);
    if (!goal) {
      throw apiError(400, "Сначала выбери главную активную цель.");
    }

    const task = goal.pillars.flatMap((pillar) => pillar.tasks).find((item) => item.id === body.taskId);
    if (!task) {
      throw apiError(400, "Эта задача не принадлежит главной цели.");
    }

    if (task.status === GoalTaskStatus.BLOCKED || task.status === GoalTaskStatus.DONE) {
      throw apiError(400, "Эту задачу нельзя закрепить на сегодня.");
    }

    const focus = await tx.dailyFocus.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      },
      update: {
        goalId: goal.id,
        goalTaskId: task.id,
        source: DailyFocusSource.MANUAL,
        isCompleted: false,
        completedAt: null
      },
      create: {
        userId: user.id,
        date: today,
        goalId: goal.id,
        goalTaskId: task.id,
        source: DailyFocusSource.MANUAL
      },
      include: dailyFocusInclude
    });

    if (task.status === GoalTaskStatus.TODO) {
      await tx.goalTask.update({
        where: { id: task.id },
        data: {
          status: GoalTaskStatus.IN_PROGRESS,
          startedAt: new Date()
        }
      });
    }

    return {
      goal,
      focus
    };
  });

  const trajectoryReview = await getGoalTrajectoryReview(prisma, user.id, result.goal, today);

  return NextResponse.json(
    serializeTodayFocus(result.goal, identityProfile, result.focus, {
      trajectoryReview
    })
  );
});

export const PATCH = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateFocusSchema);
  const today = todayToDateOnly(new Date());
  const identityProfile = await getIdentityProfile(prisma, user.id);

  const result = await prisma.$transaction(async (tx) => {
    const focus = await tx.dailyFocus.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      },
      include: dailyFocusInclude
    });

    if (!focus) {
      throw apiError(404, "Фокус на сегодня не найден.");
    }

    const goal = await getPrimaryGoalDetail(tx, user.id);
    if (!goal) {
      throw apiError(400, "Сначала выбери главную активную цель.");
    }

    await tx.dailyFocus.update({
      where: { id: focus.id },
      data: {
        isCompleted: body.isCompleted,
        completedAt: body.isCompleted ? focus.completedAt ?? new Date() : null
      }
    });

    await tx.goalTask.update({
      where: { id: focus.goalTaskId },
      data: {
        status: body.isCompleted ? GoalTaskStatus.DONE : GoalTaskStatus.IN_PROGRESS,
        startedAt: body.isCompleted
          ? focus.goalTask.startedAt ?? new Date()
          : focus.goalTask.status === GoalTaskStatus.DONE
            ? new Date()
            : focus.goalTask.startedAt ?? new Date(),
        completedAt: body.isCompleted ? new Date() : null
      }
    });

    const refreshedFocus = await tx.dailyFocus.findUniqueOrThrow({
      where: { id: focus.id },
      include: dailyFocusInclude
    });

    return {
      goal,
      focus: refreshedFocus
    };
  });

  const trajectoryReview = await getGoalTrajectoryReview(prisma, user.id, result.goal, today);

  return NextResponse.json(
    serializeTodayFocus(result.goal, identityProfile, result.focus, {
      trajectoryReview
    })
  );
});
