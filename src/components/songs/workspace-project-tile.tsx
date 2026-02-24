"use client";

import Link from "next/link";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { PlaybackIcon } from "@/components/songs/playback-icon";
import { playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";
import type { WorkspaceProjectNode } from "@/components/songs/workspace-types";

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

function coverStyle(node: WorkspaceProjectNode): CSSProperties {
  const meta = node.projectMeta;
  if (meta.coverType === "IMAGE" && meta.coverImageUrl) {
    return {
      backgroundImage: `url(${meta.coverImageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center"
    };
  }
  return {
    background: `linear-gradient(145deg, ${meta.coverColorA || "#D9F99D"}, ${meta.coverColorB || "#65A30D"})`
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
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
      className={`rounded-3xl border border-brand-border bg-white/85 p-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${dragClasses} ${tileProps?.className ?? ""}`}
    >
      <div className="mb-3 flex items-center justify-end">
        <div className="relative">
          <button
            type="button"
            className="rounded-xl border border-brand-border bg-white/80 px-2 py-1 text-xs text-brand-ink hover:bg-white"
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

      <Link href={`/songs/projects/${node.id}`} className="group block">
        <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl" style={coverStyle(node)}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
          {node.pinnedAt && (
            <div className="absolute left-2 top-2 rounded-lg bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              Pinned
            </div>
          )}
          <button
            type="button"
            className="absolute bottom-2 left-2 z-[1] grid h-11 w-11 place-items-center rounded-xl border text-lg backdrop-blur hover:brightness-95"
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
          <div className="absolute bottom-2 right-2 rounded-xl bg-black/35 px-2 py-1 text-xs text-white backdrop-blur">
            {node.projectMeta.trackCount} трек.
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-brand-ink">{node.title}</p>
            <p className="truncate text-sm text-brand-muted">
              {node.projectMeta.artistLabel || "ART SAFE"} • {formatDate(node.updatedAt)}
            </p>
          </div>
          <div className="rounded-xl border border-brand-border bg-white px-2 py-1 text-sm text-brand-ink shadow-sm">Open</div>
        </div>
      </Link>
    </div>
  );
}
