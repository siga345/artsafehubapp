"use client";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AssistantPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI ASSIST</CardTitle>
          <CardDescription>Скоро будет доступно.</CardDescription>
        </CardHeader>
        <div className="space-y-3 text-sm text-brand-muted">
          <p>В будущих версиях AI поможет с поддержкой, навигацией по PATH и поиском нужных людей.</p>
          <Button disabled>Открыть чат</Button>
        </div>
      </Card>
    </div>
  );
}
