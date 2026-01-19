"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AssistantPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ассистент</CardTitle>
          <CardDescription>Интерфейс мок‑AI для структурированных подсказок.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Badge>Песня: Neon Streetlights</Badge>
          <Badge>Идея: Night ride hook</Badge>
          <Badge>PATH: Idea Collector</Badge>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="space-y-3">
          {messages.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={`rounded-lg border border-brand-border p-3 text-sm ${
                item.role === "assistant" ? "bg-slate-50" : "bg-white"
              }`}
            >
              <p className="text-xs text-brand-muted">{item.role === "assistant" ? "Ассистент" : "Вы"}</p>
              <p>{item.text}</p>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-brand-muted">Пока нет сообщений.</p>}
        </div>

        <div className="flex gap-2">
          <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Задать вопрос ассистенту" />
          <Button
            onClick={async () => {
              if (!message) return;
              const nextMessages = [...messages, { role: "user", text: message }];
              setMessages(nextMessages);
              setMessage("");
              const response = await fetch("/api/assistant/message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message,
                  songStatus: "WRITING",
                  taskCount: 2,
                  pathLevelName: "Idea Collector"
                })
              });
              const data = await response.json();
              setMessages([...nextMessages, { role: "assistant", text: data.reply }]);
            }}
          >
            Отправить
          </Button>
        </div>
      </Card>
    </div>
  );
}
