"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const AUDIO_FOCUS_EVENT = "artsafehub:audio-focus";

type AudioWaveformPlayerProps = {
  src: string;
  className?: string;
  barCount?: number;
  loopRangePercent?: { start: number; end: number };
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function buildPeaks(channelData: Float32Array, barCount: number) {
  const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
  const peaks: number[] = [];
  for (let i = 0; i < barCount; i += 1) {
    const start = i * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    let peak = 0;
    for (let j = start; j < end; j += 1) {
      const value = Math.abs(channelData[j]);
      if (value > peak) peak = value;
    }
    peaks.push(Math.max(0.02, Math.min(1, peak)));
  }
  return peaks;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function AudioWaveformPlayer({ src, className = "", barCount = 120, loopRangePercent }: AudioWaveformPlayerProps) {
  const [peaks, setPeaks] = useState<number[]>(Array.from({ length: barCount }, () => 0.06));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceIdRef = useRef(`waveform:${Math.random().toString(36).slice(2)}`);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.max(0, Math.min(1, currentTime / duration));
  }, [currentTime, duration]);

  const normalizedLoopRange = useMemo(() => {
    if (!loopRangePercent) return null;
    const start = clamp(Number(loopRangePercent.start) || 0, 0, 99);
    const end = clamp(Number(loopRangePercent.end) || 100, 1, 100);
    if (end <= start) return null;
    if (start === 0 && end === 100) return null;
    return { start, end };
  }, [loopRangePercent]);

  const loopRangeSeconds = useMemo(() => {
    if (!normalizedLoopRange || !duration) return null;
    const startSec = (normalizedLoopRange.start / 100) * duration;
    const endSec = (normalizedLoopRange.end / 100) * duration;
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return null;
    return { startSec, endSec };
  }, [duration, normalizedLoopRange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPeaks(Array.from({ length: barCount }, () => 0.06));

    async function decode() {
      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error("Не удалось загрузить аудио.");
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new window.AudioContext();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        const nextPeaks = buildPeaks(decoded.getChannelData(0), barCount);
        if (!cancelled) {
          setPeaks(nextPeaks);
        }
        await audioCtx.close();
      } catch {
        if (!cancelled) {
          setError("Waveform недоступна для этого файла.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    decode();
    return () => {
      cancelled = true;
    };
  }, [barCount, src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (!cssWidth || !cssHeight) return;

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const midY = height / 2;
    const barWidth = width / peaks.length;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#101114";
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < peaks.length; i += 1) {
      const x = i * barWidth;
      const amp = peaks[i];
      const barHeight = Math.max(height * 0.08, amp * height * 0.9);
      const y = midY - barHeight / 2;

      const ratio = i / peaks.length;
      ctx.fillStyle = ratio <= progress ? "#ffffff" : "rgba(255,255,255,0.35)";
      ctx.fillRect(x, y, Math.max(1, barWidth * 0.72), barHeight);
    }

    const markerX = progress * width;
    ctx.fillStyle = "#ffe900";
    ctx.globalAlpha = 0.95;
    ctx.fillRect(markerX, 0, Math.max(2, barWidth * 0.8), height);
    ctx.globalAlpha = 1;
    if (normalizedLoopRange) {
      const left = (normalizedLoopRange.start / 100) * width;
      const right = (normalizedLoopRange.end / 100) * width;
      const loopWidth = Math.max(2, right - left);
      ctx.fillStyle = "rgba(231,240,74,0.16)";
      ctx.fillRect(left, 0, loopWidth, height);
      ctx.strokeStyle = "rgba(42,52,44,0.38)";
      ctx.lineWidth = Math.max(1, dpr);
      ctx.setLineDash([4 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(left, 0);
      ctx.lineTo(left, height);
      ctx.moveTo(right, 0);
      ctx.lineTo(right, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [normalizedLoopRange, peaks, progress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !loopRangeSeconds) return;
    const epsilon = Math.max(0.01, duration * 0.0025);
    if (audio.currentTime < loopRangeSeconds.startSec || audio.currentTime > loopRangeSeconds.endSec - epsilon) {
      audio.currentTime = loopRangeSeconds.startSec;
      setCurrentTime(loopRangeSeconds.startSec);
    }
  }, [duration, loopRangeSeconds]);

  useEffect(() => {
    function onAudioFocus(event: Event) {
      const custom = event as CustomEvent<{ sourceId?: string }>;
      if (custom.detail?.sourceId === sourceIdRef.current) return;
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      audio.pause();
    }

    window.addEventListener(AUDIO_FOCUS_EVENT, onAudioFocus);
    return () => window.removeEventListener(AUDIO_FOCUS_EVENT, onAudioFocus);
  }, []);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (loopRangeSeconds) {
        const epsilon = Math.max(0.01, duration * 0.0025);
        if (audio.currentTime < loopRangeSeconds.startSec || audio.currentTime > loopRangeSeconds.endSec - epsilon) {
          audio.currentTime = loopRangeSeconds.startSec;
          setCurrentTime(loopRangeSeconds.startSec);
        }
      }
      audio.play().catch(() => null);
    } else {
      audio.pause();
    }
  }

  function seekTo(event: React.MouseEvent<HTMLCanvasElement>) {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !duration) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const ratio = Math.max(0, Math.min(1, x / bounds.width));
    let nextTime = ratio * duration;
    if (loopRangeSeconds) {
      nextTime = clamp(nextTime, loopRangeSeconds.startSec, loopRangeSeconds.endSec);
    }
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <div className={`min-w-0 space-y-2 ${className}`.trim()}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 border-white/10 bg-[#141519] text-white hover:bg-white/10"
          onClick={togglePlayback}
        >
          {playing ? "Пауза" : "Слушать"}
        </Button>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-white/10 bg-[#101114]">
          <canvas ref={canvasRef} onClick={seekTo} className="h-16 w-full cursor-pointer bg-[#101114]" />
          {loading && <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/5" />}
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-white/45">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {error && <p className="text-xs text-white/45">{error}</p>}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          window.dispatchEvent(new CustomEvent(AUDIO_FOCUS_EVENT, { detail: { sourceId: sourceIdRef.current } }));
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (loopRangeSeconds) {
            const epsilon = Math.max(0.01, duration * 0.0025);
            if (audio.currentTime >= loopRangeSeconds.endSec - epsilon) {
              audio.currentTime = loopRangeSeconds.startSec;
              setCurrentTime(loopRangeSeconds.startSec);
              return;
            }
          }
          setCurrentTime(audio.currentTime);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
