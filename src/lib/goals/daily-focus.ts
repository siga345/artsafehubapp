import {
  ArtistGoalStatus,
  DailyFocusSource,
  ExecutionTemplate,
  GoalMotionType,
  GoalTaskStatus
} from "@prisma/client";
import type { RecommendationCard } from "@/contracts/recommendations";
import {
  buildTrackIdentityBridge,
  buildGoalIdentityBridge,
  buildTodayContextBridge,
  type GoalIdentityBridge
} from "@/lib/id-integration";
import { buildTrackFeedbackSummary } from "@/lib/feedback";
import { buildRecommendationCard, mapDailyFocusSourceToRecommendationSource } from "@/lib/recommendations";
import { getWorkbenchStateLabel, serializeActiveNextStep } from "@/lib/track-workbench";
import type { ArtistWorldInput } from "@/lib/artist-world";
import {
  type DbClient,
  type GoalDetailRecord,
  type GoalTaskRecord,
  type DailyFocusWithTaskRecord,
  goalDetailInclude,
  dailyFocusInclude
} from "./types";
import {
  artistGoalTypeLabels,
  executionTemplateLabels,
  goalFactorLabels,
  getGoalTypeForExecutionTemplate,
  goalMotionTypeLabels
} from "./templates";
import {
  type GoalTrajectoryReview,
  type TodayFocusCycleNeed,
  getGoalTrajectoryReview,
  computeTodayFocusCycleNeed,
  pickTodayTaskV2
} from "./trajectory";

// ─── Internal serialization helpers ──────────────────────────────────────────

function buildGoalBalance(goal: GoalDetailRecord) {
  const totals = goal.pillars.flatMap((pillar) => pillar.tasks).reduce(
    (sum, task) => {
      if (task.motionType === GoalMotionType.CRAFT) {
        sum.craft += 1;
      } else {
        sum.creative += 1;
      }
      return sum;
    },
    { craft: 0, creative: 0 }
  );

  return {
    craftTaskCount: totals.craft,
    creativeTaskCount: totals.creative
  };
}

function buildPillarBalance(pillar: GoalDetailRecord["pillars"][number]) {
  return pillar.tasks.reduce(
    (sum, task) => {
      if (task.motionType === GoalMotionType.CRAFT) {
        sum.craftTaskCount += 1;
      } else {
        sum.creativeTaskCount += 1;
      }
      return sum;
    },
    {
      craftTaskCount: 0,
      creativeTaskCount: 0
    }
  );
}

export function buildGoalProgress(goal: GoalDetailRecord) {
  const totalTasks = goal.pillars.reduce((sum, pillar) => sum + pillar.tasks.length, 0);
  const completedTasks = goal.pillars.reduce(
    (sum, pillar) => sum + pillar.tasks.filter((task) => task.status === GoalTaskStatus.DONE).length,
    0
  );
  return {
    completedTasks,
    totalTasks
  };
}

function serializeGoalTaskLinkedTrack(linkedTrack: GoalTaskRecord["linkedTrack"]) {
  if (!linkedTrack) return null;
  const activeNextStep = linkedTrack.nextSteps[0] ?? null;
  const feedbackSummary = buildTrackFeedbackSummary(linkedTrack.feedbackRequests);
  return {
    id: linkedTrack.id,
    title: linkedTrack.title,
    workbenchState: linkedTrack.workbenchState,
    workbenchStateLabel: getWorkbenchStateLabel(linkedTrack.workbenchState),
    activeNextStep: serializeActiveNextStep(activeNextStep),
    feedbackSummary
  };
}

function serializeGoalTask(task: GoalTaskRecord) {
  return {
    id: task.id,
    pillarId: task.pillarId,
    title: task.title,
    description: task.description,
    status: task.status,
    motionType: task.motionType,
    motionTypeLabel: goalMotionTypeLabels[task.motionType],
    priority: task.priority,
    ownerType: task.ownerType,
    dueDate: task.dueDate?.toISOString() ?? null,
    linkedTrackId: task.linkedTrackId,
    linkedProjectId: task.linkedProjectId,
    linkedTrack: serializeGoalTaskLinkedTrack(task.linkedTrack),
    linkedProject: task.linkedProject
      ? {
          id: task.linkedProject.id,
          title: task.linkedProject.title
        }
      : null,
    linkedSpecialistCategory: task.linkedSpecialistCategory,
    sortIndex: task.sortIndex,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null
  };
}

function serializeBalanceSummary(trajectoryReview: GoalTrajectoryReview | null | undefined) {
  if (!trajectoryReview) return null;
  return {
    craftFocusCount: trajectoryReview.craftFocusCount,
    creativeFocusCount: trajectoryReview.creativeFocusCount,
    craftShare: trajectoryReview.craftShare,
    creativeShare: trajectoryReview.creativeShare,
    dominantMotionType: trajectoryReview.dominantMotionType,
    confidence: trajectoryReview.confidence
  };
}

type ExecutionGapState = "MISSING" | "WEAK" | "IN_PROGRESS" | "STRONG";

function getExecutionTemplateLabel(template: ExecutionTemplate | null | undefined, goalType: GoalDetailRecord["type"]) {
  if (template) return executionTemplateLabels[template];
  return artistGoalTypeLabels[goalType];
}

function inferLegacyTemplate(goal: GoalDetailRecord): ExecutionTemplate | null {
  switch (goal.type) {
    case "ALBUM_RELEASE":
      return "SINGLE_RELEASE";
    case "CUSTOM_CAREER":
      return "CUSTOM_PROJECT";
    default:
      return null;
  }
}

function getProjectTemplate(goal: GoalDetailRecord) {
  return goal.executionTemplate ?? inferLegacyTemplate(goal);
}

function buildZoneSummaries(goal: GoalDetailRecord) {
  return goal.pillars.map((pillar) => {
    const tasks = pillar.tasks.map(serializeGoalTask);
    const openTasks = tasks.filter((task) => task.status !== GoalTaskStatus.DONE);
    return {
      id: pillar.id,
      factor: pillar.factor,
      factorLabel: goalFactorLabels[pillar.factor],
      defaultMotionType: pillar.defaultMotionType,
      defaultMotionTypeLabel: goalMotionTypeLabels[pillar.defaultMotionType],
      title: pillar.title,
      purpose: pillar.purpose,
      sortIndex: pillar.sortIndex,
      balance: buildPillarBalance(pillar),
      progress: {
        doneCount: tasks.filter((task) => task.status === GoalTaskStatus.DONE).length,
        totalCount: tasks.length
      },
      topOpenTasks: openTasks.slice(0, 3),
      tasks
    };
  });
}

function buildExecutionGapSummary(args: {
  goal: GoalDetailRecord;
  identityBridge: GoalIdentityBridge;
  trajectoryReview: GoalTrajectoryReview | null;
}): {
  state: ExecutionGapState;
  title: string;
  message: string;
  recommendation: RecommendationCard;
} {
  const { goal, identityBridge, trajectoryReview } = args;
  const templateLabel = getExecutionTemplateLabel(getProjectTemplate(goal), goal.type);
  const emptyPillar = goal.pillars.find((pillar) => pillar.tasks.length === 0);

  if (!goal.successDefinition && !goal.targetDate) {
    const title = "Проект пока без понятной опоры";
    const message = `У проекта «${goal.title}» ещё нет внятного результата или срока, поэтому его легко бесконечно обсуждать и сложно доводить.`;
    return {
      state: "WEAK",
      title,
      message,
      recommendation: buildRecommendationCard({
        key: `execution-gap:${goal.id}:direction`,
        surface: "HOME_COMMAND_CENTER",
        kind: "GOAL_ACTION",
        source: "SYSTEM",
        title: "Уточнить рамку проекта",
        text: message,
        reason: `${templateLabel} быстрее движется, когда у него есть понятная ближайшая опора.`,
        primaryAction: {
          label: "Открыть проект",
          href: "/today",
          action: "NAVIGATE"
        },
        secondaryActions: [],
        entityRef: {
          type: "artist_goal",
          id: goal.id
        },
        futureAiSlotKey: `${goal.id}:direction`
      })
    };
  }

  if (identityBridge.status === "MISSING" || identityBridge.status === "WEAK") {
    const title = "Проект пока не опирается на мир артиста";
    const message =
      identityBridge.warnings[0]?.message ??
      "Смысл и образ проекта пока недостаточно собраны, поэтому он ощущается как внешний список дел.";
    return {
      state: identityBridge.status === "MISSING" ? "MISSING" : "WEAK",
      title,
      message,
      recommendation: buildRecommendationCard({
        key: `execution-gap:${goal.id}:identity`,
        surface: "HOME_COMMAND_CENTER",
        kind: "GOAL_ACTION",
        source: "SYSTEM",
        title: "Усилить мир артиста",
        text: message,
        reason: "Когда проект опирается на образ и позиционирование, задачи перестают быть механическими.",
        primaryAction: {
          label: "Открыть SAFE ID",
          href: "/id",
          action: "NAVIGATE"
        },
        secondaryActions: [],
        entityRef: {
          type: "artist_goal",
          id: goal.id
        },
        futureAiSlotKey: `${goal.id}:identity`
      })
    };
  }

  if (emptyPillar) {
    const title = `Зона «${emptyPillar.title}» пока пустая`;
    const message = `В проекте «${goal.title}» ещё не собрана зона «${emptyPillar.title}», поэтому движение получается однобоким.`;
    return {
      state: "IN_PROGRESS",
      title,
      message,
      recommendation: buildRecommendationCard({
        key: `execution-gap:${goal.id}:zone:${emptyPillar.id}`,
        surface: "HOME_COMMAND_CENTER",
        kind: "GOAL_ACTION",
        source: "SYSTEM",
        title: "Заполнить пустую зону",
        text: message,
        reason: "Даже простой проект лучше держится, когда в каждой ключевой плоскости есть хотя бы один рабочий шаг.",
        primaryAction: {
          label: "Открыть проект",
          href: "/today",
          action: "NAVIGATE"
        },
        secondaryActions: [],
        entityRef: {
          type: "goal_pillar",
          id: emptyPillar.id
        },
        futureAiSlotKey: `${goal.id}:zone:${emptyPillar.id}`
      })
    };
  }

  if (trajectoryReview && trajectoryReview.overallState !== "HEALTHY") {
    return {
      state: trajectoryReview.overallState === "AT_RISK" ? "WEAK" : "IN_PROGRESS",
      title: "Проект движется с перекосом",
      message: trajectoryReview.summary,
      recommendation: trajectoryReview.recommendation
    };
  }

  const title = "Проект движется ровно";
  const message = `У проекта «${goal.title}» уже есть рабочая структура, и сейчас важнее не добавлять сущности, а доводить начатое.`;
  return {
    state: "STRONG",
    title,
    message,
    recommendation: buildRecommendationCard({
      key: `execution-gap:${goal.id}:steady`,
      surface: "HOME_COMMAND_CENTER",
      kind: "GOAL_ACTION",
      source: "SYSTEM",
      title: "Продолжать текущий темп",
      text: message,
      reason: "Сильный execution-layer не требует лишних ритуалов, когда структура уже держится.",
      primaryAction: {
        label: "Открыть проект",
        href: "/today",
        action: "NAVIGATE"
      },
      secondaryActions: [],
      entityRef: {
        type: "artist_goal",
        id: goal.id
      },
      futureAiSlotKey: `${goal.id}:steady`
    })
  };
}

function buildExecutionRecommendations(args: {
  goal: GoalDetailRecord;
  identityBridge: GoalIdentityBridge;
  trajectoryReview: GoalTrajectoryReview | null;
  gapSummary: ReturnType<typeof buildExecutionGapSummary>;
}) {
  const { goal, identityBridge, trajectoryReview, gapSummary } = args;
  const recommendations: RecommendationCard[] = [gapSummary.recommendation];
  const linkedTrackCount = goal.pillars.flatMap((pillar) => pillar.tasks).filter((task) => Boolean(task.linkedTrackId)).length;
  const findTask = goal.pillars
    .flatMap((pillar) => pillar.tasks)
    .find((task) => task.linkedSpecialistCategory && task.status !== GoalTaskStatus.DONE);

  if ((identityBridge.status === "MISSING" || identityBridge.status === "WEAK") && recommendations.every((item) => item.primaryAction?.href !== "/id")) {
    recommendations.push(
      buildRecommendationCard({
        key: `execution-rec:${goal.id}:id`,
        surface: "HOME_COMMAND_CENTER",
        kind: "GOAL_ACTION",
        source: "SYSTEM",
        title: "Проверить опору проекта",
        text: "Когда проект плохо связан с образом артиста, стоит сначала усилить SAFE ID.",
        reason: "Это помогает собрать смысл проекта и избежать случайных задач.",
        primaryAction: {
          label: "Открыть SAFE ID",
          href: "/id",
          action: "NAVIGATE"
        },
        secondaryActions: [],
        entityRef: {
          type: "artist_goal",
          id: goal.id
        },
        futureAiSlotKey: `${goal.id}:id`
      })
    );
  }

  if (linkedTrackCount === 0) {
    recommendations.push(
      buildRecommendationCard({
        key: `execution-rec:${goal.id}:songs`,
        surface: "HOME_COMMAND_CENTER",
        kind: "GOAL_ACTION",
        source: "SYSTEM",
        title: "Привязать проект к материалу",
        text: "Проекту нужна хотя бы одна связка с треком или song-project, иначе движение будет слишком абстрактным.",
        reason: "Даже для немузкальных задач артисту легче двигаться, когда есть реальный материал опоры.",
        primaryAction: {
          label: "Открыть Songs",
          href: "/songs",
          action: "NAVIGATE"
        },
        secondaryActions: [],
        entityRef: {
          type: "artist_goal",
          id: goal.id
        },
        futureAiSlotKey: `${goal.id}:songs`
      })
    );
  }

  if (findTask?.linkedSpecialistCategory) {
    recommendations.push(
      buildRecommendationCard({
        key: `execution-rec:${goal.id}:find`,
        surface: "HOME_COMMAND_CENTER",
        kind: "GOAL_ACTION",
        source: "SYSTEM",
        title: "Открыть поиск под проект",
        text: `В проекте есть задача, для которой нужен внешний человек: ${findTask.title}.`,
        reason: "Лучше сразу переводить внешние зависимости в конкретный поиск, а не держать их как мысленный долг.",
        primaryAction: {
          label: "Открыть Find",
          href: `/find?service=${findTask.linkedSpecialistCategory}`,
          action: "NAVIGATE"
        },
        secondaryActions: [],
        entityRef: {
          type: "goal_task",
          id: findTask.id
        },
        futureAiSlotKey: `${goal.id}:find`
      })
    );
  } else if (trajectoryReview && trajectoryReview.overallState !== "HEALTHY") {
    recommendations.push(trajectoryReview.recommendation);
  } else {
    recommendations.push(
      buildRecommendationCard({
        key: `execution-rec:${goal.id}:learn`,
        surface: "HOME_COMMAND_CENTER",
        kind: "GOAL_ACTION",
        source: "SYSTEM",
        title: "Посмотреть подборку под проект",
        text: "Если хочется усилить следующую зону без перегруза, начни с контекстного материала из Learn.",
        reason: "Обучение в ASP должно помогать прямо в проекте, а не жить отдельно от него.",
        primaryAction: {
          label: "Открыть Learn",
          href: "/learn",
          action: "NAVIGATE"
        },
        secondaryActions: [],
        entityRef: {
          type: "artist_goal",
          id: goal.id
        },
        futureAiSlotKey: `${goal.id}:learn`
      })
    );
  }

  return recommendations.slice(0, 3);
}

function buildSerializedGoalIdentityBridge(goal: GoalDetailRecord, identityProfile?: ArtistWorldInput | null): GoalIdentityBridge {
  return buildGoalIdentityBridge({
    profile: identityProfile ?? null,
    goal: {
      title: goal.title,
      whyNow: goal.whyNow,
      successDefinition: goal.successDefinition,
      pillars: goal.pillars.map((pillar) => ({
        factor: pillar.factor,
        tasks: pillar.tasks.map((task) => ({
          title: task.title,
          description: task.description,
          linkedTrackId: task.linkedTrackId,
          linkedProjectId: task.linkedProjectId
        }))
      }))
    }
  });
}

// ─── Goal detail serialization ───────────────────────────────────────────────

export function serializeGoalDetail(
  goal: GoalDetailRecord,
  identityProfile?: ArtistWorldInput | null,
  options?: { trajectoryReview?: GoalTrajectoryReview | null }
) {
  const identityBridge = buildSerializedGoalIdentityBridge(goal, identityProfile);
  const trajectoryReview = options?.trajectoryReview ?? null;
  const goalBalance = buildGoalBalance(goal);
  const projectTemplate = getProjectTemplate(goal);
  const projectLabel = getExecutionTemplateLabel(projectTemplate, goal.type);
  const zones = buildZoneSummaries(goal);
  const gapSummary = buildExecutionGapSummary({
    goal,
    identityBridge,
    trajectoryReview
  });
  const recommendations = buildExecutionRecommendations({
    goal,
    identityBridge,
    trajectoryReview,
    gapSummary
  });
  return {
    id: goal.id,
    type: goal.type,
    typeLabel: artistGoalTypeLabels[goal.type],
    executionTemplate: projectTemplate,
    projectLabel,
    title: goal.title,
    whyNow: goal.whyNow,
    successDefinition: goal.successDefinition,
    targetDate: goal.targetDate?.toISOString() ?? null,
    status: goal.status,
    isPrimary: goal.isPrimary,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    createdFromPathStage: goal.createdFromPathStage
      ? {
          id: goal.createdFromPathStage.id,
          order: goal.createdFromPathStage.order,
          name: goal.createdFromPathStage.name
        }
      : null,
    progress: buildGoalProgress(goal),
    trajectoryReview,
    balanceSummary: serializeBalanceSummary(trajectoryReview),
    balance: goalBalance,
    identityBridge,
    gapSummary,
    recommendations,
    zones,
    pillars: zones.map(({ topOpenTasks: _topOpenTasks, ...zone }) => zone)
  };
}

// ─── DB queries ──────────────────────────────────────────────────────────────

export async function getGoalDetailForUser(db: DbClient, userId: string, goalId: string) {
  return db.artistGoal.findFirst({
    where: {
      id: goalId,
      userId
    },
    include: goalDetailInclude
  });
}

export async function getPrimaryGoalDetail(db: DbClient, userId: string) {
  return db.artistGoal.findFirst({
    where: {
      userId,
      status: ArtistGoalStatus.ACTIVE,
      isPrimary: true
    },
    include: goalDetailInclude,
    orderBy: [{ updatedAt: "desc" }]
  });
}

export async function getIdentityProfile(db: DbClient, userId: string) {
  const [profile, visualBoards] = await Promise.all([
    db.artistIdentityProfile.findUnique({
      where: { userId }
    }),
    db.artistWorldVisualBoard.findMany({
      where: { userId },
      orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
      include: {
        images: {
          orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }]
        }
      }
    })
  ]);

  if (!profile && visualBoards.length === 0) return null;

  return {
    ...(profile ?? {}),
    visualBoards: visualBoards.map((board) => ({
      id: board.id,
      slug: board.slug,
      name: board.name,
      sourceUrl: board.sourceUrl,
      images: board.images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl
      }))
    }))
  };
}

// ─── Today focus ─────────────────────────────────────────────────────────────

export async function ensureTodayFocus(db: DbClient, userId: string, date: Date, goal: GoalDetailRecord) {
  const existing = await db.dailyFocus.findUnique({
    where: {
      userId_date: {
        userId,
        date
      }
    },
    include: dailyFocusInclude
  });

  if (existing && existing.source === DailyFocusSource.MANUAL) {
    return existing;
  }

  const trajectoryReview = await getGoalTrajectoryReview(db, userId, goal, date);
  const selection = pickTodayTaskV2(goal, trajectoryReview);
  if (!selection.picked) return existing ?? null;

  if (existing && existing.goalId === goal.id && existing.goalTaskId === selection.picked.task.id) {
    return existing;
  }

  const preserveCompletion = existing?.source === DailyFocusSource.AUTO && existing.goalTaskId === selection.picked.task.id;

  return db.dailyFocus.upsert({
    where: {
      userId_date: {
        userId,
        date
      }
    },
    update: {
      goalId: goal.id,
      goalTaskId: selection.picked.task.id,
      source: DailyFocusSource.AUTO,
      isCompleted: preserveCompletion ? existing.isCompleted : false,
      completedAt: preserveCompletion ? existing.completedAt : null
    },
    create: {
      userId,
      date,
      goalId: goal.id,
      goalTaskId: selection.picked.task.id,
      source: DailyFocusSource.AUTO
    },
    include: dailyFocusInclude
  });
}

function buildTodayFocusSelectionReason(
  focus: DailyFocusWithTaskRecord,
  trajectoryReview: GoalTrajectoryReview | null,
  cycleNeed: TodayFocusCycleNeed
) {
  if (focus.source === DailyFocusSource.MANUAL) {
    return {
      cycleNeed,
      reasonTitle: "Фокус закреплён вручную",
      reasonBody: "Система сохраняет ручной выбор и не перезаписывает его автоматическим ранжированием."
    };
  }

  switch (cycleNeed) {
    case "FINISH_OPEN_LOOP":
      return {
        cycleNeed,
        reasonTitle: "Сначала нужно закрыть открытые циклы",
        reasonBody: `В работе уже ${trajectoryReview?.openInProgressCount ?? 0} задач, поэтому система поднимает незавершённый контур выше нового старта.`
      };
    case "REBALANCE_CREATIVE":
      return {
        cycleNeed,
        reasonTitle: "Неделя ушла в craft",
        reasonBody: "Автофокус возвращает creative-шаг, чтобы цель не превратилась только в обслуживание и упаковку."
      };
    case "REBALANCE_CRAFT":
      return {
        cycleNeed,
        reasonTitle: "Неделя ушла в идеи без доведения",
        reasonBody: "Автофокус возвращает craft-задачу, чтобы перевести творческий импульс в реальное продвижение."
      };
    case "RESPOND_TO_FEEDBACK":
      return {
        cycleNeed,
        reasonTitle: "Нужно ответить на фидбек",
        reasonBody: "Связанный трек требует реакции на полученную обратную связь, иначе цикл зависнет."
      };
    case "ADVANCE_READY_TRACK":
      return {
        cycleNeed,
        reasonTitle: "Трек готов к следующему шагу",
        reasonBody: "Система выбрала задачу, которая переводит уже готовый материал в следующий рабочий этап."
      };
    default:
      return {
        cycleNeed,
        reasonTitle: "Выбран ближайший полезный шаг",
        reasonBody: "Когда явного перекоса нет, система берёт задачу с лучшей комбинацией срочности и позиции в цикле."
      };
  }
}

export function serializeTodayFocus(
  goal: GoalDetailRecord | null,
  identityProfile: ArtistWorldInput | null,
  focus: DailyFocusWithTaskRecord | null,
  options?: { trajectoryReview?: GoalTrajectoryReview | null }
) {
  if (!goal || !focus) return null;
  const trajectoryReview = options?.trajectoryReview ?? null;
  const cycleNeed = trajectoryReview ? computeTodayFocusCycleNeed(goal, trajectoryReview) : "NONE";
  const goalIdentityBridge = buildSerializedGoalIdentityBridge(goal, identityProfile);
  const trackIdentityBridge = focus.goalTask.linkedTrack
    ? buildTrackIdentityBridge({
        profile: identityProfile,
        primaryGoalId: goal.id,
        track: {
          title: focus.goalTask.linkedTrack.title,
          lyricsText: focus.goalTask.linkedTrack.lyricsText,
          trackIntent: focus.goalTask.linkedTrack.trackIntent
            ? {
                summary: focus.goalTask.linkedTrack.trackIntent.summary,
                whyNow: focus.goalTask.linkedTrack.trackIntent.whyNow
              }
            : null,
          linkedGoals: focus.goalTask.linkedTrack.goalTasks.map((task) => ({
            goalId: task.pillar.goal.id,
            goalTitle: task.pillar.goal.title,
            isPrimary: task.pillar.goal.isPrimary,
            pillarFactor: task.pillar.factor,
            taskId: task.id,
            taskTitle: task.title
          }))
        }
      })
    : null;
  const contextBridge = buildTodayContextBridge({
    goalBridge: goalIdentityBridge,
    trackBridge: trackIdentityBridge,
    linkedTrack: focus.goalTask.linkedTrack
      ? {
          id: focus.goalTask.linkedTrack.id,
          title: focus.goalTask.linkedTrack.title
        }
      : null,
    linkedProject: focus.goalTask.linkedProject
      ? {
          id: focus.goalTask.linkedProject.id,
          title: focus.goalTask.linkedProject.title
        }
      : null
  });
  const selectionReason = buildTodayFocusSelectionReason(focus, trajectoryReview, cycleNeed);
  const todayFocusSource = mapDailyFocusSourceToRecommendationSource(focus.source);

  return {
    id: focus.id,
    source: focus.source,
    isCompleted: focus.isCompleted,
    completedAt: focus.completedAt?.toISOString() ?? null,
    goal: {
      id: goal.id,
      title: goal.title,
      type: goal.type,
      typeLabel: artistGoalTypeLabels[goal.type]
    },
    pillar: {
      id: focus.goalTask.pillar.id,
      factor: focus.goalTask.pillar.factor,
      factorLabel: goalFactorLabels[focus.goalTask.pillar.factor],
      title: focus.goalTask.pillar.title
    },
    task: {
      ...serializeGoalTask(focus.goalTask)
    },
    contextBridge,
    cycleContext: trajectoryReview
      ? {
          balanceState: trajectoryReview.balanceState,
          focusState: trajectoryReview.focusState,
          deliveryState: trajectoryReview.deliveryState
        }
      : null,
    selectionReason,
    recommendation: buildRecommendationCard({
      key: `today:focus:${focus.id}`,
      surface: "TODAY",
      kind: "TODAY_FOCUS",
      source: todayFocusSource,
      title: selectionReason.reasonTitle,
      text: focus.goalTask.title,
      reason: selectionReason.reasonBody,
      primaryAction: {
        label: "Открыть Today",
        href: "/today",
        action: "NAVIGATE"
      },
      secondaryActions: [],
      entityRef: {
        type: "goal_task",
        id: focus.goalTask.id
      },
      futureAiSlotKey: focus.id
    })
  };
}

export function serializePrimaryGoalSummary(
  goal: GoalDetailRecord | null,
  identityProfile?: ArtistWorldInput | null,
  options?: { trajectoryReview?: GoalTrajectoryReview | null }
) {
  if (!goal) return null;

  const identityBridge = buildSerializedGoalIdentityBridge(goal, identityProfile);
  const trajectoryReview = options?.trajectoryReview ?? null;
  const projectTemplate = getProjectTemplate(goal);
  const projectLabel = getExecutionTemplateLabel(projectTemplate, goal.type);
  const gapSummary = buildExecutionGapSummary({
    goal,
    identityBridge,
    trajectoryReview
  });
  const recommendations = buildExecutionRecommendations({
    goal,
    identityBridge,
    trajectoryReview,
    gapSummary
  });

  return {
    id: goal.id,
    title: goal.title,
    type: goal.type,
    typeLabel: artistGoalTypeLabels[goal.type],
    executionTemplate: projectTemplate,
    projectLabel,
    status: goal.status,
    whyNow: goal.whyNow,
    targetDate: goal.targetDate?.toISOString() ?? null,
    successDefinition: goal.successDefinition,
    progress: buildGoalProgress(goal),
    trajectoryReview,
    balanceSummary: serializeBalanceSummary(trajectoryReview),
    identityBridge,
    gapSummary,
    recommendations,
    zones: goal.pillars.map((pillar) => ({
      id: pillar.id,
      factor: pillar.factor,
      title: pillar.title,
      factorLabel: goalFactorLabels[pillar.factor],
      defaultMotionType: pillar.defaultMotionType,
      defaultMotionTypeLabel: goalMotionTypeLabels[pillar.defaultMotionType],
      balance: buildPillarBalance(pillar),
      doneCount: pillar.tasks.filter((task) => task.status === GoalTaskStatus.DONE).length,
      totalCount: pillar.tasks.length
    })),
    pillars: goal.pillars.map((pillar) => ({
      id: pillar.id,
      factor: pillar.factor,
      title: pillar.title,
      factorLabel: goalFactorLabels[pillar.factor],
      defaultMotionType: pillar.defaultMotionType,
      defaultMotionTypeLabel: goalMotionTypeLabels[pillar.defaultMotionType],
      balance: buildPillarBalance(pillar),
      doneCount: pillar.tasks.filter((task) => task.status === GoalTaskStatus.DONE).length,
      totalCount: pillar.tasks.length
    }))
  };
}
