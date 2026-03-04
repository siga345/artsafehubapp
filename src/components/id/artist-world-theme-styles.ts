import { ArtistWorldBackgroundMode, ArtistWorldThemePreset } from "@prisma/client";

export function artistWorldThemeLabel(theme: ArtistWorldThemePreset) {
  switch (theme) {
    case ArtistWorldThemePreset.STUDIO:
      return "Studio";
    case ArtistWorldThemePreset.CINEMATIC:
      return "Cinematic";
    case ArtistWorldThemePreset.MINIMAL:
      return "Minimal";
    default:
      return "Editorial";
  }
}

export function getArtistWorldThemeClasses(theme: ArtistWorldThemePreset) {
  switch (theme) {
    case ArtistWorldThemePreset.STUDIO:
      return {
        shell: "text-white",
        panel: "border-white/12 bg-[#1f2621]/72",
        card: "border-white/10 bg-white/6",
        muted: "text-white/70",
        accent: "border-white/15 bg-white/10 text-white"
      };
    case ArtistWorldThemePreset.CINEMATIC:
      return {
        shell: "text-[#fff7ef]",
        panel: "border-[#f3d3aa]/30 bg-[rgba(71,43,29,0.66)]",
        card: "border-[#f3d3aa]/18 bg-[rgba(255,247,239,0.08)]",
        muted: "text-[#f4dec8]",
        accent: "border-[#f3d3aa]/25 bg-[rgba(255,240,225,0.12)] text-[#fff7ef]"
      };
    case ArtistWorldThemePreset.MINIMAL:
      return {
        shell: "text-[#101513]",
        panel: "border-[#d7ddd6] bg-[rgba(255,255,255,0.78)]",
        card: "border-[#dde4dc] bg-white/72",
        muted: "text-[#5f6c65]",
        accent: "border-[#d4dbd3] bg-white text-[#101513]"
      };
    default:
      return {
        shell: "text-[#172018]",
        panel: "border-[#d7e3cb] bg-[rgba(255,255,255,0.68)]",
        card: "border-[#dce7d1] bg-white/72",
        muted: "text-[#5e6d60]",
        accent: "border-[#d6e2ca] bg-white/82 text-[#172018]"
      };
  }
}

export function getArtistWorldBackgroundStyle(input: {
  backgroundMode: ArtistWorldBackgroundMode;
  backgroundColorA: string | null;
  backgroundColorB: string | null;
  backgroundImageUrl: string | null;
}) {
  if (input.backgroundMode === ArtistWorldBackgroundMode.IMAGE && input.backgroundImageUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(8, 12, 10, 0.24), rgba(8, 12, 10, 0.52)), url(${input.backgroundImageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center"
    } as const;
  }

  return {
    backgroundImage: `linear-gradient(135deg, ${input.backgroundColorA || "#f8fbf4"} 0%, ${input.backgroundColorB || "#e5eddc"} 100%)`
  } as const;
}
