export type PlaybackDemoLike = {
  id: string;
  audioUrl?: string | null;
  versionType?: string;
  duration?: number;
  createdAt?: string;
};

export type PlaybackTrackLike<TDemo extends PlaybackDemoLike = PlaybackDemoLike> = {
  demos: TDemo[];
  primaryDemo?: TDemo | null;
};

export type PlaybackCoverLike = {
  colorA?: string | null;
  colorB?: string | null;
} | null | undefined;

export const DEFAULT_PROJECT_COVER_LIME_A = "#D9F99D";
export const DEFAULT_PROJECT_COVER_LIME_B = "#65A30D";

export function isPlayableDemo<TDemo extends PlaybackDemoLike>(demo: TDemo | null | undefined): demo is TDemo {
  return Boolean(demo && demo.versionType !== "IDEA_TEXT" && demo.audioUrl?.trim());
}

export function pickPreferredPlaybackDemo<TDemo extends PlaybackDemoLike>(track: PlaybackTrackLike<TDemo>): TDemo | null {
  if (isPlayableDemo(track.primaryDemo)) {
    return track.primaryDemo;
  }

  for (const demo of track.demos) {
    if (isPlayableDemo(demo)) {
      return demo;
    }
  }

  return null;
}

function hexToRgb(hex: string) {
  const raw = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16)
  };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  const toLinear = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  return {
    r: Math.round((a.r + b.r) / 2),
    g: Math.round((a.g + b.g) / 2),
    b: Math.round((a.b + b.b) / 2)
  };
}

export function resolveProjectCoverColors(cover?: PlaybackCoverLike) {
  return {
    colorA: cover?.colorA?.trim() || DEFAULT_PROJECT_COVER_LIME_A,
    colorB: cover?.colorB?.trim() || DEFAULT_PROJECT_COVER_LIME_B
  };
}

export function playbackAccentButtonStyle(cover?: PlaybackCoverLike) {
  const { colorA, colorB } = resolveProjectCoverColors(cover);
  const rgbA = hexToRgb(colorA);
  const rgbB = hexToRgb(colorB);
  const mixed = rgbA && rgbB ? mixRgb(rgbA, rgbB) : null;
  const isLight = mixed ? relativeLuminance(mixed) > 0.48 : true;

  return {
    background: `linear-gradient(145deg, ${colorA}, ${colorB})`,
    borderColor: isLight ? "rgba(73, 98, 62, 0.22)" : "rgba(255,255,255,0.16)",
    color: isLight ? "#183126" : "#f4fff6"
  };
}
