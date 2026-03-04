import {
  ArtistWorldBackgroundMode,
  ArtistGoalStatus,
  ArtistGoalType,
  GoalMotionType,
  ArtistWorldThemePreset,
  DailyFocusSource,
  FindCategory,
  GoalFactor,
  GoalTaskStatus,
  NextStepStatus,
  Prisma,
  PrismaClient,
  TaskOwnerType,
  TaskPriority
} from "@prisma/client";
import type { RecommendationCard } from "@/contracts/recommendations";
import {
  buildTrackIdentityBridge,
  buildGoalIdentityBridge,
  buildTodayContextBridge,
  type GoalIdentityBridge
} from "@/lib/id-integration";
import { buildTrackFeedbackSummary, feedbackRequestSummarySelect } from "@/lib/feedback";
import { buildRecommendationCard, mapDailyFocusSourceToRecommendationSource } from "@/lib/recommendations";
import { getWorkbenchStateLabel, serializeActiveNextStep } from "@/lib/track-workbench";

type DbClient = PrismaClient | Prisma.TransactionClient;

type StageBucket = "EARLY" | "MID" | "LATE";

type TaskTemplate = {
  title: string;
  description: string;
  motionType?: GoalMotionType;
  priority?: TaskPriority;
  ownerType?: TaskOwnerType;
  linkedSpecialistCategory?: FindCategory;
};

type GoalTemplateInput = {
  goalType: ArtistGoalType;
  stageOrder: number;
  title: string;
  mission?: string | null;
  identityStatement?: string | null;
  audienceCore?: string | null;
};

export const artistWorldBlockIds = [
  "hero",
  "mission",
  "values",
  "philosophy",
  "themes",
  "visual",
  "audience",
  "references",
  "projects"
] as const;

export type ArtistWorldBlockId = (typeof artistWorldBlockIds)[number];

export const defaultArtistWorldBlockOrder: ArtistWorldBlockId[] = [...artistWorldBlockIds];

export const artistWorldThemePresetOptions: ArtistWorldThemePreset[] = [
  ArtistWorldThemePreset.EDITORIAL,
  ArtistWorldThemePreset.STUDIO,
  ArtistWorldThemePreset.CINEMATIC,
  ArtistWorldThemePreset.MINIMAL
];

export const artistWorldBackgroundModeOptions: ArtistWorldBackgroundMode[] = [
  ArtistWorldBackgroundMode.GRADIENT,
  ArtistWorldBackgroundMode.IMAGE
];

export type ArtistWorldProjectInput = {
  id?: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  linkUrl?: string | null;
  coverImageUrl?: string | null;
};

export type ArtistWorldReferenceInput = {
  id?: string;
  title?: string | null;
  creator?: string | null;
  note?: string | null;
  linkUrl?: string | null;
  imageUrl?: string | null;
};

type ArtistWorldInput = {
  identityStatement?: string | null;
  mission?: string | null;
  philosophy?: string | null;
  values?: string[];
  coreThemes?: string[];
  aestheticKeywords?: string[];
  visualDirection?: string | null;
  audienceCore?: string | null;
  differentiator?: string | null;
  fashionSignals?: string[];
  worldThemePreset?: ArtistWorldThemePreset | null;
  worldBackgroundMode?: ArtistWorldBackgroundMode | null;
  worldBackgroundColorA?: string | null;
  worldBackgroundColorB?: string | null;
  worldBackgroundImageUrl?: string | null;
  worldBlockOrder?: unknown;
  worldHiddenBlocks?: unknown;
  references?: ArtistWorldReferenceInput[];
  projects?: ArtistWorldProjectInput[];
};

type GoalWithPlanInclude = Prisma.ArtistGoalInclude;

export const goalTaskLinkedTrackSelect = {
  id: true,
  title: true,
  lyricsText: true,
  workbenchState: true,
  trackIntent: {
    select: {
      summary: true,
      whyNow: true
    }
  },
  goalTasks: {
    include: {
      pillar: {
        select: {
          factor: true,
          goal: {
            select: {
              id: true,
              title: true,
              isPrimary: true
            }
          }
        }
      }
    }
  },
  nextSteps: {
    where: { status: NextStepStatus.ACTIVE },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1
  },
  feedbackRequests: {
    orderBy: [{ updatedAt: "desc" }],
    select: feedbackRequestSummarySelect
  }
} satisfies Prisma.TrackSelect;

export const goalTaskInclude = {
  pillar: true,
  linkedTrack: {
    select: goalTaskLinkedTrackSelect
  },
  linkedProject: {
    select: {
      id: true,
      title: true
    }
  }
} satisfies Prisma.GoalTaskInclude;

export const dailyFocusInclude = {
  goalTask: {
    include: goalTaskInclude
  }
} satisfies Prisma.DailyFocusInclude;

export const goalDetailInclude = {
  createdFromPathStage: {
    select: {
      id: true,
      order: true,
      name: true
    }
  },
  pillars: {
    orderBy: [{ sortIndex: "asc" }],
    include: {
      tasks: {
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
        include: goalTaskInclude
      }
    }
  }
} satisfies GoalWithPlanInclude;

export type GoalDetailRecord = Prisma.ArtistGoalGetPayload<{
  include: typeof goalDetailInclude;
}>;

export const artistGoalTypeLabels: Record<ArtistGoalType, string> = {
  ALBUM_RELEASE: "Альбом",
  MINI_TOUR: "Мини-тур",
  FESTIVAL_RUN: "Фестивали",
  SOLO_SHOW: "Сольный концерт",
  MERCH_DROP: "Мерч-дроп",
  CUSTOM_CAREER: "Карьерная цель"
};

export const goalFactorLabels: Record<GoalFactor, string> = {
  DIRECTION: "Direction",
  ARTIST_WORLD: "Artist World",
  CATALOG: "Catalog",
  AUDIENCE: "Audience",
  LIVE: "Live",
  TEAM: "Team",
  OPERATIONS: "Operations"
};

export const goalMotionTypeLabels: Record<GoalMotionType, string> = {
  CRAFT: "Craft",
  CREATIVE: "Creative"
};

export const goalFactorDefaultMotionTypes: Record<GoalFactor, GoalMotionType> = {
  DIRECTION: GoalMotionType.CREATIVE,
  ARTIST_WORLD: GoalMotionType.CREATIVE,
  CATALOG: GoalMotionType.CREATIVE,
  AUDIENCE: GoalMotionType.CRAFT,
  LIVE: GoalMotionType.CRAFT,
  TEAM: GoalMotionType.CRAFT,
  OPERATIONS: GoalMotionType.CRAFT
};

const goalFactorTitlesRu: Record<GoalFactor, string> = {
  DIRECTION: "Направление",
  ARTIST_WORLD: "Мир артиста",
  CATALOG: "Каталог",
  AUDIENCE: "Аудитория",
  LIVE: "Живые выступления",
  TEAM: "Команда",
  OPERATIONS: "Операционная система"
};

const goalFactorPurposesRu: Record<GoalFactor, string> = {
  DIRECTION: "Уточнить траекторию и критерий успеха цели.",
  ARTIST_WORLD: "Собрать цельный бренд-слой артиста под выбранную цель.",
  CATALOG: "Привязать музыку и релизные сущности к карьерному движению.",
  AUDIENCE: "Понять, кому и как доносить следующий шаг артиста.",
  LIVE: "Подготовить сценическую и live-часть под цель.",
  TEAM: "Определить, кто нужен для достижения цели и где есть пробелы.",
  OPERATIONS: "Собрать ритм, дедлайны и систему исполнения."
};

const goalFactorsByType: Record<ArtistGoalType, GoalFactor[]> = {
  ALBUM_RELEASE: [GoalFactor.ARTIST_WORLD, GoalFactor.CATALOG, GoalFactor.AUDIENCE, GoalFactor.TEAM, GoalFactor.OPERATIONS],
  MINI_TOUR: [GoalFactor.ARTIST_WORLD, GoalFactor.LIVE, GoalFactor.AUDIENCE, GoalFactor.TEAM, GoalFactor.OPERATIONS],
  FESTIVAL_RUN: [GoalFactor.ARTIST_WORLD, GoalFactor.LIVE, GoalFactor.AUDIENCE, GoalFactor.TEAM],
  SOLO_SHOW: [GoalFactor.ARTIST_WORLD, GoalFactor.CATALOG, GoalFactor.LIVE, GoalFactor.AUDIENCE, GoalFactor.TEAM],
  MERCH_DROP: [GoalFactor.ARTIST_WORLD, GoalFactor.AUDIENCE, GoalFactor.TEAM, GoalFactor.OPERATIONS],
  CUSTOM_CAREER: [GoalFactor.DIRECTION, GoalFactor.ARTIST_WORLD, GoalFactor.CATALOG, GoalFactor.AUDIENCE, GoalFactor.OPERATIONS]
};

function getStageBucket(stageOrder: number) {
  if (stageOrder <= 2) return "EARLY" satisfies StageBucket;
  if (stageOrder <= 5) return "MID" satisfies StageBucket;
  return "LATE" satisfies StageBucket;
}

function trimOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function uniqueStrings(values?: string[] | null) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

function normalizeBlockIds(value: unknown, fallback: ArtistWorldBlockId[] = defaultArtistWorldBlockOrder) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const seen = new Set<ArtistWorldBlockId>();
  const normalized: ArtistWorldBlockId[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!(artistWorldBlockIds as readonly string[]).includes(item)) continue;
    const blockId = item as ArtistWorldBlockId;
    if (seen.has(blockId)) continue;
    seen.add(blockId);
    normalized.push(blockId);
  }

  for (const blockId of defaultArtistWorldBlockOrder) {
    if (!seen.has(blockId)) {
      normalized.push(blockId);
    }
  }

  return normalized;
}

function normalizeHiddenBlockIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<ArtistWorldBlockId>();
  const normalized: ArtistWorldBlockId[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!(artistWorldBlockIds as readonly string[]).includes(item)) continue;
    const blockId = item as ArtistWorldBlockId;
    if (seen.has(blockId)) continue;
    seen.add(blockId);
    normalized.push(blockId);
  }

  return normalized;
}

function normalizeOptionalHex(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 32);
}

function normalizeArtistWorldProject(input: ArtistWorldProjectInput) {
  return {
    id: trimOrNull(input.id),
    title: trimOrNull(input.title),
    subtitle: trimOrNull(input.subtitle),
    description: trimOrNull(input.description),
    linkUrl: trimOrNull(input.linkUrl),
    coverImageUrl: trimOrNull(input.coverImageUrl)
  };
}

function normalizeArtistWorldReference(input: ArtistWorldReferenceInput) {
  return {
    id: trimOrNull(input.id),
    title: trimOrNull(input.title),
    creator: trimOrNull(input.creator),
    note: trimOrNull(input.note),
    linkUrl: trimOrNull(input.linkUrl),
    imageUrl: trimOrNull(input.imageUrl)
  };
}

function computeDueDate(targetDate: Date | null | undefined, index: number) {
  if (!targetDate) return null;
  const next = new Date(targetDate);
  next.setUTCDate(next.getUTCDate() - Math.max(7, index * 7));
  return next;
}

function getGoalFactorMotionType(factor: GoalFactor) {
  return goalFactorDefaultMotionTypes[factor];
}

function buildArtistWorldTemplates(input: GoalTemplateInput, stageBucket: StageBucket): TaskTemplate[] {
  const identityLine = trimOrNull(input.identityStatement);
  const missionLine = trimOrNull(input.mission);
  const audienceLine = trimOrNull(input.audienceCore);
  const base = [
    {
      title: stageBucket === "EARLY" ? "Собрать ядро образа артиста" : "Уточнить образ под текущую цель",
      description: identityLine
        ? `Оттолкнись от формулировки "${identityLine}" и сведи её к короткому брендовому тезису для цели "${input.title}".`
        : `Зафиксируй, кто ты как артист именно в контексте цели "${input.title}".`
    },
    {
      title: missionLine ? "Сверить миссию с целью" : "Сформулировать миссию под цель",
      description: missionLine
        ? `Проверь, как миссия "${missionLine}" поддерживает движение к цели, и убери лишние противоречия.`
        : "Сформулируй короткую миссию, чтобы стратегия и визуал не расходились."
    }
  ];

  if (stageBucket !== "EARLY") {
    base.push({
      title: "Собрать визуальный язык следующего этапа",
      description: audienceLine
        ? `Подбери эстетические маркеры, которые будут понятны ядру аудитории: ${audienceLine}.`
        : "Определи визуальные сигналы, которые будут удерживать цельный образ в контенте и релизах."
    });
  }

  return base;
}

function buildCatalogTemplates(input: GoalTemplateInput, stageBucket: StageBucket): TaskTemplate[] {
  if (input.goalType === ArtistGoalType.MERCH_DROP) return [];

  const earlyTasks: TaskTemplate[] = [
    {
      title: input.goalType === ArtistGoalType.ALBUM_RELEASE ? "Собрать shortlist треков для альбома" : "Определить музыкальную базу цели",
      description: `Отбери материал, который реально работает на цель "${input.title}", и отдели его от общего архива.`,
      priority: TaskPriority.HIGH
    },
    {
      title: "Привязать треки или проекты к плану",
      description: "Каждая музыкальная сущность должна получить понятную роль в карьерной цели."
    }
  ];

  const midTasks: TaskTemplate[] = [
    {
      title: "Определить главный материал для следующего шага",
      description: "Зафиксируй, какой трек, проект или релиз несёт на себе основной фокус периода.",
      priority: TaskPriority.HIGH
    },
    {
      title: "Собрать упаковку материала под продвижение",
      description: "Проверь, хватает ли обложки, описания, short-form контента и release context."
    }
  ];

  const lateTasks: TaskTemplate[] = [
    {
      title: "Собрать каталог в стратегические связки",
      description: "Разведи каталог по функциям: growth, live, media, brand equity.",
      priority: TaskPriority.HIGH
    },
    {
      title: "Выделить материал для масштабирования",
      description: "Определи, какие треки и проекты лучше всего выдерживают повторное продвижение и live-упаковку."
    }
  ];

  return stageBucket === "EARLY" ? earlyTasks : stageBucket === "MID" ? midTasks : lateTasks;
}

function buildAudienceTemplates(input: GoalTemplateInput, stageBucket: StageBucket): TaskTemplate[] {
  const audienceLine = trimOrNull(input.audienceCore);
  return [
    {
      title: stageBucket === "EARLY" ? "Определить ядро аудитории" : "Уточнить сегмент с лучшим откликом",
      description: audienceLine
        ? `Сверь стратегию с текущим ядром аудитории: ${audienceLine}.`
        : "Опиши, для кого эта цель должна стать следующим очевидным шагом."
    },
    {
      title: stageBucket === "LATE" ? "Собрать карту каналов роста" : "Собрать план контакта с аудиторией",
      description:
        stageBucket === "EARLY"
          ? "Определи, где артист должен быть видим уже сейчас, чтобы цель не осталась внутренней."
          : "Собери реалистичный ритм контента, релизных касаний и внешнего фидбэка."
    }
  ];
}

function buildLiveTemplates(input: GoalTemplateInput, stageBucket: StageBucket): TaskTemplate[] {
  return [
    {
      title: stageBucket === "EARLY" ? "Определить live-формат цели" : "Собрать live-предложение под цель",
      description: `Определи, как цель "${input.title}" должна звучать и выглядеть на сцене.`,
      priority: TaskPriority.HIGH
    },
    {
      title: stageBucket === "LATE" ? "Собрать партнёрский live-пакет" : "Подготовить материалы для лайв-презентации",
      description: "Нужны понятные тезисы, сет, визуал и аргументы для букинга или фестивальных заявок."
    }
  ];
}

function buildTeamTemplates(input: GoalTemplateInput, stageBucket: StageBucket): TaskTemplate[] {
  const externalCategory =
    input.goalType === ArtistGoalType.ALBUM_RELEASE
      ? FindCategory.AUDIO_ENGINEER
      : input.goalType === ArtistGoalType.MINI_TOUR || input.goalType === ArtistGoalType.FESTIVAL_RUN
        ? FindCategory.PROMO_CREW
        : input.goalType === ArtistGoalType.SOLO_SHOW
          ? FindCategory.CLIP_PRODUCTION_TEAM
          : FindCategory.DESIGNER;

  return [
    {
      title: stageBucket === "EARLY" ? "Определить, кто нужен под цель" : "Собрать short-list команды",
      description: "Раздели, что артист делает сам, что ведёт команда, и где нужен внешний специалист.",
      priority: TaskPriority.HIGH
    },
    {
      title: "Найти внешнего исполнителя под узкое место",
      description: "Подготовь понятный brief и следующий контакт с нужным специалистом.",
      ownerType: TaskOwnerType.EXTERNAL,
      linkedSpecialistCategory: externalCategory
    }
  ];
}

function buildOperationsTemplates(input: GoalTemplateInput, stageBucket: StageBucket): TaskTemplate[] {
  return [
    {
      title: stageBucket === "LATE" ? "Собрать контрольные точки масштаба" : "Поставить контрольные точки цели",
      description: `Разложи цель "${input.title}" по ближайшим проверяемым этапам.`,
      priority: TaskPriority.HIGH
    },
    {
      title: "Собрать недельный ритм исполнения",
      description: "Определи регулярность проверки прогресса и закрепи один главный фокус на день."
    }
  ];
}

function buildDirectionTemplates(input: GoalTemplateInput): TaskTemplate[] {
  return [
    {
      title: "Уточнить критерий успеха цели",
      description: `Опиши, по каким признакам будет понятно, что цель "${input.title}" реально достигнута.`,
      priority: TaskPriority.HIGH
    },
    {
      title: "Собрать ограничения и рамки периода",
      description: "Определи, на что точно не стоит тратить фокус в ближайшем цикле."
    }
  ];
}

function buildTasksForFactor(input: GoalTemplateInput, factor: GoalFactor) {
  const stageBucket = getStageBucket(input.stageOrder);
  switch (factor) {
    case GoalFactor.DIRECTION:
      return buildDirectionTemplates(input);
    case GoalFactor.ARTIST_WORLD:
      return buildArtistWorldTemplates(input, stageBucket);
    case GoalFactor.CATALOG:
      return buildCatalogTemplates(input, stageBucket);
    case GoalFactor.AUDIENCE:
      return buildAudienceTemplates(input, stageBucket);
    case GoalFactor.LIVE:
      return buildLiveTemplates(input, stageBucket);
    case GoalFactor.TEAM:
      return buildTeamTemplates(input, stageBucket);
    case GoalFactor.OPERATIONS:
      return buildOperationsTemplates(input, stageBucket);
    default:
      return [];
  }
}

export function getGoalBlueprint(input: GoalTemplateInput) {
  const factors = goalFactorsByType[input.goalType];
  return factors.map((factor, pillarIndex) => {
    const tasks = buildTasksForFactor(input, factor);
    const defaultMotionType = getGoalFactorMotionType(factor);
    return {
      factor,
      defaultMotionType,
      title: goalFactorTitlesRu[factor],
      purpose: goalFactorPurposesRu[factor],
      sortIndex: pillarIndex,
      tasks: tasks.map((task, taskIndex) => ({
        ...task,
        motionType: task.motionType ?? defaultMotionType,
        priority: task.priority ?? TaskPriority.MEDIUM,
        ownerType: task.ownerType ?? TaskOwnerType.SELF,
        sortIndex: taskIndex
      }))
    };
  });
}

export async function unsetOtherPrimaryGoals(db: DbClient, userId: string, currentGoalId?: string) {
  await db.artistGoal.updateMany({
    where: {
      userId,
      status: ArtistGoalStatus.ACTIVE,
      isPrimary: true,
      ...(currentGoalId ? { id: { not: currentGoalId } } : {})
    },
    data: {
      isPrimary: false
    }
  });
}

export async function createGoalWithTemplate(
  db: DbClient,
  userId: string,
  input: {
    type: ArtistGoalType;
    title: string;
    whyNow?: string | null;
    successDefinition?: string | null;
    targetDate?: Date | null;
    isPrimary?: boolean;
    createdFromPathStageId?: number | null;
    stageOrder: number;
    identityProfile?: ArtistWorldInput | null;
  }
) {
  if (input.isPrimary) {
    await unsetOtherPrimaryGoals(db, userId);
  }

  const goal = await db.artistGoal.create({
    data: {
      userId,
      type: input.type,
      title: input.title.trim(),
      whyNow: trimOrNull(input.whyNow),
      successDefinition: trimOrNull(input.successDefinition),
      targetDate: input.targetDate ?? null,
      status: ArtistGoalStatus.ACTIVE,
      isPrimary: Boolean(input.isPrimary),
      createdFromPathStageId: input.createdFromPathStageId ?? null
    }
  });

  const blueprint = getGoalBlueprint({
    goalType: input.type,
    stageOrder: input.stageOrder,
    title: input.title.trim(),
    mission: input.identityProfile?.mission ?? null,
    identityStatement: input.identityProfile?.identityStatement ?? null,
    audienceCore: input.identityProfile?.audienceCore ?? null
  });

  for (const pillar of blueprint) {
    const createdPillar = await db.goalPillar.create({
      data: {
        goalId: goal.id,
        factor: pillar.factor,
        defaultMotionType: pillar.defaultMotionType,
        title: pillar.title,
        purpose: pillar.purpose,
        sortIndex: pillar.sortIndex
      }
    });

    if (pillar.tasks.length === 0) continue;

    await db.goalTask.createMany({
      data: pillar.tasks.map((task, taskIndex) => ({
        pillarId: createdPillar.id,
        title: task.title,
        description: task.description,
        motionType: task.motionType ?? pillar.defaultMotionType,
        priority: task.priority,
        ownerType: task.ownerType,
        linkedSpecialistCategory: task.linkedSpecialistCategory ?? null,
        sortIndex: task.sortIndex ?? taskIndex,
        dueDate: computeDueDate(input.targetDate, taskIndex + 1)
      }))
    });
  }

  return db.artistGoal.findUniqueOrThrow({
    where: { id: goal.id },
    include: goalDetailInclude
  });
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

type GoalTaskRecord = GoalDetailRecord["pillars"][number]["tasks"][number];
type GoalTaskWithPillar = { pillar: GoalDetailRecord["pillars"][number]; task: GoalTaskRecord };
type DailyFocusWithTaskRecord = Prisma.DailyFocusGetPayload<{
  include: typeof dailyFocusInclude;
}>;

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

function buildSystemRecommendation(input: {
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

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function isGoalTaskOpen(task: GoalTaskRecord) {
  return task.status === GoalTaskStatus.TODO || task.status === GoalTaskStatus.IN_PROGRESS;
}

function getOpenGoalTasks(goal: GoalDetailRecord) {
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

function taskNeedsFeedback(task: GoalTaskRecord) {
  return Boolean(
    task.linkedTrack &&
      (task.linkedTrack.workbenchState === "NEEDS_FEEDBACK" || buildTrackFeedbackSummary(task.linkedTrack.feedbackRequests).unresolvedItemsCount > 0)
  );
}

function taskCanAdvanceTrack(task: GoalTaskRecord) {
  return Boolean(task.linkedTrack && task.linkedTrack.workbenchState === "READY_FOR_NEXT_STEP" && task.linkedTrack.nextSteps[0]);
}

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

function isGoalDetailRecord(value: GoalDetailRecord | null): value is GoalDetailRecord {
  return Boolean(value);
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

export function serializeGoalDetail(
  goal: GoalDetailRecord,
  identityProfile?: ArtistWorldInput | null,
  options?: { trajectoryReview?: GoalTrajectoryReview | null }
) {
  const identityBridge = buildSerializedGoalIdentityBridge(goal, identityProfile);
  const trajectoryReview = options?.trajectoryReview ?? null;
  const goalBalance = buildGoalBalance(goal);
  return {
    id: goal.id,
    type: goal.type,
    typeLabel: artistGoalTypeLabels[goal.type],
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
    pillars: goal.pillars.map((pillar) => {
      const doneCount = pillar.tasks.filter((task) => task.status === GoalTaskStatus.DONE).length;
      const balance = buildPillarBalance(pillar);
      return {
        id: pillar.id,
        factor: pillar.factor,
        factorLabel: goalFactorLabels[pillar.factor],
        defaultMotionType: pillar.defaultMotionType,
        defaultMotionTypeLabel: goalMotionTypeLabels[pillar.defaultMotionType],
        title: pillar.title,
        purpose: pillar.purpose,
        sortIndex: pillar.sortIndex,
        balance,
        progress: {
          doneCount,
          totalCount: pillar.tasks.length
        },
        tasks: pillar.tasks.map(serializeGoalTask)
      };
    })
  };
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

export type DiagnosticState = "MISSING" | "WEAK" | "IN_PROGRESS" | "STRONG";
export type DiagnosticFactorKey =
  | "DIRECTION"
  | "ARTIST_WORLD"
  | "CATALOG"
  | "AUDIENCE"
  | "LIVE"
  | "TEAM"
  | "OPERATIONS"
  | "OPERATING_RHYTHM"
  | "CRAFT_CREATIVE_BALANCE"
  | "FOCUS_DISCIPLINE"
  | "DELIVERY";

export type DiagnosticItem = {
  factor: DiagnosticFactorKey;
  state: DiagnosticState;
  title: string;
  message: string;
  recommendation: RecommendationCard;
};

function buildDirectionDiagnostic(goal: GoalDetailRecord | null): DiagnosticItem {
  if (!goal) {
    return {
      factor: "DIRECTION",
      state: "MISSING",
      title: "Нет зафиксированного направления",
      message: "Пока у артиста нет главной карьерной цели, поэтому система не может задать осмысленный вектор.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:DIRECTION",
        kind: "DIAGNOSTIC",
        title: "Поставить главную цель",
        text: "Пока у артиста нет главной карьерной цели, поэтому система не может задать осмысленный вектор.",
        href: "/today"
      })
    };
  }

  if (!trimOrNull(goal.successDefinition) || !goal.targetDate) {
    return {
      factor: "DIRECTION",
      state: "WEAK",
      title: "Цель есть, но её нельзя проверить",
      message: "Уточни срок и критерий успеха, иначе план останется расплывчатым.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:DIRECTION",
        kind: "DIAGNOSTIC",
        title: "Дополнить цель",
        text: "Уточни срок и критерий успеха, иначе план останется расплывчатым.",
        href: "/today#goal-plan",
        entityRef: {
          type: "artist_goal",
          id: goal.id
        }
      })
    };
  }

  const keyFactors = new Set(goalFactorsByType[goal.type]);
  const hasTasksAcrossPillars = goal.pillars.filter((pillar) => keyFactors.has(pillar.factor)).every((pillar) => pillar.tasks.length > 0);
  if (!hasTasksAcrossPillars) {
    return {
      factor: "DIRECTION",
      state: "IN_PROGRESS",
      title: "Цель ещё не разложена полностью",
      message: "Часть стратегических блоков уже есть, но декомпозиция ещё не покрывает всю цель.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:DIRECTION",
        kind: "DIAGNOSTIC",
        title: "Открыть план",
        text: "Часть стратегических блоков уже есть, но декомпозиция ещё не покрывает всю цель.",
        href: "/today#goal-plan",
        entityRef: {
          type: "artist_goal",
          id: goal.id
        }
      })
    };
  }

  return {
    factor: "DIRECTION",
    state: "STRONG",
    title: "Направление зафиксировано",
    message: "Главная цель понятна и уже разложена на опорные блоки и задачи.",
    recommendation: buildSystemRecommendation({
      key: "home:diagnostic:DIRECTION",
      kind: "DIAGNOSTIC",
      title: "Перейти к фокусу дня",
      text: "Главная цель понятна и уже разложена на опорные блоки и задачи.",
      href: "/today",
      entityRef: {
        type: "artist_goal",
        id: goal.id
      }
    })
  };
}

function buildArtistWorldDiagnostic(profile: ArtistWorldInput | null): DiagnosticItem {
  const completedCount = [
    trimOrNull(profile?.identityStatement),
    trimOrNull(profile?.mission),
    trimOrNull(profile?.philosophy),
    uniqueStrings(profile?.coreThemes).length ? "themes" : null,
    uniqueStrings(profile?.aestheticKeywords).length ? "aesthetic" : null,
    trimOrNull(profile?.visualDirection),
    trimOrNull(profile?.audienceCore),
    trimOrNull(profile?.differentiator),
    uniqueStrings(profile?.fashionSignals).length ? "fashion" : null
  ].filter(Boolean).length;

  if (completedCount === 0) {
    return {
      factor: "ARTIST_WORLD",
      state: "MISSING",
      title: "Мир артиста не собран",
      message: "Сейчас бренд-ядро пустое, поэтому стратегия и задачи рискуют быть несвязными.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:ARTIST_WORLD",
        kind: "DIAGNOSTIC",
        title: "Заполнить мир артиста",
        text: "Сейчас бренд-ядро пустое, поэтому стратегия и задачи рискуют быть несвязными.",
        href: "/id"
      })
    };
  }

  if (completedCount <= 2) {
    return {
      factor: "ARTIST_WORLD",
      state: "WEAK",
      title: "Мир артиста держится на двух опорах",
      message: "Добавь миссию, темы и визуальный язык, чтобы цель не развалилась на случайные действия.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:ARTIST_WORLD",
        kind: "DIAGNOSTIC",
        title: "Дописать профиль",
        text: "Добавь миссию, темы и визуальный язык, чтобы цель не развалилась на случайные действия.",
        href: "/id"
      })
    };
  }

  const hasCoreFields =
    Boolean(trimOrNull(profile?.identityStatement)) &&
    Boolean(trimOrNull(profile?.mission)) &&
    uniqueStrings(profile?.coreThemes).length > 0 &&
    Boolean(trimOrNull(profile?.visualDirection));

  if (!hasCoreFields || completedCount < 7) {
    return {
      factor: "ARTIST_WORLD",
      state: "IN_PROGRESS",
      title: "Мир артиста уже читается",
      message: "Основа собрана, но ещё есть пустоты, из-за которых бренд и стратегия могут расходиться.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:ARTIST_WORLD",
        kind: "DIAGNOSTIC",
        title: "Усилить мир артиста",
        text: "Основа собрана, но ещё есть пустоты, из-за которых бренд и стратегия могут расходиться.",
        href: "/id"
      })
    };
  }

  return {
    factor: "ARTIST_WORLD",
    state: "STRONG",
    title: "Мир артиста оформлен",
    message: "Идентичность, темы и визуальный язык уже могут работать как фундамент для стратегии.",
    recommendation: buildSystemRecommendation({
      key: "home:diagnostic:ARTIST_WORLD",
      kind: "DIAGNOSTIC",
      title: "Открыть SAFE ID",
      text: "Идентичность, темы и визуальный язык уже могут работать как фундамент для стратегии.",
      href: "/id"
    })
  };
}

function buildPillarDiagnostic(options: {
  goal: GoalDetailRecord;
  factor: GoalFactor;
  title: string;
  emptyMessage: string;
  weakMessage: string;
  strongMessage: string;
  recommendedActionLabel: string;
  recommendedActionHref: string;
  isStrong: (goal: GoalDetailRecord, pillar: GoalDetailRecord["pillars"][number]) => boolean;
  isInProgress?: (goal: GoalDetailRecord, pillar: GoalDetailRecord["pillars"][number]) => boolean;
}): DiagnosticItem | null {
  const pillar = options.goal.pillars.find((item) => item.factor === options.factor);
  if (!pillar) return null;

  if (pillar.tasks.length === 0) {
    return {
      factor: options.factor,
      state: "MISSING",
      title: options.title,
      message: options.emptyMessage,
      recommendation: buildSystemRecommendation({
        key: `home:diagnostic:${options.factor}`,
        kind: "DIAGNOSTIC",
        title: options.recommendedActionLabel,
        text: options.emptyMessage,
        href: options.recommendedActionHref
      })
    };
  }

  if (options.isStrong(options.goal, pillar)) {
    return {
      factor: options.factor,
      state: "STRONG",
      title: options.title,
      message: options.strongMessage,
      recommendation: buildSystemRecommendation({
        key: `home:diagnostic:${options.factor}`,
        kind: "DIAGNOSTIC",
        title: options.recommendedActionLabel,
        text: options.strongMessage,
        href: options.recommendedActionHref
      })
    };
  }

  if (options.isInProgress?.(options.goal, pillar)) {
    return {
      factor: options.factor,
      state: "IN_PROGRESS",
      title: options.title,
      message: options.weakMessage,
      recommendation: buildSystemRecommendation({
        key: `home:diagnostic:${options.factor}`,
        kind: "DIAGNOSTIC",
        title: options.recommendedActionLabel,
        text: options.weakMessage,
        href: options.recommendedActionHref
      })
    };
  }

  return {
    factor: options.factor,
    state: "WEAK",
    title: options.title,
    message: options.weakMessage,
    recommendation: buildSystemRecommendation({
      key: `home:diagnostic:${options.factor}`,
      kind: "DIAGNOSTIC",
      title: options.recommendedActionLabel,
      text: options.weakMessage,
      href: options.recommendedActionHref
    })
  };
}

function buildOperatingRhythmDiagnostic(weeklyActiveDays: number, hasCheckIn: boolean, completedFocusCount: number): DiagnosticItem {
  if (!hasCheckIn && weeklyActiveDays === 0 && completedFocusCount === 0) {
    return {
      factor: "OPERATING_RHYTHM",
      state: "MISSING",
      title: "Ритм пока не собран",
      message: "Нет признаков регулярной фиксации и исполнения, поэтому даже хороший план не превращается в движение.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:OPERATING_RHYTHM",
        kind: "DIAGNOSTIC",
        title: "Вернуться в Today",
        text: "Нет признаков регулярной фиксации и исполнения, поэтому даже хороший план не превращается в движение.",
        href: "/today"
      })
    };
  }

  if (weeklyActiveDays >= 4 && completedFocusCount >= 3) {
    return {
      factor: "OPERATING_RHYTHM",
      state: "STRONG",
      title: "Ритм держится",
      message: "Есть устойчивое подтверждение, что ежедневный фокус превращается в реальную работу.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:OPERATING_RHYTHM",
        kind: "DIAGNOSTIC",
        title: "Сохранить темп",
        text: "Есть устойчивое подтверждение, что ежедневный фокус превращается в реальную работу.",
        href: "/today"
      })
    };
  }

  if (weeklyActiveDays >= 2 || completedFocusCount >= 1 || hasCheckIn) {
    return {
      factor: "OPERATING_RHYTHM",
      state: "IN_PROGRESS",
      title: "Ритм появляется, но ещё нестабилен",
      message: "Часть сигналов уже есть, но системе ещё не хватает регулярности.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:OPERATING_RHYTHM",
        kind: "DIAGNOSTIC",
        title: "Сделать фокус дня",
        text: "Часть сигналов уже есть, но системе ещё не хватает регулярности.",
        href: "/today"
      })
    };
  }

  return {
    factor: "OPERATING_RHYTHM",
    state: "WEAK",
    title: "Ритм слабый",
    message: "Есть отдельные действия, но пока нет понятной недели исполнения.",
    recommendation: buildSystemRecommendation({
      key: "home:diagnostic:OPERATING_RHYTHM",
      kind: "DIAGNOSTIC",
      title: "Вернуться в Today",
      text: "Есть отдельные действия, но пока нет понятной недели исполнения.",
      href: "/today"
    })
  };
}

function buildTrajectoryBalanceDiagnostic(trajectoryReview: GoalTrajectoryReview | null): DiagnosticItem | null {
  if (!trajectoryReview) return null;

  if (trajectoryReview.balanceState === "BALANCED") {
    return {
      factor: "CRAFT_CREATIVE_BALANCE",
      state: "STRONG",
      title: "Баланс craft и creative держится",
      message: "Неделя не перекошена: ремесло и творчество поддерживают один цикл, а не спорят между собой.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:CRAFT_CREATIVE_BALANCE",
        kind: "DIAGNOSTIC",
        title: "Открыть Today",
        text: "Неделя не перекошена: ремесло и творчество поддерживают один цикл, а не спорят между собой.",
        href: "/today"
      })
    };
  }

  return {
    factor: "CRAFT_CREATIVE_BALANCE",
    state: "WEAK",
    title: trajectoryReview.balanceState === "CRAFT_HEAVY" ? "Неделя утонула в craft" : "Неделя утонула в creative",
    message:
      trajectoryReview.balanceState === "CRAFT_HEAVY"
        ? "Слишком много операционки и доведения, а творческий слой не подпитывает цель."
        : "Творческих шагов много, но ремесленного продвижения и упаковки не хватает.",
    recommendation: buildSystemRecommendation({
      key: "home:diagnostic:CRAFT_CREATIVE_BALANCE",
      kind: "DIAGNOSTIC",
      title: "Перебалансировать план",
      text:
        trajectoryReview.balanceState === "CRAFT_HEAVY"
          ? "Слишком много операционки и доведения, а творческий слой не подпитывает цель."
          : "Творческих шагов много, но ремесленного продвижения и упаковки не хватает.",
      href: "/today#goal-plan"
    })
  };
}

function buildTrajectoryFocusDiagnostic(trajectoryReview: GoalTrajectoryReview | null): DiagnosticItem | null {
  if (!trajectoryReview) return null;

  return trajectoryReview.focusState === "SCATTERED"
    ? {
        factor: "FOCUS_DISCIPLINE",
        state: "MISSING",
        title: "Фокус рассыпался",
        message: "Слишком много одновременной работы или постоянное переключение без завершения.",
        recommendation: buildSystemRecommendation({
          key: "home:diagnostic:FOCUS_DISCIPLINE",
          kind: "DIAGNOSTIC",
          title: "Сузить фокус",
          text: "Слишком много одновременной работы или постоянное переключение без завершения.",
          href: "/today"
        })
      }
    : {
        factor: "FOCUS_DISCIPLINE",
        state: "STRONG",
        title: "Фокус удерживается",
        message: "Система не распыляет внимание и держит понятный центр недели.",
        recommendation: buildSystemRecommendation({
          key: "home:diagnostic:FOCUS_DISCIPLINE",
          kind: "DIAGNOSTIC",
          title: "Сохранить темп",
          text: "Система не распыляет внимание и держит понятный центр недели.",
          href: "/today"
        })
      };
}

function buildTrajectoryDeliveryDiagnostic(trajectoryReview: GoalTrajectoryReview | null): DiagnosticItem | null {
  if (!trajectoryReview) return null;

  if (trajectoryReview.deliveryState === "DELIVERING") {
    return {
      factor: "DELIVERY",
      state: "STRONG",
      title: "Есть доведение до результата",
      message: "Неделя даёт не только движение, но и закрытые шаги.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:DELIVERY",
        kind: "DIAGNOSTIC",
        title: "Продолжить цикл",
        text: "Неделя даёт не только движение, но и закрытые шаги.",
        href: "/today"
      })
    };
  }

  if (trajectoryReview.deliveryState === "AT_RISK") {
    return {
      factor: "DELIVERY",
      state: "WEAK",
      title: "Доведение под риском",
      message: "Отдельные завершения появляются, но цикл ещё легко уходит в недоделанность.",
      recommendation: buildSystemRecommendation({
        key: "home:diagnostic:DELIVERY",
        kind: "DIAGNOSTIC",
        title: "Укрепить ритм",
        text: "Отдельные завершения появляются, но цикл ещё легко уходит в недоделанность.",
        href: "/today"
      })
    };
  }

  return {
    factor: "DELIVERY",
    state: "MISSING",
    title: "Нет доведения",
    message: "Работа идёт, но без завершений система начинает крутиться вхолостую.",
    recommendation: buildSystemRecommendation({
      key: "home:diagnostic:DELIVERY",
      kind: "DIAGNOSTIC",
      title: "Вернуться к незавершённым задачам",
      text: "Работа идёт, но без завершений система начинает крутиться вхолостую.",
      href: "/today#goal-plan"
    })
  };
}

function severityRank(state: DiagnosticState) {
  switch (state) {
    case "MISSING":
      return 0;
    case "WEAK":
      return 1;
    case "IN_PROGRESS":
      return 2;
    default:
      return 3;
  }
}

export function buildDiagnostics(input: {
  goal: GoalDetailRecord | null;
  trajectoryReview?: GoalTrajectoryReview | null;
  identityProfile: ArtistWorldInput | null;
  weeklyActiveDays: number;
  hasCheckIn: boolean;
  completedFocusCount: number;
  requestCount: number;
  trackCount: number;
  projectCount: number;
}) {
  const diagnostics: DiagnosticItem[] = [];
  const balanceDiagnostic = buildTrajectoryBalanceDiagnostic(input.trajectoryReview ?? null);
  const focusDiagnostic = buildTrajectoryFocusDiagnostic(input.trajectoryReview ?? null);
  const deliveryDiagnostic = buildTrajectoryDeliveryDiagnostic(input.trajectoryReview ?? null);
  if (balanceDiagnostic) diagnostics.push(balanceDiagnostic);
  if (focusDiagnostic) diagnostics.push(focusDiagnostic);
  if (deliveryDiagnostic) diagnostics.push(deliveryDiagnostic);
  diagnostics.push(buildDirectionDiagnostic(input.goal));
  diagnostics.push(buildArtistWorldDiagnostic(input.identityProfile));

  if (isGoalDetailRecord(input.goal)) {
    const catalogDiagnostic = buildPillarDiagnostic({
      goal: input.goal,
      factor: GoalFactor.CATALOG,
      title: "Каталог не дотянут до цели",
      emptyMessage: "Цель заявлена, но музыкальная часть пока не привязана к ней в задачах.",
      weakMessage: "Каталог уже размечен, но ещё не связан с конкретными треками, проектами и завершёнными действиями.",
      strongMessage: "Каталог уже встроен в стратегию и начинает работать на цель.",
      recommendedActionLabel: "Открыть Songs",
      recommendedActionHref: "/songs",
      isStrong: (goal, pillar) =>
        pillar.tasks.some((task) => task.status === GoalTaskStatus.DONE && (task.linkedTrackId || task.linkedProjectId)),
      isInProgress: (_goal, pillar) =>
        pillar.tasks.some((task) => task.linkedTrackId || task.linkedProjectId) || input.trackCount > 0 || input.projectCount > 0
    });
    if (catalogDiagnostic) diagnostics.push(catalogDiagnostic);

    const audienceDiagnostic = buildPillarDiagnostic({
      goal: input.goal,
      factor: GoalFactor.AUDIENCE,
      title: "Аудитория пока не встроена в систему",
      emptyMessage: "Нет опорных задач, которые переводят цель в контакт с живой аудиторией.",
      weakMessage: "Аудиторный блок уже есть, но ему не хватает ясной гипотезы и регулярного действия.",
      strongMessage: "Есть понятный вектор работы с аудиторией, связанный с главной целью.",
      recommendedActionLabel: "Открыть план",
      recommendedActionHref: "/today#goal-plan",
      isStrong: (_goal, pillar) => pillar.tasks.some((task) => task.status === GoalTaskStatus.DONE),
      isInProgress: () => Boolean(trimOrNull(input.identityProfile?.audienceCore))
    });
    if (audienceDiagnostic) diagnostics.push(audienceDiagnostic);

    const liveDiagnostic = buildPillarDiagnostic({
      goal: input.goal,
      factor: GoalFactor.LIVE,
      title: "Live-компонент ещё не оформлен",
      emptyMessage: "Для этой цели нужен live-блок, но в плане он пока пустой.",
      weakMessage: "Live-задачи уже есть, но артист ещё не дошёл до готового сценического предложения.",
      strongMessage: "Live-слой уже встроен в стратегию цели.",
      recommendedActionLabel: "Открыть план",
      recommendedActionHref: "/today#goal-plan",
      isStrong: (_goal, pillar) => pillar.tasks.some((task) => task.status === GoalTaskStatus.DONE),
      isInProgress: (_goal, pillar) => pillar.tasks.some((task) => task.status === GoalTaskStatus.IN_PROGRESS)
    });
    if (liveDiagnostic) diagnostics.push(liveDiagnostic);

    const teamDiagnostic = buildPillarDiagnostic({
      goal: input.goal,
      factor: GoalFactor.TEAM,
      title: "Командный слой ещё не закрыт",
      emptyMessage: "Цель не поддержана людьми и ролями, которые помогут её довести.",
      weakMessage: "Внешние задачи уже видны, но ещё не всем назначены нужные категории и следующие контакты.",
      strongMessage: "Командные пробелы названы и уже переводятся в реальные контакты и действия.",
      recommendedActionLabel: "Открыть Find",
      recommendedActionHref: "/find",
      isStrong: (_goal, pillar) =>
        pillar.tasks.some((task) => task.ownerType === TaskOwnerType.EXTERNAL && Boolean(task.linkedSpecialistCategory)) && input.requestCount > 0,
      isInProgress: (_goal, pillar) =>
        pillar.tasks.some((task) => task.ownerType === TaskOwnerType.EXTERNAL && Boolean(task.linkedSpecialistCategory))
    });
    if (teamDiagnostic) diagnostics.push(teamDiagnostic);
  }

  diagnostics.push(buildOperatingRhythmDiagnostic(input.weeklyActiveDays, input.hasCheckIn, input.completedFocusCount));

  return diagnostics.sort((left, right) => severityRank(left.state) - severityRank(right.state));
}

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

export function todayToDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getWeekStart(dateOnly: Date) {
  const dayOfWeek = dateOnly.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(dateOnly);
  weekStartDate.setUTCDate(dateOnly.getUTCDate() + mondayOffset);
  return weekStartDate;
}

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
  return {
    id: goal.id,
    title: goal.title,
    type: goal.type,
    typeLabel: artistGoalTypeLabels[goal.type],
    status: goal.status,
    targetDate: goal.targetDate?.toISOString() ?? null,
    successDefinition: goal.successDefinition,
    progress: buildGoalProgress(goal),
    trajectoryReview,
    balanceSummary: serializeBalanceSummary(trajectoryReview),
    identityBridge,
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

export async function getIdentityProfile(db: DbClient, userId: string) {
  return db.artistIdentityProfile.findUnique({
    where: { userId }
  });
}

export function normalizeArtistWorldPayload(input: ArtistWorldInput) {
  return {
    identityStatement: trimOrNull(input.identityStatement),
    mission: trimOrNull(input.mission),
    philosophy: trimOrNull(input.philosophy),
    values: uniqueStrings(input.values),
    coreThemes: uniqueStrings(input.coreThemes),
    aestheticKeywords: uniqueStrings(input.aestheticKeywords),
    visualDirection: trimOrNull(input.visualDirection),
    audienceCore: trimOrNull(input.audienceCore),
    differentiator: trimOrNull(input.differentiator),
    fashionSignals: uniqueStrings(input.fashionSignals),
    worldThemePreset:
      input.worldThemePreset && artistWorldThemePresetOptions.includes(input.worldThemePreset)
        ? input.worldThemePreset
        : ArtistWorldThemePreset.EDITORIAL,
    worldBackgroundMode:
      input.worldBackgroundMode && artistWorldBackgroundModeOptions.includes(input.worldBackgroundMode)
        ? input.worldBackgroundMode
        : ArtistWorldBackgroundMode.GRADIENT,
    worldBackgroundColorA: normalizeOptionalHex(input.worldBackgroundColorA),
    worldBackgroundColorB: normalizeOptionalHex(input.worldBackgroundColorB),
    worldBackgroundImageUrl: trimOrNull(input.worldBackgroundImageUrl),
    worldBlockOrder: normalizeBlockIds(input.worldBlockOrder),
    worldHiddenBlocks: normalizeHiddenBlockIds(input.worldHiddenBlocks),
    references: Array.isArray(input.references) ? input.references.map(normalizeArtistWorldReference) : [],
    projects: Array.isArray(input.projects) ? input.projects.map(normalizeArtistWorldProject) : []
  };
}

export function serializeArtistWorld(profile: ArtistWorldInput | null) {
  const normalized = normalizeArtistWorldPayload(profile ?? {});
  return {
    identityStatement: normalized.identityStatement,
    mission: normalized.mission,
    philosophy: normalized.philosophy,
    values: normalized.values,
    coreThemes: normalized.coreThemes,
    aestheticKeywords: normalized.aestheticKeywords,
    visualDirection: normalized.visualDirection,
    audienceCore: normalized.audienceCore,
    differentiator: normalized.differentiator,
    fashionSignals: normalized.fashionSignals,
    themePreset: normalized.worldThemePreset,
    backgroundMode: normalized.worldBackgroundMode,
    backgroundColorA: normalized.worldBackgroundColorA,
    backgroundColorB: normalized.worldBackgroundColorB,
    backgroundImageUrl: normalized.worldBackgroundImageUrl,
    blockOrder: normalized.worldBlockOrder,
    hiddenBlocks: normalized.worldHiddenBlocks,
    references: normalized.references,
    projects: normalized.projects
  };
}

export function splitTextareaList(value: string) {
  return uniqueStrings(
    value
      .split(/\r?\n|,/)
      .map((item) => capitalize(item.trim()))
      .filter(Boolean)
  );
}
