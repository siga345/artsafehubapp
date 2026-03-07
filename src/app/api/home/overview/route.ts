import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import {
  buildDiagnostics,
  ensureTodayFocus,
  getGoalTrajectoryReview,
  getIdentityProfile,
  getPrimaryGoalDetail,
  getWeekStart as getCommandCenterWeekStart,
  serializePrimaryGoalSummary,
  serializeTodayFocus
} from "@/lib/artist-growth";
import { getDayLoopOverview } from "@/lib/day-loop";
import { getLearnContextBlock } from "@/lib/learn/context";
import { canonicalizePathStage, getCanonicalPathStageLabel } from "@/lib/path-stages";
import type { OnboardingChecklistState, OnboardingStepDto } from "@/lib/in-app-requests";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getWeekStart(dateOnly: Date) {
  const dayOfWeek = dateOnly.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(dateOnly);
  weekStartDate.setUTCDate(dateOnly.getUTCDate() + mondayOffset);
  return weekStartDate;
}

const defaultStage = getCanonicalPathStageLabel(1);

const stageFallback = {
  id: 0,
  order: 1,
  name: defaultStage?.name ?? "Искра",
  iconKey: defaultStage?.iconKey ?? "spark",
  description: defaultStage?.description ?? "Творческий порыв"
};

async function getCommandCenterDataSafe(input: {
  userId: string;
  today: Date;
  checkInExists: boolean;
  weeklyActiveDays: number;
  trackCount: number;
  projectCount: number;
  requestCount: number;
}) {
  const weekStartDate = getCommandCenterWeekStart(input.today);
  const [identityProfile, primaryGoal, completedFocusCount] = await Promise.all([
    getIdentityProfile(prisma, input.userId),
    getPrimaryGoalDetail(prisma, input.userId),
    prisma.dailyFocus.count({
      where: {
        userId: input.userId,
        isCompleted: true,
        date: {
          gte: weekStartDate,
          lte: input.today
        }
      }
    })
  ]);

  const [todayFocus, trajectoryReview] = primaryGoal
    ? await Promise.all([
        ensureTodayFocus(prisma, input.userId, input.today, primaryGoal),
        getGoalTrajectoryReview(prisma, input.userId, primaryGoal, input.today)
      ])
    : [null, null];
  const diagnostics = buildDiagnostics({
    goal: primaryGoal,
    trajectoryReview,
    identityProfile,
    weeklyActiveDays: input.weeklyActiveDays,
    hasCheckIn: input.checkInExists,
    completedFocusCount,
    requestCount: input.requestCount,
    trackCount: input.trackCount,
    projectCount: input.projectCount
  });
  const biggestRisk = diagnostics.find((item) => item.state !== "STRONG") ?? diagnostics[0] ?? null;

  return {
    position: {
      biggestRisk
    },
    primaryGoal: serializePrimaryGoalSummary(primaryGoal, identityProfile, {
      trajectoryReview
    }),
    todayFocus: serializeTodayFocus(primaryGoal, identityProfile, todayFocus, {
      trajectoryReview
    }),
    diagnostics
  };
}

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());
  const weekStartDate = getWeekStart(today);

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      nickname: true,
      links: true,
      pathStage: true
    }
  });

  const currentStage = currentUser?.pathStage ? canonicalizePathStage(currentUser.pathStage) : stageFallback;

  const [checkIn, microStep, weeklyActivity, onboardingState, trackCount, demoCount, projectCount, requestCount, dayLoop] = await Promise.all([
    prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId: user.id, date: today } }
    }),
    prisma.dailyMicroStep.findUnique({
      where: { userId_date: { userId: user.id, date: today } }
    }),
    prisma.weeklyActivity.findUnique({
      where: { userId_weekStartDate: { userId: user.id, weekStartDate } }
    }),
    prisma.userOnboardingState.findUnique({ where: { userId: user.id } }),
    prisma.track.count({
      where: { userId: user.id }
    }),
    prisma.demo.count({
      where: { track: { userId: user.id } }
    }),
    prisma.project.count({
      where: { userId: user.id }
    }),
    prisma.inAppRequest.count({ where: { artistUserId: user.id } }),
    getDayLoopOverview(prisma, user.id, today)
  ]);

  const linksObject =
    currentUser?.links && typeof currentUser.links === "object" && !Array.isArray(currentUser.links)
      ? (currentUser.links as Record<string, unknown>)
      : null;
  const hasAnyProfileLink = Boolean(
    linksObject &&
      Object.values(linksObject).some((value) => typeof value === "string" && value.trim().length > 0)
  );

  const onboardingSteps: OnboardingStepDto[] = [
    {
      id: "profile",
      title: "Заполнить профиль",
      description: "Добавь минимум одну ссылку в SAFE ID.",
      href: "/id",
      completed: Boolean(currentUser?.nickname?.trim()) && hasAnyProfileLink
    },
    {
      id: "first_song",
      title: "Создать первую песню",
      description: "Добавь первый трек в Songs.",
      href: "/songs",
      completed: trackCount > 0
    },
    {
      id: "first_demo",
      title: "Загрузить первую версию",
      description: "Добавь демо или аудио-версию к треку.",
      href: "/songs",
      completed: demoCount > 0
    },
    {
      id: "first_request",
      title: "Отправить первую заявку",
      description: "Найди специалиста и отправь запрос.",
      href: "/find",
      completed: requestCount > 0
    },
    {
      id: "daily_checkin",
      title: "Сделать daily check-in",
      description: "Зафиксируй настроение на сегодня.",
      href: "/today",
      completed: Boolean(checkIn)
    }
  ];

  const completedCount = onboardingSteps.filter((step) => step.completed).length;
  const nextStep = onboardingSteps.find((step) => !step.completed) ?? null;
  const isSparkStage = currentStage.order === 1;
  const onboarding: OnboardingChecklistState = {
    isVisible: isSparkStage && !onboardingState?.dismissedAt && completedCount < onboardingSteps.length,
    dismissedAt: onboardingState?.dismissedAt ? onboardingState.dismissedAt.toISOString() : null,
    completedCount,
    totalCount: onboardingSteps.length,
    steps: onboardingSteps,
    nextStep
  };

  const weeklyActiveDays = Math.max(0, Math.min(7, weeklyActivity?.activeDays ?? 0));
  const commandCenter = await getCommandCenterDataSafe({
    userId: user.id,
    today,
    checkInExists: Boolean(checkIn),
    weeklyActiveDays,
    trackCount,
    projectCount,
    requestCount
  });
  const todayLearn = await getLearnContextBlock(prisma, user.id, {
    surface: "TODAY"
  });
  const learnGoalId = commandCenter?.primaryGoal?.id ?? (await getPrimaryGoalDetail(prisma, user.id))?.id ?? null;
  const goalsLearn = learnGoalId
    ? await getLearnContextBlock(prisma, user.id, {
        surface: "GOALS",
        goalId: learnGoalId,
        excludeMaterialIds: todayLearn.items.map((item) => item.material.id)
      })
    : null;

  return NextResponse.json({
    today: today.toISOString(),
    stage: currentStage,
    checkIn,
    microStep,
    weeklyActiveDays,
    onboarding,
    commandCenter,
    dayLoop,
    learn: {
      today: todayLearn,
      goals: goalsLearn
    }
  });
});
