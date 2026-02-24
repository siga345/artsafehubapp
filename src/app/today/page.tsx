"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Camera, CircleDot, Clapperboard, Megaphone, Mic, Rocket, SlidersHorizontal, Sparkles, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <Card style={stageGradientStyle} className={isSeventhStage ? "border-[#7f0000]" : undefined}>
        <CardHeader>
          <CardTitle className={isSeventhStage ? "text-3xl text-white" : "text-3xl"}>PATH</CardTitle>
          <CardDescription className={isSeventhStage ? "text-white/85" : undefined}>
            Твой центр ежедневного движения по этапам.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-72 w-full items-center justify-center">
            <div className="relative z-20 flex h-72 w-72 translate-y-6 items-center justify-center">
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
          <div className="space-y-1">
            <p className={`text-2xl font-semibold ${isSeventhStage ? "text-white" : ""}`}>{isLoading ? "Загрузка..." : data?.stage.name}</p>
            <p className={`text-sm ${isSeventhStage ? "text-white/85" : "text-brand-muted"}`}>{data?.stage.description}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Сегодня</CardTitle>
          <CardDescription>Как ты сегодня? Отметь своё состояние и творческую деятельность</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {moodOrder.map((item) => (
              <Button
                key={item}
                variant={selectedMood === item ? "primary" : "secondary"}
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
            className={isCheckInLocked ? "text-brand-muted" : undefined}
          />
          <Button
            variant={isCheckInLocked ? "secondary" : "primary"}
            className={isCheckInLocked ? "text-brand-muted" : undefined}
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Микро-шаг дня</CardTitle>
          <CardDescription>Одно маленькое действие лучше, чем ноль действий.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-brand-border bg-brand-surface px-3 py-3">
            <p className="text-sm">
              {hasMicroStep ? data?.microStep?.text : "Пока нет шага на сегодня. Сгенерируй первый микро-шаг."}
            </p>
            {data?.microStep?.isCompleted && <p className="mt-1 text-xs text-brand-muted">Отмечено как выполнено.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
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
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Прогресс недели</CardTitle>
          <CardDescription>{weeklyRhythmMessage}</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className={`h-4 rounded-sm ${index < activeDays ? "bg-[#2A342C]" : "bg-[#dce6cf]"}`}
              />
            ))}
          </div>
          <p className="text-sm text-brand-muted">{activeDays}/7 дней активности на этой неделе</p>
        </div>
      </Card>

    </div>
  );
}
