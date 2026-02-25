"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ArrowRight, Compass, MapPin, SlidersHorizontal, Sparkles, Target, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type NavigationResponse = {
  requestId: string;
  generatedAt: string;
  summary: string;
  recommendations: Array<{
    specialistUserId: string;
    safeId: string;
    nickname: string;
    category: "PRODUCER" | "AUDIO_ENGINEER" | "RECORDING_STUDIO" | "PROMO_CREW";
    score: number;
    rationale: string;
    contactTelegram?: string;
    contactUrl?: string;
  }>;
  nextActions: Array<{
    title: string;
    description: string;
    etaMinutes?: number;
  }>;
};

type SupportResponse = {
  requestId: string;
  generatedAt: string;
  tone: "CALM" | "ENERGIZING" | "GROUNDING";
  responseText: string;
  suggestedSteps: string[];
  escalation: {
    level: "NONE" | "SOFT_ALERT" | "URGENT_HELP";
    reason?: string;
    resources: Array<{ title: string; url: string }>;
  };
};

type ApiErrorShape = {
  error?: string;
  details?: unknown;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let payload: ApiErrorShape | null = null;
    try {
      payload = (await response.json()) as ApiErrorShape;
    } catch {
      payload = null;
    }
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getHomeOverviewStage() {
  const response = await fetch("/api/home/overview", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Не удалось получить PATH контекст из HOME");
  }

  const payload = (await response.json()) as {
    stage?: { id?: number; name?: string };
  };

  const stageId = payload.stage?.id;
  const stageName = payload.stage?.name;

  if (!stageId || !stageName) {
    throw new Error("PATH контекст отсутствует");
  }

  return {
    pathStageId: stageId,
    pathStageName: stageName
  };
}

export default function AssistantPage() {
  const enabled = process.env.NEXT_PUBLIC_AI_ASSIST_ENABLED === "true";
  const [isPending, startTransition] = useTransition();

  const [navigationObjective, setNavigationObjective] = useState("Нужен специалист для сведения демо");
  const [navigationCity, setNavigationCity] = useState("");
  const [navigationTopK, setNavigationTopK] = useState("3");
  const [navigationBudgetMax, setNavigationBudgetMax] = useState("");
  const [navigationPreferRemote, setNavigationPreferRemote] = useState(true);
  const [navigationResult, setNavigationResult] = useState<NavigationResponse | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const [supportMood, setSupportMood] = useState<"NORMAL" | "TOUGH" | "FLYING">("NORMAL");
  const [supportNote, setSupportNote] = useState("");
  const [supportResult, setSupportResult] = useState<SupportResponse | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  const handleNavigationSubmit = () => {
    startTransition(() => {
      void (async () => {
        setNavigationError(null);
        setNavigationResult(null);

        try {
          const pathContext = await getHomeOverviewStage();
          const topKParsed = Number.parseInt(navigationTopK, 10);
          const budgetMaxParsed = Number.parseInt(navigationBudgetMax, 10);

          const payload = {
            userId: "__session__",
            objective: navigationObjective.trim(),
            pathContext,
            city: navigationCity.trim() || undefined,
            preferRemote: navigationPreferRemote,
            budget:
              navigationBudgetMax.trim() && Number.isFinite(budgetMaxParsed)
                ? { max: budgetMaxParsed, currency: "RUB" }
                : undefined,
            topK: Number.isFinite(topKParsed) ? topKParsed : 3
          };

          const result = await postJson<NavigationResponse>("/api/ai/navigation/suggest", payload);
          setNavigationResult(result);
        } catch (error) {
          setNavigationError(error instanceof Error ? error.message : "Ошибка запроса");
        }
      })();
    });
  };

  const handleSupportSubmit = () => {
    startTransition(() => {
      void (async () => {
        setSupportError(null);
        setSupportResult(null);

        try {
          const payload = {
            userId: "__session__",
            mood: supportMood,
            note: supportNote.trim() || undefined
          };

          const result = await postJson<SupportResponse>("/api/ai/support/respond", payload);
          setSupportResult(result);
        } catch (error) {
          setSupportError(error instanceof Error ? error.message : "Ошибка запроса");
        }
      })();
    });
  };

  return (
    <div className="relative isolate">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
        <div className="relative h-80 w-80 opacity-[0.1] md:h-[42rem] md:w-[42rem]">
          <Image
            src="/images/assistant-logo.png"
            alt=""
            fill
            sizes="(min-width: 768px) 42rem, 20rem"
            className="object-contain"
          />
        </div>
      </div>

      <div className="relative z-30 space-y-6">
        {enabled && (
          <section className="app-glass relative overflow-hidden p-4 md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(217,249,157,0.35),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.08),transparent_44%)]" />
            <div className="pointer-events-none absolute -right-6 top-4 h-24 w-24 rounded-full bg-[#d9f99d]/30 blur-2xl" />
            <div className="pointer-events-none absolute left-6 top-16 h-px w-1/3 bg-brand-ink/10" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                  <Compass className="h-3.5 w-3.5 text-brand-ink" />
                  Assist
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">AI ASSIST</h1>
                <p className="mt-1 max-w-2xl text-sm text-brand-muted">
                  Навигация по PATH, подбор специалистов и поддержка в одном интерфейсе.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className="bg-white">PATH-aware</Badge>
                <Badge className="bg-white">Navigation + Support</Badge>
              </div>
            </div>
          </section>
        )}

        {!enabled ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">AI ASSIST</CardTitle>
              <CardDescription>Скоро будет доступно.</CardDescription>
            </CardHeader>
            <div className="space-y-3 text-sm text-brand-muted">
              <p>В будущих версиях AI поможет с поддержкой, навигацией по PATH и поиском нужных людей.</p>
              <Button disabled>Открыть чат</Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="relative overflow-hidden border-brand-border/90 p-0 shadow-[0_20px_50px_rgba(45,60,40,0.14)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(217,249,157,0.4),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.08),transparent_46%)]" />
              <div className="pointer-events-none absolute right-6 top-6 h-28 w-28 rounded-full bg-[#d9f99d]/30 blur-2xl" />
              <div className="pointer-events-none absolute left-0 right-0 top-[96px] h-px bg-brand-border/70" />

              <div className="relative p-4 md:p-5">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="relative overflow-hidden rounded-2xl border border-[#314037]/15 bg-[#1f2a23] p-4 text-white shadow-[0_12px_30px_rgba(20,25,21,0.28)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(217,249,157,0.24),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.07),transparent_45%)]" />
                    <div className="relative">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
                        <Compass className="h-3.5 w-3.5 text-white" />
                        AI Navigation
                      </div>
                      <p className="text-xl font-semibold tracking-tight md:text-2xl">
                        Подбор специалистов по цели и PATH-контексту
                      </p>
                      <p className="mt-2 max-w-xl text-sm text-white/75">
                        Опиши задачу, город и бюджет. Assist вернет рекомендации и next actions для следующего шага.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge className="border-white/10 bg-white/10 text-white">PATH context: HOME</Badge>
                        <Badge className="border-white/10 bg-white/10 text-white">Top K: {navigationTopK || "3"}</Badge>
                        <Badge className="border-white/10 bg-white/10 text-white">
                          {navigationPreferRemote ? "Remote preferred" : "Remote optional"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-brand-border bg-white/82 p-4 shadow-sm backdrop-blur-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-brand-ink" />
                        Command Panel
                      </div>
                      <span className="text-xs text-brand-muted">
                        {navigationObjective.trim().length < 3 ? "Нужно от 3 символов" : "Готово к запуску"}
                      </span>
                    </div>

                    <label className="block space-y-1 text-sm">
                      <span className="inline-flex items-center gap-2 text-brand-muted">
                        <Target className="h-3.5 w-3.5" />
                        Цель
                      </span>
                      <Input
                        value={navigationObjective}
                        onChange={(event) => setNavigationObjective(event.target.value)}
                        placeholder="Нужен звукорежиссер для сведения демо"
                        className="bg-white"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1 text-sm">
                        <span className="inline-flex items-center gap-2 text-brand-muted">
                          <MapPin className="h-3.5 w-3.5" />
                          Город
                        </span>
                        <Input value={navigationCity} onChange={(event) => setNavigationCity(event.target.value)} className="bg-white" />
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span className="inline-flex items-center gap-2 text-brand-muted">
                          <Wallet className="h-3.5 w-3.5" />
                          Бюджет (RUB)
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={navigationBudgetMax}
                          onChange={(event) => setNavigationBudgetMax(event.target.value)}
                          className="bg-white"
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                      <label className="block space-y-1 text-sm">
                        <span className="text-brand-muted">Top K</span>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={navigationTopK}
                          onChange={(event) => setNavigationTopK(event.target.value)}
                          className="bg-white"
                        />
                      </label>
                      <label className="mt-auto flex h-10 items-center gap-2 rounded-xl border border-brand-border bg-[#f7fbf2] px-3 text-sm text-brand-ink">
                        <input
                          type="checkbox"
                          checked={navigationPreferRemote}
                          onChange={(event) => setNavigationPreferRemote(event.target.checked)}
                        />
                        Предпочитаю remote
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        onClick={handleNavigationSubmit}
                        disabled={isPending || navigationObjective.trim().length < 3}
                        className="h-11 min-w-[220px] rounded-xl"
                      >
                        <Sparkles className="h-4 w-4" />
                        {isPending ? "Загрузка..." : "Получить рекомендации"}
                      </Button>
                      <span className="text-xs text-brand-muted">
                        Использует PATH-контекст из `HOME` автоматически
                      </span>
                    </div>

                    {navigationError ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {navigationError}
                      </p>
                    ) : null}
                  </div>
                </div>

                {navigationResult ? (
                  <div className="space-y-4 rounded-2xl border border-brand-border bg-white/70 p-4">
                    <div className="rounded-xl border border-brand-border bg-white p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                        <Sparkles className="h-3.5 w-3.5 text-brand-ink" />
                        Summary
                      </div>
                      <p className="text-sm text-brand-ink">{navigationResult.summary}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-brand-ink">Recommendations</p>
                        <Badge className="bg-white">{navigationResult.recommendations.length} шт.</Badge>
                      </div>
                      {navigationResult.recommendations.map((item, index) => (
                        <div key={item.specialistUserId} className="rounded-xl border border-brand-border bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-brand-border bg-[#edf4e5] px-2 text-xs font-semibold text-brand-ink">
                              {index + 1}
                            </span>
                            <p className="font-medium text-brand-ink">{item.nickname}</p>
                            <Badge>{item.category}</Badge>
                            <Badge>score {item.score.toFixed(2)}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-brand-muted">{item.rationale}</p>
                          {(item.contactTelegram || item.contactUrl) && (
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {item.contactTelegram ? (
                                <a
                                  className="inline-flex items-center rounded-lg border border-brand-border bg-white px-2 py-1 text-brand-muted hover:text-brand-ink"
                                  href={item.contactTelegram}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Telegram <ArrowRight className="ml-1 h-3 w-3" />
                                </a>
                              ) : null}
                              {item.contactUrl ? (
                                <a
                                  className="inline-flex items-center rounded-lg border border-brand-border bg-white px-2 py-1 text-brand-muted hover:text-brand-ink"
                                  href={item.contactUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Сайт <ArrowRight className="ml-1 h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-brand-ink">Next actions</p>
                        <Badge className="bg-white">{navigationResult.nextActions.length}</Badge>
                      </div>
                      <ul className="space-y-2 text-sm text-brand-muted">
                        {navigationResult.nextActions.map((action, index) => (
                          <li key={`${action.title}-${index}`} className="rounded-xl border border-brand-border bg-white p-3">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#edf4e5] text-[11px] font-semibold text-brand-ink">
                                {index + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-brand-ink">{action.title}</p>
                                  {typeof action.etaMinutes === "number" ? (
                                    <Badge className="bg-white">{action.etaMinutes} мин</Badge>
                                  ) : null}
                                </div>
                                <p>{action.description}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="space-y-4">
              <CardHeader>
                <CardTitle>AI Support</CardTitle>
                <CardDescription>Поддерживающий ответ по настроению и заметке (non-clinical).</CardDescription>
              </CardHeader>
              <div className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-brand-muted">Mood</span>
                  <Select value={supportMood} onChange={(event) => setSupportMood(event.target.value as typeof supportMood)}>
                    <option value="NORMAL">NORMAL</option>
                    <option value="TOUGH">TOUGH</option>
                    <option value="FLYING">FLYING</option>
                  </Select>
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-brand-muted">Заметка (опционально)</span>
                  <Textarea
                    rows={4}
                    value={supportNote}
                    onChange={(event) => setSupportNote(event.target.value)}
                    placeholder="Как проходит день, что тревожит или что получается"
                  />
                </label>
                <Button onClick={handleSupportSubmit} disabled={isPending}>
                  {isPending ? "Загрузка..." : "Получить ответ"}
                </Button>
                {supportError ? <p className="text-sm text-red-600">{supportError}</p> : null}
              </div>

              {supportResult ? (
                <div className="space-y-4 rounded-2xl border border-brand-border bg-white/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{supportResult.tone}</Badge>
                    <Badge>Escalation: {supportResult.escalation.level}</Badge>
                  </div>
                  <p className="text-sm text-brand-ink">{supportResult.responseText}</p>
                  <ul className="space-y-2 text-sm text-brand-muted">
                    {supportResult.suggestedSteps.map((step, index) => (
                      <li key={`${step}-${index}`} className="rounded-xl border border-brand-border bg-white p-3">
                        {step}
                      </li>
                    ))}
                  </ul>
                  {supportResult.escalation.resources.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-brand-ink">Resources</p>
                      <ul className="space-y-2 text-sm text-brand-muted">
                        {supportResult.escalation.resources.map((resource) => (
                          <li key={resource.url}>
                            <a className="underline" href={resource.url} target="_blank" rel="noreferrer">
                            {resource.title}
                          </a>
                        </li>
                      ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
