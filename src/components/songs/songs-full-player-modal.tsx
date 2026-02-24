"use client";

import { useEffect, useState } from "react";

import { PlaybackIcon } from "@/components/songs/playback-icon";
import { useSongsPlayback } from "@/components/songs/songs-playback-provider";
import { playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function buildBars(count: number) {
  return Array.from({ length: count }, (_, idx) => 0.2 + (((idx * 11) % 12) / 12) * 0.75);
}

const bars = buildBars(56);

export function SongsFullPlayerModal() {
  const playback = useSongsPlayback();
  const { activeItem, isPlayerWindowOpen, closePlayerWindow, playing, currentTime, duration, seek, toggle, pause, canNext, canPrevious, next, previous, restart, queue, queueIndex } = playback;
  const [showOrderControls, setShowOrderControls] = useState(false);

  useEffect(() => {
    if (!isPlayerWindowOpen) return;
    setShowOrderControls(false);
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePlayerWindow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePlayerWindow, isPlayerWindowOpen]);

  if (!isPlayerWindowOpen || !activeItem) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const playAccentStyle = playbackAccentButtonStyle(activeItem.cover);
  const coverStyle =
    activeItem.cover?.type === "image" && activeItem.cover.imageUrl
      ? {
          backgroundImage: `url(${activeItem.cover.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }
      : {
          background: `linear-gradient(145deg, ${activeItem.cover?.colorA || "#d9f99d"}, ${activeItem.cover?.colorB || "#65a30d"})`
        };

  return (
    <div className="fixed inset-0 z-[70] bg-[#0f140f]/40 backdrop-blur-md" onClick={closePlayerWindow}>
      <div className="flex min-h-full items-end justify-center p-3 md:items-center md:p-6">
        <div
          className="w-full max-w-md rounded-[28px] border border-brand-border bg-[#f4f8ee]/95 p-4 text-brand-ink shadow-[0_24px_60px_rgba(61,84,46,0.18)] md:max-w-2xl md:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold tracking-tight md:text-3xl">{activeItem.title}</p>
              <p className="truncate text-sm text-brand-muted md:text-base">{activeItem.subtitle}</p>
              <p className="mt-1 text-xs text-brand-muted">{queue.length ? `Трек ${queueIndex + 1} из ${queue.length}` : "Одиночное воспроизведение"}</p>
            </div>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-brand-border bg-white/85 text-xl text-brand-ink hover:bg-white"
              onClick={closePlayerWindow}
              aria-label="Close player"
            >
              ×
            </button>
          </div>

          <div className="relative mb-5 rounded-[24px] border border-brand-border bg-white/70 p-3 md:p-5">
            <div className="pointer-events-none absolute inset-y-0 right-2 hidden items-center md:flex">
              <div className="pointer-events-auto relative">
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-brand-border bg-white/85 text-lg text-brand-ink hover:bg-white"
                  onClick={() => setShowOrderControls((prev) => !prev)}
                  aria-label="Queue and playback order"
                  aria-expanded={showOrderControls}
                >
                  ☰
                </button>
                {showOrderControls && (
                  <div className="absolute right-0 top-14 w-14 rounded-[22px] border border-brand-border bg-[#f7fbf2]/95 p-2 shadow-[0_20px_40px_rgba(61,84,46,0.16)]">
                    <button type="button" className="mb-2 grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-ink hover:bg-white" title="Queue" aria-label="Queue">☰</button>
                    <button type="button" className="mb-2 grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-muted hover:bg-white" title="Shuffle (soon)" aria-label="Shuffle">⤮</button>
                    <button type="button" className="mb-2 grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-muted hover:bg-white" title="Repeat queue (soon)" aria-label="Repeat">↻</button>
                    <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-muted hover:bg-white" onClick={() => setShowOrderControls(false)} aria-label="Close controls">×</button>
                  </div>
                )}
              </div>
            </div>
            <div className="mx-auto aspect-square w-full max-w-[320px] rounded-full border border-black/20 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.25)]" style={coverStyle} />

            <div className="mt-6">
              <div className="relative h-14 overflow-hidden rounded-2xl border border-brand-border bg-white/85 px-3">
                <div className="flex h-full w-full items-center gap-[3px]">
                  {bars.map((height, idx) => {
                    const ratio = bars.length <= 1 ? 0 : idx / (bars.length - 1);
                    const filled = ratio <= progress;
                    return (
                      <span
                        key={`${idx}-${height}`}
                        className={`block min-w-0 flex-1 rounded-full ${filled ? "bg-[#7abf52]" : "bg-[#b9c5b2]"}`}
                        style={{ height: `${Math.max(16, Math.round(30 * height))}px` }}
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
                  className="absolute inset-y-0 left-3 right-3 h-full cursor-pointer opacity-0"
                  aria-label="Seek playback"
                />
              </div>
              <div className="mt-2 flex items-center justify-center gap-3 text-sm text-brand-ink">
                <span>{formatClock(currentTime)}</span>
                <span className="text-brand-muted">/</span>
                <span>{formatClock(duration)}</span>
              </div>
              {showOrderControls && (
                <div className="mt-3 flex items-center justify-center gap-2 md:hidden">
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-ink hover:bg-white" title="Queue" aria-label="Queue">☰</button>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-muted hover:bg-white" title="Shuffle (soon)" aria-label="Shuffle">⤮</button>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-muted hover:bg-white" title="Repeat queue (soon)" aria-label="Repeat">↻</button>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-muted hover:bg-white" onClick={() => setShowOrderControls(false)} aria-label="Close controls">×</button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-5 items-center gap-2">
            <button
              type="button"
              className="grid h-12 place-items-center rounded-2xl border border-brand-border bg-white/85 text-xl text-brand-ink hover:bg-white"
              onClick={restart}
              aria-label="Restart"
            >
              ↺
            </button>
            <button
              type="button"
              className="grid h-12 place-items-center rounded-2xl border border-brand-border bg-white/85 text-2xl text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
              onClick={previous}
              disabled={!canPrevious}
              aria-label="Previous"
            >
              ‹‹
            </button>
            <button
              type="button"
              className="grid h-14 place-items-center rounded-2xl border text-3xl hover:brightness-95"
              style={playAccentStyle}
              onClick={() => {
                if (playing) pause();
                else toggle(activeItem);
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              <PlaybackIcon type={playing ? "pause" : "play"} className="h-7 w-7" />
            </button>
            <button
              type="button"
              className="grid h-12 place-items-center rounded-2xl border border-brand-border bg-white/85 text-2xl text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
              onClick={next}
              disabled={!canNext}
              aria-label="Next"
            >
              ››
            </button>
            <button
              type="button"
              className="grid h-12 place-items-center rounded-2xl border border-brand-border bg-white/85 text-xl text-brand-ink hover:bg-white"
              onClick={() => setShowOrderControls((prev) => !prev)}
              aria-label="Queue and playback order"
              aria-expanded={showOrderControls}
            >
              ☰
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
