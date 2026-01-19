"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
}

export default function PathPage() {
  const { data: levels } = useQuery({ queryKey: ["path-levels"], queryFn: () => fetcher<any[]>("/api/path/levels") });
  const { data: logs } = useQuery({ queryKey: ["path-logs"], queryFn: () => fetcher<any[]>("/api/path/progress") });
  const [contract, setContract] = useState("");

  const currentLevel = levels?.[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Текущий уровень</CardTitle>
          <CardDescription>{currentLevel?.name ?? "Загрузка..."}</CardDescription>
        </CardHeader>
        <div className="prose-mvp space-y-2">
          <p>{currentLevel?.description}</p>
          <pre className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {JSON.stringify(currentLevel?.criteria ?? {}, null, 2)}
          </pre>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Чек‑лист</CardTitle>
          <CardDescription>Критерии перехода для этого уровня PATH.</CardDescription>
        </CardHeader>
        <pre className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {JSON.stringify(currentLevel?.checklistTemplate ?? {}, null, 2)}
        </pre>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Контракт с собой</CardTitle>
          <CardDescription>Запиши обязательства для этого уровня.</CardDescription>
        </CardHeader>
        <Textarea rows={4} value={contract} onChange={(event) => setContract(event.target.value)} />
        <Button className="mt-3" variant="secondary">
          Сохранить обязательства
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Таймлайн прогресса</CardTitle>
          <CardDescription>Заметки и milestones по пути.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {logs?.map((log) => (
            <div key={log.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{log.type}</p>
              <p className="text-xs text-brand-muted">{log.text}</p>
            </div>
          ))}
          {!logs?.length && <p className="text-brand-muted">Пока нет записей прогресса.</p>}
        </div>
      </Card>
    </div>
  );
}
