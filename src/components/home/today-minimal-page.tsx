"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Check, ClipboardList, Loader2, RefreshCcw, Sparkles } from "lucide-react";

import { usePathOverlay } from "@/components/home/path-overlay";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { DailyTodoDto, DailyTodoItemDto, RhythmDto } from "@/contracts/home";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";

type HomeOverview = {
  stage: {
    order: number;
    name: string;
  };
  microStep: {
    id: string;
    text: string;
    isCompleted: boolean;
    completedAt: string | null;
  } | null;
  dailyTodo: DailyTodoDto;
  rhythm: RhythmDto;
};

type IdProfile = {
  nickname: string;
  avatarUrl: string | null;
};

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

function cloneTodoItems(items: DailyTodoItemDto[]) {
  return items.map((item) => ({ ...item }));
}

function isPlaceholderTodoItem(item: DailyTodoItemDto) {
  return item.id.startsWith("slot-");
}

function buildRhythmSegments(filledSegments: number) {
  return Array.from({ length: 7 }, (_, index) => index < filledSegments);
}

export function TodayMinimalPage() {
  const queryClient = useQueryClient();
  const { openPathOverlay } = usePathOverlay();
  const toast = useToast();
  const { data: overview, isLoading, error } = useQuery({
    queryKey: ["home-overview", "today-minimal"],
    queryFn: () => fetcher<HomeOverview>("/api/home/overview")
  });
  const { data: idProfile } = useQuery({
    queryKey: ["id-profile", "today-minimal"],
    queryFn: () => fetcher<IdProfile>("/api/id")
  });
  const [todoDraft, setTodoDraft] = useState<DailyTodoItemDto[]>([]);
  const [isTodoDirty, setIsTodoDirty] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const dailyTodo = overview?.dailyTodo ?? null;

  useEffect(() => {
    if (!dailyTodo) return;
    setTodoDraft(cloneTodoItems(dailyTodo.items));
    setIsTodoDirty(false);
  }, [dailyTodo]);

  const artistName = idProfile?.nickname?.trim() || "Артист";
  const pathLabel = overview?.stage
    ? `PATH этап: ${overview.stage.order}. ${overview.stage.name}`
    : "PATH";

  async function refreshOverview() {
    await queryClient.invalidateQueries({ queryKey: ["home-overview"] });
  }

  async function generateMicroStep() {
    setBusyAction("micro-step-generate");
    try {
      const response = await apiFetch("/api/home/micro-step", { method: "POST" });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить микро-шаг."));
      }
      await refreshOverview();
      toast.success(overview?.microStep ? "Микро-шаг обновлён." : "Микро-шаг создан.");
    } catch (microStepError) {
      toast.error(microStepError instanceof Error ? microStepError.message : "Не удалось обновить микро-шаг.");
    } finally {
      setBusyAction("");
    }
  }

  async function toggleMicroStep(nextCompleted: boolean) {
    setBusyAction("micro-step-toggle");
    try {
      const response = await apiFetch("/api/home/micro-step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: nextCompleted })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить микро-шаг."));
      }
      await refreshOverview();
      toast.success(nextCompleted ? "Микро-шаг отмечен." : "Микро-шаг снова открыт.");
    } catch (microStepError) {
      toast.error(microStepError instanceof Error ? microStepError.message : "Не удалось обновить микро-шаг.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveTodo(nextItems: DailyTodoItemDto[], successMessage = "Today to-do сохранён.") {
    setBusyAction("todo-save");
    try {
      const response = await apiFetch("/api/home/daily-todo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: nextItems.map((item, index) => ({
            id: item.id,
            text: item.text,
            isCompleted: item.isCompleted,
            sortIndex: index,
            completedAt: item.completedAt
          }))
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось сохранить today to-do."));
      }
      const saved = (await response.json()) as DailyTodoDto;
      setTodoDraft(cloneTodoItems(saved.items));
      setIsTodoDirty(false);
      await refreshOverview();
      toast.success(successMessage);
    } catch (todoError) {
      toast.error(todoError instanceof Error ? todoError.message : "Не удалось сохранить today to-do.");
    } finally {
      setBusyAction("");
    }
  }

  async function patchTodoItem(item: DailyTodoItemDto, nextCompleted: boolean) {
    setBusyAction(`todo-toggle:${item.id}`);
    try {
      const response = await apiFetch("/api/home/daily-todo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isCompleted: nextCompleted })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить пункт today to-do."));
      }
      const saved = (await response.json()) as DailyTodoDto;
      setTodoDraft(cloneTodoItems(saved.items));
      setIsTodoDirty(false);
      await refreshOverview();
      toast.success(nextCompleted ? "Пункт today to-do выполнен." : "Пункт today to-do снова открыт.");
    } catch (todoError) {
      toast.error(todoError instanceof Error ? todoError.message : "Не удалось обновить пункт today to-do.");
      throw todoError;
    } finally {
      setBusyAction("");
    }
  }

  function updateTodoText(index: number, text: string) {
    setTodoDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, text, isCompleted: text.trim() ? item.isCompleted : false, completedAt: text.trim() ? item.completedAt : null } : item))
    );
    setIsTodoDirty(true);
  }

  async function toggleTodo(index: number) {
    const item = todoDraft[index];
    if (!item || !item.text.trim()) return;

    const nextCompleted = !item.isCompleted;
    const previousDraft = cloneTodoItems(todoDraft);
    const nextDraft = todoDraft.map((candidate, candidateIndex) =>
      candidateIndex === index
        ? {
            ...candidate,
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? candidate.completedAt ?? new Date().toISOString() : null
          }
        : candidate
    );
    setTodoDraft(nextDraft);

    if (isTodoDirty || isPlaceholderTodoItem(item)) {
      setIsTodoDirty(true);
      await saveTodo(nextDraft, nextCompleted ? "Пункт today to-do выполнен." : "Пункт today to-do снова открыт.");
      return;
    }

    try {
      await patchTodoItem(item, nextCompleted);
    } catch {
      setTodoDraft(previousDraft);
    }
  }

  const rhythm = overview?.rhythm;
  const rhythmSegments = buildRhythmSegments(rhythm?.filledSegments ?? 0);
  const filledTodoCount = todoDraft.filter((item) => item.text.trim()).length;

  return (
    <div className="space-y-6 pb-10">
      <Card className="relative overflow-hidden border-brand-border bg-[#102629] p-0 text-white shadow-[0_24px_70px_rgba(16,38,41,0.26)]">
        {idProfile?.avatarUrl ? (
          <Image src={idProfile.avatarUrl} alt={artistName} fill className="object-cover" sizes="100vw" priority />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,41,0.18)_0%,rgba(16,38,41,0.36)_30%,rgba(16,38,41,0.76)_68%,rgba(16,38,41,0.96)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(115,221,255,0.24),transparent_34%),radial-gradient(circle_at_bottom,rgba(244,248,160,0.16),transparent_42%)]" />

        <div className="relative flex min-h-[24rem] flex-col justify-end p-5 md:min-h-[28rem] md:p-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <p className="text-5xl font-semibold tracking-tight text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.28)] md:text-7xl">
              {artistName}
            </p>

            <button
              type="button"
              onClick={openPathOverlay}
              className="mt-4 rounded-full border border-white/18 bg-white/10 px-5 py-2.5 text-sm font-medium text-white/92 backdrop-blur-md transition-colors hover:bg-white/20"
            >
              {pathLabel}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <Card className="border-[#cfd8b8] bg-[#f8f8ef]">
            <CardHeader className="mb-0">
              <div className="flex items-center gap-2 text-[#2a342c]">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#53614c]">Микро-шаг</p>
              </div>
              <CardTitle className="text-[1.75rem] text-[#2a342c]">Микро-шаг дня</CardTitle>
              <CardDescription className="max-w-2xl text-base text-[#53614c]">
                Простая в реализации задача, которая напрямую ведёт к выполнению проекта и/или к движению артиста вперёд.
              </CardDescription>
            </CardHeader>

            <div className="mt-5 rounded-[1.65rem] border border-[#d8deca] bg-white p-5 text-[#2a342c] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <p className="text-[1.45rem] leading-tight md:text-[1.7rem]">
                {overview?.microStep?.text ?? "Пока нет шага на сегодня. Сгенерируй первый микро-шаг."}
              </p>
              {overview?.microStep?.isCompleted ? (
                <p className="mt-3 text-sm font-medium text-[#53614c]">Шаг отмечен как выполненный. Если нужно, можешь вернуть его в работу.</p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                variant={overview?.microStep?.isCompleted ? "secondary" : "primary"}
                onClick={() => void toggleMicroStep(!(overview?.microStep?.isCompleted ?? false))}
                disabled={!overview?.microStep || busyAction === "micro-step-toggle"}
                className="min-w-[11rem]"
              >
                {busyAction === "micro-step-toggle" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {overview?.microStep?.isCompleted ? "Вернуть в работу" : "Сделано"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void generateMicroStep()}
                disabled={busyAction === "micro-step-generate"}
                className="min-w-[11rem]"
              >
                {busyAction === "micro-step-generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {overview?.microStep ? "Поменять шаг" : "Сгенерировать шаг"}
              </Button>
            </div>
          </Card>

          <Card className="border-[#cfd8b8] bg-[#f8f8ef]">
            <CardHeader className="mb-0">
              <div className="flex items-center gap-2 text-[#2a342c]">
                <Activity className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#53614c]">Rhythm</p>
              </div>
              <CardTitle className="text-[1.6rem] text-[#2a342c]">{rhythm?.label ?? "Ритм собирается"}</CardTitle>
              <CardDescription className="text-base text-[#53614c]">
                Статус продуктивности артиста. Зависит от задач и темпа их выполнения. Помогает понять, всё ли успеваешь и куда стоит смотреть внимательнее.
              </CardDescription>
            </CardHeader>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex flex-1 gap-2">
                {rhythmSegments.map((isFilled, index) => (
                  <div
                    key={`rhythm-segment-${index}`}
                    className={`h-3 flex-1 rounded-full ${isFilled ? "bg-[#2a342c]" : "bg-[#dce3cd]"}`}
                  />
                ))}
              </div>
              <p className="text-lg font-semibold text-[#53614c]">{rhythm ? rhythm.score.toFixed(1) : "0.0"}/7</p>
            </div>
            <p className="mt-4 text-base text-[#53614c]">
              {rhythm?.message ?? "Ритм начнёт собираться, когда появятся выполненные микро-шаги и закрытые пункты today to-do."}
            </p>
          </Card>
        </div>

        <Card className="border-[#cfd8b8] bg-[#f8f8ef]">
          <CardHeader className="mb-0">
            <div className="flex items-center gap-2 text-[#2a342c]">
              <ClipboardList className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#53614c]">Daily to-do</p>
            </div>
            <CardTitle className="text-[1.75rem] text-[#2a342c]">Today to-do</CardTitle>
            <CardDescription className="text-base text-[#53614c]">
              Ручной список на день: 5 пунктов максимум. Он влияет на ритм и помогает удерживать реальный темп, а не только намерение.
            </CardDescription>
          </CardHeader>

          <div className="mt-2 space-y-3">
            {todoDraft.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-[1.4rem] border px-3 py-3 ${
                  item.text.trim() ? "border-[#c7ceb3] bg-white" : "border-dashed border-[#d8deca] bg-[#f5f6ef]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void toggleTodo(index)}
                  disabled={!item.text.trim() || busyAction === "todo-save" || busyAction === `todo-toggle:${item.id}`}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                    item.isCompleted
                      ? "border-[#2a342c] bg-[#2a342c] text-white"
                      : "border-[#c7ceb3] bg-[#f8f8ef] text-[#7d8875] hover:border-[#2a342c] hover:text-[#2a342c]"
                  }`}
                  aria-label={item.isCompleted ? `Снять выполнение с пункта ${index + 1}` : `Отметить пункт ${index + 1} выполненным`}
                >
                  {busyAction === `todo-toggle:${item.id}` || busyAction === "todo-save" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : item.isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </button>
                <Input
                  value={item.text}
                  onChange={(event) => updateTodoText(index, event.target.value)}
                  placeholder={`Пункт ${index + 1}: что важно сделать сегодня`}
                  className={`border-0 px-0 py-0 text-base shadow-none focus:ring-0 ${
                    item.isCompleted ? "text-brand-muted line-through" : "text-brand-ink"
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-[#d8deca] bg-[#eef2e4] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#2a342c]">
                {filledTodoCount > 0
                  ? `${filledTodoCount} из ${overview?.dailyTodo.maxItems ?? 5} пунктов заполнено`
                  : "Пока пусто: заполни today to-do вручную"}
              </p>
              <p className="text-sm text-[#53614c]">
                {isTodoDirty
                  ? "Есть несохранённые изменения. Сохрани список, чтобы он начал влиять на ритм."
                  : "Закрытые пункты сразу усиливают ритм и показывают, где у тебя держится темп."}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void saveTodo(todoDraft)}
              disabled={!isTodoDirty || busyAction === "todo-save"}
              className="min-w-[10rem]"
            >
              {busyAction === "todo-save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Сохранить to-do
            </Button>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <Card className="border-dashed border-brand-border bg-white/70">
          <div className="flex items-center gap-3 text-brand-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>Загружаю today...</p>
          </div>
        </Card>
      ) : null}

      {error instanceof Error ? (
        <Card className="border-red-300/50 bg-[#fff2ef]">
          <p className="text-sm text-[#9b3426]">{error.message}</p>
        </Card>
      ) : null}
    </div>
  );
}
