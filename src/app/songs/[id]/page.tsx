"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statuses = [
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

export default function SongDetailPage({ params }: { params: { id: string } }) {
  const { data: song } = useQuery({ queryKey: ["song", params.id], queryFn: () => fetcher<any>(`/api/songs/${params.id}`) });
  const [notes, setNotes] = useState("");

  if (!song) {
    return <p className="text-sm text-brand-muted">Загрузка...</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{song.title}</CardTitle>
          <CardDescription>{song.description}</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Select defaultValue={song.status}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          {song.bpm && <Badge>{song.bpm} BPM</Badge>}
          {song.key && <Badge>Key: {song.key}</Badge>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Аудио‑клипы</CardTitle>
          <CardDescription>Загруженные войс‑мемо и скетчи.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {song.audioClips?.map((clip: any) => (
            <div key={clip.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{clip.filePath.split("/").pop()}</p>
              <p className="text-xs text-brand-muted">{clip.durationSec}s • {clip.noteText}</p>
            </div>
          ))}
          {!song.audioClips?.length && <p className="text-brand-muted">Пока нет клипов.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Текст / заметки</CardTitle>
          <CardDescription>Markdown‑редактор для черновика.</CardDescription>
        </CardHeader>
        <Textarea
          rows={6}
          placeholder="Пиши черновик здесь..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Задачи</CardTitle>
          <CardDescription>Что нужно сделать для этой песни.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {song.tasks?.map((task: any) => (
            <div key={task.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-brand-muted">{task.status}</p>
            </div>
          ))}
          {!song.tasks?.length && <p className="text-brand-muted">Пока нет задач.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Бюджет</CardTitle>
          <CardDescription>Отслеживай плановые расходы.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {song.budgetItems?.map((item: any) => (
            <div key={item.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{item.category}</p>
              <p className="text-xs text-brand-muted">
                {item.amount} {item.currency} • {item.note}
              </p>
            </div>
          ))}
          {!song.budgetItems?.length && <p className="text-brand-muted">Пока нет статей бюджета.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Участники</CardTitle>
          <CardDescription>Люди, которые работают над песней.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {song.members?.map((member: any) => (
            <div key={member.userId} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{member.user?.name}</p>
              <p className="text-xs text-brand-muted">{member.role}</p>
            </div>
          ))}
          {!song.members?.length && <p className="text-brand-muted">Пока нет участников.</p>}
        </div>
      </Card>

      {song.status === "READY_FOR_RELEASE" && (
        <Card>
          <CardHeader>
          <CardTitle>Release Gate чек‑лист</CardTitle>
          <CardDescription>Проверь все пункты перед релизом.</CardDescription>
          </CardHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <p>✅ Артворк готов</p>
            <p>✅ Мастер готов</p>
            <p>✅ Метаданные заполнены</p>
            <Button variant="secondary">Отметить как релиз</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
