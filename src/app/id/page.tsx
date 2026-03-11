"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Link2, Loader2, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";

type IdProfile = {
  id: string;
  safeId: string;
  nickname: string;
  avatarUrl: string | null;
  links: unknown;
};

type Links = {
  bandlink: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function parseLinks(raw: unknown): Links {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { bandlink: "" };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.bandlink === "string" && obj.bandlink.trim()) return { bandlink: obj.bandlink };
  if (typeof obj.website === "string" && obj.website.trim()) return { bandlink: obj.website };
  return { bandlink: "" };
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

export default function IdPage() {
  const toast = useToast();
  const { data } = useQuery({
    queryKey: ["id-profile"],
    queryFn: () => fetcher<IdProfile | null>("/api/id"),
    refetchOnWindowFocus: false
  });

  const links = useMemo(() => parseLinks(data?.links), [data?.links]);
  const [initialized, setInitialized] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bandlink, setBandlink] = useState("");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const hydrationRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const latestSaveTokenRef = useRef(0);
  const lastSavedPayloadRef = useRef("");

  useEffect(() => {
    if (!data || initialized) return;

    hydrationRef.current = true;
    setNickname(data.nickname ?? "");
    setAvatarUrl(data.avatarUrl ?? "");
    setBandlink(links.bandlink);
    setInitialized(true);
  }, [data, initialized, links.bandlink]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const autosavePayload = useMemo(
    () => ({
      nickname: nickname.trim(),
      avatarUrl: avatarUrl.trim() || null,
      bandlink: bandlink.trim() || null
    }),
    [avatarUrl, bandlink, nickname]
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
          throw new Error(await readApiErrorMessage(response, "Не удалось сохранить SAFE ID."));
        }

        if (saveToken !== latestSaveTokenRef.current) return;

        lastSavedPayloadRef.current = serializedPayload;
        setSaveState("saved");
      } catch (error) {
        if (saveToken !== latestSaveTokenRef.current) return;
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Не удалось сохранить SAFE ID.");
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

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await apiFetch("/api/id/avatar", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, "Не удалось загрузить аватар."));
    }

    const payload = (await response.json()) as { avatarUrl: string };
    setAvatarUrl(payload.avatarUrl);
  }

  if (data === undefined) {
    return (
      <div className="pb-8">
        <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,237,0.92)_100%)]">
          <CardHeader>
            <CardTitle className="text-2xl">SAFE ID</CardTitle>
            <CardDescription>Загружаем профиль.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pb-8">
        <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,237,0.92)_100%)]">
          <CardHeader>
            <CardTitle className="text-2xl">SAFE ID</CardTitle>
            <CardDescription>Профиль не найден.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Card className="border-[#d7e3cb] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(244,249,237,0.92)_100%)]">
        <CardHeader className="mb-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-brand-border bg-white/90 text-brand-muted">
              <UserRound className="mr-1 h-3.5 w-3.5" />
              SAFE ID
            </Badge>
            <Badge className="border-brand-border bg-white/90 text-brand-muted">{saveStatusLabel(saveState, saveError)}</Badge>
          </div>
          <CardTitle className="text-2xl">Профиль</CardTitle>
          <CardDescription>Во вкладке остались только данные SAFE ID. Блоки мира артиста полностью убраны с этого экрана.</CardDescription>
        </CardHeader>

        <div className="space-y-3 px-6 pb-6">
          {saveState === "error" ? <InlineActionMessage message={saveError} onRetry={() => void flushAutosave()} /> : null}

          <div className="rounded-2xl border border-brand-border bg-[#f7faf2] p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Код SAFE ID</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 break-all rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-semibold text-brand-ink">
                {data.safeId}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(data.safeId);
                    setCopied(true);
                    toast.success("SAFE ID скопирован.");
                  } catch {
                    setSaveError("Не удалось скопировать SAFE ID.");
                    setSaveState("error");
                  }
                }}
              >
                <Copy className="h-4 w-4" />
                {copied ? "Скопировано" : "Копировать"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-white/80 p-3">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Аватар</label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-brand-border bg-[#f4f8ed]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={nickname || "Аватар артиста"} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-8 w-8 text-brand-muted" />
                )}
              </div>

              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink shadow-sm">
                  {uploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
                  {uploadingAvatar ? "Загружаем..." : "Загрузить фото"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;

                      setUploadingAvatar(true);
                      try {
                        await uploadAvatar(file);
                        toast.success("Аватар загружен.");
                      } catch (error) {
                        setSaveState("error");
                        setSaveError(error instanceof Error ? error.message : "Не удалось загрузить аватар.");
                      } finally {
                        setUploadingAvatar(false);
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-brand-muted">JPG, PNG, WEBP или GIF. До 5 МБ.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-white/80 p-3">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Сценический псевдоним</label>
            <Input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              onBlur={() => void flushAutosave()}
              placeholder="Псевдоним"
              className="bg-white"
            />
          </div>

          <div className="rounded-2xl border border-brand-border bg-white/80 p-3">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Bandlink</label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
              <Input
                value={bandlink}
                onChange={(event) => setBandlink(event.target.value)}
                onBlur={() => void flushAutosave()}
                placeholder="Ссылка на bandlink"
                className="bg-white pl-9"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-[#f7faf2] p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Статус</p>
            <p className="mt-2 text-sm text-brand-ink">{saveStatusLabel(saveState, saveError)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
