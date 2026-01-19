"use client";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
}

export default function HubPage() {
  const { data: artists } = useQuery({ queryKey: ["hub-artists"], queryFn: () => fetcher<any[]>("/api/hub/artists") });
  const { data: specialists } = useQuery({ queryKey: ["hub-specialists"], queryFn: () => fetcher<any[]>("/api/hub/specialists") });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Каталог артистов</CardTitle>
          <CardDescription>Найди коллабораторов в комьюнити СНГ.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-2">
          {artists?.map((artist) => (
            <div key={artist.id} className="rounded-lg border border-brand-border bg-brand-surface p-3 text-sm">
              <p className="font-medium">{artist.name}</p>
              <p className="text-xs text-brand-muted">{artist.artistProfile?.city}</p>
              <p className="text-xs text-brand-muted">{artist.artistProfile?.genres?.join(", ")}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary">Почта</Button>
                <Button variant="secondary">t.me</Button>
              </div>
            </div>
          ))}
          {!artists?.length && <p className="text-sm text-brand-muted">Артисты не найдены.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Каталог специалистов</CardTitle>
          <CardDescription>Связь с продюсерами и инженерами.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-2">
          {specialists?.map((specialist) => (
            <div key={specialist.id} className="rounded-lg border border-brand-border bg-brand-surface p-3 text-sm">
              <p className="font-medium">{specialist.name}</p>
              <p className="text-xs text-brand-muted">{specialist.specialistProfile?.type}</p>
              <p className="text-xs text-brand-muted">{specialist.specialistProfile?.priceInfo}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary">Почта</Button>
                <Button variant="secondary">t.me</Button>
              </div>
            </div>
          ))}
          {!specialists?.length && <p className="text-sm text-brand-muted">Специалисты не найдены.</p>}
        </div>
      </Card>
    </div>
  );
}
