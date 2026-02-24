"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ProjectOption = {
  id: string;
  title: string;
  folder?: { id: string; title: string } | null;
  _count?: { tracks?: number };
};

type ProjectSelectionMode = "existing" | "new";

type SongProjectPickerStepProps = {
  projects: ProjectOption[];
  selectionMode: ProjectSelectionMode;
  selectedProjectId: string;
  newProjectTitle: string;
  onSelectionModeChange: (mode: ProjectSelectionMode) => void;
  onSelectedProjectIdChange: (projectId: string) => void;
  onNewProjectTitleChange: (title: string) => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  modeLabel?: string;
  onBack?: () => void;
  backLabel?: string;
};

export function SongProjectPickerStep({
  projects,
  selectionMode,
  selectedProjectId,
  newProjectTitle,
  onSelectionModeChange,
  onSelectedProjectIdChange,
  onNewProjectTitleChange,
  onConfirm,
  confirmLabel,
  busy = false,
  error = "",
  modeLabel,
  onBack,
  backLabel = "Назад"
}: SongProjectPickerStepProps) {
  const canConfirm =
    selectionMode === "existing" ? Boolean(selectedProjectId && selectedProjectId !== "NONE") : Boolean(newProjectTitle.trim());

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Проект</p>
        <h3 className="text-lg font-semibold tracking-tight text-brand-ink">В какой проект сохранить песню?</h3>
        {modeLabel ? <p className="text-sm text-brand-muted">{modeLabel}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={selectionMode === "existing" ? "primary" : "secondary"}
          className={selectionMode === "existing" ? "" : "border-brand-border bg-white/85 text-brand-ink hover:bg-white"}
          onClick={() => onSelectionModeChange("existing")}
        >
          Выбрать проект
        </Button>
        <Button
          type="button"
          variant={selectionMode === "new" ? "primary" : "secondary"}
          className={selectionMode === "new" ? "" : "border-brand-border bg-white/85 text-brand-ink hover:bg-white"}
          onClick={() => onSelectionModeChange("new")}
        >
          Новый проект
        </Button>
      </div>

      {selectionMode === "existing" ? (
        <div className="space-y-2">
          <Select
            value={selectedProjectId || "NONE"}
            onChange={(event) => onSelectedProjectIdChange(event.target.value)}
            className="border-brand-border bg-white/90 text-brand-ink focus:ring-brand-border"
          >
            <option value="NONE">Выберите проект</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
                {project.folder?.title ? ` • ${project.folder.title}` : ""}
              </option>
            ))}
          </Select>
          {!projects.length && (
            <p className="text-sm text-brand-muted">Пока нет проектов. Выбери «Новый проект».</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={newProjectTitle}
            onChange={(event) => onNewProjectTitleChange(event.target.value)}
            placeholder="Название нового проекта"
            className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
          />
          <p className="text-xs text-brand-muted">
            Будет создан новый проект и выбран для сохранения трека.
          </p>
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!canConfirm || busy} onClick={onConfirm}>
          {busy ? "Сохраняем..." : confirmLabel}
        </Button>
        {onBack ? (
          <Button
            type="button"
            variant="secondary"
            className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
            onClick={onBack}
            disabled={busy}
          >
            {backLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export type { ProjectOption, ProjectSelectionMode };

