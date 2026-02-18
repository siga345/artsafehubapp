"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetchJson } from "@/lib/client-fetch";

type Specialist = {
  id: string;
  safeId: string;
  nickname: string;
  specialistProfile?: {
    category?: string;
    city?: string | null;
    isOnline?: boolean;
    isAvailableNow?: boolean;
    budgetFrom?: number | null;
    bio?: string | null;
    contactTelegram?: string | null;
    contactUrl?: string | null;
  } | null;
};

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
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
  const filtered = specialists ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>FIND</CardTitle>
          <CardDescription>Поиск специалистов и студий по текущей задаче PATH.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-5">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Кого ищем?" />
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="ALL">Все категории</option>
            <option value="PRODUCER">Продюсер / продакшн</option>
            <option value="AUDIO_ENGINEER">Звукорежиссёр</option>
            <option value="RECORDING_STUDIO">Студия</option>
            <option value="PROMO_CREW">Промо-команда</option>
          </Select>
          <Select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Формат работы">
            <option value="ALL">Онлайн и офлайн</option>
            <option value="ONLINE">Только онлайн</option>
            <option value="CITY">Только в городе / офлайн</option>
          </Select>
          <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Город (опционально)" />
          <label className="flex items-center gap-2 rounded-md border border-brand-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={availableNow}
              onChange={(event) => setAvailableNow(event.target.checked)}
            />
            Доступен сейчас
          </label>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => {
          const profile = item.specialistProfile;
          const contact = profile?.contactTelegram ?? profile?.contactUrl ?? "";
          const canContact = Boolean(contact);

          return (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{item.nickname}</CardTitle>
                <CardDescription>
                  {(profile?.category && categoryLabels[profile.category]) || "Категория не указана"} •{" "}
                  {profile?.isOnline ? "Онлайн" : profile?.city ?? "Офлайн"}
                </CardDescription>
              </CardHeader>
              <div className="space-y-2 text-sm text-brand-muted">
                <p>SAFE ID: {item.safeId}</p>
                <p>{profile?.bio ?? "Описание пока не добавлено."}</p>
                <p>
                  {profile?.isAvailableNow ? "Доступен сейчас" : "Сейчас занят"} •{" "}
                  {profile?.budgetFrom ? `от ${profile.budgetFrom}` : "бюджет по запросу"}
                </p>
                <Button
                  variant="secondary"
                  disabled={!canContact}
                  onClick={() => {
                    if (!canContact) return;
                    window.open(contact, "_blank", "noopener,noreferrer");
                  }}
                >
                  Связаться
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-sm text-brand-muted">Пока нет совпадений по фильтрам.</p>}
    </div>
  );
}
