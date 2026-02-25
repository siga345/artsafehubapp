"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Clock3, Globe, MapPin, Search, Send, SlidersHorizontal, UserRound, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetchJson } from "@/lib/client-fetch";

type Specialist = {
  id: string;
  safeId: string;
  nickname: string;
  specialistProfile?: {
    category?: string;
    city?: string | null;
    metro?: string | null;
    isOnline?: boolean;
    isAvailableNow?: boolean;
    budgetFrom?: number | null;
    bio?: string | null;
    contactTelegram?: string | null;
    contactUrl?: string | null;
    services?: string[];
    credits?: string[];
  } | null;
};

type SongTrack = {
  id: string;
  title: string;
};

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED" | "RELEASE";

type SongVersion = {
  id: string;
  audioUrl: string;
  versionType: DemoVersionType;
  createdAt: string;
};

type TrackWithVersions = {
  id: string;
  demos: SongVersion[];
};

const versionTypeLabels: Record<DemoVersionType, string> = {
  IDEA_TEXT: "Идея (текст)",
  DEMO: "Демо",
  ARRANGEMENT: "Продакшн",
  NO_MIX: "Запись без сведения",
  MIXED: "Сведение",
  MASTERED: "Мастеринг",
  RELEASE: "Релиз"
};

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

function normalizeTelegramLink(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^(https?:\/\/|tg:\/\/)/i.test(raw)) return raw;
  const username = raw.replace(/^@/, "");
  return username ? `https://t.me/${username}` : null;
}

const categoryLabels: Record<string, string> = {
  PRODUCER: "Продюсер / продакшн",
  AUDIO_ENGINEER: "Звукорежиссёр",
  RECORDING_STUDIO: "Студия звукозаписи",
  PROMO_CREW: "Промо-команда"
};

export default function FindPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [mode, setMode] = useState("ALL");
  const [city, setCity] = useState("");
  const [availableNow, setAvailableNow] = useState(false);

  const [bookingTarget, setBookingTarget] = useState<Specialist | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingComment, setBookingComment] = useState("");

  const [songTarget, setSongTarget] = useState<Specialist | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [songComment, setSongComment] = useState("");

  const [feedback, setFeedback] = useState<string | null>(null);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category !== "ALL") params.set("category", category);
    if (mode !== "ALL") params.set("mode", mode);
    if (city.trim()) params.set("city", city.trim());
    if (availableNow) params.set("availableNow", "true");
    return `/api/hub/specialists${params.toString() ? `?${params.toString()}` : ""}`;
  }, [availableNow, category, city, mode, query]);

  const { data: specialists } = useQuery({
    queryKey: ["find-specialists", requestUrl],
    queryFn: () => fetcher<Specialist[]>(requestUrl)
  });

  const { data: tracks } = useQuery({
    queryKey: ["find-track-options"],
    queryFn: async () => {
      const items = await fetcher<SongTrack[]>("/api/songs");
      return items.map((track) => ({ id: track.id, title: track.title }));
    },
    enabled: Boolean(songTarget)
  });

  const { data: selectedTrack } = useQuery({
    queryKey: ["find-track-versions", selectedTrackId],
    queryFn: () => fetcher<TrackWithVersions>(`/api/songs/${selectedTrackId}`),
    enabled: Boolean(songTarget && selectedTrackId)
  });

  const availableVersions = useMemo(
    () =>
      (selectedTrack?.demos ?? []).filter(
        (demo) => demo.versionType !== "IDEA_TEXT" && Boolean(demo.audioUrl?.trim())
      ),
    [selectedTrack?.demos]
  );

  const filtered = specialists ?? [];

  function openStudioBookingModal(item: Specialist) {
    setSongTarget(null);
    setBookingTarget(item);
    setBookingDate("");
    setBookingTime("");
    setBookingComment("");
    setFeedback(null);
  }

  function openSendSongModal(item: Specialist) {
    const services = item.specialistProfile?.services ?? [];
    setBookingTarget(null);
    setSongTarget(item);
    setSelectedTrackId("");
    setSelectedVersionId("");
    setSelectedService(services[0] ?? "");
    setSongComment("");
    setFeedback(null);
  }

  function closeModals() {
    setBookingTarget(null);
    setSongTarget(null);
  }

  function handleStudioBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingTarget) return;

    setFeedback(`Запрос на бронь в ${bookingTarget.nickname} сформирован.`);
    closeModals();
  }

  function handleSendSongSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!songTarget || !selectedTrackId || !selectedVersionId || !selectedService) return;

    const trackTitle = tracks?.find((track) => track.id === selectedTrackId)?.title ?? "Выбранный трек";
    setFeedback(`Файл из трека \"${trackTitle}\" отправлен ${songTarget.nickname} на услугу \"${selectedService}\".`);
    closeModals();
  }

  return (
    <div className="space-y-6">
      <section className="app-glass relative overflow-hidden p-4 md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(217,249,157,0.45),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.1),transparent_50%)]" />
        <div className="pointer-events-none absolute -right-8 top-4 h-28 w-28 rounded-full bg-[#d9f99d]/35 blur-2xl" />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                <span className="-rotate-6 inline-flex h-5 w-5 items-center justify-center rounded-md border border-brand-border bg-white shadow-[0_1px_0_rgba(42,52,44,0.08)]">
                  <Search className="h-3 w-3 text-brand-ink" />
                </span>
                Find
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-brand-ink">Найди своего специалиста</h1>
              <p className="mt-1 text-sm text-brand-muted">
                Продюсеры, инженеры и студии по задаче, формату работы и городу.
              </p>
            </div>
            <div className="inline-flex items-center rounded-xl border border-brand-border bg-white/85 px-3 py-1.5 text-xs text-brand-muted shadow-sm">
              Найдено: <span className="ml-1 font-semibold text-brand-ink">{filtered.length}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm backdrop-blur-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Кого ищем? Например: звукорежиссер для сведения демо"
                  className="h-11 border-brand-border bg-white pl-9"
                />
              </label>

              <label className="flex h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-ink shadow-sm">
                <input
                  type="checkbox"
                  className="app-checkbox"
                  checked={availableNow}
                  onChange={(event) => setAvailableNow(event.target.checked)}
                />
                Доступен сейчас
              </label>
            </div>

            <div className="mt-3 rounded-xl border border-brand-border/70 bg-[#f7fbf2] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                <SlidersHorizontal className="h-3.5 w-3.5 text-brand-ink" />
                Filters
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={category} onChange={(event) => setCategory(event.target.value)} className="bg-white">
                  <option value="ALL">Все категории</option>
                  <option value="PRODUCER">Продюсер / продакшн</option>
                  <option value="AUDIO_ENGINEER">Звукорежиссёр</option>
                  <option value="RECORDING_STUDIO">Студия</option>
                  <option value="PROMO_CREW">Промо-команда</option>
                </Select>
                <Select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Формат работы" className="bg-white">
                  <option value="ALL">Онлайн и офлайн</option>
                  <option value="ONLINE">Только онлайн</option>
                  <option value="CITY">Только в городе / офлайн</option>
                </Select>
                <label className="relative block">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Город (опционально)"
                    className="bg-white pl-9"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {feedback && (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/90">
          <p className="text-sm text-emerald-800">{feedback}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => {
          const profile = item.specialistProfile;
          const isStudio = profile?.category === "RECORDING_STUDIO";
          const isPromoCrew = profile?.category === "PROMO_CREW";
          const telegramLink = normalizeTelegramLink(profile?.contactTelegram);
          const services = profile?.services ?? [];
          const credits = profile?.credits ?? [];
          const categoryLabel = (profile?.category && categoryLabels[profile.category]) || "Категория не указана";
          const locationLabel = profile?.isOnline ? "Онлайн" : profile?.city ?? "Офлайн";
          const availabilityLabel = isStudio
            ? profile?.isAvailableNow
              ? "Доступна сейчас"
              : "Сейчас занята"
            : profile?.isAvailableNow
              ? "Доступен сейчас"
              : "Сейчас занят";
          const budgetLabel = isStudio
            ? profile?.budgetFrom
              ? `от ${profile.budgetFrom} ₽/ч`
              : "цена по запросу"
            : profile?.budgetFrom
              ? `от ${profile.budgetFrom} ₽`
              : "бюджет по запросу";

          return (
            <Card key={item.id} className="relative overflow-hidden p-0">
              <div
                className={`pointer-events-none absolute inset-0 ${
                  isStudio
                    ? "bg-[radial-gradient(circle_at_0%_0%,rgba(186,230,253,0.25),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(217,249,157,0.14),transparent_40%)]"
                    : "bg-[radial-gradient(circle_at_0%_0%,rgba(217,249,157,0.22),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(253,230,138,0.14),transparent_40%)]"
                }`}
              />

              <div className="relative">
                <div
                  className={`relative overflow-hidden border-b border-brand-border p-4 ${
                    isStudio
                      ? "bg-gradient-to-br from-[#eef5fb] via-[#edf6f7] to-[#e6efe8]"
                      : "bg-gradient-to-br from-[#f4f8ee] via-[#f3f1e7] to-[#edf3e4]"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
                  <div className="relative space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge className="bg-white">
                            {isStudio ? <Building2 className="mr-1 h-3 w-3" /> : <UserRound className="mr-1 h-3 w-3" />}
                            {isStudio ? "Studio" : "Specialist"}
                          </Badge>
                          <Badge className="bg-white">{categoryLabel}</Badge>
                        </div>
                        <p className="truncate text-xl font-semibold tracking-tight text-brand-ink">{item.nickname}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-muted">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {locationLabel}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {availabilityLabel}
                          </span>
                        </p>
                      </div>

                      <div
                        className={`inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-medium shadow-sm ${
                          profile?.isAvailableNow
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-brand-border bg-white text-brand-muted"
                        }`}
                      >
                        {profile?.isAvailableNow ? "Available now" : "Busy"}
                      </div>
                    </div>

                    <div className="h-px bg-brand-border/60" />

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-brand-muted">
                        SAFE ID: <span className="ml-1 font-medium text-brand-ink">{item.safeId}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-brand-muted">
                        <Wallet className="h-3 w-3" />
                        <span className="font-medium text-brand-ink">{budgetLabel}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-brand-border bg-white/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-muted">Формат</p>
                      <p className="mt-1 text-sm font-medium text-brand-ink">
                        {profile?.isOnline ? "Онлайн" : "Оффлайн / локально"}
                      </p>
                      <p className="mt-1 text-xs text-brand-muted">
                        {profile?.city ? `Город: ${profile.city}` : "Город не указан"}
                        {isStudio ? ` • Метро: ${profile?.metro ?? "не указано"}` : ""}
                      </p>
                    </div>

                    <div className="rounded-xl border border-brand-border bg-white/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-muted">Контакты</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {profile?.contactTelegram ? (
                          <a
                            className="inline-flex items-center rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-ink hover:bg-[#f4f8ee]"
                            href={profile.contactTelegram}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Telegram
                          </a>
                        ) : null}
                        {profile?.contactUrl ? (
                          <a
                            className="inline-flex items-center rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-ink hover:bg-[#f4f8ee]"
                            href={profile.contactUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Globe className="mr-1 h-3 w-3" />
                            Сайт
                          </a>
                        ) : null}
                        {!profile?.contactTelegram && !profile?.contactUrl && (
                          <p className="text-xs text-brand-muted">Контакты не указаны</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-muted">Услуги</p>
                    <div className="flex flex-wrap gap-2">
                      {services.length ? (
                        services.map((service) => (
                          <Badge key={`${item.id}-service-${service}`} className="bg-white">
                            {service}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-brand-muted">По запросу</span>
                      )}
                    </div>
                  </div>

                  {!isStudio && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-muted">Credits</p>
                      <div className="flex flex-wrap gap-2">
                        {credits.length ? (
                          credits.slice(0, 6).map((credit) => (
                            <span
                              key={`${item.id}-credit-${credit}`}
                              className="inline-flex items-center rounded-lg border border-brand-border bg-[#f7fbf2] px-2.5 py-1 text-xs text-brand-ink"
                            >
                              {credit}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-brand-muted">Не указаны</span>
                        )}
                      </div>
                    </div>
                  )}

                  {profile?.bio && (
                    <div className="rounded-xl border border-brand-border bg-[#f7fbf2] px-3 py-2">
                      <p className="text-sm text-brand-ink">{profile.bio}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isStudio ? (
                      <Button onClick={() => openStudioBookingModal(item)} className="rounded-xl">
                        Забронировать
                      </Button>
                    ) : isPromoCrew ? (
                      <Button
                        type="button"
                        className="rounded-xl"
                        disabled={!telegramLink}
                        onClick={() => {
                          if (!telegramLink) return;
                          window.open(telegramLink, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Send className="h-4 w-4" />
                        {telegramLink ? "Связаться" : "Telegram не указан"}
                      </Button>
                    ) : (
                      <Button onClick={() => openSendSongModal(item)} className="rounded-xl">
                        <Send className="h-4 w-4" />
                        Отправить песню
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-sm text-brand-muted">Пока нет совпадений по фильтрам.</p>}

      {(bookingTarget || songTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Закрыть окно"
            className="absolute inset-0 bg-black/45"
            onClick={closeModals}
          />

          {bookingTarget && (
            <Card className="relative z-10 w-full max-w-lg rounded-2xl bg-white">
              <CardHeader>
                <CardTitle>Бронирование студии</CardTitle>
                <CardDescription>{bookingTarget.nickname}</CardDescription>
              </CardHeader>

              <form className="space-y-3" onSubmit={handleStudioBookingSubmit}>
                <Input type="date" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} required />
                <Input type="time" value={bookingTime} onChange={(event) => setBookingTime(event.target.value)} required />
                <Textarea
                  value={bookingComment}
                  onChange={(event) => setBookingComment(event.target.value)}
                  placeholder="Комментарий к брони (опционально)"
                  rows={4}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeModals}>
                    Отмена
                  </Button>
                  <Button type="submit">Перейти к брони</Button>
                </div>
              </form>
            </Card>
          )}

          {songTarget && (
            <Card className="relative z-10 w-full max-w-lg rounded-2xl bg-white">
              <CardHeader>
                <CardTitle>Отправить песню специалисту</CardTitle>
                <CardDescription>{songTarget.nickname}</CardDescription>
              </CardHeader>

              <form className="space-y-3" onSubmit={handleSendSongSubmit}>
                <Select
                  value={selectedTrackId}
                  onChange={(event) => {
                    setSelectedTrackId(event.target.value);
                    setSelectedVersionId("");
                  }}
                  required
                >
                  <option value="">Выберите песню</option>
                  {!tracks?.length && <option value="">Сначала добавьте трек во вкладке SONGS</option>}
                  {tracks?.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </Select>

                <Select
                  value={selectedVersionId}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  required
                  disabled={!selectedTrackId}
                >
                  <option value="">
                    {!selectedTrackId
                      ? "Сначала выберите песню"
                      : availableVersions.length
                        ? "Выберите версию (файл)"
                        : "У выбранной песни нет файловых версий"}
                  </option>
                  {availableVersions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {versionTypeLabels[version.versionType]} • {new Date(version.createdAt).toLocaleDateString("ru-RU")}
                    </option>
                  ))}
                </Select>

                <Select value={selectedService} onChange={(event) => setSelectedService(event.target.value)} required>
                  {!songTarget.specialistProfile?.services?.length && <option value="">Услуги специалиста не заполнены</option>}
                  {(songTarget.specialistProfile?.services ?? []).map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </Select>

                <Textarea
                  value={songComment}
                  onChange={(event) => setSongComment(event.target.value)}
                  placeholder="Комментарии к работе, референсы"
                  rows={4}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeModals}>
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !tracks?.length ||
                      !songTarget.specialistProfile?.services?.length ||
                      !selectedTrackId ||
                      !selectedVersionId ||
                      !selectedService
                    }
                  >
                    Отправить песню
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
