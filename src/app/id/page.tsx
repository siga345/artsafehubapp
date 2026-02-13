"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";

type IdProfile = {
  id: string;
  safeId: string;
  nickname: string;
  avatarUrl: string | null;
  links: unknown;
  notificationsEnabled: boolean;
  demosPrivate: boolean;
};

type Links = {
  telegram: string;
  website: string;
  youtube: string;
};

function parseLinks(raw: unknown): Links {
  if (!raw || typeof raw !== "object") {
    return { telegram: "", website: "", youtube: "" };
  }
  const obj = raw as Record<string, unknown>;
  return {
    telegram: typeof obj.telegram === "string" ? obj.telegram : "",
    website: typeof obj.website === "string" ? obj.website : "",
    youtube: typeof obj.youtube === "string" ? obj.youtube : ""
  };
}

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

export default function IdPage() {
  const { data, refetch } = useQuery({
    queryKey: ["id-profile"],
    queryFn: () => fetcher<IdProfile>("/api/id")
  });

  const links = useMemo(() => parseLinks(data?.links), [data?.links]);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [youtube, setYoutube] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [demosPrivate, setDemosPrivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  const safeId = data?.safeId ?? "SAFE-ID";
  const currentNickname = nickname || data?.nickname || "";
  const currentAvatarUrl = avatarUrl || data?.avatarUrl || "";
  const currentTelegram = telegram || links.telegram;
  const currentWebsite = website || links.website;
  const currentYoutube = youtube || links.youtube;
  const currentNotifications = notificationsEnabled;
  const currentDemosPrivate = demosPrivate;

  useEffect(() => {
    if (!data || settingsInitialized) return;
    setNotificationsEnabled(data.notificationsEnabled);
    setDemosPrivate(data.demosPrivate);
    setSettingsInitialized(true);
  }, [data, settingsInitialized]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ID</CardTitle>
          <CardDescription>Профиль артиста и SAFE ID.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-brand-border">
            <Image
              src="/images/safe-id.jpeg"
              alt="SAFE ID визуал"
              width={1200}
              height={500}
              className="h-32 w-full object-cover"
              priority
            />
          </div>
          <Input value={currentNickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ник артиста" />
          <Input value={currentAvatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="Ссылка на аватар (URL)" />
          <div className="rounded-lg border border-brand-border bg-brand-surface p-3">
            <p className="text-xs text-brand-muted">SAFE ID</p>
            <p className="text-sm font-semibold">{safeId}</p>
          </div>
          <Button variant="secondary" onClick={() => navigator.clipboard.writeText(safeId)}>
            Копировать SAFE ID
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ссылки</CardTitle>
          <CardDescription>Telegram и внешние площадки.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <Input value={currentTelegram} onChange={(event) => setTelegram(event.target.value)} placeholder="Telegram URL" />
          <Input value={currentWebsite} onChange={(event) => setWebsite(event.target.value)} placeholder="Website URL" />
          <Input value={currentYoutube} onChange={(event) => setYoutube(event.target.value)} placeholder="YouTube URL" />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
          <CardDescription>Базовые настройки MVP.</CardDescription>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={currentNotifications}
              onChange={(event) => setNotificationsEnabled(event.target.checked)}
            />
            Уведомления включены
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={currentDemosPrivate}
              onChange={(event) => setDemosPrivate(event.target.checked)}
            />
            Демки приватные (по умолчанию)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!data || !currentNickname.trim() || saving}
              onClick={async () => {
                if (!data) return;
                setSaving(true);
                await apiFetch("/api/id", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    nickname: currentNickname.trim(),
                    avatarUrl: currentAvatarUrl.trim() || null,
                    telegram: currentTelegram.trim() || null,
                    website: currentWebsite.trim() || null,
                    youtube: currentYoutube.trim() || null,
                    notificationsEnabled,
                    demosPrivate
                  })
                });
                setNickname("");
                setAvatarUrl("");
                setTelegram("");
                setWebsite("");
                setYoutube("");
                setSettingsInitialized(false);
                await refetch();
                setSaving(false);
              }}
            >
              {saving ? "Сохраняем..." : "Сохранить"}
            </Button>
            <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/signin" })}>
              Выйти
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
