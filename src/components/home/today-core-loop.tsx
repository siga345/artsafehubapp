"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Music4, MoonStar, Sunrise } from "lucide-react";

import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendationSource } from "@/contracts/recommendations";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { buildRecommendationCard } from "@/lib/recommendations";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { apiFetch, readApiErrorMessage } from "@/lib/client-fetch";

export type Mood = "NORMAL" | "TOUGH" | "FLYING";

export type TodayCoreLoopData = {
  focus: {
    id: string;
    focusNote: string | null;
    track: {
      id: string;
      title: string;
      workbenchState: string;
      workbenchStateLabel: string;
      pathStage: { id: number; name: string } | null;
      intentSummary: string | null;
      project: { id: string; title: string } | null;
      activeNextStep: {
        id: string;
        text: string;
        reason: string | null;
        status: string;
        source: RecommendationSource;
        origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
      } | null;
    };
    nextStep: {
      id: string;
      text: string;
      reason: string | null;
      status: string;
      source: RecommendationSource;
      origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
    } | null;
  } | null;
  wrapUp: {
    id: string;
    trackId: string;
    endState: string;
    endStateLabel: string;
    whatChanged: string;
    whatNotWorking: string | null;
    nextStep: {
      id: string;
      text: string;
      reason: string | null;
      status: string;
      source: RecommendationSource;
      origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
    } | null;
  } | null;
  activeTracks: Array<{
    id: string;
    title: string;
    workbenchState: string;
    workbenchStateLabel: string;
    pathStage: { id: number; name: string } | null;
    intentSummary: string | null;
    project: { id: string; title: string } | null;
    activeNextStep: {
      id: string;
      text: string;
      reason: string | null;
      status: string;
      source: RecommendationSource;
      origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
    } | null;
  }>;
};

type Props = {
  checkIn: { mood: Mood; note: string | null } | null;
  dayLoop: TodayCoreLoopData | null;
  onRefresh: () => Promise<unknown>;
  className?: string;
};

const moodLabels: Record<Mood, string> = {
  FLYING: "Лечу",
  NORMAL: "Норм",
  TOUGH: "Сложно"
};

const workbenchStateOptions = [
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "STUCK", label: "Застрял" },
  { value: "NEEDS_FEEDBACK", label: "Нужен фидбек" },
  { value: "DEFERRED", label: "Отложен" },
  { value: "READY_FOR_NEXT_STEP", label: "Готов к следующему шагу" }
];

export function TodayCoreLoop({ checkIn, dayLoop, onRefresh, className }: Props) {
  const toast = useToast();
  const [actionError, setActionError] = useState("");
  const [mood, setMood] = useState<Mood>(checkIn?.mood ?? "NORMAL");
  const [checkInNote, setCheckInNote] = useState(checkIn?.note ?? "");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [focusNote, setFocusNote] = useState("");
  const [morningNextStepTitle, setMorningNextStepTitle] = useState("");
  const [morningNextStepDetail, setMorningNextStepDetail] = useState("");
  const [wrapState, setWrapState] = useState("READY_FOR_NEXT_STEP");
  const [wrapChanged, setWrapChanged] = useState("");
  const [wrapNotWorking, setWrapNotWorking] = useState("");
  const [wrapNextTitle, setWrapNextTitle] = useState("");
  const [wrapNextDetail, setWrapNextDetail] = useState("");
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [savingFocus, setSavingFocus] = useState(false);
  const [savingWrapUp, setSavingWrapUp] = useState(false);

  useEffect(() => {
    setMood(checkIn?.mood ?? "NORMAL");
    setCheckInNote(checkIn?.note ?? "");
  }, [checkIn?.mood, checkIn?.note]);

  useEffect(() => {
    const defaultTrackId = dayLoop?.focus?.track.id ?? dayLoop?.activeTracks[0]?.id ?? "";
    setSelectedTrackId((current) => (current && dayLoop?.activeTracks.some((track) => track.id === current) ? current : defaultTrackId));
    setFocusNote(dayLoop?.focus?.focusNote ?? "");
  }, [dayLoop?.activeTracks, dayLoop?.focus?.focusNote, dayLoop?.focus?.track.id]);

  useEffect(() => {
    if (!dayLoop?.wrapUp) return;
    setWrapState(dayLoop.wrapUp.endState);
    setWrapChanged(dayLoop.wrapUp.whatChanged);
    setWrapNotWorking(dayLoop.wrapUp.whatNotWorking ?? "");
    setWrapNextTitle(dayLoop.wrapUp.nextStep?.text ?? "");
    setWrapNextDetail(dayLoop.wrapUp.nextStep?.reason ?? "");
  }, [dayLoop?.wrapUp]);

  const selectedTrack = useMemo(
    () => dayLoop?.activeTracks.find((track) => track.id === selectedTrackId) ?? null,
    [dayLoop?.activeTracks, selectedTrackId]
  );
  const focusedTrack = dayLoop?.focus?.track ?? selectedTrack ?? null;
  const focusedNextStep = dayLoop?.focus?.nextStep ?? selectedTrack?.activeNextStep ?? null;

  function buildTodayNextStepRecommendation(
    step: NonNullable<TodayCoreLoopData["activeTracks"][number]["activeNextStep"]>,
    title: string,
    trackId: string
  ) {
    return buildRecommendationCard({
      key: `songs:next-step:${step.id}`,
      surface: "TODAY",
      kind: "NEXT_STEP",
      source: step.source,
      title,
      text: step.text,
      reason: step.reason,
      primaryAction: {
        label: "Открыть трек в Songs",
        href: `/songs/${trackId}`,
        action: "NAVIGATE"
      },
      secondaryActions: [],
      entityRef: {
        type: "track_next_step",
        id: step.id
      },
      futureAiSlotKey: step.id
    });
  }

  async function saveCheckIn() {
    setSavingCheckIn(true);
    setActionError("");
    try {
      const response = await apiFetch("/api/home/check-in", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          note: checkInNote.trim() || null
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось сохранить check-in."));
      }
      await onRefresh();
      toast.success("Состояние дня сохранено.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось сохранить check-in.");
    } finally {
      setSavingCheckIn(false);
    }
  }

  async function saveMorningFocus() {
    if (!selectedTrack) {
      setActionError("Сначала выбери трек для фокуса.");
      return;
    }

    if (!selectedTrack.activeNextStep && !morningNextStepTitle.trim()) {
      setActionError("Укажи следующий шаг для выбранного трека.");
      return;
    }

    setSavingFocus(true);
    setActionError("");
    try {
      const response = await apiFetch("/api/home/track-focus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: selectedTrack.id,
          nextStepId: selectedTrack.activeNextStep?.id ?? null,
          focusNote: focusNote.trim() || null,
          createNextStep: selectedTrack.activeNextStep
            ? undefined
            : {
                text: morningNextStepTitle.trim(),
                reason: morningNextStepDetail.trim() || null
              }
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось зафиксировать фокус."));
      }
      setMorningNextStepTitle("");
      setMorningNextStepDetail("");
      await onRefresh();
      toast.success("Утренний фокус сохранён.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось зафиксировать фокус.");
    } finally {
      setSavingFocus(false);
    }
  }

  async function saveWrapUp() {
    const track = dayLoop?.focus?.track ?? selectedTrack;
    if (!track) {
      setActionError("Сначала закрепи трек в утреннем фокусе.");
      return;
    }
    if (!wrapChanged.trim()) {
      setActionError("Опиши, что изменилось за день.");
      return;
    }
    if (!wrapNextTitle.trim()) {
      setActionError("Укажи следующий шаг, который останется после завершения дня.");
      return;
    }

    setSavingWrapUp(true);
    setActionError("");
    try {
      const response = await apiFetch("/api/home/wrap-up", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: track.id,
          focusId: dayLoop?.focus?.id ?? null,
          endState: wrapState,
          whatChanged: wrapChanged.trim(),
          whatNotWorking: wrapNotWorking.trim() || null,
          nextStep: {
            text: wrapNextTitle.trim(),
            reason: wrapNextDetail.trim() || null
          }
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось завершить день."));
      }
      await onRefresh();
      toast.success("Завершение дня сохранено.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось завершить день.");
    } finally {
      setSavingWrapUp(false);
    }
  }

  return (
    <div className={className ?? ""}>
      {actionError ? <InlineActionMessage className="mb-4" message={actionError} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-4">
          <CardHeader className="mb-0">
            <div className="flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-brand-muted" />
              <CardTitle className="text-xl">Утренний фокус</CardTitle>
            </div>
            <CardDescription>Состояние дня, один трек и один следующий шаг.</CardDescription>
          </CardHeader>

          <div className="flex flex-wrap gap-2">
            {(["FLYING", "NORMAL", "TOUGH"] as Mood[]).map((item) => (
              <Button key={item} variant={mood === item ? "primary" : "secondary"} onClick={() => setMood(item)}>
                {moodLabels[item]}
              </Button>
            ))}
          </div>

          <Textarea
            value={checkInNote}
            onChange={(event) => setCheckInNote(event.target.value)}
            placeholder="Что помогает или мешает сегодня?"
            className="min-h-[96px]"
          />

          <Select value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)}>
            <option value="">Выбери трек</option>
            {(dayLoop?.activeTracks ?? []).map((track) => (
              <option key={track.id} value={track.id}>
                {track.title} • {track.workbenchStateLabel}
              </option>
            ))}
          </Select>

          {selectedTrack ? (
            <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
              <p className="text-sm font-medium text-brand-ink">{selectedTrack.title}</p>
              <p className="mt-1 text-xs text-brand-muted">
                {selectedTrack.project?.title ?? "Без проекта"}
                {selectedTrack.pathStage ? ` • ${selectedTrack.pathStage.name}` : ""}
              </p>
              {selectedTrack.intentSummary ? <p className="mt-2 text-sm text-brand-muted">{selectedTrack.intentSummary}</p> : null}
              {selectedTrack.activeNextStep ? (
                <RecommendationCard
                  className="mt-3 bg-[#f7fbf2]"
                  recommendation={buildTodayNextStepRecommendation(
                    selectedTrack.activeNextStep,
                    "Текущий next step",
                    selectedTrack.id
                  )}
                />
              ) : (
                <div className="mt-3 space-y-2">
                  <Input
                    value={morningNextStepTitle}
                    onChange={(event) => setMorningNextStepTitle(event.target.value)}
                    placeholder="Следующий шаг по треку"
                  />
                  <Textarea
                    value={morningNextStepDetail}
                    onChange={(event) => setMorningNextStepDetail(event.target.value)}
                    placeholder="Деталь шага, если нужна"
                    className="min-h-[88px]"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted">
              Пока нет выбранного трека. Открой Songs и создай хотя бы один рабочий трек.
            </div>
          )}

          <Textarea
            value={focusNote}
            onChange={(event) => setFocusNote(event.target.value)}
            placeholder="Короткая пометка, на что держать внимание сегодня"
            className="min-h-[88px]"
          />

          <div className="flex flex-wrap gap-2">
            <Button disabled={savingCheckIn} onClick={() => void saveCheckIn()}>
              {savingCheckIn ? "Сохраняю..." : "Сохранить check-in"}
            </Button>
            <Button disabled={savingFocus} onClick={() => void saveMorningFocus()}>
              {savingFocus ? "Фиксирую..." : "Зафиксировать фокус"}
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <CardHeader className="mb-0">
            <div className="flex items-center gap-2">
              <Music4 className="h-4 w-4 text-brand-muted" />
              <CardTitle className="text-xl">Работа</CardTitle>
            </div>
            <CardDescription>Текущий трек и его активный шаг прямо из Today.</CardDescription>
          </CardHeader>

          {focusedTrack ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-brand-ink">{focusedTrack.title}</p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {focusedTrack.project?.title ?? "Без проекта"}
                      {focusedTrack.pathStage ? ` • ${focusedTrack.pathStage.name}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-brand-border bg-white px-3 py-1 text-xs text-brand-ink">
                    {focusedTrack.workbenchStateLabel}
                  </span>
                </div>
                {focusedTrack.intentSummary ? <p className="mt-3 text-sm text-brand-muted">{focusedTrack.intentSummary}</p> : null}
              </div>

              <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">Следующий шаг</p>
                {focusedNextStep ? (
                  <RecommendationCard
                    className="mt-2 bg-white/60"
                    recommendation={buildTodayNextStepRecommendation(
                      focusedNextStep,
                      "Следующий шаг",
                      focusedTrack.id
                    )}
                  />
                ) : (
                  <p className="mt-2 text-sm text-brand-muted">У этого трека ещё нет активного next step.</p>
                )}
              </div>

              <Link href={`/songs/${focusedTrack.id}`}>
                <Button className="w-full justify-between">
                  Открыть трек в Songs
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted">
              Рабочий трек появится здесь после утренней фиксации фокуса.
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <CardHeader className="mb-0">
            <div className="flex items-center gap-2">
              <MoonStar className="h-4 w-4 text-brand-muted" />
              <CardTitle className="text-xl">Завершение дня</CardTitle>
            </div>
            <CardDescription>Что изменилось сегодня и что стало следующим шагом.</CardDescription>
          </CardHeader>

          <Select value={wrapState} onChange={(event) => setWrapState(event.target.value)}>
            {workbenchStateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Textarea
            value={wrapChanged}
            onChange={(event) => setWrapChanged(event.target.value)}
            placeholder="Что изменилось по треку за день"
            className="min-h-[96px]"
          />
          <Textarea
            value={wrapNotWorking}
            onChange={(event) => setWrapNotWorking(event.target.value)}
            placeholder="Что не устроило или где застрял"
            className="min-h-[88px]"
          />
          <Input
            value={wrapNextTitle}
            onChange={(event) => setWrapNextTitle(event.target.value)}
            placeholder="Следующий шаг на завтра"
          />
          <Textarea
            value={wrapNextDetail}
            onChange={(event) => setWrapNextDetail(event.target.value)}
            placeholder="Деталь следующего шага"
            className="min-h-[88px]"
          />

          <Button disabled={savingWrapUp} onClick={() => void saveWrapUp()}>
            {savingWrapUp ? "Завершаю..." : "Завершить день"}
          </Button>

          {dayLoop?.wrapUp?.nextStep ? (
            <div className="rounded-2xl border border-emerald-300/60 bg-[#edf8f0] p-4 text-[#2c6a40]">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Следующий шаг сохранён
              </div>
              <RecommendationCard
                className="mt-3 border-emerald-200/70 bg-white/70"
                recommendation={buildTodayNextStepRecommendation(
                  dayLoop.wrapUp.nextStep,
                  "Next step на завтра",
                  dayLoop.wrapUp.trackId
                )}
              />
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
