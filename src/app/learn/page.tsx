"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
}

export default function LearnPage() {
  const { data: items } = useQuery({ queryKey: ["learning"], queryFn: () => fetcher<any[]>("/api/learning") });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!query) return items;
    return items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
  }, [items, query]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Learning library</CardTitle>
          <CardDescription>Filter by tags, song status, or PATH level.</CardDescription>
        </CardHeader>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources" />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <div className="text-sm text-brand-muted">
              <p>Type: {item.type}</p>
              <p>Tags: {item.tags?.join(", ")}</p>
              <a className="text-brand-accent" href={item.url} target="_blank" rel="noreferrer">
                Open resource
              </a>
            </div>
          </Card>
        ))}
        {!filtered.length && <p className="text-sm text-brand-muted">No learning items found.</p>}
      </div>
    </div>
  );
}
