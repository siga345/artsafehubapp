"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

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

type SongsPlaybackContextValue = {
  activeItem: SongsPlaybackItem | null;
  queue: SongsPlaybackItem[];
  queueIndex: number;
  queueContext: SongsPlaybackQueueContext;
  playing: boolean;
  currentTime: number;
  duration: number;
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
  clear: () => void;
  openPlayerWindow: () => void;
  closePlayerWindow: () => void;
  togglePlayerWindow: () => void;
  isActive: (demoId: string) => boolean;
  isPlayingDemo: (demoId: string) => boolean;
};

const SongsPlaybackContext = createContext<SongsPlaybackContextValue | null>(null);

export function SongsPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<SongsPlaybackItem[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueContext, setQueueContext] = useState<SongsPlaybackQueueContext>(null);
  const [isPlayerWindowOpen, setIsPlayerWindowOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeItem = queue[queueIndex] ?? null;
  const canPrevious = queueIndex > 0;
  const canNext = queueIndex >= 0 && queueIndex < queue.length - 1;

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

  function setPlaybackTarget(nextQueue: SongsPlaybackItem[], nextIndex: number, nextContext: SongsPlaybackQueueContext) {
    const safeQueue = nextQueue.filter((item) => Boolean(item?.src));
    if (!safeQueue.length) return;
    const clampedIndex = Math.min(Math.max(nextIndex, 0), safeQueue.length - 1);
    setQueue(safeQueue);
    setQueueIndex(clampedIndex);
    setQueueContext(nextContext ?? null);
    setCurrentTime(0);
    setDuration(safeQueue[clampedIndex]?.durationSec ?? 0);
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
    if (!canPrevious) return;
    setQueueIndex((prev) => Math.max(0, prev - 1));
    setCurrentTime(0);
  }

  function next() {
    if (!canNext) return;
    setQueueIndex((prev) => Math.min(queue.length - 1, prev + 1));
    setCurrentTime(0);
  }

  function clear() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
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
      clear,
      openPlayerWindow,
      closePlayerWindow,
      togglePlayerWindow,
      isActive: (demoId: string) => visibleActiveItem?.demoId === demoId,
      isPlayingDemo: (demoId: string) => visibleActiveItem?.demoId === demoId && visiblePlaying
    }),
    [
      visibleActiveItem,
      visibleCanNext,
      visibleCanPrevious,
      visibleCurrentTime,
      visibleDuration,
      visiblePlayerWindowOpen,
      visiblePlaying,
      visibleQueue,
      visibleQueueContext,
      visibleQueueIndex
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
            setPlaying(true);
            window.dispatchEvent(new CustomEvent(AUDIO_FOCUS_EVENT, { detail: { sourceId: GLOBAL_PLAYBACK_SOURCE_ID } }));
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || activeItem?.durationSec || 0)}
          onEnded={() => {
            if (queueIndex < queue.length - 1) {
              setQueueIndex((prev) => Math.min(queue.length - 1, prev + 1));
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
