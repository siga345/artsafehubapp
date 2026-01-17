"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
}

export default function StudioPage() {
  const { data: bookings, refetch } = useQuery({ queryKey: ["bookings"], queryFn: () => fetcher<any[]>("/api/bookings") });
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [status, setStatus] = useState("REQUESTED");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create booking</CardTitle>
          <CardDescription>Simple list-based calendar for sessions.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
          <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="REQUESTED">Requested</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <Button
          className="mt-3"
          onClick={async () => {
            await fetch("/api/bookings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startAt: new Date(startAt).toISOString(),
                endAt: new Date(endAt).toISOString(),
                status,
                notes: "New studio booking"
              })
            });
            setStartAt("");
            setEndAt("");
            await refetch();
          }}
        >
          Save booking
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking list</CardTitle>
          <CardDescription>Upcoming and past sessions.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm">
          {bookings?.map((booking) => (
            <div key={booking.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <p className="font-medium">
                {new Date(booking.startAt).toLocaleString()} → {new Date(booking.endAt).toLocaleString()}
              </p>
              <p className="text-xs text-brand-muted">{booking.status}</p>
            </div>
          ))}
          {!bookings?.length && <p className="text-brand-muted">No bookings yet.</p>}
        </div>
      </Card>
    </div>
  );
}
