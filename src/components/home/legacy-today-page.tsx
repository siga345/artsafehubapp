"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { type ComponentType, useMemo, useState } from "react";
import { Camera, CircleDot, Clapperboard, Megaphone, Mic, Rocket, SlidersHorizontal, Sparkles, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TodayCoreLoop, type Mood, type TodayCoreLoopData } from "@/components/home/today-core-loop";
import { LearnContextCard, type LearnContextCardAction } from "@/components/learn/learn-context-card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";
import type { OnboardingChecklistState } from "@/lib/in-app-requests";
import { postLearnProgress } from "@/lib/learn/client";
import type { LearnContextBlock } from "@/lib/learn/types";

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

type HomeOverview = {
  today: string;
  stage: {
    id: number;
    order: number;
    name: string;
    iconKey: string;
    description: string;
  };
  checkIn: {
    mood: Mood;
    note: string | null;
  } | null;
  weeklyActiveDays: number;
  onboarding: OnboardingChecklistState;
  dayLoop: TodayCoreLoopData;
  learn: {
    today: LearnContextBlock | null;
    goals: LearnContextBlock | null;
  };
};

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  spark: Sparkles,
  mic: Mic,
  knobs: CircleDot,
  record: Clapperboard,
  sliders: SlidersHorizontal,
  wave: Waves,
  rocket: Rocket,
  camera: Camera,
  megaphone: Megaphone
};

const stageImageByOrder: Record<number, string> = {
  1: "/images/stage-1-iskra-symbol.png",
  2: "/images/stage-2-formirovanie-symbol.png",
  3: "/images/stage-3-vyhod-v-svet-symbol.png",
  4: "/images/stage-4-proryv-symbol.png",
  5: "/images/stage-5-priznanie-symbol.png",
  6: "/images/stage-6-shirokaya-izvestnost-symbol.png",
  7: "/images/stage-7-nasledie-symbol.png"
};

function getWeeklyRhythmMessage(activeDays: number) {
  switch (activeDays) {
    case 0:
      return "Кажется, ты совсем ничего не делал, не поздно начать";
    case 1:
      return "Старт есть: 1 день активности на этой неделе.";
    case 2:
      return "Мягкий ритм: 2 дня активности, продолжай.";
    case 3:
      return "Хороший ритм: 3 дня активности, ты в процессе.";
    case 4:
      return "Уверенный ритм: 4 дня активности, классный темп.";
    case 5:
      return "Сильный ритм: 5 дней активности, почти максимум.";
    case 6:
      return "Почти идеально: 6 дней активности за неделю.";
    default:
      return "Максимум: 7 из 7 активных дней.";
  }
}

function formatTodayLabel(value?: string) {
  if (!value) return "Сегодня";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Сегодня";
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long"
  });
}

function getStageGradientStyle(order?: number) {
  switch (order) {
    case 2:
      return {
        background:
          "linear-gradient(135deg, rgba(203, 213, 225, 0.46) 0%, rgba(148, 163, 184, 0.32) 48%, rgba(226, 232, 240, 0.42) 100%)"
      } as const;
    case 3:
      return {
        background:
          "linear-gradient(135deg, rgba(253, 230, 138, 0.52) 0%, rgba(250, 204, 21, 0.34) 48%, rgba(254, 249, 195, 0.48) 100%)"
      } as const;
    case 4:
      return {
        background:
          "linear-gradient(135deg, rgba(134, 239, 172, 0.46) 0%, rgba(74, 222, 128, 0.32) 48%, rgba(220, 252, 231, 0.44) 100%)"
      } as const;
    case 5:
      return {
        background:
          "linear-gradient(135deg, rgba(253, 186, 116, 0.50) 0%, rgba(249, 115, 22, 0.30) 48%, rgba(255, 237, 213, 0.46) 100%)"
      } as const;
    case 6:
      return {
        background:
          "linear-gradient(135deg, rgba(125, 181, 255, 0.62) 0%, rgba(37, 99, 235, 0.54) 48%, rgba(191, 219, 254, 0.54) 100%)"
      } as const;
    case 7:
      return {
        background:
          "linear-gradient(140deg, #ff7a7a 0%, #ff2b2b 44%, #9a1111 78%, #3a0b0b 100%)"
      } as const;
    default:
      return undefined;
  }
}

export function LegacyTodayPage() {
  const toast = useToast();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["home-overview"],
    queryFn: () => fetcher<HomeOverview>("/api/home/overview")
  });
  const [isUpdatingOnboarding, setIsUpdatingOnboarding] = useState(false);
  const [actionError, setActionError] = useState("");
  const stageImageSrc = data?.stage?.order ? stageImageByOrder[data.stage.order] : undefined;
  const StageIcon = useMemo(() => {
    const key = data?.stage.iconKey ?? "spark";
    return iconMap[key] ?? Sparkles;
  }, [data?.stage?.iconKey]);
  const isSeventhStage = data?.stage?.order === 7;
  const stageGradientStyle = getStageGradientStyle(data?.stage?.order);
  const activeDays = Math.max(0, Math.min(7, data?.weeklyActiveDays ?? 0));
  const weeklyRhythmMessage = getWeeklyRhythmMessage(activeDays);
  const todayLabel = formatTodayLabel(data?.today);
  const onboarding = data?.onboarding;

  async function handleLearnAction(materialSlug: string, action: LearnContextCardAction) {
    setActionError("");
    try {
      if (action.kind === "APPLY_TO_TRACK") {
        await postLearnProgress(materialSlug, {
          action: "APPLY",
          surface: "TODAY",
          targetType: "TRACK",
          targetId: action.targetId,
          recommendationContext: action.recommendationContext
        });
        toast.success("Материал привязан к треку.");
      } else if (action.kind === "APPLY_TO_GOAL") {
        await postLearnProgress(materialSlug, {
          action: "APPLY",
          surface: "TODAY",
          targetType: "GOAL",
          targetId: action.targetId,
          recommendationContext: action.recommendationContext
        });
        toast.success("Материал привязан к цели.");
      } else if (action.kind === "NOT_RELEVANT") {
        await postLearnProgress(materialSlug, {
          action: "NOT_RELEVANT",
          surface: "TODAY",
          recommendationContext: action.recommendationContext
        });
        toast.info("Материал скрыт из рекомендаций.");
      } else {
        await postLearnProgress(materialSlug, {
          action: "LATER",
          surface: "TODAY",
          recommendationContext: action.recommendationContext
        });
        toast.info("Материал отложен на потом.");
      }
      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить Learn-материал.");
    }
  }

  return (
    <div className="space-y-4">
      {onboarding?.isVisible ? (
        <Card className="rounded-2xl border border-brand-border bg-white/85 p-0">
          <div className="border-b border-brand-border px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Первые шаги</p>
                <h2 className="text-base font-semibold text-brand-ink">Чеклист запуска</h2>
                <p className="text-xs text-brand-muted">
                  {onboarding.completedCount}/{onboarding.totalCount} завершено
                </p>
              </div>
              <Button
                variant="secondary"
                className="h-9 rounded-xl px-3 text-xs"
                disabled={isUpdatingOnboarding}
                onClick={async () => {
                  setIsUpdatingOnboarding(true);
                  try {
                    const response = await apiFetch("/api/home/onboarding", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "DISMISS" })
                    });
                    if (!response.ok) {
                      throw new Error(await readApiErrorMessage(response, "Не удалось скрыть чеклист запуска."));
                    }
                    await refetch();
                    toast.info("Чеклист запуска скрыт. Его можно вернуть позже.");
                  } catch (error) {
                    setActionError(error instanceof Error ? error.message : "Не удалось обновить чеклист запуска.");
                  } finally {
                    setIsUpdatingOnboarding(false);
                  }
                }}
              >
                Скрыть
              </Button>
            </div>
          </div>
          <div className="grid gap-2 px-4 py-3 md:grid-cols-2 xl:grid-cols-3">
            {onboarding.steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white/80 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-ink">{step.title}</p>
                  <p className="text-xs text-brand-muted">{step.description}</p>
                </div>
                {step.completed ? (
                  <span className="shrink-0 rounded-lg border border-emerald-300/45 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-800">
                    Готово
                  </span>
                ) : (
                  <Link href={step.href}>
                    <Button className="h-8 shrink-0 rounded-lg px-3 text-xs">Перейти</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
          {onboarding.nextStep ? (
            <div className="border-t border-brand-border px-4 py-3 text-xs text-brand-muted">
              Следующий шаг: <span className="font-medium text-brand-ink">{onboarding.nextStep.title}</span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card
        style={stageGradientStyle}
        className={`relative overflow-hidden p-0 ${isSeventhStage ? "border-[#7f0000]" : ""}`}
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${
            isSeventhStage
              ? "bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.16),transparent_42%),radial-gradient(circle_at_85%_88%,rgba(255,120,120,0.18),transparent_45%)]"
              : "bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.65),transparent_44%),radial-gradient(circle_at_84%_84%,rgba(42,52,44,0.08),transparent_46%)]"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-10 top-8 h-44 w-44 rounded-full blur-3xl ${
            isSeventhStage ? "bg-red-200/25" : "bg-lime-200/45"
          }`}
        />
        <div className="relative grid gap-3 p-3 pb-5 md:grid-cols-[1.08fr_0.92fr] md:items-center md:gap-4 md:p-4 md:pb-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] md:gap-2 md:rounded-xl md:px-2.5 md:py-1 md:text-xs ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/90"
                    : "border-brand-border bg-white/80 text-brand-muted"
                }`}
              >
                <StageIcon className={`h-3 w-3 md:h-3.5 md:w-3.5 ${isSeventhStage ? "text-white" : "text-brand-ink"}`} />
                Путь
              </span>
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <span
                  className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] md:rounded-xl md:px-2.5 md:py-1 md:text-xs ${
                    isSeventhStage
                      ? "border-white/15 bg-black/15 text-white/85"
                      : "border-brand-border bg-white/75 text-brand-muted"
                  }`}
                >
                  Этап {data?.stage?.order ?? "—"}
                </span>
                <span
                  className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] md:rounded-xl md:px-2.5 md:py-1 md:text-xs ${
                    isSeventhStage
                      ? "border-white/15 bg-black/15 text-white/85"
                      : "border-brand-border bg-white/75 text-brand-muted"
                  }`}
                >
                  {todayLabel}
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-2xl font-semibold tracking-tight md:text-[2rem] ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>
                  PATH
                </p>
                <p className={`mt-0.5 text-xs md:mt-1 md:text-sm ${isSeventhStage ? "text-white/80" : "text-brand-muted"}`}>
                  Центр ежедневного движения по этапам.
                </p>
              </div>
              <div className="ml-auto max-w-[62%] text-right">
                <div className="min-w-0">
                  <p className={`text-base font-semibold leading-tight md:text-xl ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>
                    {isLoading ? "Загрузка..." : data?.stage.name}
                  </p>
                  <p className={`mt-0.5 text-xs md:mt-1 md:text-sm ${isSeventhStage ? "text-white/80" : "text-brand-muted"}`}>
                    {data?.stage.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-1 flex min-h-[170px] items-center justify-center overflow-hidden md:mt-0 md:min-h-[240px]">
            <div
              aria-hidden
              className={`absolute h-32 w-32 rounded-full border md:h-44 md:w-44 ${
                isSeventhStage ? "border-white/20" : "border-brand-ink/10"
              }`}
            />
            <div
              aria-hidden
              className={`absolute h-44 w-44 rounded-full border md:h-60 md:w-60 ${
                isSeventhStage ? "border-white/10" : "border-brand-ink/5"
              }`}
            />
            <div
              aria-hidden
              className={`absolute h-24 w-24 rounded-full blur-2xl md:h-36 md:w-36 ${
                isSeventhStage ? "bg-white/10" : "bg-white/60"
              }`}
            />

            <div className="relative z-20 flex h-36 w-36 items-center justify-center md:h-56 md:w-56">
              {stageImageSrc ? (
                <Image
                  src={stageImageSrc}
                  alt={data?.stage?.name ? `Этап PATH: ${data.stage.name}` : "Текущий этап PATH"}
                  fill
                  sizes="(max-width: 768px) 144px, 224px"
                  className={`object-contain scale-[1.72] ${isSeventhStage ? "invert brightness-[2.2] contrast-[1.15]" : ""}`}
                  priority
                />
              ) : (
                <StageIcon className={`h-24 w-24 md:h-36 md:w-36 ${isSeventhStage ? "text-white" : "text-brand-ink"}`} />
              )}
            </div>
          </div>
        </div>
        <div
          className={`relative border-t p-3 md:p-4 ${
            isSeventhStage ? "border-white/10 bg-black/5" : "border-brand-border/70 bg-white/20"
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={`text-xs font-semibold md:text-sm ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>Daily Control Center</p>
              <p className={`text-[11px] md:text-xs ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
                Утренний фокус, работа по треку и завершение дня без лишних экранов.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] md:rounded-xl md:px-2.5 md:py-1 md:text-xs ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/85"
                    : "border-brand-border bg-white/80 text-brand-muted"
                }`}
              >
                Фокус: {data?.dayLoop?.focus ? "зафиксирован" : "ожидает"}
              </span>
              <span
                className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] md:rounded-xl md:px-2.5 md:py-1 md:text-xs ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/85"
                    : "border-brand-border bg-white/80 text-brand-muted"
                }`}
              >
                Следующий шаг: {data?.dayLoop?.focus?.nextStep || data?.dayLoop?.wrapUp?.nextStep ? "есть" : "пусто"}
              </span>
            </div>
          </div>

          {actionError ? <InlineActionMessage message={actionError} className="mb-3" /> : null}

          <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
            <div
              className={`rounded-2xl border p-3 shadow-sm ${
                isSeventhStage ? "border-white/15 bg-black/15" : "border-brand-border bg-white/72"
              }`}
            >
              <TodayCoreLoop checkIn={data?.checkIn ?? null} dayLoop={data?.dayLoop ?? null} onRefresh={refetch} />
            </div>

            <section
              className={`rounded-2xl border p-3 ${
                isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/65"
              }`}
            >
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.14em] md:text-xs ${
                      isSeventhStage ? "text-white/75" : "text-brand-muted"
                    }`}
                  >
                    Ритм недели
                  </p>
                  <p className={`text-[11px] md:text-xs ${isSeventhStage ? "text-white/85" : "text-brand-muted"}`}>{activeDays}/7</p>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div
                      key={index}
                      className={`h-1.5 rounded-full md:h-2 ${
                        index < activeDays
                          ? isSeventhStage
                            ? "bg-white"
                            : "bg-[#2A342C]"
                          : isSeventhStage
                            ? "bg-white/20"
                            : "bg-[#dce6cf]"
                      }`}
                    />
                  ))}
                </div>
                <p className={`mt-2 text-[11px] md:text-xs ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
                  {weeklyRhythmMessage}
                </p>
              </div>

	              <div className="space-y-2">
	                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
	                  Подсказки
                </p>
                <ul className={`space-y-2 text-sm ${isSeventhStage ? "text-white/85" : "text-brand-muted"}`}>
                  <li className={`rounded-xl border px-3 py-2 ${isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/80"}`}>
                    Сначала зафиксируй фокус на треке, потом открывай мастерскую.
                  </li>
                  <li className={`rounded-xl border px-3 py-2 ${isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/80"}`}>
                    Если следующий шаг большой, сократи его до действия на 10–20 минут.
                  </li>
                  <li className={`rounded-xl border px-3 py-2 ${isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/80"}`}>
                    Вечером обязательно оставляй следующий шаг, чтобы день не обрывался в пустоту.
	                  </li>
	                </ul>
	              </div>

                <LearnContextCard
                  className="mt-3"
                  block={data?.learn.today ?? null}
                  compact
                  targetLabelOverride={data?.dayLoop?.focus?.track.title ?? null}
                  onAction={handleLearnAction}
                />
	            </section>
	          </div>
	        </div>
      </Card>
    </div>
  );
}
