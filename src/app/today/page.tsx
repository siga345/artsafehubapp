"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
}

export default function TodayPage() {
  const { data: levels } = useQuery({ queryKey: ["path-levels"], queryFn: () => fetcher<any[]>("/api/path/levels") });
  const { data: tasks } = useQuery({ queryKey: ["tasks"], queryFn: () => fetcher<any[]>("/api/tasks") });
  const [nextStep, setNextStep] = useState<string | null>(null);

  const currentLevel = levels?.[0];
  const priorityTasks = tasks?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Текущий уровень PATH</CardTitle>
          <CardDescription>{currentLevel?.name ?? "Загрузка..."}</CardDescription>
        </CardHeader>
        <div className="prose-mvp">
          <p>{currentLevel?.description ?? ""}</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Приоритетные задачи</CardTitle>
          <CardDescription>1–3 фокус‑задачи для поддержания темпа.</CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm text-slate-700">
          {priorityTasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2">
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-brand-muted">{task.status}</p>
            </li>
          ))}
          {priorityTasks.length === 0 && <li className="text-brand-muted">Пока нет задач.</li>}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
          <CardDescription>Фиксируй импульс в один клик.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Записать идею</Button>
          <Button variant="secondary">Создать песню</Button>
          <Button variant="secondary">Спросить ассистента</Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Следующий шаг</CardTitle>
          <CardDescription>Подсказка от мок‑AI на основе контекста.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <Button
            onClick={async () => {
              const response = await fetch("/api/assistant/next-step", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  songStatus: "WRITING",
                  taskCount: tasks?.length ?? 0,
                  pathLevelName: currentLevel?.name
                })
              });
              const data = await response.json();
              setNextStep(data.nextStep);
            }}
          >
            Получить следующий шаг
          </Button>
          {nextStep && <p className="text-sm text-slate-700">{nextStep}</p>}
        </div>
      </Card>
    </div>
  );
}
