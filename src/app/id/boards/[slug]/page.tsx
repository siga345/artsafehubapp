"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ImagePlus, Link2, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureArtistWorldVisualBoards,
  type ArtistWorldVisualBoardSlug
} from "@/lib/artist-growth";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";

type VisualBoardDraft = {
  id: string;
  slug: ArtistWorldVisualBoardSlug;
  name: string;
  sourceUrl: string;
  images: Array<{ id: string; imageUrl: string }>;
};

type IdProfile = {
  artistWorld: {
    visualDirection: string | null;
    aestheticKeywords: string[];
    fashionSignals: string[];
    visualBoards: Array<{
      id: string;
      slug: ArtistWorldVisualBoardSlug;
      name: string;
      sourceUrl: string | null;
      images: Array<{ id: string; imageUrl: string }>;
    }>;
  };
};

type SaveState = "idle" | "saving" | "saved" | "error";

const boardMeta = {
  aesthetics: {
    title: "Эстетика",
    description: "Расширенный board для атмосферы, фактур, света, пространства и общего mood.",
    placeholder: "По одному коду на строку",
    emptyLabel: "Загрузи первые кадры, чтобы board начал читаться.",
    sourceHint: "Сюда можно вставить ссылку на Pinterest board или любой внешний moodboard."
  },
  fashion: {
    title: "Фэшн",
    description: "Собери силуэты, одежду, детали и сценический образ в одном board.",
    placeholder: "По одному сигналу образа на строку",
    emptyLabel: "Загрузи первые образы и предметы, чтобы board ожил.",
    sourceHint: "Можно хранить ссылку на Pinterest, Are.na или другой board с образами."
  }
} as const satisfies Record<
  ArtistWorldVisualBoardSlug,
  {
    title: string;
    description: string;
    placeholder: string;
    emptyLabel: string;
    sourceHint: string;
  }
>;

function joinLines(values: string[] | undefined) {
  return Array.isArray(values) ? values.join("\n") : "";
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

function saveStatusLabel(saveState: SaveState, saveError: string) {
  if (saveState === "saving") return "Сохраняем";
  if (saveState === "saved") return "Сохранено";
  if (saveState === "error") return saveError || "Ошибка сохранения";
  return "Изменения сохраняются автоматически";
}

export default function ArtistWorldBoardPage({ params }: { params: { slug: string } }) {
  const slug = params.slug === "aesthetics" || params.slug === "fashion" ? params.slug : null;
  const { data } = useQuery({
    queryKey: ["id-profile", "board-detail"],
    queryFn: () => fetcher<IdProfile | null>("/api/id"),
    refetchOnWindowFocus: false
  });

  const [initialized, setInitialized] = useState(false);
  const [visualDirection, setVisualDirection] = useState("");
  const [aestheticKeywords, setAestheticKeywords] = useState("");
  const [fashionSignals, setFashionSignals] = useState("");
  const [visualBoards, setVisualBoards] = useState<VisualBoardDraft[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const hydrationRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const latestSaveTokenRef = useRef(0);
  const lastSavedPayloadRef = useRef("");

  useEffect(() => {
    if (!data || initialized) return;

    hydrationRef.current = true;
    setVisualDirection(data.artistWorld.visualDirection ?? "");
    setAestheticKeywords(joinLines(data.artistWorld.aestheticKeywords));
    setFashionSignals(joinLines(data.artistWorld.fashionSignals));
    setVisualBoards(
      ensureArtistWorldVisualBoards(data.artistWorld.visualBoards).map((board) => ({
        id: board.id ?? board.slug,
        slug: board.slug,
        name: board.name,
        sourceUrl: board.sourceUrl ?? "",
        images: board.images.map((image) => ({
          id: image.id ?? createClientId("img"),
          imageUrl: image.imageUrl
        }))
      }))
    );
    setInitialized(true);
  }, [data, initialized]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const autosavePayload = useMemo(
    () => ({
      artistWorld: {
        visualDirection: visualDirection.trim() || null,
        aestheticKeywords: splitLines(aestheticKeywords),
        fashionSignals: splitLines(fashionSignals),
        visualBoards: visualBoards.map((board) => ({
          id: board.id,
          slug: board.slug,
          name: board.name,
          sourceUrl: board.sourceUrl.trim() || null,
          images: board.images.map((image) => ({
            id: image.id,
            imageUrl: image.imageUrl
          }))
        }))
      }
    }),
    [aestheticKeywords, fashionSignals, visualBoards, visualDirection]
  );

  const serializedAutosavePayload = useMemo(() => JSON.stringify(autosavePayload), [autosavePayload]);

  const persistPayload = useCallback(
    async (serializedPayload = serializedAutosavePayload) => {
      if (!initialized || serializedPayload === lastSavedPayloadRef.current) return;

      const saveToken = ++latestSaveTokenRef.current;
      setSaveState("saving");
      setSaveError("");

      try {
        const response = await apiFetch("/api/id", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: serializedPayload
        });

        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, "Не удалось сохранить board."));
        }

        if (saveToken !== latestSaveTokenRef.current) return;

        lastSavedPayloadRef.current = serializedPayload;
        setSaveState("saved");
      } catch (error) {
        if (saveToken !== latestSaveTokenRef.current) return;
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Не удалось сохранить board.");
      }
    },
    [initialized, serializedAutosavePayload]
  );

  async function flushAutosave() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    await persistPayload(serializedAutosavePayload);
  }

  useEffect(() => {
    if (!initialized) return;

    if (hydrationRef.current) {
      lastSavedPayloadRef.current = serializedAutosavePayload;
      hydrationRef.current = false;
      setSaveState("idle");
      return;
    }

    if (serializedAutosavePayload === lastSavedPayloadRef.current) return;

    setSaveState("saving");
    setSaveError("");

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persistPayload(serializedAutosavePayload);
    }, 700);
  }, [initialized, persistPayload, serializedAutosavePayload]);

  async function uploadWorldAsset(file: File) {
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
    return payload.url;
  }

  const board = slug ? visualBoards.find((item) => item.slug === slug) ?? null : null;

  if (!slug) {
    return (
      <div className="pb-8">
        <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,237,0.92)_100%)]">
          <CardHeader>
            <CardTitle className="text-2xl">Board не найден</CardTitle>
            <CardDescription>Доступны только `aesthetics` и `fashion`.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data === undefined || !board) {
    return (
      <div className="pb-8">
        <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,237,0.92)_100%)]">
          <CardHeader>
            <CardTitle className="text-2xl">{boardMeta[slug].title}</CardTitle>
            <CardDescription>Загружаем board.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/id" className="text-sm font-medium text-brand-muted underline-offset-4 hover:underline">
            Назад в Мир артиста
          </Link>
          <h1 className="mt-2 text-3xl font-semibold text-brand-ink">{boardMeta[slug].title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">{boardMeta[slug].description}</p>
        </div>

        <div className="rounded-full border border-brand-border bg-white px-4 py-2 text-sm text-brand-muted">
          {saveStatusLabel(saveState, saveError)}
        </div>
      </div>

      {saveState === "error" ? <InlineActionMessage message={saveError} onRetry={() => void flushAutosave()} /> : null}

      <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(244,249,237,0.92)_100%)]">
        <CardHeader>
          <CardTitle className="text-2xl">Moodboard</CardTitle>
          <CardDescription>{boardMeta[slug].sourceHint}</CardDescription>
        </CardHeader>

        <div className="space-y-4 px-6 pb-6">
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <Input
              value={board.sourceUrl}
              onChange={(event) =>
                setVisualBoards((current) =>
                  current.map((item) => (item.slug === slug ? { ...item, sourceUrl: event.target.value } : item))
                )
              }
              onBlur={() => void flushAutosave()}
              placeholder="https://www.pinterest.com/..."
              className="bg-white pl-9"
            />
          </div>

          {board.sourceUrl.trim() ? (
            <a
              href={board.sourceUrl.trim()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#cbdab8] bg-[#f5faeb] px-4 py-3 text-sm font-medium text-[#4b6440] transition-colors hover:bg-[#ecf4df]"
            >
              Открыть внешний moodboard
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}

          {slug === "aesthetics" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Визуальное направление</label>
                <Input
                  value={visualDirection}
                  onChange={(event) => setVisualDirection(event.target.value)}
                  onBlur={() => void flushAutosave()}
                  placeholder="Например: dream-noir, холодный урбан, глянцевый raw"
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Эстетические коды</label>
                <Textarea
                  value={aestheticKeywords}
                  onChange={(event) => setAestheticKeywords(event.target.value)}
                  onBlur={() => void flushAutosave()}
                  placeholder={boardMeta.aesthetics.placeholder}
                  className="min-h-[140px] bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Сигналы образа</label>
              <Textarea
                value={fashionSignals}
                onChange={(event) => setFashionSignals(event.target.value)}
                onBlur={() => void flushAutosave()}
                placeholder={boardMeta.fashion.placeholder}
                className="min-h-[160px] bg-white"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
              {uploadingImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
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

                  setUploadingImage(true);
                  try {
                    const imageUrl = await uploadWorldAsset(file);
                    setVisualBoards((current) =>
                      current.map((item) =>
                        item.slug === slug
                          ? {
                              ...item,
                              images: [...item.images, { id: createClientId("img"), imageUrl }]
                            }
                          : item
                      )
                    );
                  } catch (error) {
                    setSaveState("error");
                    setSaveError(error instanceof Error ? error.message : "Не удалось загрузить изображение.");
                  } finally {
                    setUploadingImage(false);
                  }
                }}
              />
            </label>
            <p className="text-xs text-brand-muted">Изображения сохраняются внутри board и сразу попадают в summary на основном полотне.</p>
          </div>

          {board.images.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {board.images.map((image) => (
                <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white">
                  <div className="aspect-[4/5] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setVisualBoards((current) =>
                        current.map((item) =>
                          item.slug === slug ? { ...item, images: item.images.filter((candidate) => candidate.id !== image.id) } : item
                        )
                      )
                    }
                    className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-brand-border bg-[#f7faf2] text-sm text-brand-muted">
              {boardMeta[slug].emptyLabel}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
