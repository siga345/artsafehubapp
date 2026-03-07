import {
  ArtistGoalType,
  FindCategory,
  GoalFactor,
  GoalMotionType,
  TaskOwnerType,
  TaskPriority
} from "@prisma/client";
import { trimOrNull } from "./types";

// ─── Internal types ──────────────────────────────────────────────────────────

type StageBucket = "EARLY" | "MID" | "LATE";

type TaskTemplate = {
  title: string;
  description: string;
  motionType?: GoalMotionType;
  priority?: TaskPriority;
  ownerType?: TaskOwnerType;
  linkedSpecialistCategory?: FindCategory;
};

export type GoalTemplateInput = {
  goalType: ArtistGoalType;
  stageOrder: number;
  title: string;
  mission?: string | null;
  identityStatement?: string | null;
  audienceCore?: string | null;
};

// ─── Label maps ──────────────────────────────────────────────────────────────

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

export const goalFactorsByType: Record<ArtistGoalType, GoalFactor[]> = {
  ALBUM_RELEASE: [GoalFactor.ARTIST_WORLD, GoalFactor.CATALOG, GoalFactor.AUDIENCE, GoalFactor.TEAM, GoalFactor.OPERATIONS],
  MINI_TOUR: [GoalFactor.ARTIST_WORLD, GoalFactor.LIVE, GoalFactor.AUDIENCE, GoalFactor.TEAM, GoalFactor.OPERATIONS],
  FESTIVAL_RUN: [GoalFactor.ARTIST_WORLD, GoalFactor.LIVE, GoalFactor.AUDIENCE, GoalFactor.TEAM],
  SOLO_SHOW: [GoalFactor.ARTIST_WORLD, GoalFactor.CATALOG, GoalFactor.LIVE, GoalFactor.AUDIENCE, GoalFactor.TEAM],
  MERCH_DROP: [GoalFactor.ARTIST_WORLD, GoalFactor.AUDIENCE, GoalFactor.TEAM, GoalFactor.OPERATIONS],
  CUSTOM_CAREER: [GoalFactor.DIRECTION, GoalFactor.ARTIST_WORLD, GoalFactor.CATALOG, GoalFactor.AUDIENCE, GoalFactor.OPERATIONS]
};

// ─── Internal helpers ────────────────────────────────────────────────────────

function getStageBucket(stageOrder: number): StageBucket {
  if (stageOrder <= 2) return "EARLY";
  if (stageOrder <= 5) return "MID";
  return "LATE";
}

function getGoalFactorMotionType(factor: GoalFactor) {
  return goalFactorDefaultMotionTypes[factor];
}

export function computeDueDate(targetDate: Date | null | undefined, index: number) {
  if (!targetDate) return null;
  const next = new Date(targetDate);
  next.setUTCDate(next.getUTCDate() - Math.max(7, index * 7));
  return next;
}

// ─── Per-factor template builders ────────────────────────────────────────────

function buildArtistWorldTemplates(input: GoalTemplateInput, stageBucket: StageBucket): TaskTemplate[] {
  const identityLine = trimOrNull(input.identityStatement);
  const missionLine = trimOrNull(input.mission);
  const audienceLine = trimOrNull(input.audienceCore);
  const base: TaskTemplate[] = [
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

// ─── Public API ──────────────────────────────────────────────────────────────

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
