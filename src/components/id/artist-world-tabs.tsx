"use client";

import { Image, ListMusic, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ArtistWorldTab = "text" | "visual" | "playlist";

const tabs: Array<{ value: ArtistWorldTab; label: string; icon: typeof Type }> = [
  { value: "text", label: "Текст", icon: Type },
  { value: "visual", label: "Визуал", icon: Image },
  { value: "playlist", label: "Плейлист", icon: ListMusic }
];

export function ArtistWorldTabs(props: { activeTab: ArtistWorldTab; onTabChange: (tab: ArtistWorldTab) => void }) {
  return (
    <div className="inline-flex rounded-2xl border border-brand-border bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Button
            key={tab.value}
            type="button"
            variant={props.activeTab === tab.value ? "primary" : "ghost"}
            className="rounded-xl px-3"
            onClick={() => props.onTabChange(tab.value)}
          >
            <Icon className="mr-1.5 h-4 w-4" />
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}
