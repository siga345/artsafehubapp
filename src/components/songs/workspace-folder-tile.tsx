"use client";

import Link from "next/link";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import type { WorkspaceFolderNode, WorkspacePreviewItem } from "@/components/songs/workspace-types";

function previewTileStyle(item: WorkspacePreviewItem): CSSProperties {
  if (item.type === "project") {
    if (item.coverType === "IMAGE" && item.coverImageUrl) {
      return {
        backgroundImage: `url(${item.coverImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      };
    }
    return {
      background: `linear-gradient(145deg, ${item.coverColorA || "#d4d9e5"}, ${item.coverColorB || "#65758b"})`
    };
  }

  return {
    background: "linear-gradient(145deg, #9ab5ff, #5f7ac8)"
  };
}

type WorkspaceFolderTileProps = {
  node: WorkspaceFolderNode;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuContent?: ReactNode;
  tileProps?: HTMLAttributes<HTMLDivElement>;
  dragState?: "idle" | "dragging" | "drop-target" | "drop-invalid";
};

export function WorkspaceFolderTile({
  node,
  menuOpen,
  onToggleMenu,
  menuContent,
  tileProps,
  dragState = "idle"
}: WorkspaceFolderTileProps) {
  const preview = node.preview.slice(0, 2);
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
            aria-label="Folder actions"
          >
            •••
          </button>
          {menuOpen && menuContent}
        </div>
      </div>

      <Link href={`/songs/folders/${node.id}`} className="group block">
        <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl bg-[#101214]/95">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="grid h-full w-full grid-cols-2 gap-2 p-3">
            {preview.length ? (
              preview.map((item) => (
                <div key={`${item.type}:${item.id}`} className="rounded-2xl" style={previewTileStyle(item)} />
              ))
            ) : (
              <div className="col-span-2 rounded-2xl bg-white/5" />
            )}
          </div>
          {node.pinnedAt && (
            <div className="absolute left-2 top-2 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              Pinned
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-brand-ink">{node.title}</p>
            <p className="truncate text-sm text-brand-muted">{node.itemCount} item{node.itemCount === 1 ? "" : "s"}</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
