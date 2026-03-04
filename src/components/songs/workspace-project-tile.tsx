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
    NO_MIX: "Без сведения",
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
  const releaseLabel = releaseKind === "SINGLE" ? "Сингл" : "Альбом";
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
      className={`rounded-2xl bg-transparent p-0 shadow-none transition hover:-translate-y-0.5 md:rounded-3xl ${dragClasses} ${tileProps?.className ?? ""}`}
    >
      <Link href={projectOpenHref} className="group block">
        <div className="relative aspect-square overflow-visible rounded-xl md:rounded-2xl">
          <div
            className="relative h-full w-full overflow-hidden rounded-xl shadow-sm transition-shadow group-hover:shadow-md md:rounded-2xl"
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
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur md:left-2.5 md:top-2.5 md:rounded-lg md:px-2 md:py-1 md:text-[10px]">
              <Disc3 className="h-2.5 w-2.5 md:h-3 md:w-3" />
              {releaseLabel}
            </div>
            <div className="absolute right-14 top-2 max-w-[calc(100%-7.5rem)] truncate rounded-md bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur md:right-16 md:top-2.5 md:max-w-[calc(100%-9rem)] md:rounded-lg md:px-2 md:py-1 md:text-[10px]">
              {formatProjectBadgeDate(node.updatedAt)}
            </div>

            <div className="absolute bottom-2 left-2 right-12 text-white md:bottom-4 md:left-4 md:right-20">
              <p className="truncate text-xs font-semibold drop-shadow-sm md:text-base">{node.title}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-white/90 drop-shadow-sm md:text-xs">
                <Music2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                {singleStageLabel ?? `${node.projectMeta.trackCount || 0} трек.`}
              </p>
            </div>
          </div>

          <div className="absolute right-2 top-2 z-10 md:right-3 md:top-3">
            <div className="relative">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-lg border border-white/25 bg-white/15 text-xs text-white shadow-sm backdrop-blur hover:bg-white/25 md:h-auto md:w-auto md:px-2 md:py-1 md:text-[11px]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleMenu();
                }}
                aria-label="Действия проекта"
              >
                •••
              </button>
              {menuOpen && menuContent}
            </div>
          </div>

          <button
            type="button"
            className="absolute bottom-2 right-2 z-[1] grid h-10 w-10 place-items-center rounded-full border text-lg shadow-lg backdrop-blur hover:brightness-95 md:bottom-4 md:right-4 md:h-12 md:w-12"
            style={accent}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPlay?.();
            }}
            aria-label="Играть проект"
          >
            {playLoading ? "…" : <PlaybackIcon type="play" className="h-3.5 w-3.5 md:h-4 md:w-4" />}
          </button>
        </div>
      </Link>
    </div>
  );
}
