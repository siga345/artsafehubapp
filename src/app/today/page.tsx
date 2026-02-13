"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CircleDot, Clapperboard, Megaphone, Mic, Rocket, SlidersHorizontal, Sparkles, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  1: "/images/stage-1-iskra.png",
  2: "/images/stage-2-formirovanie.png",
  3: "/images/stage-3-vyhod-v-svet.png",
  4: "/images/stage-4-proryv.png",
  5: "/images/stage-5-priznanie.png",
  6: "/images/stage-6-shirokaya-izvestnost.png",
  7: "/images/stage-7-nasledie.png"
};

export default function TodayPage() {
  const router = useRouter();
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
    if (mood === null) {
      setMood(data.checkIn.mood);
    }
    if (!note) {
      setNote(data.checkIn.note ?? "");
    }
  }, [data?.checkIn, mood, note]);

  const selectedMood = mood ?? data?.checkIn?.mood ?? null;
  const noteValue = note;
  const stageImageSrc = data?.stage?.order ? stageImageByOrder[data.stage.order] : undefined;
  const StageIcon = useMemo(() => {
    const key = data?.stage.iconKey ?? "spark";
    return iconMap[key] ?? Sparkles;
  }, [data?.stage.iconKey]);
  const activeDays = Math.max(0, Math.min(7, data?.weeklyActiveDays ?? 0));
  const hasMicroStep = Boolean(data?.microStep);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>PATH</CardTitle>
          <CardDescription>Твой центр ежедневного движения по этапам.</CardDescription>
        </CardHeader>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-full border-4 border-brand-border bg-white">
            {stageImageSrc ? (
              <Image
                src={stageImageSrc}
                alt={data?.stage?.name ? `Этап PATH: ${data.stage.name}` : "Текущий этап PATH"}
                fill
                sizes="192px"
                className="object-cover"
                priority
              />
            ) : (
              <StageIcon className="h-16 w-16 text-brand-ink" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-semibold">{isLoading ? "Загрузка..." : data?.stage.name}</p>
            <p className="text-sm text-brand-muted">{data?.stage.description}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Сегодня</CardTitle>
          <CardDescription>Как ты сегодня? Отметь состояние и добавь короткую заметку.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(moodLabels) as Mood[]).map((item) => (
              <Button
                key={item}
                variant={selectedMood === item ? "primary" : "secondary"}
                onClick={() => setMood(item)}
              >
                {moodLabels[item]}
              </Button>
            ))}
          </div>
          <textarea
            value={noteValue}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Пара слов о состоянии (опционально)"
            rows={3}
            className="w-full rounded-md border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-accent"
          />
          <Button
            disabled={!selectedMood || isSaving}
            onClick={async () => {
              if (!selectedMood) return;
              setIsSaving(true);
              await apiFetch("/api/home/check-in", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mood: selectedMood, note: noteValue.trim() || null })
              });
              setNote("");
              setMood(null);
              await refetch();
              setIsSaving(false);
            }}
          >
            {isSaving ? "Сохраняем..." : "Сохранить чек-ин"}
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
          <CardDescription>Мягкий ритм: от 0 до 7 активных дней.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className={`h-4 rounded-sm ${index < activeDays ? "bg-brand-ink" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <p className="text-sm text-brand-muted">{activeDays}/7 дней активности на этой неделе</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
          <CardDescription>Сразу переходи к ключевым ежедневным шагам.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => router.push("/songs")}>
            Записать демо
          </Button>
          <Button variant="secondary" onClick={() => router.push("/find")}>
            Найти специалиста
          </Button>
        </div>
      </Card>
    </div>
  );
}
