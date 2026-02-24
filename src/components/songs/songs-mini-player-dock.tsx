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

const progressBars = buildMiniBars(42);

export function SongsMiniPlayerDock() {
  const {
    activeItem,
    playing,
    currentTime,
    duration,
    seek,
    restart,
    pause,
    toggle,
    previous,
    next,
    canPrevious,
    canNext,
    openPlayerWindow
  } = useSongsPlayback();

  if (!activeItem) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const playAccentStyle = playbackAccentButtonStyle(activeItem.cover);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.7rem] z-40 px-3 md:bottom-[5.8rem] md:px-4">
      <div className="pointer-events-auto mx-auto max-w-5xl rounded-[22px] border border-brand-border bg-[#f4f8ee]/95 p-2.5 text-brand-ink shadow-[0_16px_36px_rgba(61,84,46,0.16)] backdrop-blur md:p-3">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border md:h-12 md:w-12"
            style={playAccentStyle}
            onClick={() => {
              if (playing) pause();
              else toggle(activeItem);
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            <PlaybackIcon type={playing ? "pause" : "play"} className="h-4 w-4 md:h-5 md:w-5" />
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
                        className={`block min-w-0 flex-1 rounded-full ${filled ? "bg-[#7abf52]" : "bg-[#b9c5b2]"}`}
                        style={{ height: `${Math.max(18, Math.round(26 * height))}px` }}
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

          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 md:h-10 md:w-10"
              onClick={previous}
              aria-label="Previous"
              disabled={!canPrevious}
            >
              ‹
            </button>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35 md:h-10 md:w-10"
              onClick={next}
              aria-label="Next"
              disabled={!canNext}
            >
              ›
            </button>
          </div>

          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-ink hover:bg-white md:h-10 md:w-10"
            onClick={restart}
            aria-label="Restart"
          >
            ↺
          </button>

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
