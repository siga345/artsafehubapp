"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

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
          <section className="app-glass p-4 md:p-6">
            <h1 className="text-3xl font-semibold tracking-tight text-brand-ink">AI ASSIST</h1>
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
            <Card className="space-y-4">
              <CardHeader>
                <CardTitle>AI Navigation</CardTitle>
                <CardDescription>Подбор специалистов и next actions по цели и PATH-контексту.</CardDescription>
              </CardHeader>
              <div className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-brand-muted">Цель</span>
                  <Input
                    value={navigationObjective}
                    onChange={(event) => setNavigationObjective(event.target.value)}
                    placeholder="Нужен звукорежиссер для сведения демо"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span className="text-brand-muted">Город (опционально)</span>
                    <Input value={navigationCity} onChange={(event) => setNavigationCity(event.target.value)} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-brand-muted">Макс. бюджет (RUB)</span>
                    <Input
                      type="number"
                      min={0}
                      value={navigationBudgetMax}
                      onChange={(event) => setNavigationBudgetMax(event.target.value)}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span className="text-brand-muted">Top K</span>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={navigationTopK}
                      onChange={(event) => setNavigationTopK(event.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm text-brand-ink">
                    <input
                      type="checkbox"
                      checked={navigationPreferRemote}
                      onChange={(event) => setNavigationPreferRemote(event.target.checked)}
                    />
                    Предпочитаю remote
                  </label>
                </div>
                <Button onClick={handleNavigationSubmit} disabled={isPending || navigationObjective.trim().length < 3}>
                  {isPending ? "Загрузка..." : "Получить рекомендации"}
                </Button>
                {navigationError ? <p className="text-sm text-red-600">{navigationError}</p> : null}
              </div>

              {navigationResult ? (
                <div className="space-y-4 rounded-2xl border border-brand-border bg-white/70 p-4">
                  <p className="text-sm text-brand-ink">{navigationResult.summary}</p>
                  <div className="space-y-3">
                    {navigationResult.recommendations.map((item) => (
                      <div key={item.specialistUserId} className="rounded-xl border border-brand-border bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-brand-ink">{item.nickname}</p>
                          <Badge>{item.category}</Badge>
                          <Badge>score {item.score.toFixed(2)}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-brand-muted">{item.rationale}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-brand-muted">
                          {item.contactTelegram ? (
                            <a className="underline" href={item.contactTelegram} target="_blank" rel="noreferrer">
                              Telegram
                            </a>
                          ) : null}
                          {item.contactUrl ? (
                            <a className="underline" href={item.contactUrl} target="_blank" rel="noreferrer">
                              Сайт
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-brand-ink">Next actions</p>
                    <ul className="space-y-2 text-sm text-brand-muted">
                      {navigationResult.nextActions.map((action, index) => (
                        <li key={`${action.title}-${index}`} className="rounded-xl border border-brand-border bg-white p-3">
                          <p className="font-medium text-brand-ink">{action.title}</p>
                          <p>{action.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
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
