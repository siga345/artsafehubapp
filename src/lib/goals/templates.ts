import {
  ArtistGoalType,
  ExecutionTemplate,
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
  executionTemplate?: ExecutionTemplate | null;
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

export const executionTemplateLabels: Record<ExecutionTemplate, string> = {
  SINGLE_RELEASE: "Релиз сингла",
  ARTIST_PROFILE_REFRESH: "Обновить карточки артиста",
  TEAM_SEARCH: "Поиск команды",
  CUSTOM_PROJECT: "Свободный проект"
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

type ExecutionPillarTemplate = {
  factor: GoalFactor;
  title: string;
  purpose: string;
  tasks: TaskTemplate[];
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

export function getGoalTypeForExecutionTemplate(template: ExecutionTemplate): ArtistGoalType {
  switch (template) {
    case "SINGLE_RELEASE":
      return ArtistGoalType.ALBUM_RELEASE;
    case "ARTIST_PROFILE_REFRESH":
      return ArtistGoalType.CUSTOM_CAREER;
    case "TEAM_SEARCH":
      return ArtistGoalType.CUSTOM_CAREER;
    case "CUSTOM_PROJECT":
      return ArtistGoalType.CUSTOM_CAREER;
    default:
      return ArtistGoalType.CUSTOM_CAREER;
  }
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

function buildSingleReleaseExecutionPillars(input: GoalTemplateInput): ExecutionPillarTemplate[] {
  return [
    {
      factor: GoalFactor.CATALOG,
      title: "Музыка",
      purpose: "Собрать музыкальную основу релиза и понять, какой материал реально несёт проект.",
      tasks: [
        {
          title: "Выбрать главный трек релиза",
          description: `Определи, какой материал станет центром проекта "${input.title}" и почему именно он должен выйти первым.`,
          priority: TaskPriority.HIGH
        },
        {
          title: "Привязать трек или проект к релизу",
          description: "Свяжи проект с конкретным музыкальным материалом, чтобы рекомендации не висели в воздухе."
        }
      ]
    },
    {
      factor: GoalFactor.ARTIST_WORLD,
      title: "Образ",
      purpose: "Собрать визуальный и смысловой слой проекта, чтобы релиз ощущался как часть мира артиста.",
      tasks: [
        {
          title: "Собрать референсы для визуала",
          description: "Подбери 5-10 референсов, которые задают настроение релиза и помогут говорить с визуальной командой.",
          priority: TaskPriority.HIGH
        },
        {
          title: "Определить визуальный язык релиза",
          description: trimOrNull(input.identityStatement)
            ? `Свяжи релиз с identity statement "${trimOrNull(input.identityStatement)}" и определи, как это читается в образе.`
            : "Сформулируй 2-3 опорных визуальных сигнала, чтобы релиз не выглядел случайным."
        }
      ]
    },
    {
      factor: GoalFactor.AUDIENCE,
      title: "Промо",
      purpose: "Понять, как анонсировать релиз и через какие касания выводить его в поле зрения аудитории.",
      tasks: [
        {
          title: "Собрать анонсный пакет",
          description: "Определи минимальный набор для запуска: дата, тизер, обложка, короткое описание и первые точки контакта.",
          priority: TaskPriority.HIGH
        },
        {
          title: "Собрать план первых касаний",
          description: trimOrNull(input.audienceCore)
            ? `Собери простой план под аудиторию: ${trimOrNull(input.audienceCore)}.`
            : "Определи, где и как релиз впервые встретится со своей аудиторией."
        }
      ]
    },
    {
      factor: GoalFactor.TEAM,
      title: "Команда",
      purpose: "Зафиксировать, кто нужен проекту, и где требуется внешний человек вместо бесконечного solo-mode.",
      tasks: [
        {
          title: "Понять, кто нужен под релиз",
          description: "Раздели, что ты делаешь сам, а где нужен внешний человек, чтобы проект не тормозил.",
          priority: TaskPriority.HIGH
        },
        {
          title: "Найти или подтвердить нужного специалиста",
          description: "Подготовь короткий запрос и открой поиск по человеку, который закрывает узкое место.",
          ownerType: TaskOwnerType.EXTERNAL,
          linkedSpecialistCategory: FindCategory.PROMO_CREW
        }
      ]
    },
    {
      factor: GoalFactor.OPERATIONS,
      title: "Организация",
      purpose: "Собрать проект в управляемый контур, а не в набор зависших идей и обещаний.",
      tasks: [
        {
          title: "Определить ближайшие контрольные точки",
          description: `Разложи проект "${input.title}" на ближайшие этапы, которые реально можно проверить и довести.`,
          priority: TaskPriority.HIGH
        },
        {
          title: "Закрепить 1-3 приоритета проекта",
          description: "Определи, что именно нельзя откладывать, чтобы релиз продолжал двигаться."
        }
      ]
    }
  ];
}

function buildArtistProfileRefreshExecutionPillars(input: GoalTemplateInput): ExecutionPillarTemplate[] {
  return [
    {
      factor: GoalFactor.ARTIST_WORLD,
      title: "Образ",
      purpose: "Обновить самоописание и визуальное ядро артиста, чтобы карточки и площадки говорили единым языком.",
      tasks: [
        {
          title: "Обновить identity block",
          description: trimOrNull(input.identityStatement)
            ? `Пересмотри основу "${trimOrNull(input.identityStatement)}" и реши, что должно звучать яснее и современнее.`
            : "Собери короткое самоописание, которое понятно объясняет, кто ты как артист."
        },
        {
          title: "Собрать новые визуальные референсы",
          description: "Подбери набор референсов под актуальный этап артиста, чтобы обновление не было косметическим."
        }
      ]
    },
    {
      factor: GoalFactor.CATALOG,
      title: "Материал",
      purpose: "Определить, какой музыкальный материал и какие релизы должны поддерживать обновлённый образ.",
      tasks: [
        {
          title: "Выбрать материал для обновлённой подачи",
          description: "Определи, какие треки, фрагменты и описания лучше всего представляют артиста сейчас.",
          priority: TaskPriority.HIGH
        },
        {
          title: "Подготовить контент для карточек",
          description: "Собери тексты, цитаты, сниппеты и фактуру, которая будет жить на площадках и в профилях."
        }
      ]
    },
    {
      factor: GoalFactor.AUDIENCE,
      title: "Площадки",
      purpose: "Проверить, где аудитория реально соприкасается с артистом, и убрать устаревшие или пустые точки входа.",
      tasks: [
        {
          title: "Проверить карточки и ссылки артиста",
          description: "Пройди по основным площадкам и найди разрывы между образом, текстами и актуальным материалом.",
          priority: TaskPriority.HIGH
        },
        {
          title: "Обновить точки первого впечатления",
          description: "Реши, что видит человек при первом заходе: аватар, описание, визуал, ключевой релиз."
        }
      ]
    },
    {
      factor: GoalFactor.TEAM,
      title: "Команда",
      purpose: "Понять, кто поможет собрать новый образ быстрее и сильнее, чем endless solo revisions.",
      tasks: [
        {
          title: "Определить нужные роли под обновление",
          description: "Реши, нужен ли дизайнер, фотограф, стилист или редакторский взгляд со стороны."
        },
        {
          title: "Открыть поиск по визуальному исполнителю",
          description: "Подготовь короткий бриф и найди человека, который усилит обновление карточек.",
          ownerType: TaskOwnerType.EXTERNAL,
          linkedSpecialistCategory: FindCategory.DESIGNER
        }
      ]
    },
    {
      factor: GoalFactor.OPERATIONS,
      title: "Сборка",
      purpose: "Собрать обновление в один короткий проект, а не в бесконечный фон без дедлайна.",
      tasks: [
        {
          title: "Собрать список того, что точно обновляется",
          description: `Сформируй минимальный контур проекта "${input.title}", чтобы обновление было конечным и проверяемым.`,
          priority: TaskPriority.HIGH
        },
        {
          title: "Закрепить последовательность сборки",
          description: "Определи, что делается сначала: образ, контент, площадки или команда."
        }
      ]
    }
  ];
}

function buildTeamSearchExecutionPillars(input: GoalTemplateInput): ExecutionPillarTemplate[] {
  return [
    {
      factor: GoalFactor.DIRECTION,
      title: "Запрос",
      purpose: "Сформулировать, зачем вообще нужен новый человек и что именно он должен изменить в карьере артиста.",
      tasks: [
        {
          title: "Понять, кого ты ищешь",
          description: `Опиши, какую проблему должен решить проект "${input.title}" и почему эту роль нельзя больше держать в тумане.`,
          priority: TaskPriority.HIGH
        },
        {
          title: "Собрать короткий запрос",
          description: "Сформулируй в 3-5 предложениях, что тебе нужно, на каком этапе ты находишься и чего ждёшь от контакта."
        }
      ]
    },
    {
      factor: GoalFactor.TEAM,
      title: "Роли",
      purpose: "Развести роли и ожидания, чтобы поиск не превратился в хаотичное “нужен кто-то помочь”.",
      tasks: [
        {
          title: "Развести задачи по ролям",
          description: "Определи, что делает артист, что делает менеджер, и какая роль реально закрывает дыру в проекте."
        },
        {
          title: "Собрать критерии адекватного человека",
          description: "Зафиксируй 3-5 критериев, по которым ты поймёшь, что человек подходит именно тебе."
        }
      ]
    },
    {
      factor: GoalFactor.CATALOG,
      title: "Материал",
      purpose: "Подготовить материал и контекст, чтобы поиск строился не на абстрактном разговоре, а на реальном состоянии артиста.",
      tasks: [
        {
          title: "Подготовить материал для показа",
          description: "Выбери трек, релиз, визуал или другие материалы, которые можно отправить в первом контакте."
        },
        {
          title: "Собрать 1-2 референса сотрудничества",
          description: "Подбери примеры того, какой тип работы и какого результата ты ищешь."
        }
      ]
    },
    {
      factor: GoalFactor.AUDIENCE,
      title: "Поиск",
      purpose: "Понять, где искать людей и по каким сигналам отсеивать случайные контакты.",
      tasks: [
        {
          title: "Открыть поиск по нужной категории",
          description: "Найди 3-5 релевантных кандидатов внутри экосистемы и за её пределами.",
          ownerType: TaskOwnerType.EXTERNAL,
          linkedSpecialistCategory: FindCategory.PRODUCER
        },
        {
          title: "Собрать shortlist кандидатов",
          description: "Выдели тех, с кем реально хочешь говорить дальше, а не тех, кто просто “на всякий случай”."
        }
      ]
    },
    {
      factor: GoalFactor.OPERATIONS,
      title: "Контакт",
      purpose: "Не растянуть поиск команды на месяцы без действий и обратной связи.",
      tasks: [
        {
          title: "Отправить первый контакт",
          description: "Сделай первый понятный outreach вместо бесконечной подготовки."
        },
        {
          title: "Зафиксировать следующий шаг после ответа",
          description: "Реши заранее, что делаешь, если кандидат ответил, попросил доп. материалы или не ответил."
        }
      ]
    }
  ];
}

function buildCustomExecutionPillars(input: GoalTemplateInput): ExecutionPillarTemplate[] {
  return [
    {
      factor: GoalFactor.DIRECTION,
      title: "Вектор",
      purpose: "Понять, что именно двигает этот проект и по каким признакам будет видно движение.",
      tasks: [
        {
          title: "Сформулировать смысл проекта",
          description: `Собери в 2-3 фразы, зачем вообще существует проект "${input.title}" и что он должен поменять.`,
          priority: TaskPriority.HIGH
        },
        {
          title: "Определить критерий движения",
          description: "Реши, по каким признакам станет понятно, что проект реально движется, а не просто обсуждается."
        }
      ]
    },
    {
      factor: GoalFactor.ARTIST_WORLD,
      title: "Образ",
      purpose: "Связать проект с образом артиста, чтобы он не был отдельной механической задачей.",
      tasks: [
        {
          title: "Понять, как проект поддерживает мир артиста",
          description: trimOrNull(input.mission)
            ? `Свяжи проект с миссией "${trimOrNull(input.mission)}" и зафиксируй, в чём именно эта связь.`
            : "Зафиксируй, как проект должен звучать и чувствоваться в контексте твоего образа."
        },
        {
          title: "Собрать визуальные и смысловые опоры",
          description: "Подбери несколько опор, чтобы проект не распадался между идеей и реализацией."
        }
      ]
    },
    {
      factor: GoalFactor.CATALOG,
      title: "Материал",
      purpose: "Привязать проект к реальному материалу, контенту или объекту работы.",
      tasks: [
        {
          title: "Определить материал проекта",
          description: "Выдели, с какими треками, релизами, текстами или объектами этот проект связан напрямую."
        },
        {
          title: "Собрать минимум для старта",
          description: "Подготовь базовый набор материалов, без которого проект невозможно двигать дальше."
        }
      ]
    },
    {
      factor: GoalFactor.AUDIENCE,
      title: "Видимость",
      purpose: "Понять, как проект будет выходить наружу и через какие точки касания станет заметен.",
      tasks: [
        {
          title: "Определить, кому этот проект должен стать видимым",
          description: trimOrNull(input.audienceCore)
            ? `Подумай, как проект должен дойти до аудитории: ${trimOrNull(input.audienceCore)}.`
            : "Реши, кто должен увидеть результат этого проекта и где это должно произойти."
        },
        {
          title: "Собрать первый внешний шаг",
          description: "Определи самый реалистичный способ вынести проект из внутреннего режима наружу."
        }
      ]
    },
    {
      factor: GoalFactor.OPERATIONS,
      title: "Организация",
      purpose: "Собрать проект в простую управляемую структуру без blank-workspace эффекта.",
      tasks: [
        {
          title: "Разложить проект по ближайшим этапам",
          description: "Сделай проект конечным: выдели 3-5 опорных этапов, а не бесконечную размытую цель.",
          priority: TaskPriority.HIGH
        },
        {
          title: "Выбрать 1-3 приоритета",
          description: "Определи, что сейчас важнее всего, чтобы проект начал набирать инерцию."
        }
      ]
    }
  ];
}

function buildExecutionTemplateBlueprint(input: GoalTemplateInput & { executionTemplate: ExecutionTemplate }) {
  let pillars: ExecutionPillarTemplate[];

  switch (input.executionTemplate) {
    case "SINGLE_RELEASE":
      pillars = buildSingleReleaseExecutionPillars(input);
      break;
    case "ARTIST_PROFILE_REFRESH":
      pillars = buildArtistProfileRefreshExecutionPillars(input);
      break;
    case "TEAM_SEARCH":
      pillars = buildTeamSearchExecutionPillars(input);
      break;
    case "CUSTOM_PROJECT":
      pillars = buildCustomExecutionPillars(input);
      break;
    default:
      pillars = buildCustomExecutionPillars(input);
      break;
  }

  return pillars.map((pillar, pillarIndex) => {
    const defaultMotionType = getGoalFactorMotionType(pillar.factor);
    return {
      factor: pillar.factor,
      defaultMotionType,
      title: pillar.title,
      purpose: pillar.purpose,
      sortIndex: pillarIndex,
      tasks: pillar.tasks.map((task, taskIndex) => ({
        ...task,
        motionType: task.motionType ?? defaultMotionType,
        priority: task.priority ?? TaskPriority.MEDIUM,
        ownerType: task.ownerType ?? TaskOwnerType.SELF,
        sortIndex: taskIndex
      }))
    };
  });
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
  if (input.executionTemplate) {
    return buildExecutionTemplateBlueprint({
      ...input,
      executionTemplate: input.executionTemplate
    });
  }

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
