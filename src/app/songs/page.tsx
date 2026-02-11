"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

const statuses = [
  "ALL",
  "IDEA_DEMO",
  "WRITING",
  "ARRANGEMENT",
  "RECORDING",
  "MIXING",
  "MASTERING",
  "READY_FOR_RELEASE",
  "RELEASED",
  "ARCHIVED"
];

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
}

export default function SongsPage() {
  const { data: songs } = useQuery({ queryKey: ["songs"], queryFn: () => fetcher<any[]>("/api/songs") });
  const [filter, setFilter] = useState("ALL");

  const filtered = useMemo(() => {
    if (!songs) return [];
    if (filter === "ALL") return songs;
    return songs.filter((song) => song.status === filter);
  }, [songs, filter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Песни</CardTitle>
          <CardDescription>Отслеживай песню как процесс, а не как файл.</CardDescription>
        </CardHeader>
        <div className="max-w-xs">
          <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((song) => (
          <Link key={song.id} href={`/songs/${song.id}`}>
            <Card className="h-full transition hover:border-brand-accent">
              <CardHeader>
                <CardTitle>{song.title}</CardTitle>
                <CardDescription>{song.description}</CardDescription>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge>{song.status}</Badge>
                {song.bpm && <Badge>{song.bpm} BPM</Badge>}
              </div>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && <p className="text-sm text-brand-muted">Песни не найдены.</p>}
      </div>
    </div>
  );
}
