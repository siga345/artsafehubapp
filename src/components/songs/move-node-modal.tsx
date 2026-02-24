"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import type { FolderListItem, WorkspaceNode } from "@/components/songs/workspace-types";

type MoveNodeModalProps = {
  open: boolean;
  node: WorkspaceNode | null;
  folders: FolderListItem[];
  loading?: boolean;
  onClose: () => void;
  onMove: (targetFolderId: string | null) => void;
  getTargetDisabledReason?: (targetFolderId: string | null) => string | null;
};

type FolderTreeRow = FolderListItem & { depth: number };

function buildRows(folders: FolderListItem[]) {
  const byParent = new Map<string | null, FolderListItem[]>();
  for (const folder of folders) {
    const key = folder.parentFolderId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(folder);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  const rows: FolderTreeRow[] = [];
  function visit(parentId: string | null, depth: number) {
    for (const folder of byParent.get(parentId) ?? []) {
      rows.push({ ...folder, depth });
      visit(folder.id, depth + 1);
    }
  }
  visit(null, 0);
  return rows;
}

export function MoveNodeModal({
  open,
  node,
  folders,
  loading,
  onClose,
  onMove,
  getTargetDisabledReason
}: MoveNodeModalProps) {
  const rows = useMemo(() => buildRows(folders), [folders]);
  if (!open || !node) return null;

  const rootDisabledReason = getTargetDisabledReason?.(null) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-3xl border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_20px_60px_rgba(24,32,27,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3">
          <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Move {node.type}</p>
          <h3 className="text-lg font-semibold text-brand-ink">{node.title}</h3>
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-brand-border bg-white px-3 py-2 text-left hover:bg-[#f0f5e8] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onMove(null)}
            disabled={Boolean(rootDisabledReason) || loading}
            title={rootDisabledReason ?? undefined}
          >
            <span className="font-medium text-brand-ink">HOME</span>
            {rootDisabledReason ? <span className="text-xs text-red-600">{rootDisabledReason}</span> : <span className="text-xs text-brand-muted">Move here</span>}
          </button>

          {rows.map((folder) => {
            const disabledReason = getTargetDisabledReason?.(folder.id) ?? null;
            return (
              <button
                key={folder.id}
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-brand-border bg-white px-3 py-2 text-left hover:bg-[#f0f5e8] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onMove(folder.id)}
                disabled={Boolean(disabledReason) || loading}
                title={disabledReason ?? undefined}
              >
                <span
                  className="min-w-0 truncate font-medium text-brand-ink"
                  style={{ paddingLeft: `${folder.depth * 16}px` }}
                >
                  {folder.depth > 0 ? "↳ " : ""}
                  {folder.title}
                </span>
                {disabledReason ? <span className="text-xs text-red-600">{disabledReason}</span> : <span className="text-xs text-brand-muted">Move here</span>}
              </button>
            );
          })}

          {!rows.length && <p className="rounded-xl border border-dashed border-brand-border bg-white px-3 py-3 text-sm text-brand-muted">Папок пока нет.</p>}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
