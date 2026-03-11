"use client";

import { Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type VisualBoardDraft = {
  id: string;
  slug: string;
  name: string;
  images: Array<{ id: string; imageUrl: string }>;
};

export type VisualEditorField = "visualDirection" | "aestheticKeywords" | "fashionSignals";

const boardDescriptions: Record<string, string> = {
  aesthetics: "Добавь кадры, фактуры, цвета и атмосферу, которые задают ощущение твоего мира.",
  fashion: "Собери одежду, силуэты, аксессуары и образы, в которых ты реально видишь себя."
};

export function ArtistWorldVisualEditor(props: {
  boards: VisualBoardDraft[];
  visualDirection: string;
  aestheticKeywords: string;
  fashionSignals: string;
  uploadingImage: boolean;
  onFieldChange: (field: VisualEditorField, value: string) => void;
  onUploadImage: (boardSlug: string, file: File) => Promise<void>;
  onDeleteImage: (boardSlug: string, imageId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-[24px] border border-brand-border bg-[#f9fbf6] p-4">
        <div>
          <p className="text-sm font-medium text-brand-ink">Визуальные борды</p>
          <p className="text-xs text-brand-muted">Держи перед глазами два канонических борда: атмосферу и одежду.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {props.boards.map((board) => (
            <div key={board.slug} className="space-y-3 rounded-[22px] border border-brand-border bg-white/80 p-4">
              <div>
                <p className="text-sm font-medium text-brand-ink">{board.name}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  {boardDescriptions[board.slug] ?? "Загрузи изображения, которые формируют твой визуальный мир."}
                </p>
              </div>

              {board.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {board.images.map((image) => (
                    <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-brand-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => props.onDeleteImage(board.slug, image.id)}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-brand-border bg-[#f7faf2] text-sm text-brand-muted">
                  Пока нет изображений
                </div>
              )}

              <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
                <Upload className="mr-2 h-4 w-4" />
                {props.uploadingImage ? "Загружаем..." : "Добавить изображение"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={props.uploadingImage}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    await props.onUploadImage(board.slug, file);
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <details className="overflow-hidden rounded-[24px] border border-brand-border bg-[#f9fbf6]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-brand-ink marker:hidden">
          Углубить визуал
        </summary>
        <div className="space-y-4 border-t border-brand-border px-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Визуальное направление</label>
            <Input
              value={props.visualDirection}
              onChange={(event) => props.onFieldChange("visualDirection", event.target.value)}
              placeholder="Например: мрачный урбан, кинематографичный дневник, raw bedroom pop"
              className="bg-white"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Эстетические коды</label>
              <Textarea
                value={props.aestheticKeywords}
                onChange={(event) => props.onFieldChange("aestheticKeywords", event.target.value)}
                placeholder="По одному коду на строку"
                className="min-h-[132px] bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Образ / стиль</label>
              <Textarea
                value={props.fashionSignals}
                onChange={(event) => props.onFieldChange("fashionSignals", event.target.value)}
                placeholder="По одному сигналу образа на строку"
                className="min-h-[132px] bg-white"
              />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
