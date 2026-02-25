"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PlaybackIcon } from "@/components/songs/playback-icon";
import { useSongsPlayback } from "@/components/songs/songs-playback-provider";
import { playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function buildMiniBars(count: number) {
  return Array.from({ length: count }, (_, idx) => 0.2 + (((idx * 17) % 10) / 10) * 0.75);
}

function hexToRgb(color: string) {
  const value = color.trim();
  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (hex.length === 3) {
    const [r, g, b] = hex.split("");
    const rr = Number.parseInt(`${r}${r}`, 16);
    const gg = Number.parseInt(`${g}${g}`, 16);
    const bb = Number.parseInt(`${b}${b}`, 16);
    if ([rr, gg, bb].some((item) => Number.isNaN(item))) return null;
    return { r: rr, g: gg, b: bb };
  }
  if (hex.length !== 6) return null;
  const rr = Number.parseInt(hex.slice(0, 2), 16);
  const gg = Number.parseInt(hex.slice(2, 4), 16);
  const bb = Number.parseInt(hex.slice(4, 6), 16);
  if ([rr, gg, bb].some((item) => Number.isNaN(item))) return null;
  return { r: rr, g: gg, b: bb };
}

function mixHexColors(colorA: string, colorB: string, ratio: number) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  if (!a || !b) return null;
  const t = Math.min(Math.max(ratio, 0), 1);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bCh = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bCh})`;
}

function rgbaFromHex(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

const progressBars = buildMiniBars(42);

export function SongsMiniPlayerDock() {
  const {
    activeItem,
    playing,
    currentTime,
    duration,
    seek,
    toggle,
    openPlayerWindow
  } = useSongsPlayback();

  if (!activeItem) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const playAccentStyle = playbackAccentButtonStyle(activeItem.cover);
  const coverColorA = activeItem.cover?.colorA || "#d9f99d";
  const coverColorB = activeItem.cover?.colorB || "#65a30d";
  const mutedTrackBarsColor = rgbaFromHex(mixHexColors(coverColorA, coverColorB, 0.5) || coverColorB, 0.28) || "#b9c5b2";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.7rem] z-40 px-3 md:bottom-[5.8rem] md:px-4">
      <div className="pointer-events-auto mx-auto max-w-5xl rounded-[22px] border border-brand-border bg-[#f4f8ee]/95 p-2.5 text-brand-ink shadow-[0_16px_36px_rgba(61,84,46,0.16)] backdrop-blur md:p-3">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border shadow-[0_8px_16px_rgba(61,84,46,0.18)] hover:brightness-95 md:h-10 md:w-10"
            style={playAccentStyle}
            onClick={() => toggle(activeItem)}
            aria-label={playing ? "Pause" : "Play"}
          >
            <PlaybackIcon type={playing ? "pause" : "play"} className="h-4 w-4" />
          </button>

          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={openPlayerWindow}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPlayerWindow();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Open full player"
          >
            <p className="truncate text-sm font-semibold leading-tight">{activeItem.title}</p>
            <p className="truncate text-[11px] text-brand-muted md:text-xs">{activeItem.subtitle}</p>

            <div className="mt-1.5 flex items-center gap-1.5 md:mt-2 md:gap-2">
              <span className="hidden w-9 text-[11px] text-brand-muted sm:block">{formatClock(currentTime)}</span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-xl border border-brand-border bg-white/80 px-2">
                <div className="flex h-full w-full items-center gap-[2px]">
                  {progressBars.map((height, idx) => {
                    const ratio = progressBars.length <= 1 ? 0 : idx / (progressBars.length - 1);
                    const filled = ratio <= progress;
                    return (
                      <span
                        key={`${idx}-${height}`}
                        className="block min-w-0 flex-1 rounded-full"
                        style={{
                          height: `${Math.max(18, Math.round(26 * height))}px`,
                          backgroundColor: filled ? mixHexColors(coverColorA, coverColorB, ratio) || coverColorB : mutedTrackBarsColor
                        }}
                      />
                    );
                  })}
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0.01)}
                  step={0.01}
                  value={Math.min(currentTime, duration || 0)}
                  onInput={(event) => seek(Number((event.target as HTMLInputElement).value))}
                  onChange={(event) => seek(Number(event.target.value))}
                  onPointerDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute inset-y-0 left-2 right-2 h-full cursor-pointer opacity-0"
                  aria-label="Seek playback"
                />
              </div>
              <span className="hidden w-9 text-right text-[11px] text-brand-muted sm:block">{formatClock(duration)}</span>
            </div>
          </div>

          {activeItem.linkHref && (
            <Link href={activeItem.linkHref} className="hidden sm:block">
              <Button variant="secondary" className="border-brand-border bg-white/85 text-brand-ink hover:bg-white">
                Версии
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
