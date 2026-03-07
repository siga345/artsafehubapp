import {
  ArtistWorldBackgroundMode,
  ArtistWorldThemePreset
} from "@prisma/client";

// ─── Block IDs ───────────────────────────────────────────────────────────────

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
  references?: ArtistWorldReferenceInput[];
  projects?: ArtistWorldProjectInput[];
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
