"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { signOut } from "next-auth/react";
import {
  Bell,
  Copy,
  Globe,
  Link2,
  LogOut,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  Youtube
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="pb-8">
      <div className="relative overflow-hidden rounded-[30px] border border-brand-border bg-gradient-to-br from-[#edf4e4] via-[#e8f0de] to-[#e2ead7] p-4 shadow-[0_20px_45px_rgba(61,84,46,0.14)] md:p-5">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-10 top-6 h-44 w-44 rounded-full bg-[#d9f99d]/40 blur-3xl" />
          <div className="absolute left-[-1rem] top-16 h-36 w-36 rounded-full bg-white/35 blur-2xl" />
          <div className="absolute bottom-[-1rem] left-24 h-28 w-28 rounded-full bg-[#9fc7b3]/35 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0)_40%,rgba(90,123,75,0.06)_100%)]" />
        </div>

        <div className="relative space-y-4">
          <section className="overflow-hidden rounded-[28px] border border-brand-border bg-white/85 shadow-[0_14px_32px_rgba(61,84,46,0.1)]">
            <div className="relative p-4 md:p-5">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-0 top-0 h-24 w-full bg-[linear-gradient(90deg,rgba(213,234,164,0.28),rgba(255,255,255,0))]" />
                <div className="absolute right-6 top-4 h-24 w-24 rounded-full bg-[#dff0c6]/50 blur-2xl" />
              </div>

              <div className="relative grid gap-4 md:grid-cols-[1.25fr_0.95fr]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-[#cbdab8] bg-[#f5faeb] text-[#4b6440]">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Artist Identity
                    </Badge>
                    <Badge className="border-brand-border bg-white/90 text-brand-muted">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      SAFE ID
                    </Badge>
                    <Badge className="border-brand-border bg-white/90 text-brand-muted">
                      {data ? "Profile loaded" : "Loading profile..."}
                    </Badge>
                  </div>

                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">SAFE ID</h1>
                    <p className="mt-1 text-sm text-brand-muted">
                      Профиль артиста, ссылки и приватность в едином брендовом интерфейсе.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-brand-border bg-white/80 px-3 py-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Nickname</p>
                      <p className="mt-1 truncate text-sm font-medium text-brand-ink">
                        {currentNickname.trim() || "Не указан"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-brand-border bg-white/80 px-3 py-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Links</p>
                      <p className="mt-1 text-sm font-medium text-brand-ink">
                        {[currentTelegram, currentWebsite, currentYoutube].filter(Boolean).length} / 3
                      </p>
                    </div>
                    <div className="rounded-2xl border border-brand-border bg-white/80 px-3 py-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Privacy</p>
                      <p className="mt-1 text-sm font-medium text-brand-ink">
                        {currentDemosPrivate ? "Private demos" : "Open demos"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="overflow-hidden rounded-2xl border border-brand-border bg-white/75 shadow-sm">
                    <div className="relative">
                      <Image
                        src="/images/safe-id.jpeg"
                        alt="SAFE ID визуал"
                        width={1200}
                        height={500}
                        className="h-36 w-full object-cover"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/15" />
                    </div>
                    <div className="p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">SAFE ID Code</p>
                      <p className="mt-1 break-all rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-semibold text-brand-ink">
                        {safeId}
                      </p>
                      <Button
                        variant="secondary"
                        className="mt-2 w-full rounded-xl border-brand-border bg-white text-brand-ink hover:bg-white"
                        onClick={async () => {
                          await navigator.clipboard.writeText(safeId);
                          setCopied(true);
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {copied ? "Скопировано" : "Копировать SAFE ID"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Status</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge className={currentNotifications ? "bg-[#eef7df] text-[#4b6440] border-[#cbdab8]" : ""}>
                        <Bell className="mr-1 h-3.5 w-3.5" />
                        {currentNotifications ? "Notifications ON" : "Notifications OFF"}
                      </Badge>
                      <Badge className={currentDemosPrivate ? "bg-[#eef7df] text-[#4b6440] border-[#cbdab8]" : ""}>
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                        {currentDemosPrivate ? "Demos private" : "Demos public"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.4),transparent_35%)]" />
                <div className="relative">
                  <CardHeader className="mb-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className="border-brand-border bg-white/90 text-brand-muted">
                        <UserRound className="mr-1 h-3.5 w-3.5" />
                        Identity
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">Профиль артиста</CardTitle>
                    <CardDescription>Базовые данные для SAFE ID и карточки артиста.</CardDescription>
                  </CardHeader>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
                        Ник артиста
                      </label>
                      <Input
                        value={currentNickname}
                        onChange={(event) => setNickname(event.target.value)}
                        placeholder="Ник артиста"
                        className="bg-white"
                      />
                    </div>

                    <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
                        Аватар (URL)
                      </label>
                      <Input
                        value={currentAvatarUrl}
                        onChange={(event) => setAvatarUrl(event.target.value)}
                        placeholder="Ссылка на аватар (URL)"
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(217,249,157,0.2),transparent_40%)]" />
                <div className="relative">
                  <CardHeader className="mb-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className="border-brand-border bg-white/90 text-brand-muted">
                        <Link2 className="mr-1 h-3.5 w-3.5" />
                        Links
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">Ссылки</CardTitle>
                    <CardDescription>Telegram и внешние площадки для контакта и портфолио.</CardDescription>
                  </CardHeader>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
                        Telegram
                      </label>
                      <div className="relative">
                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                        <Input
                          value={currentTelegram}
                          onChange={(event) => setTelegram(event.target.value)}
                          placeholder="Telegram URL"
                          className="bg-white pl-9"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
                        Website
                      </label>
                      <div className="relative">
                        <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                        <Input
                          value={currentWebsite}
                          onChange={(event) => setWebsite(event.target.value)}
                          placeholder="Website URL"
                          className="bg-white pl-9"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">
                        YouTube
                      </label>
                      <div className="relative">
                        <Youtube className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                        <Input
                          value={currentYoutube}
                          onChange={(event) => setYoutube(event.target.value)}
                          placeholder="YouTube URL"
                          className="bg-white pl-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(159,199,179,0.18),transparent_40%)]" />
              <div className="relative">
                <CardHeader className="mb-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className="border-brand-border bg-white/90 text-brand-muted">
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      Settings
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">Приватность и сессия</CardTitle>
                  <CardDescription>Базовые настройки MVP и управление аккаунтом.</CardDescription>
                </CardHeader>

                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-3 rounded-2xl border border-brand-border bg-white/80 px-3 py-3 shadow-sm">
                    <input
                      type="checkbox"
                      className="app-checkbox"
                      checked={currentNotifications}
                      onChange={(event) => setNotificationsEnabled(event.target.checked)}
                    />
                    <div>
                      <p className="font-medium text-brand-ink">Уведомления включены</p>
                      <p className="text-xs text-brand-muted">Получать апдейты по активностям и действиям.</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-brand-border bg-white/80 px-3 py-3 shadow-sm">
                    <input
                      type="checkbox"
                      className="app-checkbox"
                      checked={currentDemosPrivate}
                      onChange={(event) => setDemosPrivate(event.target.checked)}
                    />
                    <div>
                      <p className="font-medium text-brand-ink">Демки приватные (по умолчанию)</p>
                      <p className="text-xs text-brand-muted">Новые демо доступны только по твоим правилам доступа.</p>
                    </div>
                  </label>

                  <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">Save Changes</p>
                    <p className="mt-1 text-sm text-brand-muted">
                      Сохраняет nickname, avatar URL, ссылки и настройки приватности.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        className="rounded-xl"
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
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Сохраняем..." : "Сохранить"}
                      </Button>
                      <Button
                        variant="secondary"
                        className="rounded-xl border-brand-border bg-white text-brand-ink hover:bg-white"
                        onClick={() => signOut({ callbackUrl: "/signin" })}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Выйти
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
