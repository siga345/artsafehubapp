"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";

type PathStage = {
  id: number;
  name: string;
};

type Demo = {
  id: string;
  audioUrl: string;
  textNote: string | null;
  duration: number;
  createdAt: string;
};

type Track = {
  id: string;
  title: string;
  folderId: string | null;
  pathStageId: number | null;
  pathStage?: PathStage | null;
  demos: Demo[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function formatDuration(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

export default function SongDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: track, refetch } = useQuery({
    queryKey: ["song-track", params.id],
    queryFn: () => fetcher<Track>(`/api/songs/${params.id}`)
  });
  const { data: stages } = useQuery({
    queryKey: ["song-path-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/path/stages")
  });

  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [updatingDemoId, setUpdatingDemoId] = useState("");
  const [demoNotes, setDemoNotes] = useState<Record<string, string>>({});

  if (!track) {
    return <p className="text-sm text-brand-muted">Загрузка трека...</p>;
  }

  const currentTitle = title || track.title;
  const currentStage = stageId === "" ? track.pathStageId : stageId === "NONE" ? null : Number(stageId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Трек</CardTitle>
          <CardDescription>Название и этап по PATH.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={currentTitle} onChange={(event) => setTitle(event.target.value)} />
          <Select
            value={currentStage ? String(currentStage) : "NONE"}
            onChange={(event) => setStageId(event.target.value)}
          >
            <option value="NONE">Этап не выбран</option>
            {stages?.map((stage) => (
              <option key={stage.id} value={String(stage.id)}>
                {stage.name}
              </option>
            ))}
          </Select>
          <Button
            disabled={savingMeta || !currentTitle.trim()}
            onClick={async () => {
              setSavingMeta(true);
              await apiFetch(`/api/songs/${track.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: currentTitle.trim(),
                  pathStageId: currentStage ?? null
                })
              });
              setTitle("");
              setStageId("");
              await refetch();
              setSavingMeta(false);
            }}
          >
            {savingMeta ? "Сохраняем..." : "Сохранить"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Демки</CardTitle>
          <CardDescription>Аудио + текст к демке + этап трека.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          {track.demos.map((demo) => (
            <div key={demo.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <audio controls src={`/api/audio-clips/${demo.id}/stream`} className="w-full" />
              <p className="mt-2 text-xs text-brand-muted">
                {formatDate(demo.createdAt)} • {formatDuration(demo.duration)}
              </p>
              <Input
                className="mt-2"
                value={demoNotes[demo.id] ?? demo.textNote ?? ""}
                onChange={(event) =>
                  setDemoNotes((prev) => ({
                    ...prev,
                    [demo.id]: event.target.value
                  }))
                }
                placeholder="Текст к демке"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={updatingDemoId === demo.id}
                  onClick={async () => {
                    setUpdatingDemoId(demo.id);
                    await apiFetch(`/api/audio-clips/${demo.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ textNote: (demoNotes[demo.id] ?? "").trim() || null })
                    });
                    await refetch();
                    setUpdatingDemoId("");
                  }}
                >
                  Сохранить текст
                </Button>
                <Button
                  variant="secondary"
                  disabled={updatingDemoId === demo.id}
                  onClick={async () => {
                    setUpdatingDemoId(demo.id);
                    await apiFetch(`/api/audio-clips/${demo.id}`, { method: "DELETE" });
                    await refetch();
                    setUpdatingDemoId("");
                  }}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
          {!track.demos.length && <p className="text-sm text-brand-muted">Пока нет демок. Запиши первую на вкладке SONGS.</p>}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => router.push("/songs")}>
          Записать новую демку
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            await apiFetch(`/api/songs/${track.id}`, { method: "DELETE" });
            router.push("/songs");
          }}
        >
          Удалить трек
        </Button>
      </div>
    </div>
  );
}
