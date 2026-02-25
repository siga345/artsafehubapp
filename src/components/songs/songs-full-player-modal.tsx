"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";

import { SongsCircularAudioVisualizer } from "@/components/songs/songs-circular-audio-visualizer";
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

const bars = buildBars(56);

export function SongsFullPlayerModal() {
  const playback = useSongsPlayback();
  const {
    activeItem,
    isPlayerWindowOpen,
    closePlayerWindow,
    playing,
    currentTime,
    duration,
    seek,
    toggle,
    pause,
    canNext,
    canPrevious,
    next,
    previous,
    queue,
    queueIndex,
    repeatMode,
    shuffleEnabled,
    cycleRepeatMode,
    toggleShuffle,
    getOrCreateAnalyserNode,
    resumeAnalyserContext
  } = playback;
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    if (!isPlayerWindowOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePlayerWindow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePlayerWindow, isPlayerWindowOpen]);

  useEffect(() => {
    if (!isPlayerWindowOpen) return;
    const node = getOrCreateAnalyserNode();
    if (node) setAnalyser(node);
  }, [getOrCreateAnalyserNode, isPlayerWindowOpen]);

  useEffect(() => {
    if (!isPlayerWindowOpen) return;
    const node = getOrCreateAnalyserNode();
    if (node) setAnalyser(node);
    if (!playing) return;
    void resumeAnalyserContext().catch(() => null);
  }, [activeItem?.demoId, getOrCreateAnalyserNode, isPlayerWindowOpen, playing, resumeAnalyserContext]);

  if (!isPlayerWindowOpen || !activeItem) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const coverColorA = activeItem.cover?.colorA || "#d9f99d";
  const coverColorB = activeItem.cover?.colorB || "#65a30d";
  const mutedTrackBarsColor = rgbaFromHex(mixHexColors(coverColorA, coverColorB, 0.5) || coverColorB, 0.28) || "#b9c5b2";
  const repeatButtonTitle =
    repeatMode === "off"
      ? "Repeat: выключен"
      : repeatMode === "queue"
        ? "Repeat: плейлист"
        : "Repeat: трек";
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
  const playAccentStyle = playbackAccentButtonStyle(activeItem.cover);
  const transportButtonBaseClassName =
    "grid h-11 w-11 place-items-center rounded-full border border-brand-border bg-white/80 text-brand-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35";
  const transportToggleActiveClassName = "border-[#9fc7b3] bg-[#e7f2eb] text-[#2e6855] hover:bg-[#edf6f0]";
  const transportToggleIdleClassName = "border-brand-border bg-white/80 text-brand-ink hover:bg-white";
  const repeatButtonClassName = repeatMode === "off" ? transportToggleIdleClassName : transportToggleActiveClassName;
  const shuffleButtonClassName = shuffleEnabled ? transportToggleActiveClassName : transportToggleIdleClassName;

  return (
    <div className="fixed inset-0 z-[70] bg-[#0f140f]/40 backdrop-blur-md" onClick={closePlayerWindow}>
      <div className="flex min-h-full items-center justify-center p-3 md:p-6">
        <div
          className="w-full max-w-3xl rounded-[28px] border border-brand-border bg-[#f4f8ee]/95 p-4 text-brand-ink shadow-[0_24px_60px_rgba(61,84,46,0.18)] md:p-6 lg:max-w-4xl"
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

          <div className="relative mx-auto mb-5 flex min-h-[460px] w-full max-w-sm items-center justify-center p-3 md:min-h-[560px] md:p-5">
            <SongsCircularAudioVisualizer
              analyser={analyser}
              playing={playing}
              coverStyle={coverStyle}
              coverColors={{ colorA: activeItem.cover?.colorA, colorB: activeItem.cover?.colorB }}
              className="max-w-[280px] md:max-w-[340px]"
            />
          </div>

          <div className="relative z-10 mx-auto mb-4 w-full max-w-sm">
            <div className="relative h-14 overflow-hidden rounded-2xl border border-brand-border bg-white/85 px-3">
              <div className="flex h-full w-full items-center gap-[3px]">
                {bars.map((height, idx) => {
                  const ratio = bars.length <= 1 ? 0 : idx / (bars.length - 1);
                  const filled = ratio <= progress;
                  return (
                    <span
                      key={`${idx}-${height}`}
                      className="block min-w-0 flex-1 rounded-full"
                      style={{
                        height: `${Math.max(16, Math.round(30 * height))}px`,
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
                className="absolute inset-y-0 left-3 right-3 h-full cursor-pointer opacity-0"
                aria-label="Seek playback"
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-3 text-sm text-brand-ink">
              <span>{formatClock(currentTime)}</span>
              <span className="text-brand-muted">/</span>
              <span>{formatClock(duration)}</span>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-sm items-center justify-between rounded-[22px] border border-brand-border bg-[#eef4e7]/95 px-4 py-2 shadow-[0_10px_24px_rgba(61,84,46,0.12)]">
            <button
              type="button"
              className={`${transportButtonBaseClassName} ${shuffleButtonClassName}`}
              onClick={toggleShuffle}
              aria-label={shuffleEnabled ? "Shuffle: включен" : "Shuffle: выключен"}
              title={shuffleEnabled ? "Shuffle: включен" : "Shuffle: выключен"}
              aria-pressed={shuffleEnabled}
            >
              <Shuffle className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={transportButtonBaseClassName}
              onClick={previous}
              disabled={!canPrevious}
              aria-label="Previous"
            >
              <SkipBack className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="grid h-14 w-14 place-items-center rounded-full border shadow-[0_8px_20px_rgba(61,84,46,0.22)] transition hover:brightness-95"
              style={playAccentStyle}
              onClick={() => {
                if (playing) pause();
                else toggle(activeItem);
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-6 w-6" strokeWidth={2.5} /> : <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={2.2} />}
            </button>
            <button
              type="button"
              className={transportButtonBaseClassName}
              onClick={next}
              disabled={!canNext}
              aria-label="Next"
            >
              <SkipForward className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={`${transportButtonBaseClassName} ${repeatButtonClassName}`}
              onClick={cycleRepeatMode}
              aria-label={repeatButtonTitle}
              title={repeatButtonTitle}
            >
              {repeatMode === "track" ? <Repeat1 className="h-5 w-5" strokeWidth={2.2} /> : <Repeat className="h-5 w-5" strokeWidth={2.2} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
