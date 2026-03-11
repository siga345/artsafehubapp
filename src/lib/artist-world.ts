import {
  ArtistWorldBackgroundMode,
  ArtistWorldThemePreset
} from "@prisma/client";

// ─── Block IDs ───────────────────────────────────────────────────────────────

export const artistWorldBlockIds = [
  "mission",
  "identity",
  "themes_audience",
  "aesthetics",
  "fashion",
  "playlist"
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

// ─── Input types ─────────────────────────────────────────────────────────────

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

export type ArtistWorldVisualBoardInput = {
  id?: string;
  slug: string;
  name: string;
  sourceUrl?: string | null;
  images?: Array<{ id?: string; imageUrl: string }>;
};

export const artistWorldVisualBoardDefinitions = [
  { slug: "aesthetics", name: "Эстетика" },
  { slug: "fashion", name: "Фэшн" }
] as const;

export type ArtistWorldVisualBoardSlug = (typeof artistWorldVisualBoardDefinitions)[number]["slug"];

export type ArtistWorldInput = {
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
  worldCreated?: boolean;
  artistName?: string | null;
  artistAge?: number | null;
  artistCity?: string | null;
  favoriteArtists?: string[];
  lifeValues?: string | null;
  teamPreference?: string | null;
  playlistUrl?: string | null;
  references?: ArtistWorldReferenceInput[];
  projects?: ArtistWorldProjectInput[];
  visualBoards?: ArtistWorldVisualBoardInput[];
};

// ─── Internal helpers ────────────────────────────────────────────────────────

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

function isCanonicalVisualBoardSlug(value: string): value is ArtistWorldVisualBoardSlug {
  return artistWorldVisualBoardDefinitions.some((board) => board.slug === value);
}

function normalizeVisualBoardImages(images?: Array<{ id?: string; imageUrl: string }>) {
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => ({
      id: trimOrNull(image.id),
      imageUrl: image.imageUrl.trim()
    }))
    .filter((image) => image.imageUrl.length > 0);
}

export function ensureArtistWorldVisualBoards(
  boards?: ArtistWorldVisualBoardInput[] | null
): Array<{
  id: string | null;
  slug: ArtistWorldVisualBoardSlug;
  name: string;
  sourceUrl: string | null;
  images: Array<{ id: string | null; imageUrl: string }>;
}> {
  const items = Array.isArray(boards) ? boards : [];

  return artistWorldVisualBoardDefinitions.map((definition) => {
    const existing = items.find((board) => isCanonicalVisualBoardSlug(board.slug) && board.slug === definition.slug);

    return {
      id: trimOrNull(existing?.id),
      slug: definition.slug,
      name: definition.name,
      sourceUrl: trimOrNull(existing?.sourceUrl),
      images: normalizeVisualBoardImages(existing?.images)
    };
  });
}

function hasIdentityGroup(input: ArtistWorldInput | null | undefined) {
  return Boolean(trimOrNull(input?.identityStatement) || trimOrNull(input?.philosophy));
}

function hasIdentityContextGroup(input: ArtistWorldInput | null | undefined) {
  return Boolean(trimOrNull(input?.lifeValues) || uniqueStrings(input?.favoriteArtists).length > 0);
}

function hasThemesAudienceGroup(input: ArtistWorldInput | null | undefined) {
  return Boolean(
    uniqueStrings(input?.values).length > 0 ||
    uniqueStrings(input?.coreThemes).length > 0 ||
    trimOrNull(input?.audienceCore) ||
    trimOrNull(input?.differentiator)
  );
}

export function countArtistWorldTextCoreAnswers(input: ArtistWorldInput | null | undefined) {
  const groups = [hasIdentityGroup(input), hasIdentityContextGroup(input), hasThemesAudienceGroup(input)].filter(Boolean).length;

  return (trimOrNull(input?.mission) ? 1 : 0) + groups;
}

export function hasArtistWorldTextCore(input: ArtistWorldInput | null | undefined) {
  const missionReady = Boolean(trimOrNull(input?.mission));
  const supportingGroups = [hasIdentityGroup(input), hasIdentityContextGroup(input), hasThemesAudienceGroup(input)].filter(Boolean).length;

  return missionReady && supportingGroups >= 2;
}

export function hasArtistWorldVisualContent(input: ArtistWorldInput | null | undefined) {
  return ensureArtistWorldVisualBoards(input?.visualBoards).some((board) => board.images.length > 0 || Boolean(board.sourceUrl));
}

// ─── Public API ──────────────────────────────────────────────────────────────

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
    worldCreated: input.worldCreated ?? false,
    artistName: trimOrNull(input.artistName),
    artistAge: typeof input.artistAge === "number" && input.artistAge >= 10 && input.artistAge <= 100 ? input.artistAge : null,
    artistCity: trimOrNull(input.artistCity),
    favoriteArtists: uniqueStrings(input.favoriteArtists).slice(0, 3),
    lifeValues: trimOrNull(input.lifeValues),
    teamPreference: input.teamPreference && ["solo", "team", "both"].includes(input.teamPreference) ? input.teamPreference : null,
    playlistUrl: trimOrNull(input.playlistUrl),
    references: Array.isArray(input.references) ? input.references.map(normalizeArtistWorldReference) : [],
    projects: Array.isArray(input.projects) ? input.projects.map(normalizeArtistWorldProject) : [],
    visualBoards: ensureArtistWorldVisualBoards(input.visualBoards)
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
    worldCreated: normalized.worldCreated,
    artistName: normalized.artistName,
    artistAge: normalized.artistAge,
    artistCity: normalized.artistCity,
    favoriteArtists: normalized.favoriteArtists,
    lifeValues: normalized.lifeValues,
    teamPreference: normalized.teamPreference,
    playlistUrl: normalized.playlistUrl,
    references: normalized.references,
    projects: normalized.projects,
    visualBoards: normalized.visualBoards
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
