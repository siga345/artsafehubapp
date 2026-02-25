"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const GLOBAL_PLAYBACK_SOURCE_ID = "songs-global-player";
const AUDIO_FOCUS_EVENT = "artsafehub:audio-focus";

export type SongsPlaybackItem = {
  demoId: string;
  src: string;
  title: string;
  subtitle: string;
  linkHref?: string;
  durationSec?: number;
  trackId: string;
  projectId?: string | null;
  versionType?: string;
  queueGroupType?: "project" | "track";
  queueGroupId?: string;
  cover?: {
    type: "gradient" | "image";
    imageUrl?: string | null;
    colorA?: string | null;
    colorB?: string | null;
  };
  meta?: {
    projectTitle?: string;
    pathStageName?: string;
  };
};

type SongsPlaybackQueueContext = {
  type: "project" | "track";
  projectId?: string;
  trackId?: string;
  title?: string;
} | null;

export type SongsPlaybackRepeatMode = "off" | "queue" | "track";

type SongsPlaybackContextValue = {
  activeItem: SongsPlaybackItem | null;
  queue: SongsPlaybackItem[];
  queueIndex: number;
  queueContext: SongsPlaybackQueueContext;
  playing: boolean;
  currentTime: number;
  duration: number;
  repeatMode: SongsPlaybackRepeatMode;
  shuffleEnabled: boolean;
  canNext: boolean;
  canPrevious: boolean;
  isPlayerWindowOpen: boolean;
  play: (item: SongsPlaybackItem) => void;
  playQueue: (items: SongsPlaybackItem[], startIndex?: number, context?: SongsPlaybackQueueContext) => void;
  toggle: (item: SongsPlaybackItem) => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  restart: () => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  clear: () => void;
  openPlayerWindow: () => void;
  closePlayerWindow: () => void;
  togglePlayerWindow: () => void;
  getOrCreateAnalyserNode: () => AnalyserNode | null;
  resumeAnalyserContext: () => Promise<void>;
  isActive: (demoId: string) => boolean;
  isPlayingDemo: (demoId: string) => boolean;
};

const SongsPlaybackContext = createContext<SongsPlaybackContextValue | null>(null);

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const webkitWindow = window as Window & typeof globalThis & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext || webkitWindow.webkitAudioContext || null;
}

function shuffleArray<T>(items: T[]) {
  const result = [...items];
  for (let idx = result.length - 1; idx > 0; idx -= 1) {
    const swapIdx = Math.floor(Math.random() * (idx + 1));
    [result[idx], result[swapIdx]] = [result[swapIdx], result[idx]];
  }
  return result;
}

function findItemIndex(items: SongsPlaybackItem[], target: SongsPlaybackItem | null) {
  if (!target) return -1;
  const byRef = items.findIndex((item) => item === target);
  if (byRef >= 0) return byRef;
  return items.findIndex((item) => item.demoId === target.demoId);
}

function shuffleQueuePreservingIndex(items: SongsPlaybackItem[], keepIndex: number) {
  if (items.length <= 1) return [...items];
  const safeIndex = Math.min(Math.max(keepIndex, 0), items.length - 1);
  const active = items[safeIndex];
  const rest = shuffleArray(items.filter((_, idx) => idx !== safeIndex));
  return [...rest.slice(0, safeIndex), active, ...rest.slice(safeIndex)];
}

export function SongsPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [originalQueue, setOriginalQueue] = useState<SongsPlaybackItem[]>([]);
  const [queue, setQueue] = useState<SongsPlaybackItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueContext, setQueueContext] = useState<SongsPlaybackQueueContext>(null);
  const [isPlayerWindowOpen, setIsPlayerWindowOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<SongsPlaybackRepeatMode>("off");
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const webAudioUnsupportedRef = useRef(false);

  const activeItem = queue[queueIndex] ?? null;
  const canPrevious = queue.length > 0 && (queueIndex > 0 || (repeatMode === "queue" && queue.length > 1));
  const canNext = queue.length > 0 && (queueIndex < queue.length - 1 || (repeatMode === "queue" && queue.length > 1));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onAudioFocus(event: Event) {
      const custom = event as CustomEvent<{ sourceId?: string }>;
      if (custom.detail?.sourceId === GLOBAL_PLAYBACK_SOURCE_ID) return;
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      audio.pause();
    }

    window.addEventListener(AUDIO_FOCUS_EVENT, onAudioFocus);
    return () => window.removeEventListener(AUDIO_FOCUS_EVENT, onAudioFocus);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeItem) return;
    audio.play().catch(() => null);
  }, [activeItem?.demoId]);

  useEffect(
    () => () => {
      try {
        analyserNodeRef.current?.disconnect();
      } catch {
        // ignore cleanup errors
      }
      try {
        mediaSourceNodeRef.current?.disconnect();
      } catch {
        // ignore cleanup errors
      }
      const ctx = audioContextRef.current;
      if (ctx) {
        void ctx.close().catch(() => null);
      }
      analyserNodeRef.current = null;
      mediaSourceNodeRef.current = null;
      audioContextRef.current = null;
    },
    []
  );

  const getOrCreateAnalyserNode = useCallback((): AnalyserNode | null => {
    if (webAudioUnsupportedRef.current) return null;
    if (analyserNodeRef.current) return analyserNodeRef.current;

    const audio = audioRef.current;
    if (!audio) return null;

    const AudioContextImpl = getAudioContextCtor();
    if (!AudioContextImpl) {
      webAudioUnsupportedRef.current = true;
      return null;
    }

    try {
      const ctx = audioContextRef.current ?? new AudioContextImpl();
      audioContextRef.current = ctx;

      const source = mediaSourceNodeRef.current ?? ctx.createMediaElementSource(audio);
      mediaSourceNodeRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.7;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;

      source.connect(analyser);
      analyser.connect(ctx.destination);

      analyserNodeRef.current = analyser;
      return analyser;
    } catch {
      webAudioUnsupportedRef.current = true;
      return null;
    }
  }, []);

  const resumeAnalyserContext = useCallback(async () => {
    if (webAudioUnsupportedRef.current) return;
    const analyser = analyserNodeRef.current ?? getOrCreateAnalyserNode();
    if (!analyser) return;
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }, [getOrCreateAnalyserNode]);

  function setPlaybackTarget(nextQueue: SongsPlaybackItem[], nextIndex: number, nextContext: SongsPlaybackQueueContext) {
    const safeQueue = nextQueue.filter((item) => Boolean(item?.src));
    if (!safeQueue.length) return;
    const clampedIndex = Math.min(Math.max(nextIndex, 0), safeQueue.length - 1);
    const nextPlaybackQueue = shuffleEnabled ? shuffleQueuePreservingIndex(safeQueue, clampedIndex) : safeQueue;
    const nextPlaybackIndex = shuffleEnabled ? findItemIndex(nextPlaybackQueue, safeQueue[clampedIndex]) : clampedIndex;
    setOriginalQueue(safeQueue);
    setQueue(nextPlaybackQueue);
    setQueueIndex(nextPlaybackIndex >= 0 ? nextPlaybackIndex : clampedIndex);
    setQueueContext(nextContext ?? null);
    setCurrentTime(0);
    setDuration((nextPlaybackQueue[nextPlaybackIndex >= 0 ? nextPlaybackIndex : clampedIndex] ?? safeQueue[clampedIndex])?.durationSec ?? 0);
  }

  function play(item: SongsPlaybackItem) {
    setPlaybackTarget([item], 0, {
      type: "track",
      trackId: item.trackId,
      projectId: item.projectId ?? undefined,
      title: item.title
    });
  }

  function playQueue(items: SongsPlaybackItem[], startIndex = 0, context: SongsPlaybackQueueContext = null) {
    setPlaybackTarget(items, startIndex, context);
  }

  function pause() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }

  function toggle(item: SongsPlaybackItem) {
    const audio = audioRef.current;
    if (activeItem?.demoId === item.demoId) {
      if (!audio) return;
      if (audio.paused) audio.play().catch(() => null);
      else audio.pause();
      return;
    }
    play(item);
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrentTime(seconds);
  }

  function restart() {
    seek(0);
  }

  function previous() {
    if (!queue.length) return;
    if (queueIndex > 0) {
      setQueueIndex((prev) => Math.max(0, prev - 1));
    } else if (repeatMode === "queue" && queue.length > 1) {
      setQueueIndex(queue.length - 1);
    } else {
      return;
    }
    setCurrentTime(0);
  }

  function next() {
    if (!queue.length) return;
    if (queueIndex < queue.length - 1) {
      setQueueIndex((prev) => Math.min(queue.length - 1, prev + 1));
    } else if (repeatMode === "queue" && queue.length > 1) {
      setQueueIndex(0);
    } else {
      return;
    }
    setCurrentTime(0);
  }

  function cycleRepeatMode() {
    setRepeatMode((prev) => {
      if (prev === "off") return "queue";
      if (prev === "queue") return "track";
      return "off";
    });
  }

  function toggleShuffle() {
    const nextEnabled = !shuffleEnabled;
    setShuffleEnabled(nextEnabled);

    if (!originalQueue.length) return;

    const currentItem = activeItem;
    if (!nextEnabled) {
      setQueue(originalQueue);
      const restoredIndex = findItemIndex(originalQueue, currentItem);
      setQueueIndex(restoredIndex >= 0 ? restoredIndex : 0);
      return;
    }

    const originalActiveIndex = findItemIndex(originalQueue, currentItem);
    const shuffledQueue = shuffleQueuePreservingIndex(originalQueue, originalActiveIndex >= 0 ? originalActiveIndex : 0);
    setQueue(shuffledQueue);
    const shuffledIndex = findItemIndex(shuffledQueue, currentItem);
    setQueueIndex(shuffledIndex >= 0 ? shuffledIndex : 0);
  }

  function clear() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setOriginalQueue([]);
    setQueue([]);
    setQueueIndex(0);
    setQueueContext(null);
    setIsPlayerWindowOpen(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }

  function openPlayerWindow() {
    if (!activeItem) return;
    setIsPlayerWindowOpen(true);
  }

  function closePlayerWindow() {
    setIsPlayerWindowOpen(false);
  }

  function togglePlayerWindow() {
    if (!activeItem) return;
    setIsPlayerWindowOpen((prev) => !prev);
  }

  const visibleActiveItem = mounted ? activeItem : null;
  const visibleQueue = mounted ? queue : [];
  const visibleQueueIndex = mounted ? queueIndex : 0;
  const visibleQueueContext = mounted ? queueContext : null;
  const visiblePlaying = mounted ? playing : false;
  const visibleCurrentTime = mounted ? currentTime : 0;
  const visibleDuration = mounted ? duration : 0;
  const visibleRepeatMode = mounted ? repeatMode : "off";
  const visibleShuffleEnabled = mounted ? shuffleEnabled : false;
  const visibleCanNext = mounted ? canNext : false;
  const visibleCanPrevious = mounted ? canPrevious : false;
  const visiblePlayerWindowOpen = mounted ? isPlayerWindowOpen : false;

  const value = useMemo<SongsPlaybackContextValue>(
    () => ({
      activeItem: visibleActiveItem,
      queue: visibleQueue,
      queueIndex: visibleQueueIndex,
      queueContext: visibleQueueContext,
      playing: visiblePlaying,
      currentTime: visibleCurrentTime,
      duration: visibleDuration,
      repeatMode: visibleRepeatMode,
      shuffleEnabled: visibleShuffleEnabled,
      canNext: visibleCanNext,
      canPrevious: visibleCanPrevious,
      isPlayerWindowOpen: visiblePlayerWindowOpen,
      play,
      playQueue,
      toggle,
      pause,
      next,
      previous,
      seek,
      restart,
      cycleRepeatMode,
      toggleShuffle,
      clear,
      openPlayerWindow,
      closePlayerWindow,
      togglePlayerWindow,
      getOrCreateAnalyserNode,
      resumeAnalyserContext,
      isActive: (demoId: string) => visibleActiveItem?.demoId === demoId,
      isPlayingDemo: (demoId: string) => visibleActiveItem?.demoId === demoId && visiblePlaying
    }),
    [
      visibleActiveItem,
      visibleCanNext,
      visibleCanPrevious,
      visibleCurrentTime,
      visibleDuration,
      visibleRepeatMode,
      visibleShuffleEnabled,
      visiblePlayerWindowOpen,
      visiblePlaying,
      visibleQueue,
      visibleQueueContext,
      visibleQueueIndex,
      getOrCreateAnalyserNode,
      resumeAnalyserContext
    ]
  );

  return (
    <SongsPlaybackContext.Provider value={value}>
      {children}
      {mounted && (
        <audio
          ref={audioRef}
          src={activeItem?.src ?? undefined}
          preload="metadata"
          onPlay={() => {
            void resumeAnalyserContext().catch(() => null);
            setPlaying(true);
            window.dispatchEvent(new CustomEvent(AUDIO_FOCUS_EVENT, { detail: { sourceId: GLOBAL_PLAYBACK_SOURCE_ID } }));
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || activeItem?.durationSec || 0)}
          onEnded={() => {
            if (repeatMode === "track") {
              const audio = audioRef.current;
              if (!audio) return;
              audio.currentTime = 0;
              setCurrentTime(0);
              audio.play().catch(() => null);
              return;
            }
            if (queueIndex < queue.length - 1) {
              setQueueIndex((prev) => Math.min(queue.length - 1, prev + 1));
              setCurrentTime(0);
              return;
            }
            if (repeatMode === "queue" && queue.length > 0) {
              setQueueIndex(0);
              setCurrentTime(0);
              return;
            }
            setPlaying(false);
          }}
          onError={() => {
            setPlaying(false);
          }}
          className="hidden"
        />
      )}
    </SongsPlaybackContext.Provider>
  );
}

export function useSongsPlayback() {
  const context = useContext(SongsPlaybackContext);
  if (!context) {
    throw new Error("useSongsPlayback must be used inside SongsPlaybackProvider");
  }
  return context;
}
