"use client";

import Link from "next/link";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Folder } from "lucide-react";

import type { WorkspaceFolderNode, WorkspacePreviewItem } from "@/components/songs/workspace-types";
import { buildProjectCoverStyle } from "@/lib/project-cover-style";

function previewTileStyle(item: WorkspacePreviewItem): CSSProperties {
  if (item.type === "project") {
    return buildProjectCoverStyle({
      releaseKind: item.releaseKind ?? "ALBUM",
      coverType: item.coverType,
      coverImageUrl: item.coverImageUrl,
      coverPresetKey: item.coverPresetKey,
      coverColorA: item.coverColorA ?? "#d4d9e5",
      coverColorB: item.coverColorB ?? "#65758b"
    });
  }

  return {
    background: "linear-gradient(145deg, #d8f2be, #8fbe56)"
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
      className={`rounded-2xl bg-transparent p-0 shadow-none transition hover:-translate-y-0.5 md:rounded-3xl ${dragClasses} ${tileProps?.className ?? ""}`}
    >
      <Link href={`/songs/folders/${node.id}`} className="group block">
        <div className="relative aspect-square overflow-visible rounded-xl md:rounded-2xl">
          <div className="relative h-full w-full overflow-hidden rounded-xl border border-brand-border/60 bg-[#1f2d23] shadow-sm transition-shadow group-hover:shadow-md md:rounded-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(217,249,157,0.28),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.08),transparent_50%)]" />
            <div className="absolute left-2 top-2 h-3.5 w-12 rounded-t-lg border border-white/15 border-b-0 bg-white/10 md:left-3 md:top-3 md:h-4 md:w-14 md:rounded-t-xl" />
            <div className="absolute bottom-2 left-2 right-2 top-5 overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-[1px] md:bottom-3 md:left-3 md:right-3 md:top-6 md:rounded-2xl">
              <div className="grid h-full w-full grid-cols-2 gap-1 p-2 md:gap-2 md:p-3">
                {preview.length ? (
                  preview.map((item) => (
                    <div
                      key={`${item.type}:${item.id}`}
                      className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                      style={previewTileStyle(item)}
                    />
                  ))
                ) : (
                  <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5" />
                )}
              </div>
            </div>

            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur md:rounded-lg md:px-2 md:py-1 md:text-[10px]">
              <Folder className="h-2.5 w-2.5 md:h-3 md:w-3" />
              Папка
            </div>
            <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4">
              <div className="inline-flex max-w-full flex-col rounded-lg border border-white/15 bg-black/25 px-2 py-1 text-white backdrop-blur md:px-2.5 md:py-1.5">
                <p className="truncate text-xs font-semibold leading-tight drop-shadow-sm md:text-base">{node.title}</p>
                <p className="mt-0.5 text-[10px] text-white/85 drop-shadow-sm md:text-xs">
                  {node.itemCount} эл.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute right-2 top-2 z-10 md:right-3 md:top-3">
            <div className="relative">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-lg border border-white/25 bg-white/15 text-xs text-white shadow-sm backdrop-blur hover:bg-white/25 md:h-auto md:w-auto md:px-2 md:py-1"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleMenu();
                }}
                aria-label="Действия папки"
              >
                •••
              </button>
              {menuOpen && menuContent}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
