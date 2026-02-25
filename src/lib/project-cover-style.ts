import type { CSSProperties } from "react";

import type { ProjectReleaseKind } from "@/lib/songs-project-navigation";

export type ProjectCoverRenderInput = {
  releaseKind?: ProjectReleaseKind | null;
  coverType: "GRADIENT" | "IMAGE";
  coverImageUrl?: string | null;
  coverPresetKey?: string | null;
  coverColorA?: string | null;
  coverColorB?: string | null;
};

type ProjectCoverPreset = {
  key: string;
  releaseKind: ProjectReleaseKind;
  label: string;
  colorA: string;
  colorB: string;
  gradientCss?: string;
};

export const PROJECT_COVER_PRESETS: ProjectCoverPreset[] = [
  { key: "lime-grove", releaseKind: "SINGLE", label: "Lime Grove", colorA: "#D9F99D", colorB: "#65A30D" },
  { key: "citrus-neon", releaseKind: "SINGLE", label: "Citrus", colorA: "#FFE66D", colorB: "#FF7A18" },
  { key: "sky-blue", releaseKind: "SINGLE", label: "Sky", colorA: "#A8D8FF", colorB: "#5B7CFA" },
  { key: "album-aurora", releaseKind: "ALBUM", label: "Album Aurora", colorA: "#86EFAC", colorB: "#1D4ED8",
    gradientCss:
      "radial-gradient(circle at 12% 14%, rgba(255,255,255,0.26), transparent 42%), radial-gradient(circle at 82% 18%, rgba(134,239,172,0.42), transparent 46%), radial-gradient(circle at 18% 78%, rgba(59,130,246,0.4), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1d4ed8 38%, #059669 68%, #a3e635 100%)" },
  { key: "album-sunset-grid", releaseKind: "ALBUM", label: "Album Sunset", colorA: "#FDBA74", colorB: "#7C3AED",
    gradientCss:
      "radial-gradient(circle at 16% 22%, rgba(255,255,255,0.22), transparent 38%), radial-gradient(circle at 76% 26%, rgba(251,191,36,0.35), transparent 44%), radial-gradient(circle at 62% 78%, rgba(124,58,237,0.38), transparent 48%), linear-gradient(145deg, #431407 0%, #c2410c 26%, #fb7185 54%, #7c3aed 100%)" }
];

export function projectDefaultCoverForKind(releaseKind: ProjectReleaseKind) {
  const preset =
    PROJECT_COVER_PRESETS.find((item) => item.releaseKind === releaseKind) ??
    PROJECT_COVER_PRESETS.find((item) => item.key === "lime-grove")!;
  return {
    coverPresetKey: preset.key,
    coverColorA: preset.colorA,
    coverColorB: preset.colorB
  };
}

export function buildProjectCoverStyle(input: ProjectCoverRenderInput): CSSProperties {
  if (input.coverType === "IMAGE" && input.coverImageUrl) {
    return {
      backgroundImage: `url(${input.coverImageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center"
    };
  }

  const preset = input.coverPresetKey ? PROJECT_COVER_PRESETS.find((item) => item.key === input.coverPresetKey) : null;
  if (preset?.gradientCss) {
    return { background: preset.gradientCss };
  }

  return {
    background: `linear-gradient(145deg, ${input.coverColorA || "#D9F99D"}, ${input.coverColorB || "#65A30D"})`
  };
}

