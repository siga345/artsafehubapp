"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
}

export default function IdeasPage() {
  const { data: ideas, refetch } = useQuery({ queryKey: ["ideas"], queryFn: () => fetcher<any[]>("/api/ideas") });
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Создать текстовую идею</CardTitle>
          <CardDescription>Быстро фиксируй тексты, хуки и концепции.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название идеи" />
          <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} placeholder="Идея в Markdown" />
          <Button
            onClick={async () => {
              await fetch("/api/ideas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, text, tags: [] })
              });
              setTitle("");
              setText("");
              await refetch();
            }}
          >
            Сохранить идею
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Загрузить аудио‑идею</CardTitle>
          <CardDescription>Прикрепи войс‑мемо или мелодический скетч.</CardDescription>
        </CardHeader>
        <div className="prose-mvp">
          <p>Загрузка через /api/audio-clips (multipart). UI‑заглушка для MVP.</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Библиотека идей</CardTitle>
          <CardDescription>Преобразуй идеи в песни, когда готов.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {ideas?.map((idea) => (
            <div key={idea.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{idea.title}</p>
              <p className="text-xs text-brand-muted">{idea.tags?.join(", ") || "Без тегов"}</p>
              <Button variant="secondary" className="mt-2">Преобразовать в песню</Button>
            </div>
          ))}
          {!ideas?.length && <p className="text-brand-muted">Пока нет идей.</p>}
        </div>
      </Card>
    </div>
  );
}
