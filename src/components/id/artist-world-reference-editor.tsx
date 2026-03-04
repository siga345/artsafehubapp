import { Link2, MoveDown, MoveUp, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ArtistWorldReferenceDraft = {
  id: string;
  title: string;
  creator: string;
  note: string;
  linkUrl: string;
  imageUrl: string;
};

export function ArtistWorldReferenceEditor(props: {
  references: ArtistWorldReferenceDraft[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<ArtistWorldReferenceDraft>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onUploadImage: (id: string, file: File) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand-ink">Референсы</p>
          <p className="text-xs text-brand-muted">Образы, работы и ориентиры, которые собирают твой мир.</p>
        </div>
        <Button type="button" variant="secondary" className="rounded-xl" onClick={props.onAdd} disabled={props.references.length >= 8}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {props.references.map((reference, index) => (
        <div key={reference.id} className="space-y-3 rounded-2xl border border-brand-border bg-white/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">Референс {index + 1}</p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="h-8 rounded-lg px-2" type="button" onClick={() => props.onMoveUp(reference.id)} disabled={index === 0}>
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="h-8 rounded-lg px-2"
                type="button"
                onClick={() => props.onMoveDown(reference.id)}
                disabled={index === props.references.length - 1}
              >
                <MoveDown className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="h-8 rounded-lg px-2" type="button" onClick={() => props.onDelete(reference.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input value={reference.title} onChange={(event) => props.onChange(reference.id, { title: event.target.value })} placeholder="Название референса" />
            <Input value={reference.creator} onChange={(event) => props.onChange(reference.id, { creator: event.target.value })} placeholder="Автор / источник" />
          </div>

          <Textarea
            value={reference.note}
            onChange={(event) => props.onChange(reference.id, { note: event.target.value })}
            placeholder="Что именно ты берешь из этого референса"
            className="min-h-[88px]"
          />

          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <Input
              value={reference.linkUrl}
              onChange={(event) => props.onChange(reference.id, { linkUrl: event.target.value })}
              placeholder="Ссылка на референс"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3">
            {reference.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reference.imageUrl} alt={reference.title || "Изображение референса"} className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-brand-border bg-[#f4f8ed] text-xs text-brand-muted">
                Image
              </div>
            )}

            <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
              <Upload className="mr-2 h-4 w-4" />
              Загрузить image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  await props.onUploadImage(reference.id, file);
                }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
