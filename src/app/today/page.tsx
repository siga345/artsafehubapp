"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Camera, CircleDot, Clapperboard, Megaphone, Mic, Rocket, SlidersHorizontal, Sparkles, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

type Mood = "NORMAL" | "TOUGH" | "FLYING";

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
  microStep: {
    id: string;
    text: string;
    isCompleted: boolean;
  } | null;
  weeklyActiveDays: number;
};

const moodLabels: Record<Mood, string> = {
  NORMAL: "Норм",
  TOUGH: "Сложно",
  FLYING: "Лечу"
};

const moodOrder: Mood[] = ["FLYING", "NORMAL", "TOUGH"];

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

export default function TodayPage() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["home-overview"],
    queryFn: () => fetcher<HomeOverview>("/api/home/overview")
  });
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingStep, setIsRefreshingStep] = useState(false);

  useEffect(() => {
    if (!data?.checkIn) return;
    setMood(data.checkIn.mood);
    setNote(data.checkIn.note ?? "");
  }, [data?.checkIn]);

  const selectedMood = mood ?? data?.checkIn?.mood ?? null;
  const noteValue = note;
  const stageImageSrc = data?.stage?.order ? stageImageByOrder[data.stage.order] : undefined;
  const StageIcon = useMemo(() => {
    const key = data?.stage.iconKey ?? "spark";
    return iconMap[key] ?? Sparkles;
  }, [data?.stage.iconKey]);
  const isSeventhStage = data?.stage?.order === 7;
  const stageGradientStyle = getStageGradientStyle(data?.stage?.order);
  const activeDays = Math.max(0, Math.min(7, data?.weeklyActiveDays ?? 0));
  const isCheckInLocked = Boolean(data?.checkIn);
  const weeklyRhythmMessage = getWeeklyRhythmMessage(activeDays);
  const hasMicroStep = Boolean(data?.microStep);
  const todayLabel = formatTodayLabel(data?.today);

  return (
    <div className="space-y-6">
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
        <div className="relative grid gap-5 p-4 md:grid-cols-[1.05fr_0.95fr] md:items-center md:p-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/90"
                    : "border-brand-border bg-white/80 text-brand-muted"
                }`}
              >
                <StageIcon className={`h-3.5 w-3.5 ${isSeventhStage ? "text-white" : "text-brand-ink"}`} />
                Path
              </span>
              <span
                className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-xs ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/85"
                    : "border-brand-border bg-white/75 text-brand-muted"
                }`}
              >
                Этап {data?.stage?.order ?? "—"}
              </span>
              <span
                className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-xs ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/85"
                    : "border-brand-border bg-white/75 text-brand-muted"
                }`}
              >
                {todayLabel}
              </span>
            </div>

            <div>
              <p className={`text-3xl font-semibold tracking-tight ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>
                PATH
              </p>
              <p className={`mt-1 text-sm ${isSeventhStage ? "text-white/80" : "text-brand-muted"}`}>
                Твой центр ежедневного движения по этапам.
              </p>
            </div>

            <div
              className={`rounded-2xl border p-3 shadow-sm backdrop-blur-sm ${
                isSeventhStage
                  ? "border-white/15 bg-black/20 text-white"
                  : "border-brand-border bg-white/72 text-brand-ink"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xl font-semibold ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>
                    {isLoading ? "Загрузка..." : data?.stage.name}
                  </p>
                  <p className={`mt-1 text-sm ${isSeventhStage ? "text-white/80" : "text-brand-muted"}`}>
                    {data?.stage.description}
                  </p>
                </div>
                <div
                  className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    isSeventhStage
                      ? "border-white/15 bg-white/10 text-white"
                      : "border-brand-border bg-[#eef4e6] text-brand-ink"
                  }`}
                >
                  <StageIcon className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-3 ${
                isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border/80 bg-white/55"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
                  Rhythm
                </p>
                <p className={`text-xs ${isSeventhStage ? "text-white/85" : "text-brand-muted"}`}>{activeDays}/7</p>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={`hero-rhythm-${index}`}
                    className={`h-2 rounded-full ${
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
              <p className={`mt-2 text-xs ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>{weeklyRhythmMessage}</p>
            </div>
          </div>

          <div className="relative flex min-h-[280px] items-center justify-center md:min-h-[340px]">
            <div
              aria-hidden
              className={`absolute h-56 w-56 rounded-full border ${
                isSeventhStage ? "border-white/20" : "border-brand-ink/10"
              }`}
            />
            <div
              aria-hidden
              className={`absolute h-72 w-72 rounded-full border ${
                isSeventhStage ? "border-white/10" : "border-brand-ink/5"
              }`}
            />
            <div
              aria-hidden
              className={`absolute h-44 w-44 rounded-full blur-2xl ${
                isSeventhStage ? "bg-white/10" : "bg-white/60"
              }`}
            />

            <div className="relative z-20 flex h-72 w-72 items-center justify-center">
              {stageImageSrc ? (
                <Image
                  src={stageImageSrc}
                  alt={data?.stage?.name ? `Этап PATH: ${data.stage.name}` : "Текущий этап PATH"}
                  fill
                  sizes="288px"
                  className={`object-contain scale-[1.72] ${isSeventhStage ? "invert brightness-[2.2] contrast-[1.15]" : ""}`}
                  priority
                />
              ) : (
                <StageIcon className={`h-44 w-44 ${isSeventhStage ? "text-white" : "text-brand-ink"}`} />
              )}
            </div>
          </div>
        </div>
        <div
          className={`relative border-t p-4 md:p-5 ${
            isSeventhStage ? "border-white/10 bg-black/5" : "border-brand-border/70 bg-white/20"
          }`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={`text-sm font-semibold ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>Daily Control Center</p>
              <p className={`text-xs ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
                Чек-ин, микро-шаг и прогресс недели в одном месте.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-xs ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/85"
                    : "border-brand-border bg-white/80 text-brand-muted"
                }`}
              >
                Чек-ин: {isCheckInLocked ? "сохранен" : "ожидает"}
              </span>
              <span
                className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-xs ${
                  isSeventhStage
                    ? "border-white/15 bg-black/15 text-white/85"
                    : "border-brand-border bg-white/80 text-brand-muted"
                }`}
              >
                Микро-шаг: {hasMicroStep ? "есть" : "пусто"}
              </span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <section
                className={`rounded-2xl border p-4 shadow-sm backdrop-blur-sm ${
                  isSeventhStage ? "border-white/15 bg-black/20" : "border-brand-border bg-white/78"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className={`text-sm font-semibold ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>Сегодня</p>
                    <p className={`text-xs ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
                      Как ты сегодня? Отметь состояние и творческую деятельность.
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-xl border px-2 py-1 text-xs ${
                      isSeventhStage
                        ? "border-white/15 bg-white/10 text-white/90"
                        : "border-brand-border bg-[#eef4e6] text-brand-ink"
                    }`}
                  >
                    {selectedMood ? moodLabels[selectedMood] : "Выбери mood"}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {moodOrder.map((item) => (
                      <Button
                        key={item}
                        variant={selectedMood === item ? "primary" : "secondary"}
                        className={isSeventhStage && selectedMood !== item ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : undefined}
                        disabled={isCheckInLocked || isSaving}
                        onClick={() => setMood(item)}
                      >
                        {moodLabels[item]}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    value={noteValue}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Пара слов о состоянии (опционально)"
                    rows={3}
                    readOnly={isCheckInLocked}
                    disabled={isCheckInLocked || isSaving}
                    className={
                      isSeventhStage
                        ? "border-white/15 bg-black/15 text-white placeholder:text-white/40 focus:ring-white"
                        : isCheckInLocked
                          ? "text-brand-muted"
                          : undefined
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={isCheckInLocked ? "secondary" : "primary"}
                      className={
                        isSeventhStage
                          ? isCheckInLocked
                            ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                            : "bg-white text-[#2A342C] hover:bg-white/90"
                          : isCheckInLocked
                            ? "text-brand-muted"
                            : undefined
                      }
                      disabled={isCheckInLocked || !selectedMood || isSaving}
                      onClick={async () => {
                        if (!selectedMood || isCheckInLocked) return;
                        setIsSaving(true);
                        await apiFetch("/api/home/check-in", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ mood: selectedMood, note: noteValue.trim() || null })
                        });
                        await refetch();
                        setIsSaving(false);
                      }}
                    >
                      {isCheckInLocked ? "Сохранено" : isSaving ? "Сохраняем..." : "Сохранить чек-ин"}
                    </Button>
                  </div>
                </div>
              </section>

              <section
                className={`rounded-2xl border p-4 shadow-sm ${
                  isSeventhStage ? "border-white/15 bg-black/15" : "border-brand-border bg-white/72"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className={`text-sm font-semibold ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>Микро-шаг дня</p>
                    <p className={`text-xs ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
                      Одно маленькое действие лучше, чем ноль действий.
                    </p>
                  </div>
                  {data?.microStep?.isCompleted ? (
                    <span
                      className={`inline-flex items-center rounded-xl border px-2 py-1 text-xs ${
                        isSeventhStage
                          ? "border-white/15 bg-white/10 text-white/90"
                          : "border-brand-border bg-[#eef4e6] text-brand-ink"
                      }`}
                    >
                      Выполнено
                    </span>
                  ) : null}
                </div>

                <div
                  className={`rounded-xl border px-3 py-3 ${
                    isSeventhStage ? "border-white/10 bg-black/10 text-white" : "border-brand-border bg-brand-surface"
                  }`}
                >
                  <p className={`text-sm ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>
                    {hasMicroStep ? data?.microStep?.text : "Пока нет шага на сегодня. Сгенерируй первый микро-шаг."}
                  </p>
                  {data?.microStep?.isCompleted && (
                    <p className={`mt-1 text-xs ${isSeventhStage ? "text-white/70" : "text-brand-muted"}`}>Отмечено как выполнено.</p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className={isSeventhStage ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : undefined}
                    disabled={!hasMicroStep || Boolean(data?.microStep?.isCompleted)}
                    onClick={async () => {
                      await apiFetch("/api/home/micro-step", { method: "PATCH" });
                      await refetch();
                    }}
                  >
                    Сделано
                  </Button>
                  <Button
                    variant="secondary"
                    className={isSeventhStage ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : undefined}
                    disabled={isRefreshingStep}
                    onClick={async () => {
                      setIsRefreshingStep(true);
                      await apiFetch("/api/home/micro-step", { method: "POST" });
                      await refetch();
                      setIsRefreshingStep(false);
                    }}
                  >
                    {isRefreshingStep ? "Обновляем..." : "Поменять шаг"}
                  </Button>
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section
                className={`rounded-2xl border p-4 shadow-sm ${
                  isSeventhStage ? "border-white/15 bg-black/20" : "border-brand-border bg-white/78"
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>Прогресс недели</p>
                    <p className={`text-xs ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>{weeklyRhythmMessage}</p>
                  </div>
                  <div
                    className={`rounded-xl border px-2.5 py-1 text-xs font-medium ${
                      isSeventhStage
                        ? "border-white/15 bg-white/10 text-white"
                        : "border-brand-border bg-[#eef4e6] text-brand-ink"
                    }`}
                  >
                    {activeDays}/7
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div
                      key={index}
                      className={`h-5 rounded-md border ${
                        index < activeDays
                          ? isSeventhStage
                            ? "border-white/15 bg-white"
                            : "border-[#2A342C]/15 bg-[#2A342C]"
                          : isSeventhStage
                            ? "border-white/10 bg-white/10"
                            : "border-brand-border bg-[#dce6cf]"
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div
                    className={`rounded-xl border p-3 ${
                      isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white"
                    }`}
                  >
                    <p className={`text-xs uppercase tracking-[0.12em] ${isSeventhStage ? "text-white/70" : "text-brand-muted"}`}>
                      Активные дни
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>{activeDays}</p>
                  </div>
                  <div
                    className={`rounded-xl border p-3 ${
                      isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white"
                    }`}
                  >
                    <p className={`text-xs uppercase tracking-[0.12em] ${isSeventhStage ? "text-white/70" : "text-brand-muted"}`}>
                      До 7/7
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${isSeventhStage ? "text-white" : "text-brand-ink"}`}>{Math.max(0, 7 - activeDays)}</p>
                  </div>
                </div>
              </section>

              <section
                className={`rounded-2xl border p-4 ${
                  isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/65"
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${isSeventhStage ? "text-white/75" : "text-brand-muted"}`}>
                  Path Tips
                </p>
                <ul className={`mt-2 space-y-2 text-sm ${isSeventhStage ? "text-white/85" : "text-brand-muted"}`}>
                  <li className={`rounded-xl border px-3 py-2 ${isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/80"}`}>
                    Сначала сохрани чек-ин, потом отмечай микро-шаг: так трекер дня будет последовательным.
                  </li>
                  <li className={`rounded-xl border px-3 py-2 ${isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/80"}`}>
                    Если шаг слишком большой, обнови его и сократи до действия на 10–20 минут.
                  </li>
                  <li className={`rounded-xl border px-3 py-2 ${isSeventhStage ? "border-white/10 bg-black/10" : "border-brand-border bg-white/80"}`}>
                    Держи ритм 3–4 дня в неделю: это уже хороший устойчивый темп.
                  </li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </Card>

    </div>
  );
}
