"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, ExternalLink, FileText, Globe, PlayCircle } from "lucide-react";

import { LearnEmbedFrame } from "@/components/learn/learn-embed-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";
import {
  getLearnMaterialTimeLabel,
  getLearnMaterialTypeLabel,
  getLearnProgressStatusLabel,
  getLearnProviderLabel,
  supportsInlineEmbed
} from "@/lib/learn/providers";
import type { LearnMaterialDetail, LearnMaterialProgressState } from "@/lib/learn/types";
import { useToast } from "@/components/ui/toast";

type LearnDetailPageProps = {
  material: LearnMaterialDetail;
};

type TrackOption = {
  id: string;
  title: string;
};

type GoalOption = {
  id: string;
  title: string;
  status: string;
};

type GoalListResponse = {
  items: GoalOption[];
};

async function fetchTrackOptions() {
  const tracks = await apiFetchJson<Array<{ id: string; title: string }>>("/api/songs");
  return tracks.map((track) => ({ id: track.id, title: track.title }));
}

async function fetchGoalOptions() {
  const goals = await apiFetchJson<GoalListResponse>("/api/goals");
  return goals.items.filter((goal) => goal.status === "ACTIVE").map((goal) => ({ id: goal.id, title: goal.title, status: goal.status }));
}

export function LearnDetailPage({ material }: LearnDetailPageProps) {
  const toast = useToast();
  const timeLabel = getLearnMaterialTimeLabel(material);
  const canEmbed = supportsInlineEmbed(material);
  const isVideo = material.type === "VIDEO";
  const isArticle = material.type === "ARTICLE";
  const [progress, setProgress] = useState<LearnMaterialProgressState>(material.progress);
  const [isApplyTrackOpen, setIsApplyTrackOpen] = useState(false);
  const [isApplyGoalOpen, setIsApplyGoalOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [savingAction, setSavingAction] = useState("");

  const tracksQuery = useQuery({
    queryKey: ["learn-apply-tracks"],
    queryFn: fetchTrackOptions,
    enabled: isApplyTrackOpen
  });
  const goalsQuery = useQuery({
    queryKey: ["learn-apply-goals"],
    queryFn: fetchGoalOptions,
    enabled: isApplyGoalOpen
  });

  useEffect(() => {
    let cancelled = false;

    async function markOpen() {
      try {
        const response = await apiFetch(`/api/learn/materials/${material.slug}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "OPEN",
            surface: "LEARN"
          })
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { progress: LearnMaterialProgressState };
        if (!cancelled) {
          setProgress(payload.progress);
        }
      } catch {
        // ignore non-blocking open tracking errors
      }
    }

    void markOpen();
    return () => {
      cancelled = true;
    };
  }, [material.slug]);

  useEffect(() => {
    if (tracksQuery.data?.length && !selectedTrackId) {
      setSelectedTrackId(tracksQuery.data[0].id);
    }
  }, [selectedTrackId, tracksQuery.data]);

  useEffect(() => {
    if (goalsQuery.data?.length && !selectedGoalId) {
      setSelectedGoalId(goalsQuery.data[0].id);
    }
  }, [selectedGoalId, goalsQuery.data]);

  const appliedTargetLabel = useMemo(() => {
    if (!progress.appliedTarget) return null;
    return progress.appliedTarget.type === "TRACK"
      ? `Применено к треку: ${progress.appliedTarget.title}`
      : `Применено к цели: ${progress.appliedTarget.title}`;
  }, [progress.appliedTarget]);

  async function submitProgressAction(
    body:
      | { action: "LATER" | "NOT_RELEVANT"; surface: "LEARN" }
      | { action: "APPLY"; surface: "LEARN"; targetType: "TRACK" | "GOAL"; targetId: string }
  ) {
    setSavingAction(body.action);
    try {
      const response = await apiFetch(`/api/learn/materials/${material.slug}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить статус материала."));
      }
      const payload = (await response.json()) as { progress: LearnMaterialProgressState };
      setProgress(payload.progress);

      if (body.action === "APPLY") {
        toast.success(body.targetType === "TRACK" ? "Материал привязан к треку." : "Материал привязан к цели.");
      } else if (body.action === "LATER") {
        toast.info("Материал отложен на потом.");
      } else {
        toast.info("Материал помечен как неактуальный.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить статус материала.");
    } finally {
      setSavingAction("");
    }
  }

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
              {progress.status ? (
                <Badge className="border-brand-border bg-white/90 text-brand-ink">{getLearnProgressStatusLabel(progress.status)}</Badge>
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

            {appliedTargetLabel ? (
              <div className="rounded-2xl border border-brand-border bg-white/85 p-3 text-sm text-brand-ink">{appliedTargetLabel}</div>
            ) : null}
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
              <CardTitle className="text-lg">Workflow actions</CardTitle>
              <CardDescription>Материал можно не только открыть, но и привязать к текущей работе.</CardDescription>
            </CardHeader>
            <div className="space-y-3 px-6 pb-6">
              {appliedTargetLabel ? (
                <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-3 text-sm text-brand-ink">{appliedTargetLabel}</div>
              ) : null}
              <Button className="w-full justify-center" onClick={() => setIsApplyTrackOpen(true)}>
                Применить к треку
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => setIsApplyGoalOpen(true)}>
                Применить к цели
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                disabled={savingAction === "LATER"}
                onClick={() => void submitProgressAction({ action: "LATER", surface: "LEARN" })}
              >
                Вернуться позже
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-center"
                disabled={savingAction === "NOT_RELEVANT"}
                onClick={() => void submitProgressAction({ action: "NOT_RELEVANT", surface: "LEARN" })}
              >
                Не подошло
              </Button>
            </div>
          </Card>

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
              {progress.status ? (
                <div className="rounded-2xl border border-brand-border bg-white/70 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Статус</p>
                  <p className="mt-1 font-medium text-brand-ink">{getLearnProgressStatusLabel(progress.status)}</p>
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

      <Modal
        open={isApplyTrackOpen}
        onClose={() => setIsApplyTrackOpen(false)}
        title="Применить к треку"
        description="Сохраняем материал как рабочий intent для выбранного трека."
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setIsApplyTrackOpen(false),
            disabled: savingAction === "APPLY"
          },
          {
            label: savingAction === "APPLY" ? "Сохраняем..." : "Применить",
            onClick: async () => {
              if (!selectedTrackId) return;
              await submitProgressAction({
                action: "APPLY",
                surface: "LEARN",
                targetType: "TRACK",
                targetId: selectedTrackId
              });
              setIsApplyTrackOpen(false);
            },
            disabled: savingAction === "APPLY" || !selectedTrackId
          }
        ]}
      >
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Трек</label>
          <Select value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)}>
            <option value="">Выбери трек</option>
            {(tracksQuery.data ?? []).map((track) => (
              <option key={track.id} value={track.id}>
                {track.title}
              </option>
            ))}
          </Select>
          {tracksQuery.isLoading ? <p className="text-sm text-brand-muted">Загружаем треки…</p> : null}
          {tracksQuery.isError ? <p className="text-sm text-[#9b3426]">Не удалось загрузить список треков.</p> : null}
        </div>
      </Modal>

      <Modal
        open={isApplyGoalOpen}
        onClose={() => setIsApplyGoalOpen(false)}
        title="Применить к цели"
        description="Сохраняем материал как рабочую опору для выбранной активной цели."
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setIsApplyGoalOpen(false),
            disabled: savingAction === "APPLY"
          },
          {
            label: savingAction === "APPLY" ? "Сохраняем..." : "Применить",
            onClick: async () => {
              if (!selectedGoalId) return;
              await submitProgressAction({
                action: "APPLY",
                surface: "LEARN",
                targetType: "GOAL",
                targetId: selectedGoalId
              });
              setIsApplyGoalOpen(false);
            },
            disabled: savingAction === "APPLY" || !selectedGoalId
          }
        ]}
      >
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Цель</label>
          <Select value={selectedGoalId} onChange={(event) => setSelectedGoalId(event.target.value)}>
            <option value="">Выбери цель</option>
            {(goalsQuery.data ?? []).map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </Select>
          {goalsQuery.isLoading ? <p className="text-sm text-brand-muted">Загружаем цели…</p> : null}
          {goalsQuery.isError ? <p className="text-sm text-[#9b3426]">Не удалось загрузить список целей.</p> : null}
        </div>
      </Modal>
    </div>
  );
}
