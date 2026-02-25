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
      className={`rounded-3xl bg-transparent p-0 shadow-none transition hover:-translate-y-0.5 ${dragClasses} ${tileProps?.className ?? ""}`}
    >
      <Link href={`/songs/folders/${node.id}`} className="group block">
        <div className="relative aspect-square overflow-visible rounded-2xl">
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-brand-border/60 bg-[#1f2d23] shadow-sm transition-shadow group-hover:shadow-md">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(217,249,157,0.28),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.08),transparent_50%)]" />
            <div className="absolute left-3 top-3 h-4 w-14 rounded-t-xl border border-white/15 border-b-0 bg-white/10" />
            <div className="absolute left-3 right-3 top-6 bottom-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-[1px]">
              <div className="grid h-full w-full grid-cols-2 gap-2 p-3">
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

            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
              <Folder className="h-3 w-3" />
              Folder
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="inline-flex max-w-full flex-col rounded-lg border border-white/15 bg-black/25 px-2.5 py-1.5 text-white backdrop-blur">
                <p className="truncate text-base font-semibold leading-tight drop-shadow-sm">{node.title}</p>
                <p className="mt-0.5 text-xs text-white/85 drop-shadow-sm">
                  {node.itemCount} item{node.itemCount === 1 ? "" : "s"}
                </p>
              </div>
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
                aria-label="Folder actions"
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
