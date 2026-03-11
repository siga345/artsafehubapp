"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ListMusic, Sparkles, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ensureArtistWorldVisualBoards } from "@/lib/artist-growth";
import { apiFetch, readApiErrorMessage } from "@/lib/client-fetch";

type OnboardingAnswers = {
  artistName: string;
  artistAge: string;
  nickname: string;
  artistCity: string;
  favoriteArtist1: string;
  favoriteArtist2: string;
  favoriteArtist3: string;
  lifeValues: string;
  musicAspirations: string;
  teamPreference: "solo" | "team" | "both" | "";
  playlistUrl: string;
};

type VisualBoardDraft = {
  id: string;
  slug: string;
  name: string;
  images: Array<{ id: string; imageUrl: string }>;
};

const STEPS = [
  {
    title: "Основа",
    description: "Собери базовые данные, с которых начинается мир артиста."
  },
  {
    title: "Опоры",
    description: "Зафиксируй свои референсы, ценности и направление в музыке."
  },
  {
    title: "Визуал",
    description: "Заполни два канонических визуальных борда. Этот шаг можно пропустить."
  },
  {
    title: "Плейлист",
    description: "Оставь внешнюю ссылку на плейлист референсов. Этот шаг можно пропустить."
  }
] as const;

const teamOptions = [
  { value: "solo" as const, label: "Одиночка", description: "Чаще двигаюсь самостоятельно" },
  { value: "team" as const, label: "Команда", description: "Люблю работать в связке" },
  { value: "both" as const, label: "И так, и так", description: "Могу и сам, и в команде" }
];

function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultBoards(): VisualBoardDraft[] {
  return ensureArtistWorldVisualBoards().map((board) => ({
    id: board.slug,
    slug: board.slug,
    name: board.name,
    images: []
  }));
}

function isStepValid(step: number, answers: OnboardingAnswers) {
  switch (step) {
    case 0: {
      const age = Number.parseInt(answers.artistAge, 10);
      return (
        answers.artistName.trim().length > 0 &&
        !Number.isNaN(age) &&
        age >= 10 &&
        age <= 100 &&
        answers.nickname.trim().length > 0 &&
        answers.artistCity.trim().length > 0
      );
    }
    case 1:
      return (
        answers.favoriteArtist1.trim().length > 0 &&
        answers.favoriteArtist2.trim().length > 0 &&
        answers.favoriteArtist3.trim().length > 0 &&
        answers.lifeValues.trim().length > 0 &&
        answers.musicAspirations.trim().length > 0 &&
        answers.teamPreference.length > 0
      );
    default:
      return true;
  }
}

const boardDescriptions: Record<string, string> = {
  aesthetics: "Атмосфера, цвета, фактуры, настроение, кадры и пространства.",
  fashion: "Одежда, силуэты, аксессуары, стайлинг и сценический образ."
};

export function ArtistWorldOnboarding(props: { onComplete: () => void }) {
  const toast = useToast();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    artistName: "",
    artistAge: "",
    nickname: "",
    artistCity: "",
    favoriteArtist1: "",
    favoriteArtist2: "",
    favoriteArtist3: "",
    lifeValues: "",
    musicAspirations: "",
    teamPreference: "",
    playlistUrl: ""
  });
  const [visualBoards, setVisualBoards] = useState<VisualBoardDraft[]>(createDefaultBoards);

  const currentStep = STEPS[step];
  const canContinue = isStepValid(step, answers);
  const isLastStep = step === STEPS.length - 1;
  const completion = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  async function uploadBoardImage(boardSlug: string, file: File) {
    setUploadingImage(true);
    setSubmitError("");

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("kind", "board_image");

      const response = await apiFetch("/api/id/world/assets", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось загрузить изображение."));
      }

      const payload = (await response.json()) as { url: string };
      setVisualBoards((current) =>
        current.map((board) =>
          board.slug === boardSlug
            ? {
                ...board,
                images: [...board.images, { id: createClientId("img"), imageUrl: payload.url }]
              }
            : board
        )
      );
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось загрузить изображение.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit() {
    if (!isStepValid(0, answers) || !isStepValid(1, answers)) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await apiFetch("/api/id/world/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: answers.artistName.trim(),
          artistAge: Number.parseInt(answers.artistAge, 10),
          nickname: answers.nickname.trim(),
          artistCity: answers.artistCity.trim(),
          favoriteArtists: [
            answers.favoriteArtist1.trim(),
            answers.favoriteArtist2.trim(),
            answers.favoriteArtist3.trim()
          ],
          lifeValues: answers.lifeValues.trim(),
          musicAspirations: answers.musicAspirations.trim(),
          teamPreference: answers.teamPreference,
          playlistUrl: answers.playlistUrl.trim() || null,
          visualBoards: visualBoards.map((board) => ({
            slug: board.slug,
            name: board.name,
            images: board.images.map((image) => ({ imageUrl: image.imageUrl }))
          }))
        })
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось создать мир."));
      }

      toast.success("Мир артиста создан.");
      props.onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка при создании мира.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderStep() {
    if (step === 0) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Как тебя зовут?</label>
            <Input
              value={answers.artistName}
              onChange={(event) => setAnswers((current) => ({ ...current, artistName: event.target.value }))}
              placeholder="Имя"
              className="bg-white"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Сколько тебе лет?</label>
            <Input
              type="number"
              min={10}
              max={100}
              value={answers.artistAge}
              onChange={(event) => setAnswers((current) => ({ ...current, artistAge: event.target.value }))}
              placeholder="Возраст"
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Твой сценический псевдоним?</label>
            <Input
              value={answers.nickname}
              onChange={(event) => setAnswers((current) => ({ ...current, nickname: event.target.value }))}
              placeholder="Псевдоним"
              className="bg-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">В каком городе ты живёшь?</label>
            <Input
              value={answers.artistCity}
              onChange={(event) => setAnswers((current) => ({ ...current, artistCity: event.target.value }))}
              placeholder="Город"
              className="bg-white"
            />
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Три твоих любимых артиста?</label>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={answers.favoriteArtist1}
                onChange={(event) => setAnswers((current) => ({ ...current, favoriteArtist1: event.target.value }))}
                placeholder="Артист 1"
                className="bg-white"
                autoFocus
              />
              <Input
                value={answers.favoriteArtist2}
                onChange={(event) => setAnswers((current) => ({ ...current, favoriteArtist2: event.target.value }))}
                placeholder="Артист 2"
                className="bg-white"
              />
              <Input
                value={answers.favoriteArtist3}
                onChange={(event) => setAnswers((current) => ({ ...current, favoriteArtist3: event.target.value }))}
                placeholder="Артист 3"
                className="bg-white"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
                Что для тебя самое ценное в жизни прямо сейчас?
              </label>
              <Textarea
                value={answers.lifeValues}
                onChange={(event) => setAnswers((current) => ({ ...current, lifeValues: event.target.value }))}
                placeholder="Что для тебя важно и к чему ты стремишься как человек"
                className="min-h-[156px] bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">К чему ты стремишься в музыке?</label>
              <Textarea
                value={answers.musicAspirations}
                onChange={(event) => setAnswers((current) => ({ ...current, musicAspirations: event.target.value }))}
                placeholder="Твоя цель в музыке"
                className="min-h-[156px] bg-white"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
              Ты одиночка или любишь работать в команде?
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {teamOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAnswers((current) => ({ ...current, teamPreference: option.value }))}
                  className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                    answers.teamPreference === option.value
                      ? "border-[#4b6440] bg-[#eef6e2]"
                      : "border-brand-border bg-white hover:bg-[#f3f8ea]"
                  }`}
                >
                  <p className="text-sm font-medium text-brand-ink">{option.label}</p>
                  <p className="mt-1 text-xs text-brand-muted">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#d8e2cc] bg-[#f5faeb] px-4 py-3 text-sm text-[#4b6440]">
            Визуальный шаг можно пропустить, но мир будет сильнее, если ты добавишь хотя бы несколько референсов.
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {visualBoards.map((board) => (
              <div key={board.slug} className="space-y-3 rounded-[22px] border border-brand-border bg-white/85 p-4">
                <div>
                  <p className="text-sm font-medium text-brand-ink">{board.name}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {boardDescriptions[board.slug] ?? "Собери изображения, которые помогают держать образ в фокусе."}
                  </p>
                </div>

                {board.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {board.images.map((image) => (
                      <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-brand-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setVisualBoards((current) =>
                              current.map((item) =>
                                item.slug === board.slug
                                  ? { ...item, images: item.images.filter((img) => img.id !== image.id) }
                                  : item
                              )
                            )
                          }
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-brand-border bg-[#f7faf2] text-sm text-brand-muted">
                    Пока нет изображений
                  </div>
                )}

                <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingImage ? "Загружаем..." : "Добавить изображение"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      await uploadBoardImage(board.slug, file);
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#d8e2cc] bg-[#f5faeb] px-4 py-3 text-sm text-[#4b6440]">
          Плейлист не хранится у нас внутри. Мы оставляем только внешнюю ссылку, чтобы ты мог открыть свои музыкальные референсы в один клик.
        </div>

        <div className="space-y-2 rounded-[24px] border border-brand-border bg-white/85 p-4">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Ссылка на плейлист референсов</label>
          <div className="relative">
            <ListMusic className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <Input
              value={answers.playlistUrl}
              onChange={(event) => setAnswers((current) => ({ ...current, playlistUrl: event.target.value }))}
              placeholder="https://music.yandex.ru/users/.../playlists/..."
              className="bg-white pl-9"
              autoFocus
            />
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex min-h-[68vh] flex-col items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#cbdab8] bg-[#f5faeb]">
            <Sparkles className="h-9 w-9 text-[#4b6440]" />
          </div>
          <h1 className="text-3xl font-semibold text-brand-ink">Создай свой мир артиста</h1>
          <p className="mt-3 text-base leading-7 text-brand-muted">
            Сначала соберём текстовую основу, затем визуал и плейлист. После этого у тебя появится цельная структура мира артиста внутри SAFE ID.
          </p>
          <Button className="mt-8 rounded-xl px-8 py-3 text-base" onClick={() => setStarted(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Создать свой мир
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[68vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl rounded-[32px] border border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(244,249,237,0.98)_100%)] p-5 shadow-[0_24px_60px_rgba(59,77,49,0.12)] md:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-muted">Мир артиста</p>
            <h2 className="mt-2 text-2xl font-semibold text-brand-ink md:text-3xl">{currentStep.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">{currentStep.description}</p>
          </div>
          <div className="rounded-2xl border border-[#d8e2cc] bg-white/80 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Шаг</p>
            <p className="mt-1 text-lg font-semibold text-brand-ink">
              {step + 1} / {STEPS.length}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="h-2 overflow-hidden rounded-full bg-[#e2ead8]">
            <div className="h-full rounded-full bg-[#4b6440] transition-all" style={{ width: `${completion}%` }} />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {STEPS.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-2xl border px-3 py-2 text-left ${
                  index === step
                    ? "border-[#4b6440] bg-[#eef6e2]"
                    : index < step
                      ? "border-[#cbdab8] bg-[#f6faef]"
                      : "border-brand-border bg-white/70"
                }`}
              >
                <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">{index + 1}</p>
                <p className="mt-1 text-sm font-medium text-brand-ink">{item.title}</p>
              </div>
            ))}
          </div>
        </div>

        {renderStep()}

        {submitError ? (
          <div className="mt-4 rounded-2xl border border-[#e6c7c2] bg-[#fff4f2] px-4 py-3 text-sm text-[#9a3e33]">
            {submitError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || submitting || uploadingImage}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>

          <div className="flex flex-wrap gap-3">
            {!isLastStep ? (
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => setStep((current) => current + 1)}
                disabled={!canContinue || submitting || uploadingImage}
              >
                {step === 2 ? "Пропустить или продолжить" : "Продолжить"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => void handleSubmit()}
                disabled={submitting || uploadingImage}
              >
                {submitting ? "Создаём..." : "Создать мир"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
