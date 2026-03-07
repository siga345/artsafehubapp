import { GoalFactor, GoalTaskStatus, TaskOwnerType } from "@prisma/client";
import type { RecommendationCard } from "@/contracts/recommendations";
import type { GoalDetailRecord } from "./types";
import { trimOrNull, uniqueStrings } from "./types";
import {
  buildSystemRecommendation,
  type GoalTrajectoryReview
} from "./trajectory";
import { goalFactorsByType } from "./templates";
import type { ArtistWorldInput } from "@/lib/artist-world";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Per-factor diagnostics ──────────────────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────────────────────

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

  if (input.goal) {
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
