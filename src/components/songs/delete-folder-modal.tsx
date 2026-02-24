"use client";

import { Button } from "@/components/ui/button";

type DeleteFolderModalProps = {
  open: boolean;
  folderTitle: string;
  busy?: boolean;
  onCancel: () => void;
  onEmptyFolder: () => void;
  onDeleteEverything: () => void;
};

export function DeleteFolderModal({
  open,
  folderTitle,
  busy,
  onCancel,
  onEmptyFolder,
  onDeleteEverything
}: DeleteFolderModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm md:items-center md:p-6" onClick={busy ? undefined : onCancel}>
      <div
        className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#111317]/95 p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 px-2">
          <h3 className="text-2xl font-semibold tracking-tight">Are you sure?</h3>
          <p className="mt-2 text-sm text-white/70">
            This folder has content inside ({folderTitle}). Do you want to empty the folder instead?
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="secondary"
            className="h-14 w-full rounded-2xl border-0 bg-white/12 text-lg text-white hover:bg-white/18"
            onClick={onEmptyFolder}
            disabled={busy}
          >
            Empty folder
          </Button>
          <Button
            variant="secondary"
            className="h-14 w-full rounded-2xl border-0 bg-white/12 text-lg text-red-400 hover:bg-white/18"
            onClick={onDeleteEverything}
            disabled={busy}
          >
            Delete everything
          </Button>
          <Button
            variant="secondary"
            className="h-14 w-full rounded-2xl border-0 bg-white/12 text-lg text-white hover:bg-white/18"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
