"use client";

import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { Disc3, Music2 } from "lucide-react";

import { PlaybackIcon } from "@/components/songs/playback-icon";
import type { WorkspaceProjectNode } from "@/components/songs/workspace-types";
import { buildProjectCoverStyle } from "@/lib/project-cover-style";
import { playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";
import { getProjectOpenHref } from "@/lib/songs-project-navigation";
import { resolveVersionTypeByStage } from "@/lib/songs-version-stage-map";

type WorkspaceProjectTileProps = {
  node: WorkspaceProjectNode;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onPlay?: () => void;
  playLoading?: boolean;
  menuContent?: ReactNode;
  tileProps?: HTMLAttributes<HTMLDivElement>;
  dragState?: "idle" | "dragging" | "drop-target" | "drop-invalid";
};

function formatProjectBadgeDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function getTrackStatusLabel(stageName: string | null | undefined) {
  if (!stageName) return "не выбран";
  const versionType = resolveVersionTypeByStage({ id: 0, name: stageName });
  const statusByVersionType = {
    IDEA_TEXT: "Идея",
    DEMO: "Демо",
    ARRANGEMENT: "Продакшн",
    NO_MIX: "Запись",
    MIXED: "Сведение",
    MASTERED: "Мастеринг",
    RELEASE: "Релиз"
  } as const;
  return versionType ? statusByVersionType[versionType] : stageName;
}

export function WorkspaceProjectTile({
  node,
  menuOpen,
  onToggleMenu,
  onPlay,
  playLoading,
  menuContent,
  tileProps,
  dragState = "idle"
}: WorkspaceProjectTileProps) {
  const projectOpenHref = getProjectOpenHref({
    id: node.id,
    releaseKind: node.projectMeta.releaseKind ?? "ALBUM",
    singleTrackId: node.projectMeta.singleTrackId ?? null
  });
  const releaseKind = node.projectMeta.releaseKind ?? "ALBUM";
  const releaseLabel = releaseKind === "SINGLE" ? "Single" : "Album";
  const singleStageLabel =
    releaseKind === "SINGLE" && node.projectMeta.singleTrackId
      ? `Статус ${getTrackStatusLabel(node.projectMeta.singleTrackStageName)}`
      : null;
  const accent = playbackAccentButtonStyle({
    colorA: node.projectMeta.coverColorA || "#D9F99D",
    colorB: node.projectMeta.coverColorB || "#65A30D"
  });
  const dragClasses =
    dragState === "dragging"
      ? "opacity-60 ring-2 ring-brand-ink/30"
      : dragState === "drop-target"
        ? "ring-2 ring-[#9fc7b3] bg-[#f2fbf5]"
        : dragState === "drop-invalid"
          ? "ring-2 ring-red-300"
          : "";

  return (
    <div
      {...tileProps}
      className={`rounded-3xl bg-transparent p-0 shadow-none transition hover:-translate-y-0.5 ${dragClasses} ${tileProps?.className ?? ""}`}
    >
      <Link href={projectOpenHref} className="group block">
        <div className="relative aspect-square overflow-visible rounded-2xl">
          <div
            className="relative h-full w-full overflow-hidden rounded-2xl shadow-sm transition-shadow group-hover:shadow-md"
            style={buildProjectCoverStyle({
              releaseKind,
              coverType: node.projectMeta.coverType,
              coverImageUrl: node.projectMeta.coverImageUrl,
              coverPresetKey: node.projectMeta.coverPresetKey,
              coverColorA: node.projectMeta.coverColorA,
              coverColorB: node.projectMeta.coverColorB
            })}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-black/12" />
            <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              <Disc3 className="h-3 w-3" />
              {releaseLabel}
            </div>
            <div className="absolute right-14 top-3 rounded-lg bg-black/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              {formatProjectBadgeDate(node.updatedAt)}
            </div>

            <div className="absolute bottom-4 left-4 right-20 text-white">
              <p className="truncate text-base font-semibold drop-shadow-sm">{node.title}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/90 drop-shadow-sm">
                <Music2 className="h-3 w-3" />
                {singleStageLabel ?? `${node.projectMeta.trackCount || 0} трек.`}
              </p>
            </div>
          </div>

          <div className="absolute right-3 top-3 z-10">
            <div className="relative">
              <button
                type="button"
                className="rounded-xl border border-white/25 bg-white/15 px-2 py-1 text-xs text-white shadow-sm backdrop-blur hover:bg-white/25"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleMenu();
                }}
                aria-label="Project actions"
              >
                •••
              </button>
              {menuOpen && menuContent}
            </div>
          </div>

          <button
            type="button"
            className="absolute bottom-4 right-4 z-[1] grid h-12 w-12 place-items-center rounded-full border text-lg shadow-lg backdrop-blur hover:brightness-95"
            style={accent}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPlay?.();
            }}
            aria-label="Play project"
          >
            {playLoading ? "…" : <PlaybackIcon type="play" className="h-4 w-4" />}
          </button>
        </div>
      </Link>
    </div>
  );
}
