import { Link2, MoveDown, MoveUp, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ArtistWorldProjectDraft = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  linkUrl: string;
  coverImageUrl: string;
};

export function ArtistWorldProjectEditor(props: {
  projects: ArtistWorldProjectDraft[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<ArtistWorldProjectDraft>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onUploadCover: (id: string, file: File) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-ink">Проекты</p>
          <p className="text-xs text-brand-muted">Ручные карточки проектов для мира артиста.</p>
        </div>
        <Button type="button" variant="secondary" className="rounded-xl" onClick={props.onAdd} disabled={props.projects.length >= 6}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {props.projects.map((project, index) => (
        <div key={project.id} className="space-y-3 rounded-2xl border border-brand-border bg-white/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">Проект {index + 1}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="h-8 rounded-lg px-2" type="button" onClick={() => props.onMoveUp(project.id)} disabled={index === 0}>
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="h-8 rounded-lg px-2"
                type="button"
                onClick={() => props.onMoveDown(project.id)}
                disabled={index === props.projects.length - 1}
              >
                <MoveDown className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="h-8 rounded-lg px-2" type="button" onClick={() => props.onDelete(project.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input value={project.title} onChange={(event) => props.onChange(project.id, { title: event.target.value })} placeholder="Название проекта" />
            <Input
              value={project.subtitle}
              onChange={(event) => props.onChange(project.id, { subtitle: event.target.value })}
              placeholder="Подзаголовок / формат"
            />
          </div>

          <Textarea
            value={project.description}
            onChange={(event) => props.onChange(project.id, { description: event.target.value })}
            placeholder="Коротко: что это за проект и почему он важен"
            className="min-h-[88px]"
          />

          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <Input
              value={project.linkUrl}
              onChange={(event) => props.onChange(project.id, { linkUrl: event.target.value })}
              placeholder="Ссылка на проект"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3">
            {project.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.coverImageUrl} alt={project.title || "Обложка проекта"} className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-brand-border bg-[#f4f8ed] text-xs text-brand-muted">
                Cover
              </div>
            )}

            <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
              <Upload className="mr-2 h-4 w-4" />
              Загрузить cover
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  await props.onUploadCover(project.id, file);
                }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
