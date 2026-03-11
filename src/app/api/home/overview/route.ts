import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import {
  buildDiagnostics,
  ensureTodayFocus,
  getGoalTrajectoryReview,
  goalDetailInclude,
  getIdentityProfile,
  getWeekStart as getCommandCenterWeekStart,
  serializePrimaryGoalSummary,
  serializeTodayFocus
} from "@/lib/artist-growth";
import { getDayLoopOverview } from "@/lib/day-loop";
import { buildRhythmOverview, getHomeRhythmWindowStart, serializeDailyTodo } from "@/lib/home-today";
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
  const [identityProfile, activeGoals, completedFocusCount] = await Promise.all([
    getIdentityProfile(prisma, input.userId),
    prisma.artistGoal.findMany({
      where: {
        userId: input.userId,
        status: "ACTIVE"
      },
      include: goalDetailInclude,
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }]
    }),
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
  const featuredGoal = activeGoals[0] ?? null;

  const trajectoryEntries = await Promise.all(
    activeGoals.map(async (goal) => ({
      goalId: goal.id,
      trajectoryReview: await getGoalTrajectoryReview(prisma, input.userId, goal, input.today)
    }))
  );
  const trajectoryByGoalId = new Map(trajectoryEntries.map((item) => [item.goalId, item.trajectoryReview]));

  const todayFocus = featuredGoal ? await ensureTodayFocus(prisma, input.userId, input.today, featuredGoal) : null;
  const trajectoryReview = featuredGoal ? trajectoryByGoalId.get(featuredGoal.id) ?? null : null;
  const diagnostics = buildDiagnostics({
    goal: featuredGoal,
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
  const activeProjects = activeGoals
    .map((goal) =>
      serializePrimaryGoalSummary(goal, identityProfile, {
        trajectoryReview: trajectoryByGoalId.get(goal.id) ?? null
      })
    )
    .filter((project): project is NonNullable<typeof project> => Boolean(project));
  const featuredProject = activeProjects[0] ?? null;
  const recommendedStart = serializeTodayFocus(featuredGoal, identityProfile, todayFocus, {
    trajectoryReview
  });
  const gapHighlights = activeProjects
    .map((project) => ({
      key: `gap:${project.id}`,
      projectId: project.id,
      projectTitle: project.title,
      projectLabel: project.projectLabel,
      state: project.gapSummary.state,
      title: project.gapSummary.title,
      message: project.gapSummary.message,
      recommendation: project.gapSummary.recommendation
    }))
    .slice(0, 5);
  const recommendations = [
    recommendedStart?.recommendation ?? null,
    ...activeProjects.flatMap((project) => project.recommendations)
  ]
    .filter(Boolean)
    .filter((item, index, items) => items.findIndex((candidate) => candidate?.key === item?.key) === index)
    .slice(0, 6);

  return {
    position: {
      biggestRisk
    },
    activeProjects,
    featuredProject,
    gapHighlights,
    recommendations,
    recommendedStart,
    primaryGoal: featuredProject,
    todayFocus: recommendedStart,
    diagnostics
  };
}

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());
  const weekStartDate = getWeekStart(today);
  const rhythmWindowStart = getHomeRhythmWindowStart(today);

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

  const [checkIn, microStep, dailyTodo, weeklyActivity, onboardingState, trackCount, demoCount, projectCount, requestCount, dayLoop, rhythmMicroSteps, rhythmDailyTodos] = await Promise.all([
    prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId: user.id, date: today } }
    }),
    prisma.dailyMicroStep.findUnique({
      where: { userId_date: { userId: user.id, date: today } }
    }),
    prisma.dailyTodo.findUnique({
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
    getDayLoopOverview(prisma, user.id, today),
    prisma.dailyMicroStep.findMany({
      where: {
        userId: user.id,
        date: {
          gte: rhythmWindowStart,
          lte: today
        }
      },
      select: {
        date: true,
        isCompleted: true
      }
    }),
    prisma.dailyTodo.findMany({
      where: {
        userId: user.id,
        date: {
          gte: rhythmWindowStart,
          lte: today
        }
      },
      select: {
        date: true,
        items: true
      }
    })
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
  const serializedDailyTodo = serializeDailyTodo(today, dailyTodo?.items ?? []);
  const rhythm = buildRhythmOverview({
    today,
    microSteps: rhythmMicroSteps,
    dailyTodos: rhythmDailyTodos
  });
  const commandCenter = await getCommandCenterDataSafe({
    userId: user.id,
    today,
    checkInExists: Boolean(checkIn),
    weeklyActiveDays,
    trackCount,
    projectCount,
    requestCount
  });

  return NextResponse.json({
    today: today.toISOString(),
    stage: currentStage,
    checkIn,
    microStep,
    dailyTodo: serializedDailyTodo,
    rhythm,
    onboarding,
    commandCenter,
    dayLoop
  });
});
