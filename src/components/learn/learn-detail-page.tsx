"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Clock3, ExternalLink, FileText, Globe, PlayCircle } from "lucide-react";

import { LearnEmbedFrame } from "@/components/learn/learn-embed-frame";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/client-fetch";
import {
  getLearnMaterialTimeLabel,
  getLearnMaterialTypeLabel,
  getLearnProviderLabel,
  supportsInlineEmbed
} from "@/lib/learn/providers";
import type { LearnMaterialDetail } from "@/lib/learn/types";

type LearnDetailPageProps = {
  material: LearnMaterialDetail;
};

export function LearnDetailPage({ material }: LearnDetailPageProps) {
  const timeLabel = getLearnMaterialTimeLabel(material);
  const canEmbed = supportsInlineEmbed(material);
  const isVideo = material.type === "VIDEO";
  const isArticle = material.type === "ARTICLE";

  useEffect(() => {
    async function markOpen() {
      try {
        await apiFetch(`/api/learn/materials/${material.slug}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "OPEN",
            surface: "LEARN"
          })
        });
      } catch {
        // ignore non-blocking open tracking errors
      }
    }

    void markOpen();
  }, [material.slug]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/learn"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-medium tracking-tight text-brand-ink transition-colors hover:bg-[#f2f5eb]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в Learn
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-[30px] border border-brand-border bg-gradient-to-br from-[#edf4e4] via-[#e9f0e0] to-[#e5ecda] p-4 shadow-[0_18px_42px_rgba(55,74,61,0.12)] md:p-5">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-10 top-6 h-44 w-44 rounded-full bg-[#d9f99d]/35 blur-3xl" />
          <div className="absolute left-[-1rem] top-16 h-32 w-32 rounded-full bg-white/35 blur-2xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0)_40%,rgba(90,123,75,0.06)_100%)]" />
        </div>

        <div className="relative grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-[#cbdab8] bg-[#f5faeb] text-[#4b6440]">
                {isVideo ? <PlayCircle className="mr-1 h-3.5 w-3.5" /> : <FileText className="mr-1 h-3.5 w-3.5" />}
                {getLearnMaterialTypeLabel(material.type)}
              </Badge>
              <Badge className="border-brand-border bg-white/90 text-brand-muted">{getLearnProviderLabel(material.provider)}</Badge>
              <Badge className="border-brand-border bg-white/90 text-brand-muted">{material.language.toUpperCase()}</Badge>
              {timeLabel ? (
                <Badge className="border-brand-border bg-white/90 text-brand-muted">
                  <Clock3 className="mr-1 h-3.5 w-3.5" />
                  {timeLabel}
                </Badge>
              ) : null}
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">{material.title}</h1>
              <p className="mt-2 text-sm text-brand-muted">
                {material.authorName} • {material.sourceName}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-brand-muted">{material.summary}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {material.tags.map((tag) => (
                <span
                  key={`${material.id}-${tag}`}
                  className="inline-flex items-center rounded-full border border-brand-border bg-white/85 px-2.5 py-1 text-xs text-brand-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-brand-border bg-white/75 shadow-sm">
            <div
              className="h-52 w-full bg-[#ebf2e2] bg-cover bg-center"
              style={{ backgroundImage: `url(${material.thumbnailUrl})` }}
              aria-hidden="true"
            />
            <div className="space-y-3 p-4">
              <div className="rounded-2xl border border-brand-border bg-white p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Источник</p>
                <p className="mt-1 text-sm font-medium text-brand-ink">{material.sourceName}</p>
                <p className="mt-1 break-all text-xs text-brand-muted">{material.sourceUrl}</p>
              </div>

              <a
                href={material.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A342C] px-4 py-2 text-sm font-medium tracking-tight text-white transition-colors hover:bg-[#1F2822]"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть оригинал
              </a>

              {!canEmbed ? (
                <p className="text-xs leading-relaxed text-brand-muted">
                  Источник может не поддерживать встраивание. Материал остаётся внутри каталога, а оригинал доступен по кнопке выше.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <section className="space-y-4">
          {isVideo && canEmbed && material.embedUrl ? <LearnEmbedFrame src={material.embedUrl} title={material.title} kind="video" /> : null}

          {isArticle && canEmbed && material.embedUrl ? (
            <div className="space-y-3">
              <LearnEmbedFrame src={material.embedUrl} title={material.title} kind="article" />
              <div className="rounded-2xl border border-brand-border bg-white/80 p-3 text-sm text-brand-muted shadow-sm">
                Если источник не отображается из-за ограничений сайта, используйте кнопку <span className="font-medium text-brand-ink">«Открыть оригинал»</span>.
              </div>
            </div>
          ) : null}

          {!canEmbed ? (
            <Card className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_5%,rgba(217,249,157,0.35),transparent_35%)]" />
              <div className="relative">
                <CardHeader>
                  <Badge className="w-fit border-brand-border bg-white/90 text-brand-muted">
                    {isVideo ? "External video" : "Article preview"}
                  </Badge>
                  <CardTitle>{isVideo ? "Видео открывается у источника" : "Preview материала"}</CardTitle>
                  <CardDescription>
                    {isVideo
                      ? "Для этого видео не настроен embed в MVP. Сохраняем карточку и метаданные внутри каталога, а просмотр идёт по ссылке."
                      : "Некоторые сайты блокируют iframe. Ниже — краткое описание и ссылка на оригинальный материал."}
                  </CardDescription>
                </CardHeader>

                <div className="space-y-3 rounded-2xl border border-brand-border bg-white/75 p-4 shadow-sm">
                  <p className="text-sm leading-relaxed text-brand-muted">{material.summary}</p>
                  <div className="flex flex-wrap gap-2">
                    {material.tags.map((tag) => (
                      <span
                        key={`preview-${material.id}-${tag}`}
                        className="inline-flex items-center rounded-full border border-brand-border bg-white px-2 py-1 text-xs text-brand-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <a
                    href={material.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-medium tracking-tight text-brand-ink transition-colors hover:bg-[#f2f5eb]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Перейти к источнику
                  </a>
                </div>
              </div>
            </Card>
          ) : null}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Метаданные</CardTitle>
              <CardDescription>Базовая информация для каталога и будущего mobile UX.</CardDescription>
            </CardHeader>
            <div className="space-y-3 px-6 pb-6 text-sm">
              <div className="rounded-2xl border border-brand-border bg-white/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Тип</p>
                <p className="mt-1 font-medium text-brand-ink">{getLearnMaterialTypeLabel(material.type)}</p>
              </div>
              <div className="rounded-2xl border border-brand-border bg-white/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Провайдер</p>
                <p className="mt-1 font-medium text-brand-ink">{getLearnProviderLabel(material.provider)}</p>
              </div>
              <div className="rounded-2xl border border-brand-border bg-white/70 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Язык</p>
                <p className="mt-1 font-medium text-brand-ink">{material.language.toUpperCase()}</p>
              </div>
              {timeLabel ? (
                <div className="rounded-2xl border border-brand-border bg-white/70 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Длительность</p>
                  <p className="mt-1 font-medium text-brand-ink">{timeLabel}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Источник</CardTitle>
              <CardDescription>Внутренняя карточка + внешний оригинал для полного просмотра.</CardDescription>
            </CardHeader>
            <div className="space-y-3 px-6 pb-6">
              <div className="rounded-2xl border border-brand-border bg-white/70 p-3 text-sm text-brand-muted">
                <p className="inline-flex items-center gap-2 font-medium text-brand-ink">
                  <Globe className="h-4 w-4" />
                  {material.sourceName}
                </p>
                <p className="mt-2 break-all text-xs">{material.sourceUrl}</p>
              </div>

              <a
                href={material.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A342C] px-4 py-2 text-sm font-medium tracking-tight text-white transition-colors hover:bg-[#1F2822]"
              >
                <ExternalLink className="h-4 w-4" />
                Открыть оригинал
              </a>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
