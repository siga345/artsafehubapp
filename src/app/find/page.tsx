"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Globe,
  MapPin,
  Search,
  Send,
  SlidersHorizontal,
  UserRound,
  Wallet
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";
import { requestActionLabelRu, requestStatusLabelRu, requestTypeLabelRu, type RequestCardDto } from "@/lib/in-app-requests";

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
  IDEA_TEXT: "Идея",
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

function parseReferenceLinks(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const categoryLabels: Record<string, string> = {
  PRODUCER: "Продюсер / продакшн",
  AUDIO_ENGINEER: "Звукорежиссёр",
  RECORDING_STUDIO: "Студия звукозаписи",
  PROMO_CREW: "Промо-команда",
  COVER_ARTIST: "Художник (обложки)",
  COVER_PHOTOGRAPHER: "Фотограф (обложки)",
  VIDEOGRAPHER: "Видеограф (сниппеты / short-form)",
  CLIP_PRODUCTION_TEAM: "Клип-продакшн команда",
  DESIGNER: "Дизайнер (клипы / промо / обложки)"
};

const sendSongRemoteOnlyCategories = new Set(["PRODUCER", "AUDIO_ENGINEER", "COVER_ARTIST"]);

function isSendSongRemoteOnlyCategory(category: string | null | undefined) {
  return Boolean(category && sendSongRemoteOnlyCategories.has(category));
}

function normalizeLabelToken(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function resolveProfileBadges(profile: Specialist["specialistProfile"]): string[] {
  if (!profile?.category) return [];

  if (profile.category === "PROMO_CREW") return ["Промо"];
  if (profile.category === "RECORDING_STUDIO") return ["Студия"];
  if (profile.category === "PRODUCER") return ["Продюсер"];
  if (profile.category === "COVER_ARTIST") return ["Художник обложек"];
  if (profile.category === "COVER_PHOTOGRAPHER") return ["Фотограф обложек"];
  if (profile.category === "VIDEOGRAPHER") return ["Видеограф"];
  if (profile.category === "CLIP_PRODUCTION_TEAM") return ["Клип-продакшн"];
  if (profile.category === "DESIGNER") return ["Дизайнер"];

  if (profile.category !== "AUDIO_ENGINEER") return [];

  const serviceTokens = (profile.services ?? []).map(normalizeLabelToken);
  const badges: string[] = [];

  const hasMixing = serviceTokens.some((service) => service.includes("свед") || service.includes("mix"));
  const hasMastering = serviceTokens.some((service) => service.includes("мастер") || service.includes("master"));

  if (hasMixing) badges.push("Инженер сведения");
  if (hasMastering) badges.push("Инженер мастеринга");

  return badges.length ? badges : ["Инженер сведения"];
}

function resolveRequestTypeByCategory(category: string | undefined) {
  if (category === "RECORDING_STUDIO") return "STUDIO_SESSION";
  if (category === "PROMO_CREW") return "PROMO_PRODUCTION";
  if (category === "AUDIO_ENGINEER") return "MIX_MASTER";
  return "PRODUCTION";
}

export default function FindPage() {
  const toast = useToast();
  const requestsRole = "ARTIST";
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "requests">("catalog");
  const [serviceFilter, setServiceFilter] = useState("ALL");
  const [city, setCity] = useState("");
  const [availableNow, setAvailableNow] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const [bookingTarget, setBookingTarget] = useState<Specialist | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingComment, setBookingComment] = useState("");

  const [songTarget, setSongTarget] = useState<Specialist | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [songComment, setSongComment] = useState("");
  const [coverPhotoReferences, setCoverPhotoReferences] = useState("");
  const [requestsActionBusyId, setRequestsActionBusyId] = useState("");

  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = params.get("service")?.trim().toUpperCase() || "ALL";
    const nextCity = params.get("city")?.trim() || "";
    setServiceFilter(service);
    setCity(nextCity);
  }, []);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (serviceFilter !== "ALL") params.set("service", serviceFilter);
    if (city.trim()) params.set("city", city.trim());
    if (availableNow) params.set("availableNow", "true");
    return `/api/hub/specialists${params.toString() ? `?${params.toString()}` : ""}`;
  }, [availableNow, city, query, serviceFilter]);

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

  const {
    data: requestsData,
    refetch: refetchRequests,
    isFetching: requestsLoading
  } = useQuery({
    queryKey: ["find-requests", requestsRole],
    queryFn: () => fetcher<{ items: RequestCardDto[] }>(`/api/requests?role=${requestsRole}`),
    enabled: activeTab === "requests"
  });

  const availableVersions = useMemo(
    () =>
      (selectedTrack?.demos ?? []).filter(
        (demo) => demo.versionType !== "IDEA_TEXT" && Boolean(demo.audioUrl?.trim())
      ),
    [selectedTrack?.demos]
  );

  const filtered = specialists ?? [];
  const requests = requestsData?.items ?? [];
  const activeAdvancedFiltersCount = Number(availableNow) + Number(serviceFilter !== "ALL") + Number(Boolean(city.trim()));

  function toggleCardExpanded(cardId: string) {
    setExpandedCards((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }

  function openStudioBookingModal(item: Specialist) {
    setSongTarget(null);
    setBookingTarget(item);
    setBookingDate("");
    setBookingTime("");
    setBookingComment("");
    setActionError("");
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
    setCoverPhotoReferences("");
    setActionError("");
    setFeedback(null);
  }

  function closeModals() {
    setBookingTarget(null);
    setSongTarget(null);
    setActionError("");
  }

  async function handleStudioBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingTarget) return;

    setActionError("");
    try {
      const preferredStartAt = bookingDate && bookingTime ? new Date(`${bookingDate}T${bookingTime}:00`) : null;
      const brief = bookingComment.trim() || `Нужна студийная сессия. Дата: ${bookingDate}, время: ${bookingTime}.`;
      const response = await apiFetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "STUDIO_SESSION",
          specialistUserId: bookingTarget.id,
          brief,
          preferredStartAt: preferredStartAt?.toISOString(),
          city: bookingTarget.specialistProfile?.city ?? undefined,
          isRemote: Boolean(bookingTarget.specialistProfile?.isOnline)
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось отправить заявку."));
      }
      toast.success(`Заявка на бронь отправлена: ${bookingTarget.nickname}`);
      setFeedback(`Запрос на бронь в ${bookingTarget.nickname} отправлен.`);
      closeModals();
      if (activeTab === "requests") {
        await refetchRequests();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  async function handleSendSongSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!songTarget || !selectedTrackId || !selectedVersionId || !selectedService) return;

    const trackTitle = tracks?.find((track) => track.id === selectedTrackId)?.title ?? "Выбранный трек";
    const isCoverArtistTarget = songTarget.specialistProfile?.category === "COVER_ARTIST";
    const referenceLinks = isCoverArtistTarget ? parseReferenceLinks(coverPhotoReferences) : [];
    const invalidReference = referenceLinks.find((link) => !isHttpUrl(link));

    if (invalidReference) {
      setActionError(`Некорректная ссылка на референс: ${invalidReference}`);
      return;
    }

    if (referenceLinks.length > 8) {
      setActionError("Можно добавить не более 8 фото-референсов.");
      return;
    }

    setActionError("");
    try {
      const requestType = resolveRequestTypeByCategory(songTarget.specialistProfile?.category);
      const baseBrief = songComment.trim() || `Нужна услуга «${selectedService}» по треку «${trackTitle}».`;
      const referencesSection =
        referenceLinks.length > 0
          ? `\n\nФото-референсы:\n${referenceLinks.map((link, index) => `${index + 1}. ${link}`).join("\n")}`
          : "";
      const brief = `${baseBrief}${referencesSection}`;
      const response = await apiFetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: requestType,
          specialistUserId: songTarget.id,
          trackId: selectedTrackId,
          demoId: selectedVersionId,
          serviceLabel: selectedService,
          brief,
          isRemote: true
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось отправить заявку."));
      }
      toast.success(`Заявка отправлена: ${songTarget.nickname}`);
      setFeedback(`Файл из трека \"${trackTitle}\" отправлен ${songTarget.nickname} на услугу \"${selectedService}\".`);
      closeModals();
      if (activeTab === "requests") {
        await refetchRequests();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  async function applyRequestAction(requestId: string, action: RequestCardDto["availableActions"][number]) {
    setRequestsActionBusyId(`${requestId}:${action}`);
    setActionError("");
    try {
      const response = await apiFetch(`/api/requests/${requestId}/action`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить статус заявки."));
      }
      await refetchRequests();
      toast.success("Статус заявки обновлён.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить заявку.");
    } finally {
      setRequestsActionBusyId("");
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="app-glass relative overflow-hidden p-3 md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(217,249,157,0.45),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.1),transparent_50%)]" />
        <div className="pointer-events-none absolute -right-8 top-4 h-28 w-28 rounded-full bg-[#d9f99d]/35 blur-2xl" />

        <div className="relative space-y-3 md:space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted md:mb-2 md:gap-2 md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                <span className="-rotate-6 inline-flex h-4 w-4 items-center justify-center rounded-md border border-brand-border bg-white shadow-[0_1px_0_rgba(42,52,44,0.08)] md:h-5 md:w-5">
                  <Search className="h-3 w-3 text-brand-ink" />
                </span>
                Поиск
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-brand-ink md:text-3xl">Найди своего специалиста</h1>
              <p className="mt-1 text-xs text-brand-muted md:text-sm">
                Продюсеры, инженеры, студии и визуальные специалисты по задаче, услуге и городу.
              </p>
            </div>
            <div className="inline-flex items-center rounded-lg border border-brand-border bg-white/85 px-2.5 py-1 text-[11px] text-brand-muted shadow-sm md:rounded-xl md:px-3 md:py-1.5 md:text-xs">
              Найдено: <span className="ml-1 font-semibold text-brand-ink">{filtered.length}</span>
            </div>
          </div>

          <div className="rounded-xl border border-brand-border bg-white/75 p-2.5 shadow-sm backdrop-blur-sm md:rounded-2xl md:p-3">
            <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.25fr)_auto] md:gap-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Кого ищем? Например: звукорежиссер для сведения демо"
                  className="h-10 border-brand-border bg-white pl-9 md:h-11"
                />
              </label>

              <label className="hidden h-11 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-ink shadow-sm md:flex">
                <input
                  type="checkbox"
                  className="app-checkbox"
                  checked={availableNow}
                  onChange={(event) => setAvailableNow(event.target.checked)}
                />
                Доступен сейчас
              </label>
            </div>

            <div className="mt-2 flex md:hidden">
              <button
                type="button"
                className={`flex w-full items-center justify-between border border-brand-border bg-[#f7fbf2] px-3 py-2 text-left shadow-sm ${
                  showMobileFilters ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl"
                }`}
                onClick={() => setShowMobileFilters((prev) => !prev)}
                aria-expanded={showMobileFilters}
                aria-controls="find-mobile-filters"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-brand-ink" />
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Фильтры</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
                  {activeAdvancedFiltersCount ? `${activeAdvancedFiltersCount} актив.` : "базовый"}
                  {showMobileFilters ? <ChevronUp className="h-4 w-4 text-brand-ink" /> : <ChevronDown className="h-4 w-4 text-brand-ink" />}
                </span>
              </button>
            </div>

            <div
              id="find-mobile-filters"
              className={`border border-brand-border/70 bg-[#f7fbf2] p-2.5 md:mt-3 md:rounded-xl md:border-t md:p-3 ${
                showMobileFilters
                  ? "mt-0 block rounded-b-xl rounded-t-none border-t-0"
                  : "mt-2 hidden rounded-xl md:block"
              }`}
            >
              <div className="mb-2 hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted md:flex md:text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5 text-brand-ink" />
                Фильтры
              </div>
              <div className="mb-2 md:hidden">
                <label className="flex h-10 items-center gap-2 rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-ink shadow-sm">
                  <input
                    type="checkbox"
                    className="app-checkbox"
                    checked={availableNow}
                    onChange={(event) => setAvailableNow(event.target.checked)}
                  />
                  Доступен сейчас
                </label>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
                <Select
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                  aria-label="Услуга"
                  className="h-10 bg-white md:h-11"
                >
                  <option value="ALL">Все услуги</option>
                  <option value="ARRANGEMENT_BEAT">Аранжировка / бит</option>
                  <option value="VOCAL_RECORDING">Запись вокала</option>
                  <option value="MIXING">Сведение песни</option>
                  <option value="MASTERING">Мастеринг песни</option>
                  <option value="COVER_ART_OR_PHOTO">Обложка песни (рисунок/фото)</option>
                  <option value="PROMO_PLAN">Промо-план распространения</option>
                  <option value="VIDEO_SNIPPETS">Видео-сниппеты</option>
                  <option value="RELEASE_VISUAL_IDENTITY">Айдентика релиза (визуал)</option>
                  <option value="MUSIC_VIDEO_CLIP">Музыкальный клип</option>
                </Select>
                <label className="relative block">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="Город (опционально)"
                    className="h-10 bg-white pl-9 md:h-11"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "catalog" ? "primary" : "secondary"}
          className="h-10 rounded-xl px-4"
          onClick={() => setActiveTab("catalog")}
        >
          Каталог
        </Button>
        <Button
          variant={activeTab === "requests" ? "primary" : "secondary"}
          className="h-10 rounded-xl px-4"
          onClick={() => setActiveTab("requests")}
        >
          Заявки
        </Button>
      </div>

      {actionError ? <InlineActionMessage message={actionError} /> : null}

      {activeTab === "catalog" && feedback && (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/90">
          <p className="text-sm text-emerald-800">{feedback}</p>
        </Card>
      )}

      {activeTab === "catalog" ? (
      <div className="grid gap-3 min-[520px]:grid-cols-2 md:gap-4">
        {filtered.map((item) => {
          const profile = item.specialistProfile;
          const isStudio = profile?.category === "RECORDING_STUDIO";
          const isSendSongCategory = isSendSongRemoteOnlyCategory(profile?.category);
          const isContactOnlyCategory =
            profile?.category === "PROMO_CREW" ||
            profile?.category === "COVER_PHOTOGRAPHER" ||
            profile?.category === "VIDEOGRAPHER" ||
            profile?.category === "CLIP_PRODUCTION_TEAM" ||
            profile?.category === "DESIGNER";
          const telegramLink = normalizeTelegramLink(profile?.contactTelegram);
          const websiteLink = profile?.contactUrl?.trim() ? profile.contactUrl : null;
          const preferredContactLink = telegramLink ?? websiteLink;
          const services = profile?.services ?? [];
          const credits = profile?.credits ?? [];
          const categoryLabel = (profile?.category && categoryLabels[profile.category]) || "Категория не указана";
          const profileBadges = resolveProfileBadges(profile);
          const locationLabel = isStudio
            ? [profile?.city, profile?.metro].filter(Boolean).join(" • ")
            : isContactOnlyCategory
              ? profile?.city ?? ""
              : "";
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
          const mobileExpanded = Boolean(expandedCards[item.id]);

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
                  className={`relative overflow-hidden border-b border-brand-border p-3 md:p-4 ${
                    isStudio
                      ? "bg-gradient-to-br from-[#eef5fb] via-[#edf6f7] to-[#e6efe8]"
                      : "bg-gradient-to-br from-[#f4f8ee] via-[#f3f1e7] to-[#edf3e4]"
                  }`}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/40 blur-2xl md:h-24 md:w-24" />
                  <div className="relative space-y-2.5 md:space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 md:mb-2 md:gap-2">
                          {profileBadges.length ? (
                            profileBadges.map((badge) => (
                              <Badge key={`${item.id}-profile-badge-${badge}`} className="bg-white px-2 py-0.5 text-[11px] md:px-2.5 md:py-1 md:text-xs">
                                {badge}
                              </Badge>
                            ))
                          ) : (
                            <Badge className="bg-white px-2 py-0.5 text-[11px] md:px-2.5 md:py-1 md:text-xs">
                              {isStudio ? <Building2 className="mr-1 h-3 w-3" /> : <UserRound className="mr-1 h-3 w-3" />}
                              {categoryLabel}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-lg font-semibold tracking-tight text-brand-ink md:text-xl">{item.nickname}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-brand-muted md:gap-x-3 md:text-sm">
                          {locationLabel ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5" />
                              {locationLabel}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                            {availabilityLabel}
                          </span>
                        </p>
                      </div>

                      <div
                        className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-medium shadow-sm md:rounded-xl md:px-2.5 md:py-1 md:text-xs ${
                          profile?.isAvailableNow
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-brand-border bg-white text-brand-muted"
                        }`}
                      >
                        {profile?.isAvailableNow ? "Доступен сейчас" : "Занят"}
                      </div>
                    </div>

                    <div className="h-px bg-brand-border/60" />

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] md:gap-2 md:text-xs">
                      <span className="inline-flex items-center rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-brand-muted md:rounded-xl md:px-2.5 md:py-1">
                        SAFE ID: <span className="ml-1 font-medium text-brand-ink">{item.safeId}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-brand-muted md:rounded-xl md:px-2.5 md:py-1">
                        <Wallet className="h-3 w-3" />
                        <span className="font-medium text-brand-ink">{budgetLabel}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-3 md:space-y-4 md:p-4">
                  {locationLabel ? (
                    <div className="rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-xs text-brand-muted md:hidden">
                      <span className="font-medium text-brand-ink">{locationLabel}</span>
                    </div>
                  ) : null}

                  <div className={`${mobileExpanded ? "block" : "hidden"} md:block`}>
                    <div className="space-y-3 md:space-y-4">
                      <div className="rounded-xl border border-brand-border bg-white/80 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-muted">Контакты</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {telegramLink ? (
                            <a
                              className="inline-flex items-center rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-ink hover:bg-[#f4f8ee]"
                              href={telegramLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Telegram
                            </a>
                          ) : null}
                          {websiteLink ? (
                            <a
                              className="inline-flex items-center rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-ink hover:bg-[#f4f8ee]"
                              href={websiteLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Globe className="mr-1 h-3 w-3" />
                              Сайт
                            </a>
                          ) : null}
                          {!telegramLink && !websiteLink && (
                            <p className="text-xs text-brand-muted">Контакты не указаны</p>
                          )}
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
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-muted">Кредиты</p>
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
                    </div>
                  </div>

                  <div className="flex md:hidden">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-ink"
                      onClick={() => toggleCardExpanded(item.id)}
                      aria-expanded={mobileExpanded}
                    >
                      {mobileExpanded ? "Скрыть детали" : "Показать детали"}
                      {mobileExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5 md:pt-1">
                    {isStudio ? (
                      <Button onClick={() => openStudioBookingModal(item)} className="rounded-xl">
                        Забронировать
                      </Button>
                    ) : isSendSongCategory ? (
                      <Button onClick={() => openSendSongModal(item)} className="rounded-xl">
                        <Send className="h-4 w-4" />
                        Отправить песню
                      </Button>
                    ) : isContactOnlyCategory ? (
                      <Button
                        type="button"
                        className="rounded-xl"
                        disabled={!preferredContactLink}
                        onClick={() => {
                          if (!preferredContactLink) return;
                          window.open(preferredContactLink, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Send className="h-4 w-4" />
                        {preferredContactLink ? "Связаться" : "Контакт не указан"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="rounded-xl"
                        disabled={!preferredContactLink}
                        onClick={() => {
                          if (!preferredContactLink) return;
                          window.open(preferredContactLink, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <Send className="h-4 w-4" />
                        {preferredContactLink ? "Связаться" : "Контакт не указан"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      ) : (
        <Card className="rounded-2xl p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-brand-ink">Центр заявок</h2>
          </div>

          {requestsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`request-skeleton-${index}`} className="h-20 animate-pulse rounded-xl border border-brand-border bg-white/70" />
              ))}
            </div>
          ) : requests.length ? (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded-xl border border-brand-border bg-white/80 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">
                        {requestTypeLabelRu[request.type]} • {request.trackTitle || "Без трека"}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {request.specialist.nickname} ({request.specialist.safeId}) • {new Date(request.createdAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <span className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs text-brand-ink">
                      {requestStatusLabelRu[request.status]}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-brand-ink">{request.brief}</p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {request.availableActions.map((action) => (
                      <Button
                        key={`${request.id}:${action}`}
                        variant="secondary"
                        className="h-8 rounded-lg px-3 text-xs"
                        disabled={Boolean(requestsActionBusyId)}
                        onClick={() => void applyRequestAction(request.id, action)}
                      >
                        {requestsActionBusyId === `${request.id}:${action}` ? "..." : requestActionLabelRu[action]}
                      </Button>
                    ))}
                  </div>

                  <div className="mt-3 space-y-1">
                    {request.history.slice(0, 4).map((entry) => (
                      <p key={entry.id} className="text-xs text-brand-muted">
                        {new Date(entry.createdAt).toLocaleString("ru-RU")} • {entry.actor.nickname} • {requestActionLabelRu[entry.action]}
                        {entry.comment ? ` — ${entry.comment}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-brand-muted">Заявок пока нет.</p>
          )}
        </Card>
      )}

      {activeTab === "catalog" && filtered.length === 0 && <p className="text-sm text-brand-muted">Пока нет совпадений по фильтрам.</p>}

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
                {actionError ? <InlineActionMessage message={actionError} /> : null}
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
                {actionError ? <InlineActionMessage message={actionError} /> : null}
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

                {songTarget.specialistProfile?.category === "COVER_ARTIST" && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-brand-ink">Фото-референсы</p>
                    <Textarea
                      value={coverPhotoReferences}
                      onChange={(event) => setCoverPhotoReferences(event.target.value)}
                      placeholder={"Добавьте ссылки на фото-референсы (каждая с новой строки)\nhttps://..."}
                      rows={4}
                    />
                    <p className="text-xs text-brand-muted">Опционально, до 8 ссылок, формат: http/https.</p>
                  </div>
                )}

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
