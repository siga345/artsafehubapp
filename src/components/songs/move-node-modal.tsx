"use client";

import { useMemo } from "react";
import { ChevronRight, Folder, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function disabledReasonLabel(reason: string | null) {
  if (!reason) return null;
  if (reason === "same") return "Текущая папка";
  if (reason === "descendant") return "Нельзя в дочернюю";
  if (reason === "depth") return "Слишком глубоко";
  return reason;
}

function statusLabel(reason: string | null) {
  return reason ? disabledReasonLabel(reason) : "Переместить сюда";
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
            className="group flex w-full items-center justify-between rounded-2xl border border-brand-border bg-white px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f0f5e8] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            onClick={() => onMove(null)}
            disabled={Boolean(rootDisabledReason) || loading}
            title={disabledReasonLabel(rootDisabledReason) ?? undefined}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-border bg-[#edf4e5] text-brand-ink">
                <Home className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-brand-ink">Главная папка</span>
                <span className="block text-xs text-brand-muted">Корень workspace</span>
              </span>
            </span>
            <Badge className={`shrink-0 ${rootDisabledReason ? "border-red-200 bg-red-50 text-red-700" : "bg-white"}`}>
              {statusLabel(rootDisabledReason)}
            </Badge>
          </button>

          {rows.map((folder) => {
            const disabledReason = getTargetDisabledReason?.(folder.id) ?? null;
            return (
              <button
                key={folder.id}
                type="button"
                className="group flex w-full items-center justify-between rounded-2xl border border-brand-border bg-white px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f0f5e8] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                onClick={() => onMove(folder.id)}
                disabled={Boolean(disabledReason) || loading}
                title={disabledReasonLabel(disabledReason) ?? undefined}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span style={{ width: `${folder.depth * 14}px` }} aria-hidden />
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-border bg-[#edf4e5] text-brand-ink">
                    <Folder className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate font-medium text-brand-ink">
                      {folder.depth > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-brand-muted" />}
                      <span className="truncate">{folder.title}</span>
                    </span>
                    <span className="block text-xs text-brand-muted">
                      {folder.depth === 0 ? "Верхний уровень" : `Уровень ${folder.depth + 1}`}
                    </span>
                  </span>
                </span>
                <Badge className={`shrink-0 ${disabledReason ? "border-red-200 bg-red-50 text-red-700" : "bg-white"}`}>
                  {statusLabel(disabledReason)}
                </Badge>
              </button>
            );
          })}

          {!rows.length && <p className="rounded-xl border border-dashed border-brand-border bg-white px-3 py-3 text-sm text-brand-muted">Папок пока нет.</p>}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
