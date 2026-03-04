import { ArtistGoalType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import {
  createGoalWithTemplate,
  getGoalTrajectoryReview,
  getIdentityProfile,
  goalDetailInclude,
  serializeGoalDetail,
  todayToDateOnly
} from "@/lib/artist-growth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const createGoalSchema = z.object({
  type: z.nativeEnum(ArtistGoalType),
  title: z.string().trim().min(3).max(140),
  whyNow: z.string().trim().max(500).optional().nullable(),
  successDefinition: z.string().trim().max(500).optional().nullable(),
  targetDate: z.string().trim().max(40).optional().nullable(),
  isPrimary: z.boolean().optional()
});

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw apiError(400, "Некорректная дата цели.");
  }
  return parsed;
}

function isMissingTableError(error: unknown, tableName: string) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("does not exist in the current database") && message.includes(tableName.toLowerCase());
}

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const today = todayToDateOnly(new Date());

  try {
    const [goals, identityProfile] = await Promise.all([
      prisma.artistGoal.findMany({
        where: {
          userId: user.id
        },
        include: goalDetailInclude,
        orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }]
      }),
      getIdentityProfile(prisma, user.id)
    ]);

    const trajectoryReviews = await Promise.all(
      goals.map(async (goal) => ({
        goalId: goal.id,
        trajectoryReview: await getGoalTrajectoryReview(prisma, user.id, goal, today)
      }))
    );
    const trajectoryByGoalId = new Map(trajectoryReviews.map((item) => [item.goalId, item.trajectoryReview]));

    return NextResponse.json({
      items: goals.map((goal) =>
        serializeGoalDetail(goal, identityProfile, {
          trajectoryReview: trajectoryByGoalId.get(goal.id) ?? null
        })
      )
    });
  } catch (error) {
    if (isMissingTableError(error, "artistgoal")) {
      return NextResponse.json({ items: [] });
    }
    throw error;
  }
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createGoalSchema);
  const targetDate = parseOptionalDate(body.targetDate);
  const today = todayToDateOnly(new Date());

  const created = await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: {
        pathStageId: true,
        pathStage: {
          select: {
            order: true
          }
        }
      }
    });
    if (!currentUser) {
      throw apiError(404, "Пользователь не найден.");
    }

    const identityProfile = await tx.artistIdentityProfile.findUnique({
      where: { userId: user.id }
    });

    const hasPrimary = await tx.artistGoal.count({
      where: {
        userId: user.id,
        status: "ACTIVE",
        isPrimary: true
      }
    });

    return createGoalWithTemplate(tx, user.id, {
      type: body.type,
      title: body.title,
      whyNow: body.whyNow,
      successDefinition: body.successDefinition,
      targetDate,
      isPrimary: body.isPrimary ?? hasPrimary === 0,
      createdFromPathStageId: currentUser.pathStageId,
      stageOrder: currentUser.pathStage?.order ?? 1,
      identityProfile
    });
  });
  const identityProfile = await getIdentityProfile(prisma, user.id);
  const trajectoryReview = await getGoalTrajectoryReview(prisma, user.id, created, today);

  return NextResponse.json(
    serializeGoalDetail(created, identityProfile, {
      trajectoryReview
    }),
    { status: 201 }
  );
});
