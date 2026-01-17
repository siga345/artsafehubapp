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
    return <p className="text-sm text-brand-muted">Loading...</p>;
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
          <CardTitle>Audio clips</CardTitle>
          <CardDescription>Uploaded voice memos and sketches.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {song.audioClips?.map((clip: any) => (
            <div key={clip.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{clip.filePath.split("/").pop()}</p>
              <p className="text-xs text-brand-muted">{clip.durationSec}s • {clip.noteText}</p>
            </div>
          ))}
          {!song.audioClips?.length && <p className="text-brand-muted">No clips yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lyrics / Notes</CardTitle>
          <CardDescription>Markdown editor for your working draft.</CardDescription>
        </CardHeader>
        <Textarea
          rows={6}
          placeholder="Write your draft here..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>What needs to be done for this song.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {song.tasks?.map((task: any) => (
            <div key={task.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-brand-muted">{task.status}</p>
            </div>
          ))}
          {!song.tasks?.length && <p className="text-brand-muted">No tasks yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget items</CardTitle>
          <CardDescription>Track estimated spending.</CardDescription>
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
          {!song.budgetItems?.length && <p className="text-brand-muted">No budget items yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People contributing to this song.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {song.members?.map((member: any) => (
            <div key={member.userId} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">{member.user?.name}</p>
              <p className="text-xs text-brand-muted">{member.role}</p>
            </div>
          ))}
          {!song.members?.length && <p className="text-brand-muted">No members yet.</p>}
        </div>
      </Card>

      {song.status === "READY_FOR_RELEASE" && (
        <Card>
          <CardHeader>
            <CardTitle>Release Gate Checklist</CardTitle>
            <CardDescription>Confirm every release item before shipping.</CardDescription>
          </CardHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <p>✅ Artwork prepared</p>
            <p>✅ Mastered audio</p>
            <p>✅ Metadata filled</p>
            <Button variant="secondary">Mark as released</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
