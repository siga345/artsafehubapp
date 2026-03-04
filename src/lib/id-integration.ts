export type IdentitySupportChipKind =
  | "mission"
  | "identity"
  | "theme"
  | "aesthetic"
  | "visual"
  | "audience"
  | "differentiator"
  | "fashion";

export type IdentityBridgeStatus = "STRONG" | "PARTIAL" | "WEAK" | "MISSING";

export type IdentitySupportChip = {
  id: string;
  kind: IdentitySupportChipKind;
  label: string;
  value: string;
};

export type SoftWarning = {
  code: string;
  title: string;
  message: string;
};

export type GoalIdentityBridge = {
  status: IdentityBridgeStatus;
  summary: string;
  supports: IdentitySupportChip[];
  warnings: SoftWarning[];
  linkedTrackCount: number;
  linkedProjectCount: number;
};

export type TrackIdentityBridge = {
  status: IdentityBridgeStatus;
  summary: string;
  supports: IdentitySupportChip[];
  warnings: SoftWarning[];
  linkedGoals: Array<{
    goalId: string;
    goalTitle: string;
    isPrimary: boolean;
    pillarFactor: string;
    taskId: string;
    taskTitle: string;
  }>;
  matches: {
    coreThemes: string[];
    aestheticKeywords: string[];
    fashionSignals: string[];
  };
};

export type TodayContextBridge = {
  summary: string;
  supports: IdentitySupportChip[];
  warnings: SoftWarning[];
  linkedTrack: { id: string; title: string } | null;
  linkedProject: { id: string; title: string } | null;
};

export type ArtistWorldIdentitySource = {
  identityStatement?: string | null;
  mission?: string | null;
  philosophy?: string | null;
  coreThemes?: string[] | null;
  aestheticKeywords?: string[] | null;
  visualDirection?: string | null;
  audienceCore?: string | null;
  differentiator?: string | null;
  fashionSignals?: string[] | null;
};

type NormalizedArtistWorldIdentity = {
  identityStatement: string | null;
  mission: string | null;
  philosophy: string | null;
  coreThemes: string[];
  aestheticKeywords: string[];
  visualDirection: string | null;
  audienceCore: string | null;
  differentiator: string | null;
  fashionSignals: string[];
};

type GoalBridgeInput = {
  profile: ArtistWorldIdentitySource | null;
  goal: {
    title: string;
    whyNow?: string | null;
    successDefinition?: string | null;
    pillars: Array<{
      factor: string;
      tasks: Array<{
        title: string;
        description?: string | null;
        linkedTrackId?: string | null;
        linkedProjectId?: string | null;
      }>;
    }>;
  };
};

type TrackBridgeInput = {
  profile: ArtistWorldIdentitySource | null;
  track: {
    title: string;
    lyricsText?: string | null;
    trackIntent?: {
      summary?: string | null;
      whyNow?: string | null;
    } | null;
    linkedGoals: Array<{
      goalId: string;
      goalTitle: string;
      isPrimary: boolean;
      pillarFactor: string;
      taskId: string;
      taskTitle: string;
    }>;
  };
  primaryGoalId?: string | null;
};

function trimOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeText(value?: string | null) {
  return trimOrNull(value)?.toLowerCase().replace(/\s+/g, " ") ?? "";
}

function uniqueStrings(values?: string[] | null) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const trimmed = trimOrNull(value);
    if (!trimmed) continue;
    const key = normalizeText(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(trimmed);
  }

  return items;
}

function dedupeSupports(items: IdentitySupportChip[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${normalizeText(item.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeWarnings(items: SoftWarning[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

function summarizeSupports(items: IdentitySupportChip[]) {
  const values = items
    .slice(0, 3)
    .map((item) => item.value)
    .filter(Boolean);

  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} и ${values[1]}`;
  return `${values[0]}, ${values[1]} и ${values[2]}`;
}

function countArtistWorldCoverage(profile: NormalizedArtistWorldIdentity) {
  return [
    profile.identityStatement,
    profile.mission,
    profile.philosophy,
    profile.coreThemes.length ? "themes" : null,
    profile.aestheticKeywords.length ? "aesthetic" : null,
    profile.visualDirection,
    profile.audienceCore,
    profile.differentiator,
    profile.fashionSignals.length ? "fashion" : null
  ].filter(Boolean).length;
}

function findContainedTerms(terms: string[], textBank: Array<string | null | undefined>) {
  const normalizedText = textBank.map((value) => normalizeText(value)).filter(Boolean).join(" ");
  if (!normalizedText) return [];
  return terms.filter((term) => normalizedText.includes(normalizeText(term)));
}

function supportChip(kind: IdentitySupportChipKind, value: string, label?: string): IdentitySupportChip {
  return {
    id: `${kind}:${normalizeText(value)}`,
    kind,
    label:
      label ??
      {
        mission: "Mission",
        identity: "Identity",
        theme: "Theme",
        aesthetic: "Aesthetic",
        visual: "Visual",
        audience: "Audience",
        differentiator: "Differentiator",
        fashion: "Fashion"
      }[kind],
    value
  };
}

export function normalizeArtistWorldIdentity(profile: ArtistWorldIdentitySource | null | undefined): NormalizedArtistWorldIdentity {
  return {
    identityStatement: trimOrNull(profile?.identityStatement),
    mission: trimOrNull(profile?.mission),
    philosophy: trimOrNull(profile?.philosophy),
    coreThemes: uniqueStrings(profile?.coreThemes),
    aestheticKeywords: uniqueStrings(profile?.aestheticKeywords),
    visualDirection: trimOrNull(profile?.visualDirection),
    audienceCore: trimOrNull(profile?.audienceCore),
    differentiator: trimOrNull(profile?.differentiator),
    fashionSignals: uniqueStrings(profile?.fashionSignals)
  };
}

function resolveGoalStatus(args: {
  coverageCount: number;
  supports: IdentitySupportChip[];
  warnings: SoftWarning[];
  hasThemeLikeSupport: boolean;
  linkedTrackCount: number;
  linkedProjectCount: number;
  profile: NormalizedArtistWorldIdentity;
}): IdentityBridgeStatus {
  const { coverageCount, supports, warnings, hasThemeLikeSupport, linkedTrackCount, linkedProjectCount, profile } = args;
  if (!profile.identityStatement && !profile.mission && coverageCount === 0) return "MISSING";
  if (warnings.length === 0 && supports.length >= 4 && (hasThemeLikeSupport || linkedTrackCount > 0 || linkedProjectCount > 0)) {
    return "STRONG";
  }
  if (supports.length >= 2 || linkedTrackCount > 0 || linkedProjectCount > 0 || coverageCount >= 3) {
    return "PARTIAL";
  }
  return "WEAK";
}

function resolveTrackStatus(args: {
  coverageCount: number;
  supports: IdentitySupportChip[];
  warnings: SoftWarning[];
  linkedGoalsCount: number;
  hasMatch: boolean;
  hasPrimaryLinkedGoal: boolean;
  profile: NormalizedArtistWorldIdentity;
}): IdentityBridgeStatus {
  const { coverageCount, supports, warnings, linkedGoalsCount, hasMatch, hasPrimaryLinkedGoal, profile } = args;
  if (!profile.identityStatement && !profile.mission && coverageCount === 0 && linkedGoalsCount === 0 && !hasMatch) {
    return "MISSING";
  }
  if (warnings.length === 0 && hasPrimaryLinkedGoal && hasMatch && supports.length >= 3) {
    return "STRONG";
  }
  if (linkedGoalsCount > 0 || hasMatch || supports.length >= 2) {
    return "PARTIAL";
  }
  return "WEAK";
}

export function buildGoalIdentityBridge(input: GoalBridgeInput): GoalIdentityBridge {
  const profile = normalizeArtistWorldIdentity(input.profile);
  const coverageCount = countArtistWorldCoverage(profile);
  const allTasks = input.goal.pillars.flatMap((pillar) => pillar.tasks);
  const textBank = [
    input.goal.title,
    input.goal.whyNow ?? null,
    input.goal.successDefinition ?? null,
    ...allTasks.flatMap((task) => [task.title, task.description ?? null])
  ];

  const matchedThemes = findContainedTerms(profile.coreThemes, textBank);
  const matchedAesthetic = findContainedTerms(profile.aestheticKeywords, textBank);
  const matchedFashion = findContainedTerms(profile.fashionSignals, textBank);
  const linkedTrackCount = allTasks.filter((task) => Boolean(task.linkedTrackId)).length;
  const linkedProjectCount = allTasks.filter((task) => Boolean(task.linkedProjectId)).length;
  const hasAudiencePillar = input.goal.pillars.some((pillar) => pillar.factor === "AUDIENCE");
  const hasCatalogPillar = input.goal.pillars.some((pillar) => pillar.factor === "CATALOG");
  const supports = dedupeSupports([
    ...(profile.mission ? [supportChip("mission", profile.mission)] : []),
    ...(profile.identityStatement ? [supportChip("identity", profile.identityStatement)] : []),
    ...matchedThemes.map((value) => supportChip("theme", value)),
    ...(hasAudiencePillar && profile.audienceCore ? [supportChip("audience", profile.audienceCore)] : []),
    ...(profile.visualDirection ? [supportChip("visual", profile.visualDirection)] : []),
    ...(profile.differentiator ? [supportChip("differentiator", profile.differentiator)] : []),
    ...matchedAesthetic.map((value) => supportChip("aesthetic", value)),
    ...matchedFashion.map((value) => supportChip("fashion", value))
  ]).slice(0, 5);

  const warnings = dedupeWarnings([
    ...(!profile.identityStatement && !profile.mission
      ? [
          {
            code: "goal_missing_foundation",
            title: "Нужно ядро артиста",
            message: "У цели пока нет явной опоры на identity statement или mission."
          } satisfies SoftWarning
        ]
      : []),
    ...(matchedThemes.length === 0 && coverageCount < 3
      ? [
          {
            code: "goal_missing_world_support",
            title: "Связь с миром артиста слабая",
            message: "В тексте цели пока не читаются темы или маркеры мира артиста."
          } satisfies SoftWarning
        ]
      : []),
    ...(hasAudiencePillar && !profile.audienceCore
      ? [
          {
            code: "goal_audience_gap",
            title: "Не зафиксировано ядро аудитории",
            message: "У цели есть audience-блок, но в SAFE ID не заполнено, для кого эта музыка."
          } satisfies SoftWarning
        ]
      : []),
    ...(hasCatalogPillar && linkedTrackCount === 0 && linkedProjectCount === 0
      ? [
          {
            code: "goal_catalog_gap",
            title: "Каталог еще не привязан",
            message: "В catalog-задачах пока нет связанного трека или проекта."
          } satisfies SoftWarning
        ]
      : [])
  ]);

  const status = resolveGoalStatus({
    coverageCount,
    supports,
    warnings,
    hasThemeLikeSupport: matchedThemes.length > 0 || matchedAesthetic.length > 0 || matchedFashion.length > 0,
    linkedTrackCount,
    linkedProjectCount,
    profile
  });

  const supportSummary = summarizeSupports(supports);
  return {
    status,
    summary:
      supportSummary ??
      (status === "MISSING"
        ? "SAFE ID пока не дает опору для этой цели."
        : "Цель пока слабо связана с темами и миром артиста."),
    supports,
    warnings,
    linkedTrackCount,
    linkedProjectCount
  };
}

export function buildTrackIdentityBridge(input: TrackBridgeInput): TrackIdentityBridge {
  const profile = normalizeArtistWorldIdentity(input.profile);
  const coverageCount = countArtistWorldCoverage(profile);
  const textBank = [
    input.track.title,
    input.track.trackIntent?.summary ?? null,
    input.track.trackIntent?.whyNow ?? null,
    input.track.lyricsText ?? null
  ];
  const matchedThemes = findContainedTerms(profile.coreThemes, textBank);
  const matchedAesthetic = findContainedTerms(profile.aestheticKeywords, textBank);
  const matchedFashion = findContainedTerms(profile.fashionSignals, textBank);
  const hasPrimaryLinkedGoal = input.track.linkedGoals.some((item) => item.isPrimary);
  const supports = dedupeSupports([
    ...(profile.mission ? [supportChip("mission", profile.mission)] : []),
    ...(profile.identityStatement ? [supportChip("identity", profile.identityStatement)] : []),
    ...matchedThemes.map((value) => supportChip("theme", value)),
    ...matchedAesthetic.map((value) => supportChip("aesthetic", value)),
    ...matchedFashion.map((value) => supportChip("fashion", value)),
    ...(profile.visualDirection ? [supportChip("visual", profile.visualDirection)] : []),
    ...(profile.audienceCore ? [supportChip("audience", profile.audienceCore)] : []),
    ...(profile.differentiator ? [supportChip("differentiator", profile.differentiator)] : [])
  ]).slice(0, 6);

  const warnings = dedupeWarnings([
    ...(!trimOrNull(input.track.trackIntent?.summary)
      ? [
          {
            code: "track_missing_intent",
            title: "Не зафиксирован intent",
            message: "У трека пока нет краткого объяснения, зачем он нужен сейчас."
          } satisfies SoftWarning
        ]
      : []),
    ...(input.track.linkedGoals.length === 0
      ? [
          {
            code: "track_missing_goal_link",
            title: "Трек не привязан к цели",
            message: "Трек пока не связан ни с одной задачей цели."
          } satisfies SoftWarning
        ]
      : []),
    ...(input.primaryGoalId && input.track.linkedGoals.length > 0 && !hasPrimaryLinkedGoal
      ? [
          {
            code: "track_outside_primary_goal",
            title: "Трек вне текущего главного фокуса",
            message: "Связи трека есть, но они не ведут в текущую primary goal."
          } satisfies SoftWarning
        ]
      : []),
    ...(matchedThemes.length === 0 && matchedAesthetic.length === 0 && matchedFashion.length === 0
      ? [
          {
            code: "track_missing_world_match",
            title: "Мир артиста пока не читается",
            message: "В названии, intent или тексте трека пока не считываются темы, эстетика или fashion-сигналы."
          } satisfies SoftWarning
        ]
      : [])
  ]);

  const status = resolveTrackStatus({
    coverageCount,
    supports,
    warnings,
    linkedGoalsCount: input.track.linkedGoals.length,
    hasMatch: matchedThemes.length > 0 || matchedAesthetic.length > 0 || matchedFashion.length > 0,
    hasPrimaryLinkedGoal,
    profile
  });

  const supportSummary = summarizeSupports(supports);
  return {
    status,
    summary:
      supportSummary ??
      (status === "MISSING"
        ? "Трек пока не связан с ядром артиста."
        : "Связь трека с миром артиста пока читается слабо."),
    supports,
    warnings,
    linkedGoals: [...input.track.linkedGoals].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary)),
    matches: {
      coreThemes: matchedThemes,
      aestheticKeywords: matchedAesthetic,
      fashionSignals: matchedFashion
    }
  };
}

export function buildTodayContextBridge(input: {
  goalBridge: GoalIdentityBridge | null;
  trackBridge?: TrackIdentityBridge | null;
  linkedTrack?: { id: string; title: string } | null;
  linkedProject?: { id: string; title: string } | null;
}): TodayContextBridge | null {
  if (!input.goalBridge && !input.trackBridge) return null;

  const supports = dedupeSupports([
    ...(input.trackBridge?.supports ?? []),
    ...(input.goalBridge?.supports ?? [])
  ]).slice(0, 5);
  const warnings = dedupeWarnings([
    ...(input.trackBridge?.warnings ?? []),
    ...(input.goalBridge?.warnings ?? [])
  ]).slice(0, 3);

  return {
    summary: input.trackBridge?.summary ?? input.goalBridge?.summary ?? "Связь с миром артиста пока не собрана.",
    supports,
    warnings,
    linkedTrack: input.linkedTrack ?? null,
    linkedProject: input.linkedProject ?? null
  };
}
