import {
  ArtistGoalStatus,
  GoalFactor,
  NextStepStatus,
  Prisma,
  PrismaClient,
  type ArtistGoalType,
  type TrackWorkbenchState
} from "@prisma/client";

import { buildDiagnostics, ensureTodayFocus, getPrimaryGoalDetail, todayToDateOnly } from "@/lib/artist-growth";
import { getWeekStart } from "@/lib/artist-growth";
import { getDayLoopOverview, listActiveWorkshopTracks } from "@/lib/day-loop";
import { feedbackRequestSummarySelect, buildTrackFeedbackSummary } from "@/lib/feedback";
import { LEARN_MOCK_MATERIALS, type LearnMaterialRecord } from "@/lib/learn/mock-materials";
import { getLearnMatchReasonLabel } from "@/lib/learn/providers";
import { getLearnProgressMap, serializeLearnProgress, type LearnProgressRecord } from "@/lib/learn/progress";
import { materialRecordToPublicItem } from "@/lib/learn/repository";
import { buildRecommendationCard } from "@/lib/recommendations";
import type {
  LearnContextBlock,
  LearnContextItem,
  LearnMatchReason,
  LearnProblemType,
  LearnSurface
} from "@/lib/learn/types";

type DbClient = PrismaClient;

const trackContextInclude = {
  pathStage: {
    select: {
      id: true,
      order: true,
      name: true
    }
  },
  nextSteps: {
    where: {
      status: NextStepStatus.ACTIVE
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1
  },
  distributionRequest: {
    select: {
      id: true
    }
  },
  feedbackRequests: {
    orderBy: [{ updatedAt: "desc" }],
    select: feedbackRequestSummarySelect
  }
} satisfies Prisma.TrackInclude;

type TrackContextRecord = Prisma.TrackGetPayload<{ include: typeof trackContextInclude }>;

type GoalContextRecord = {
  id: string;
  title: string;
  type: ArtistGoalType;
};

type ResolvedLearnContext = {
  surface: LearnSurface;
  stageOrder: number | null;
  stageLabel: string | null;
  goal: GoalContextRecord | null;
  track:
    | {
        id: string;
        title: string;
        workbenchState: TrackWorkbenchState;
        hasActiveNextStep: boolean;
        pathStageOrder: number | null;
        unresolvedFeedbackCount: number;
        hasDistributionRequest: boolean;
      }
    | null;
  problemTypes: LearnProblemType[];
  title: string;
  subtitle: string;
  excludeMaterialIds: Set<string>;
};

type LearnMaterialCandidate = {
  material: LearnMaterialRecord;
  progress?: LearnProgressRecord;
  score: number;
  matchReasons: LearnMatchReason[];
};

function addProblemType(bucket: Set<LearnProblemType>, type: LearnProblemType, when: boolean) {
  if (when) {
    bucket.add(type);
  }
}

function isWithinDays(value: Date | null | undefined, days: number, now = Date.now()) {
  if (!value) return false;
  return now - value.getTime() < days * 24 * 60 * 60 * 1000;
}

function buildMatchReasons(material: LearnMaterialRecord, context: ResolvedLearnContext): LearnMatchReason[] {
  const reasons: LearnMatchReason[] = [];

  if (context.stageOrder && material.workflow.stageOrders.includes(context.stageOrder)) {
    reasons.push("PATH_STAGE");
  }
  if (context.goal?.type && material.workflow.goalTypes.includes(context.goal.type)) {
    reasons.push("GOAL_TYPE");
  }
  if (context.track?.workbenchState && material.workflow.trackStates.includes(context.track.workbenchState)) {
    reasons.push("TRACK_STATE");
  }
  if (context.problemTypes.some((item) => material.workflow.problemTypes.includes(item))) {
    reasons.push("PROBLEM_TYPE");
  }

  return reasons;
}

function scoreMaterial(material: LearnMaterialRecord, context: ResolvedLearnContext, progress: LearnProgressRecord | undefined) {
  if (context.excludeMaterialIds.has(material.id)) return null;

  if (progress?.status === "APPLIED") {
    return null;
  }

  if (progress?.status === "NOT_RELEVANT" && isWithinDays(progress.notRelevantAt, 30)) {
    return null;
  }

  const laterIsCoolingDown = progress?.status === "LATER" && isWithinDays(progress.laterAt, 3);
  if (laterIsCoolingDown) {
    return null;
  }

  const matchReasons = buildMatchReasons(material, context);
  let score = 0;

  if (matchReasons.includes("PROBLEM_TYPE")) score += 40;
  if (matchReasons.includes("TRACK_STATE")) score += 30;
  if (matchReasons.includes("GOAL_TYPE")) score += 25;
  if (matchReasons.includes("PATH_STAGE")) score += 20;
  if (material.workflow.preferredSurfaces.includes(context.surface)) score += 10;
  if (material.isFeatured) score += 5;
  if (progress?.status === "LATER" && progress.laterAt && !isWithinDays(progress.laterAt, 3)) score += 8;

  return {
    material,
    progress,
    score,
    matchReasons
  };
}

function compareCandidates(left: LearnMaterialCandidate, right: LearnMaterialCandidate) {
  if (left.score !== right.score) return right.score - left.score;

  const leftSeen = left.progress?.status ? 1 : 0;
  const rightSeen = right.progress?.status ? 1 : 0;
  if (leftSeen !== rightSeen) return leftSeen - rightSeen;

  if (left.material.sortOrder !== right.material.sortOrder) {
    return left.material.sortOrder - right.material.sortOrder;
  }

  return left.material.title.localeCompare(right.material.title, "ru");
}

function resolvePrimaryAction(context: ResolvedLearnContext): LearnContextItem["primaryAction"] {
  if (context.surface === "SONGS" && context.track) {
    return {
      kind: "APPLY_TO_TRACK",
      targetId: context.track.id,
      targetLabel: context.track.title
    };
  }

  if (context.surface === "GOALS" && context.goal) {
    return {
      kind: "APPLY_TO_GOAL",
      targetId: context.goal.id,
      targetLabel: context.goal.title
    };
  }

  if (context.surface === "TODAY" && context.track) {
    return {
      kind: "APPLY_TO_TRACK",
      targetId: context.track.id,
      targetLabel: context.track.title
    };
  }

  if (context.surface === "TODAY" && context.goal) {
    return {
      kind: "APPLY_TO_GOAL",
      targetId: context.goal.id,
      targetLabel: context.goal.title
    };
  }

  return {
    kind: "SAVE_FOR_LATER",
    targetId: null,
    targetLabel: null
  };
}

function getPrimaryActionLabel(action: LearnContextItem["primaryAction"]) {
  if (action.kind === "APPLY_TO_TRACK") {
    return action.targetLabel ? `Применить к треку: ${action.targetLabel}` : "Применить к треку";
  }

  if (action.kind === "APPLY_TO_GOAL") {
    return action.targetLabel ? `Применить к цели: ${action.targetLabel}` : "Применить к цели";
  }

  return "Вернуться позже";
}

function buildLearnRecommendationReason(matchReasons: LearnMatchReason[]) {
  if (matchReasons.length === 0) {
    return "Материал остаётся рядом с текущим рабочим циклом и пригоден для применения без AI.";
  }

  return `Подходит по сигналам: ${matchReasons.map(getLearnMatchReasonLabel).join(", ")}.`;
}

function buildContextBlock(
  context: ResolvedLearnContext,
  selected: Array<Pick<LearnMaterialCandidate, "material" | "progress" | "matchReasons">>
): LearnContextBlock {
  return {
    surface: context.surface,
    title: context.title,
    subtitle: context.subtitle,
    empty: selected.length === 0,
    items: selected.map((entry) => {
      const primaryAction = resolvePrimaryAction(context);
      return {
        material: materialRecordToPublicItem(
          entry.material,
          entry.progress ? serializeLearnProgress(entry.progress) : undefined
        ),
        matchReasons: entry.matchReasons,
        primaryAction,
        recommendation: buildRecommendationCard({
          key: `learn:context:${context.surface.toLowerCase()}:${entry.material.id}`,
          surface: "LEARN",
          kind: "LEARN_CONTEXT",
          source: "SYSTEM",
          title: entry.material.title,
          text: entry.material.summary,
          reason: buildLearnRecommendationReason(entry.matchReasons),
          primaryAction: {
            label: getPrimaryActionLabel(primaryAction),
            action: primaryAction.kind === "SAVE_FOR_LATER" ? "DISMISS" : "APPLY",
            payload:
              primaryAction.kind === "SAVE_FOR_LATER"
                ? { kind: "LATER" }
                : {
                    kind: primaryAction.kind,
                    targetId: primaryAction.targetId,
                    targetLabel: primaryAction.targetLabel
                  }
          },
          secondaryActions: [
            {
              label: "Вернуться позже",
              action: "DISMISS",
              payload: { kind: "LATER" }
            },
            {
              label: "Не подошло",
              action: "DISMISS",
              payload: { kind: "NOT_RELEVANT" }
            }
          ],
          entityRef: {
            type: "learn_material",
            id: entry.material.id
          },
          futureAiSlotKey: entry.material.id
        })
      };
    })
  };
}

function pickFallbackMaterials(
  context: ResolvedLearnContext,
  progressMap: Map<string, LearnProgressRecord>,
  limit: number
): Array<Pick<LearnMaterialCandidate, "material" | "progress" | "matchReasons">> {
  const featuredStageMatches = LEARN_MOCK_MATERIALS.filter((material) => {
    if (!material.isFeatured) return false;
    if (!context.stageOrder || !material.workflow.stageOrders.includes(context.stageOrder)) return false;
    return scoreMaterial(material, context, progressMap.get(material.id)) !== null;
  }).sort((left, right) => left.sortOrder - right.sortOrder);

  const unseenFeaturedStageMatches = featuredStageMatches.filter((material) => !progressMap.get(material.id)?.status);
  const genericFeatured = LEARN_MOCK_MATERIALS.filter((material) => {
    if (!material.isFeatured) return false;
    return scoreMaterial(material, context, progressMap.get(material.id)) !== null;
  }).sort((left, right) => left.sortOrder - right.sortOrder);

  const ordered = [...unseenFeaturedStageMatches, ...featuredStageMatches, ...genericFeatured];
  const deduped: LearnMaterialRecord[] = [];
  const seenIds = new Set<string>();
  for (const material of ordered) {
    if (seenIds.has(material.id)) continue;
    seenIds.add(material.id);
    deduped.push(material);
    if (deduped.length >= limit) break;
  }

  return deduped.map((material) => ({
    material,
    progress: progressMap.get(material.id),
    matchReasons: buildMatchReasons(material, context)
  }));
}

async function findTrackContext(db: DbClient, userId: string, trackId: string | null | undefined) {
  if (!trackId) return null;

  const track = await db.track.findFirst({
    where: {
      id: trackId,
      userId
    },
    include: trackContextInclude
  });

  if (!track) return null;

  const feedbackSummary = buildTrackFeedbackSummary(track.feedbackRequests);
  return {
    id: track.id,
    title: track.title,
    workbenchState: track.workbenchState,
    hasActiveNextStep: track.nextSteps.length > 0,
    pathStageOrder: track.pathStage?.order ?? null,
    unresolvedFeedbackCount: feedbackSummary.unresolvedItemsCount,
    hasDistributionRequest: Boolean(track.distributionRequest)
  };
}

async function pickSongsAnchorTrackId(db: DbClient, userId: string) {
  const workshopTracks = await listActiveWorkshopTracks(db, userId);
  if (workshopTracks[0]?.id) return workshopTracks[0].id;

  const recentTrack = await db.track.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true }
  });

  return recentTrack?.id ?? null;
}

async function resolveGoalContext(db: DbClient, userId: string, goalId?: string | null): Promise<GoalContextRecord | null> {
  if (goalId) {
    const goal = await db.artistGoal.findFirst({
      where: {
        id: goalId,
        userId
      },
      select: {
        id: true,
        title: true,
        type: true
      }
    });
    return goal ?? null;
  }

  const goal = await db.artistGoal.findFirst({
    where: {
      userId,
      status: ArtistGoalStatus.ACTIVE,
      isPrimary: true
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true
    }
  });

  return goal ?? null;
}

async function resolveTodayContext(db: DbClient, userId: string, excludeMaterialIds: Set<string>): Promise<ResolvedLearnContext> {
  const today = todayToDateOnly(new Date());
  const weekStart = getWeekStart(today);
  const [user, primaryGoal, checkIn, weeklyActivity, trackCount, projectCount, requestCount, dayLoop] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        pathStage: {
          select: {
            order: true,
            name: true
          }
        }
      }
    }),
    getPrimaryGoalDetail(db, userId),
    db.dailyCheckIn.findUnique({
      where: {
        userId_date: {
          userId,
          date: today
        }
      }
    }),
    db.weeklyActivity.findUnique({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate: weekStart
        }
      }
    }),
    db.track.count({ where: { userId } }),
    db.project.count({ where: { userId } }),
    db.inAppRequest.count({ where: { artistUserId: userId } }),
    getDayLoopOverview(db, userId, today)
  ]);

  const completedFocusCount = await db.dailyFocus.count({
    where: {
      userId,
      isCompleted: true,
      date: {
        gte: weekStart,
        lte: today
      }
    }
  });

  const diagnostics = buildDiagnostics({
    goal: primaryGoal,
    identityProfile: await db.artistIdentityProfile.findUnique({ where: { userId } }),
    weeklyActiveDays: Math.max(0, Math.min(7, weeklyActivity?.activeDays ?? 0)),
    hasCheckIn: Boolean(checkIn),
    completedFocusCount,
    requestCount,
    trackCount,
    projectCount
  });
  const biggestRisk = diagnostics.find((item) => item.state !== "STRONG") ?? diagnostics[0] ?? null;
  const ensuredTodayFocus = primaryGoal ? await ensureTodayFocus(db, userId, today, primaryGoal) : null;
  const todayFocusTrackId = ensuredTodayFocus?.goalTask.linkedTrackId ?? dayLoop.focus?.track.id ?? null;
  const track = await findTrackContext(db, userId, todayFocusTrackId);

  const problemTypes = new Set<LearnProblemType>();
  addProblemType(problemTypes, "DIRECTION", !primaryGoal);
  addProblemType(
    problemTypes,
    "DIRECTION",
    Boolean(biggestRisk && ["DIRECTION", "ARTIST_WORLD", "CATALOG"].includes(biggestRisk.factor))
  );
  addProblemType(problemTypes, "MOMENTUM", !dayLoop.focus?.track);
  addProblemType(
    problemTypes,
    "MOMENTUM",
    Boolean(track && (track.workbenchState === "STUCK" || track.workbenchState === "DEFERRED" || track.workbenchState === "READY_FOR_NEXT_STEP"))
  );
  addProblemType(problemTypes, "MOMENTUM", Boolean(track && !track.hasActiveNextStep));
  addProblemType(problemTypes, "FEEDBACK", Boolean(track && (track.workbenchState === "NEEDS_FEEDBACK" || track.unresolvedFeedbackCount > 0)));
  addProblemType(
    problemTypes,
    "RELEASE_PLANNING",
    Boolean(primaryGoal?.type === "ALBUM_RELEASE" || (track && track.pathStageOrder !== null && track.pathStageOrder >= 6 && !track.hasDistributionRequest))
  );

  return {
    surface: "TODAY",
    stageOrder: user?.pathStage?.order ?? 1,
    stageLabel: user?.pathStage?.name ?? "Искра",
    goal: primaryGoal
      ? {
          id: primaryGoal.id,
          title: primaryGoal.title,
          type: primaryGoal.type
        }
      : null,
    track,
    problemTypes: [...problemTypes],
    title: "Learn для сегодняшнего цикла",
    subtitle: track
      ? `Подобрано под трек «${track.title}» и текущее состояние работы.`
      : primaryGoal
        ? `Подборка под главную цель «${primaryGoal.title}».`
        : "Материалы для мягкого входа в рабочий цикл.",
    excludeMaterialIds
  };
}

async function resolveGoalsContext(
  db: DbClient,
  userId: string,
  goalId: string | null | undefined,
  excludeMaterialIds: Set<string>
): Promise<ResolvedLearnContext> {
  const [user, goal] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        pathStage: {
          select: {
            order: true,
            name: true
          }
        }
      }
    }),
    resolveGoalContext(db, userId, goalId)
  ]);

  const problemTypes = new Set<LearnProblemType>();
  addProblemType(problemTypes, "DIRECTION", !goal);
  addProblemType(problemTypes, "RELEASE_PLANNING", goal?.type === "ALBUM_RELEASE");

  return {
    surface: "GOALS",
    stageOrder: user?.pathStage?.order ?? 1,
    stageLabel: user?.pathStage?.name ?? "Искра",
    goal,
    track: null,
    problemTypes: [...problemTypes],
    title: goal ? "Learn для главной цели" : "Learn для постановки цели",
    subtitle: goal
      ? `Материалы, которые поддерживают цель «${goal.title}».`
      : "Подборка, которая помогает собрать направление и критерий успеха.",
    excludeMaterialIds
  };
}

async function resolveSongsContext(
  db: DbClient,
  userId: string,
  trackId: string | null | undefined,
  excludeMaterialIds: Set<string>
): Promise<ResolvedLearnContext> {
  const [user, anchorTrackId, primaryGoal] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        pathStage: {
          select: {
            order: true,
            name: true
          }
        }
      }
    }),
    trackId ? Promise.resolve(trackId) : pickSongsAnchorTrackId(db, userId),
    resolveGoalContext(db, userId)
  ]);

  const track = await findTrackContext(db, userId, anchorTrackId);
  const problemTypes = new Set<LearnProblemType>();
  addProblemType(
    problemTypes,
    "MOMENTUM",
    Boolean(track && (track.workbenchState === "STUCK" || track.workbenchState === "DEFERRED" || track.workbenchState === "READY_FOR_NEXT_STEP"))
  );
  addProblemType(problemTypes, "MOMENTUM", Boolean(track && !track.hasActiveNextStep));
  addProblemType(problemTypes, "FEEDBACK", Boolean(track && (track.workbenchState === "NEEDS_FEEDBACK" || track.unresolvedFeedbackCount > 0)));
  addProblemType(
    problemTypes,
    "RELEASE_PLANNING",
    Boolean(primaryGoal?.type === "ALBUM_RELEASE" || (track && track.pathStageOrder !== null && track.pathStageOrder >= 6 && !track.hasDistributionRequest))
  );

  return {
    surface: "SONGS",
    stageOrder: track?.pathStageOrder ?? user?.pathStage?.order ?? 1,
    stageLabel: user?.pathStage?.name ?? "Искра",
    goal: primaryGoal,
    track,
    problemTypes: [...problemTypes],
    title: "Learn в рабочем треке",
    subtitle: track
      ? `Материалы под текущее состояние трека «${track.title}».`
      : "Подборка по текущему PATH-этапу, пока рабочий трек ещё не выбран.",
    excludeMaterialIds
  };
}

export async function getLearnContextBlock(
  db: DbClient,
  userId: string,
  input: {
    surface: LearnSurface;
    trackId?: string | null;
    goalId?: string | null;
    limit?: number;
    excludeMaterialIds?: string[];
  }
) {
  const limit = Math.max(1, Math.min(6, input.limit ?? 3));
  const progressMap = await getLearnProgressMap(db, userId);
  const excludeMaterialIds = new Set(input.excludeMaterialIds ?? []);

  const context =
    input.surface === "TODAY"
      ? await resolveTodayContext(db, userId, excludeMaterialIds)
      : input.surface === "GOALS"
        ? await resolveGoalsContext(db, userId, input.goalId, excludeMaterialIds)
        : await resolveSongsContext(db, userId, input.trackId, excludeMaterialIds);

  const scored = LEARN_MOCK_MATERIALS.map((material) => scoreMaterial(material, context, progressMap.get(material.id)))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort(compareCandidates);

  let selected: Array<Pick<LearnMaterialCandidate, "material" | "progress" | "matchReasons">> = scored
    .filter((item) => item.score > 0)
    .slice(0, limit);
  if (selected.length === 0) {
    selected = pickFallbackMaterials(context, progressMap, limit);
  }

  return buildContextBlock(context, selected);
}
