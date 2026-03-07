import { GoalMotionType, GoalTaskStatus, TaskPriority } from "@prisma/client";
import type { RecommendationCard } from "@/contracts/recommendations";
import { buildRecommendationCard } from "@/lib/recommendations";
import { buildTrackFeedbackSummary } from "@/lib/feedback";
import {
  type DbClient,
  type GoalDetailRecord,
  type GoalTaskRecord,
  type DailyFocusWithTaskRecord,
  dailyFocusInclude,
  roundToTwo
} from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GoalBalanceState = "BALANCED" | "CRAFT_HEAVY" | "CREATIVE_HEAVY";
export type GoalFocusState = "CENTERED" | "SCATTERED";
export type GoalDeliveryState = "DELIVERING" | "AT_RISK" | "NO_FINISHING";
export type GoalTrajectoryOverallState = "HEALTHY" | "OFF_BALANCE" | "AT_RISK";
export type GoalReviewConfidence = "high" | "low";
export type TodayFocusCycleNeed =
  | "FINISH_OPEN_LOOP"
  | "REBALANCE_CREATIVE"
  | "REBALANCE_CRAFT"
  | "RESPOND_TO_FEEDBACK"
  | "ADVANCE_READY_TRACK"
  | "NONE";

export type GoalTrajectoryReview = {
  windowStart: string;
  windowEnd: string;
  overallState: GoalTrajectoryOverallState;
  balanceState: GoalBalanceState;
  focusState: GoalFocusState;
  deliveryState: GoalDeliveryState;
  weeklyFocusCount: number;
  completedThisWeek: number;
  focusCompletionRate: number;
  openInProgressCount: number;
  craftFocusCount: number;
  creativeFocusCount: number;
  craftShare: number;
  creativeShare: number;
  dominantMotionType: GoalMotionType | null;
  confidence: GoalReviewConfidence;
  summary: string;
  recommendation: RecommendationCard;
};

// ─── Internal helpers ────────────────────────────────────────────────────────

export function buildSystemRecommendation(input: {
  key: string;
  kind: "DIAGNOSTIC" | "GOAL_ACTION" | "TODAY_FOCUS";
  title: string;
  text: string;
  reason?: string | null;
  href: string;
  entityRef?: RecommendationCard["entityRef"];
}) {
  return buildRecommendationCard({
    key: input.key,
    surface: "HOME_COMMAND_CENTER",
    kind: input.kind,
    source: "SYSTEM",
    title: input.title,
    text: input.text,
    reason: input.reason ?? null,
    primaryAction: {
      label: input.title,
      href: input.href,
      action: "NAVIGATE"
    },
    secondaryActions: [],
    entityRef: input.entityRef ?? null,
    futureAiSlotKey: input.key
  });
}

function isGoalTaskOpen(task: GoalTaskRecord) {
  return task.status === GoalTaskStatus.TODO || task.status === GoalTaskStatus.IN_PROGRESS;
}

export function getOpenGoalTasks(goal: GoalDetailRecord) {
  return goal.pillars.flatMap((pillar) =>
    pillar.tasks.filter(isGoalTaskOpen).map((task) => ({
      pillar,
      task
    }))
  );
}

function getTaskFeedbackCount(task: GoalTaskRecord) {
  return task.linkedTrack ? buildTrackFeedbackSummary(task.linkedTrack.feedbackRequests).unresolvedItemsCount : 0;
}

export function taskNeedsFeedback(task: GoalTaskRecord) {
  return Boolean(
    task.linkedTrack &&
      (task.linkedTrack.workbenchState === "NEEDS_FEEDBACK" || buildTrackFeedbackSummary(task.linkedTrack.feedbackRequests).unresolvedItemsCount > 0)
  );
}

export function taskCanAdvanceTrack(task: GoalTaskRecord) {
  return Boolean(task.linkedTrack && task.linkedTrack.workbenchState === "READY_FOR_NEXT_STEP" && task.linkedTrack.nextSteps[0]);
}

function priorityRank(priority: TaskPriority) {
  switch (priority) {
    case TaskPriority.HIGH:
      return 0;
    case TaskPriority.MEDIUM:
      return 1;
    default:
      return 2;
  }
}

function dueDateRank(value: Date | null) {
  return value ? value.getTime() : Number.MAX_SAFE_INTEGER;
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export function computeGoalMotionBalance(goal: GoalDetailRecord, weeklyFocuses: DailyFocusWithTaskRecord[]) {
  const eligibleTasks = getOpenGoalTasks(goal);
  const availableCraft = eligibleTasks.some(({ task }) => task.motionType === GoalMotionType.CRAFT);
  const availableCreative = eligibleTasks.some(({ task }) => task.motionType === GoalMotionType.CREATIVE);
  const useFocusHistory = weeklyFocuses.length >= 2;

  const counts = useFocusHistory
    ? weeklyFocuses.reduce(
        (sum, focus) => {
          if (focus.goalTask.motionType === GoalMotionType.CRAFT) {
            sum.craftFocusCount += 1;
          } else {
            sum.creativeFocusCount += 1;
          }
          return sum;
        },
        { craftFocusCount: 0, creativeFocusCount: 0 }
      )
    : eligibleTasks.reduce(
        (sum, item) => {
          if (item.task.motionType === GoalMotionType.CRAFT) {
            sum.craftFocusCount += 1;
          } else {
            sum.creativeFocusCount += 1;
          }
          return sum;
        },
        { craftFocusCount: 0, creativeFocusCount: 0 }
      );

  const total = counts.craftFocusCount + counts.creativeFocusCount;
  const craftShare = total > 0 ? roundToTwo(counts.craftFocusCount / total) : 0;
  const creativeShare = total > 0 ? roundToTwo(counts.creativeFocusCount / total) : 0;

  let balanceState: GoalBalanceState = "BALANCED";
  if (craftShare >= 0.7 && availableCreative) {
    balanceState = "CRAFT_HEAVY";
  } else if (creativeShare >= 0.7 && availableCraft) {
    balanceState = "CREATIVE_HEAVY";
  }

  const confidence: GoalReviewConfidence = useFocusHistory ? "high" : "low";

  return {
    balanceState,
    craftFocusCount: counts.craftFocusCount,
    creativeFocusCount: counts.creativeFocusCount,
    craftShare,
    creativeShare,
    dominantMotionType:
      counts.craftFocusCount === counts.creativeFocusCount
        ? null
        : counts.craftFocusCount > counts.creativeFocusCount
          ? GoalMotionType.CRAFT
          : GoalMotionType.CREATIVE,
    confidence
  };
}

// ─── Trajectory summary ──────────────────────────────────────────────────────

function buildTrajectorySummary(review: {
  overallState: GoalTrajectoryOverallState;
  balanceState: GoalBalanceState;
  focusState: GoalFocusState;
  deliveryState: GoalDeliveryState;
}) {
  if (review.focusState === "SCATTERED") {
    return {
      summary: "Фокус распадается: открытых циклов слишком много, и система тянет к доведению.",
      actionLabel: "Сузить фокус дня",
      actionHref: "/today"
    };
  }

  if (review.deliveryState === "NO_FINISHING") {
    return {
      summary: "Есть движение без завершений: артист работает, но не закрывает петли и не переводит усилие в результат.",
      actionLabel: "Вернуться к незавершённым задачам",
      actionHref: "/today#goal-plan"
    };
  }

  if (review.balanceState === "CRAFT_HEAVY") {
    return {
      summary: "Неделя перегружена ремеслом и операционкой: циклу не хватает творческого шага.",
      actionLabel: "Добавить creative-фокус",
      actionHref: "/today#goal-plan"
    };
  }

  if (review.balanceState === "CREATIVE_HEAVY") {
    return {
      summary: "Идей и разработок много, но циклу не хватает ремесленного доведения и упаковки.",
      actionLabel: "Добавить craft-фокус",
      actionHref: "/today#goal-plan"
    };
  }

  if (review.deliveryState === "AT_RISK") {
    return {
      summary: "Прогресс есть, но он хрупкий: завершения случаются редко, и неделя легко уходит в распад.",
      actionLabel: "Укрепить ритм",
      actionHref: "/today"
    };
  }

  return {
    summary: "Траектория выглядит здоровой: баланс ремесла и творчества поддерживает реальное движение.",
    actionLabel: "Сохранить цикл",
    actionHref: "/today"
  };
}

// ─── Trajectory review ───────────────────────────────────────────────────────

export function getWeekStart(dateOnly: Date) {
  const dayOfWeek = dateOnly.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(dateOnly);
  weekStartDate.setUTCDate(dateOnly.getUTCDate() + mondayOffset);
  return weekStartDate;
}

export function todayToDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function computeGoalTrajectoryReview(input: {
  goal: GoalDetailRecord;
  weeklyFocuses: DailyFocusWithTaskRecord[];
  date: Date;
}) {
  const balance = computeGoalMotionBalance(input.goal, input.weeklyFocuses);
  const openInProgressCount = input.goal.pillars.reduce(
    (sum, pillar) => sum + pillar.tasks.filter((task) => task.status === GoalTaskStatus.IN_PROGRESS).length,
    0
  );
  const weeklyFocusCount = input.weeklyFocuses.length;
  const completedThisWeek = input.weeklyFocuses.filter((focus) => focus.isCompleted).length;
  const focusCompletionRate = weeklyFocusCount > 0 ? roundToTwo(completedThisWeek / weeklyFocusCount) : 0;
  const distinctWeeklyTaskCount = new Set(input.weeklyFocuses.map((focus) => focus.goalTaskId)).size;

  const focusState: GoalFocusState =
    openInProgressCount >= 4 || (distinctWeeklyTaskCount >= 3 && completedThisWeek === 0) ? "SCATTERED" : "CENTERED";

  let deliveryState: GoalDeliveryState = "DELIVERING";
  if (completedThisWeek === 0 && openInProgressCount >= 2) {
    deliveryState = "NO_FINISHING";
  } else if (completedThisWeek === 1 && focusCompletionRate < 0.5) {
    deliveryState = "AT_RISK";
  }

  let overallState: GoalTrajectoryOverallState = "HEALTHY";
  if (focusState === "SCATTERED" || deliveryState === "NO_FINISHING") {
    overallState = "AT_RISK";
  } else if (balance.balanceState !== "BALANCED") {
    overallState = "OFF_BALANCE";
  }

  const summary = buildTrajectorySummary({
    overallState,
    balanceState: balance.balanceState,
    focusState,
    deliveryState
  });

  return {
    windowStart: getWeekStart(input.date).toISOString(),
    windowEnd: input.date.toISOString(),
    overallState,
    balanceState: balance.balanceState,
    focusState,
    deliveryState,
    weeklyFocusCount,
    completedThisWeek,
    focusCompletionRate,
    openInProgressCount,
    craftFocusCount: balance.craftFocusCount,
    creativeFocusCount: balance.creativeFocusCount,
    craftShare: balance.craftShare,
    creativeShare: balance.creativeShare,
    dominantMotionType: balance.dominantMotionType,
    confidence: balance.confidence,
    summary: summary.summary,
    recommendation: buildSystemRecommendation({
      key: `home:trajectory:${input.goal.id}`,
      kind: "GOAL_ACTION",
      title: summary.actionLabel,
      text: summary.summary,
      href: summary.actionHref,
      entityRef: {
        type: "artist_goal",
        id: input.goal.id
      }
    })
  } satisfies GoalTrajectoryReview;
}

async function getWeeklyGoalFocuses(db: DbClient, userId: string, goalId: string, date: Date) {
  return db.dailyFocus.findMany({
    where: {
      userId,
      goalId,
      date: {
        gte: getWeekStart(date),
        lte: date
      }
    },
    include: dailyFocusInclude,
    orderBy: [{ date: "asc" }]
  });
}

export async function getGoalTrajectoryReview(db: DbClient, userId: string, goal: GoalDetailRecord, date: Date) {
  const weeklyFocuses = await getWeeklyGoalFocuses(db, userId, goal.id, date);
  return computeGoalTrajectoryReview({
    goal,
    weeklyFocuses,
    date
  });
}

// ─── Cycle need & task picking ───────────────────────────────────────────────

function hasCycleNeedTask(goal: GoalDetailRecord, predicate: (task: GoalTaskRecord) => boolean) {
  return getOpenGoalTasks(goal).some(({ task }) => predicate(task));
}

export function computeTodayFocusCycleNeed(goal: GoalDetailRecord, trajectoryReview: GoalTrajectoryReview): TodayFocusCycleNeed {
  if (
    trajectoryReview.openInProgressCount >= 3 ||
    trajectoryReview.focusState === "SCATTERED" ||
    trajectoryReview.deliveryState === "NO_FINISHING"
  ) {
    return "FINISH_OPEN_LOOP";
  }

  if (trajectoryReview.balanceState === "CRAFT_HEAVY" && hasCycleNeedTask(goal, (task) => task.motionType === GoalMotionType.CREATIVE)) {
    return "REBALANCE_CREATIVE";
  }

  if (trajectoryReview.balanceState === "CREATIVE_HEAVY" && hasCycleNeedTask(goal, (task) => task.motionType === GoalMotionType.CRAFT)) {
    return "REBALANCE_CRAFT";
  }

  if (hasCycleNeedTask(goal, taskNeedsFeedback)) {
    return "RESPOND_TO_FEEDBACK";
  }

  if (hasCycleNeedTask(goal, taskCanAdvanceTrack)) {
    return "ADVANCE_READY_TRACK";
  }

  return "NONE";
}

function cycleNeedRank(cycleNeed: TodayFocusCycleNeed, task: GoalTaskRecord) {
  switch (cycleNeed) {
    case "FINISH_OPEN_LOOP":
      return task.status === GoalTaskStatus.IN_PROGRESS ? 0 : 1;
    case "REBALANCE_CREATIVE":
      return task.motionType === GoalMotionType.CREATIVE ? 0 : 1;
    case "REBALANCE_CRAFT":
      return task.motionType === GoalMotionType.CRAFT ? 0 : 1;
    case "RESPOND_TO_FEEDBACK":
      return taskNeedsFeedback(task) ? 0 : 1;
    case "ADVANCE_READY_TRACK":
      return taskCanAdvanceTrack(task) ? 0 : 1;
    default:
      return 0;
  }
}

export function pickTodayTaskV2(goal: GoalDetailRecord, trajectoryReview: GoalTrajectoryReview) {
  const cycleNeed = computeTodayFocusCycleNeed(goal, trajectoryReview);
  const tasks = getOpenGoalTasks(goal).sort((left, right) => {
    const cycleRankDelta = cycleNeedRank(cycleNeed, left.task) - cycleNeedRank(cycleNeed, right.task);
    if (cycleRankDelta !== 0) return cycleRankDelta;

    const feedbackDelta = Number(taskNeedsFeedback(right.task)) - Number(taskNeedsFeedback(left.task));
    if (feedbackDelta !== 0) return feedbackDelta;

    const readyTrackDelta = Number(taskCanAdvanceTrack(right.task)) - Number(taskCanAdvanceTrack(left.task));
    if (readyTrackDelta !== 0) return readyTrackDelta;

    const priorityDelta = priorityRank(left.task.priority) - priorityRank(right.task.priority);
    if (priorityDelta !== 0) return priorityDelta;

    const dueDateDelta = dueDateRank(left.task.dueDate) - dueDateRank(right.task.dueDate);
    if (dueDateDelta !== 0) return dueDateDelta;

    const sortIndexDelta = left.task.sortIndex - right.task.sortIndex;
    if (sortIndexDelta !== 0) return sortIndexDelta;

    return left.task.createdAt.getTime() - right.task.createdAt.getTime();
  });

  return {
    cycleNeed,
    picked: tasks[0] ?? null
  };
}
