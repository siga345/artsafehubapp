"use client";

import { ExternalLink, Link2, ListMusic } from "lucide-react";
import { Input } from "@/components/ui/input";

export function ArtistWorldPlaylistEditor(props: {
  playlistUrl: string;
  onPlaylistUrlChange: (url: string) => void;
}) {
  const hasUrl = props.playlistUrl.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-brand-border bg-[#f9fbf6] p-4">
        <div>
          <p className="text-sm font-medium text-brand-ink">Плейлист референсов</p>
          <p className="text-xs text-brand-muted">
            Вставь ссылку на плейлист твоих музыкальных референсов (Яндекс Музыка, Spotify, Apple Music и т.д.)
          </p>
        </div>

        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            value={props.playlistUrl}
            onChange={(e) => props.onPlaylistUrlChange(e.target.value)}
            placeholder="https://music.yandex.ru/users/.../playlists/..."
            className="bg-white pl-9"
          />
        </div>

        {hasUrl && (
          <a
            href={props.playlistUrl.trim()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#cbdab8] bg-[#f5faeb] px-4 py-3 text-sm font-medium text-[#4b6440] transition-colors hover:bg-[#ecf4df]"
          >
            <ListMusic className="h-4 w-4" />
            Открыть плейлист
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
