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
          <CardTitle>Current PATH level</CardTitle>
          <CardDescription>{currentLevel?.name ?? "Loading..."}</CardDescription>
        </CardHeader>
        <div className="prose-mvp">
          <p>{currentLevel?.description ?? ""}</p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priority tasks</CardTitle>
          <CardDescription>1–3 focus items to keep momentum.</CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm text-slate-700">
          {priorityTasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2">
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-brand-muted">{task.status}</p>
            </li>
          ))}
          {priorityTasks.length === 0 && <li className="text-brand-muted">No tasks yet.</li>}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Capture momentum in one click.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">Record Idea</Button>
          <Button variant="secondary">Create Song</Button>
          <Button variant="secondary">Ask Assistant</Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next step</CardTitle>
          <CardDescription>Mock AI suggestion based on your context.</CardDescription>
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
            Get next step
          </Button>
          {nextStep && <p className="text-sm text-slate-700">{nextStep}</p>}
        </div>
      </Card>
    </div>
  );
}
