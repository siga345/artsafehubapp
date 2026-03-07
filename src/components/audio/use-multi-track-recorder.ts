"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDefaultFxChainSettings,
  hasEnabledFx,
  processAudioBufferWithFx,
  type FxChainSettings
} from "@/lib/audio/fx-chain";
import { analyzeAudioBlobInBrowser } from "@/lib/audio/analysis";
import type { RecorderTrackRole, RecorderTrackTemplate, MultiTrackRecorderSessionSnapshot, ReadyPayload } from "./multi-track-recorder";

// --- Shared types ---
export type RecordingState = "idle" | "recording" | "paused";
export type RecorderTab = "tracks" | "fx" | "mix";
export type TonalMode = "minor" | "major";
export type AsyncStatus = "idle" | "processing" | "ready" | "error";
export type AutoDetectTarget = "bpm" | "key" | "both" | null;
export type FxPanelId = "eq" | "reverb" | "delay" | "filter" | "driveTune";

export type Layer = {
  id: string;
  kind: "import" | "recording";
  name: string;
  role: RecorderTrackRole | null;
  blob: Blob;
  url: string;
  durationSec: number;
  muted: boolean;
  volume: number;
  pan: number;
};

// --- Utilities (exported for sub-components) ---
export const KEY_ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampBpmValue(value: number) {
  return clamp(Math.round(value), 40, 240);
}

export function clampPanValue(value: number) {
  return clamp(Math.round(value), -100, 100);
}

export function formatPanLabel(value: number) {
  const pan = clampPanValue(value);
  if (pan === 0) return "C";
  return `${pan < 0 ? "L" : "R"}${Math.abs(pan)}`;
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function formatRoleLabel(role: RecorderTrackRole | null) {
  switch (role) {
    case "beat": return "Beat";
    case "guitar": return "Guitar";
    case "lead_vocal": return "Lead";
    case "double": return "Double";
    case "back_vocal": return "Back";
    case "piano": return "Piano";
    case "custom": return "Custom";
    default: return null;
  }
}

// --- Internal utilities ---
function createLayerName(index: number) {
  return `Дорожка ${index}`;
}

async function getBlobDurationSeconds(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.src = objectUrl;
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      URL.revokeObjectURL(objectUrl);
      resolve(Math.max(0, duration));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
    };
  });
}

function encodeWavFromBuffer(buffer: AudioBuffer): Blob {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const sampleCount = buffer.length;
  const bytesPerSample = 2;
  const dataLength = sampleCount * channelCount * bytesPerSample;
  const out = new ArrayBuffer(44 + dataLength);
  const view = new DataView(out);

  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataLength, true); offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channelCount, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * channelCount * bytesPerSample, true); offset += 4;
  view.setUint16(offset, channelCount * bytesPerSample, true); offset += 2;
  view.setUint16(offset, 8 * bytesPerSample, true); offset += 2;
  writeString("data");
  view.setUint32(offset, dataLength, true); offset += 4;

  const channels = Array.from({ length: channelCount }, (_, ch) => buffer.getChannelData(ch));
  for (let i = 0; i < sampleCount; i += 1) {
    for (let ch = 0; ch < channelCount; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channels[ch]?.[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

function cloneUrlState(setter: React.Dispatch<React.SetStateAction<string>>, nextUrl: string) {
  setter((prev) => {
    if (prev) URL.revokeObjectURL(prev);
    return nextUrl;
  });
}

// --- Hook ---
type UseMultiTrackRecorderOptions = {
  onReady: (payload: ReadyPayload) => void;
  onError: (message: string) => void;
  onReset?: () => void;
  resetKey?: number;
  armedTrackTemplate?: RecorderTrackTemplate | null;
  onSessionSnapshotChange?: (snapshot: MultiTrackRecorderSessionSnapshot) => void;
};

export function useMultiTrackRecorder({
  onReady,
  onError,
  onReset,
  resetKey = 0,
  armedTrackTemplate = null,
  onSessionSnapshotChange,
}: UseMultiTrackRecorderOptions) {
  const [tab, setTab] = useState<RecorderTab>("tracks");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const [bpm, setBpm] = useState(90);
  const [bpmInputValue, setBpmInputValue] = useState("90");
  const [songKeyRoot, setSongKeyRoot] = useState<string | null>(null);
  const [songKeyMode, setSongKeyMode] = useState<TonalMode>("minor");
  const [bpmAutoEnabled, setBpmAutoEnabled] = useState(false);
  const [songKeyAutoEnabled, setSongKeyAutoEnabled] = useState(false);
  const [autoDetectLoading, setAutoDetectLoading] = useState<AutoDetectTarget>(null);
  const [autoDetectError, setAutoDetectError] = useState("");
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [metronomePreviewPlaying, setMetronomePreviewPlaying] = useState(false);

  const [fxSettingsByLayerId, setFxSettingsByLayerId] = useState<Record<string, FxChainSettings>>({});
  const [fxPreviewUrl, setFxPreviewUrl] = useState("");
  const [fxPreviewStatus, setFxPreviewStatus] = useState<AsyncStatus>("idle");
  const [fxPreviewError, setFxPreviewError] = useState("");
  const [fxPanelsOpen, setFxPanelsOpen] = useState<Record<FxPanelId, boolean>>({
    eq: false, reverb: false, delay: false, filter: false, driveTune: false,
  });

  const [stemsPreviewUrl, setStemsPreviewUrl] = useState("");
  const [stemsPreviewStatus, setStemsPreviewStatus] = useState<AsyncStatus>("idle");
  const [stemsPreviewError, setStemsPreviewError] = useState("");
  const [mixPreviewUrl, setMixPreviewUrl] = useState("");
  const [mixing, setMixing] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const discardRecordingOnStopRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const backingAudioRef = useRef<HTMLAudioElement[]>([]);
  const metronomeCtxRef = useRef<AudioContext | null>(null);
  const metronomeIntervalRef = useRef<number | null>(null);
  const decodedLayerCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const layersRef = useRef<Layer[]>([]);
  const recordWaveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordWaveCtxRef = useRef<AudioContext | null>(null);
  const recordWaveSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordWaveAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordWaveDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const recordWaveRafRef = useRef<number | null>(null);
  const recordWaveDrawRef = useRef<((timestamp: number) => void) | null>(null);
  const recordWavePausedRef = useRef(false);
  const recordWaveHistoryRef = useRef<number[]>([]);
  const recordWaveLastSampleAtRef = useRef(0);

  useEffect(() => { layersRef.current = layers; }, [layers]);

  const selectedLayer = useMemo(
    () => layers.find((l) => l.id === selectedLayerId) ?? null,
    [layers, selectedLayerId]
  );
  const selectedRecordedLayer = useMemo(
    () => (selectedLayer?.kind === "recording" ? selectedLayer : null),
    [selectedLayer]
  );
  const selectedRecordedLayerFx = useMemo(
    () => selectedRecordedLayer
      ? fxSettingsByLayerId[selectedRecordedLayer.id] ?? createDefaultFxChainSettings()
      : null,
    [fxSettingsByLayerId, selectedRecordedLayer]
  );

  function toggleFxPanel(panelId: FxPanelId) {
    setFxPanelsOpen((cur) => ({ ...cur, [panelId]: !cur[panelId] }));
  }

  useEffect(() => {
    if (!layers.length) { setSelectedLayerId(null); return; }
    setSelectedLayerId((prev) =>
      prev && layers.some((l) => l.id === prev) ? prev : layers[layers.length - 1]?.id ?? null
    );
  }, [layers]);

  useEffect(() => { setBpmInputValue(String(bpm)); }, [bpm]);

  useEffect(() => {
    if (!onSessionSnapshotChange) return;
    onSessionSnapshotChange({
      bpm, bpmAutoEnabled, songKeyRoot, songKeyMode, songKeyAutoEnabled, selectedLayerId,
      layers: layers.map((l) => ({ id: l.id, kind: l.kind, role: l.role, name: l.name, muted: l.muted, volume: l.volume, pan: l.pan, durationSec: l.durationSec })),
      hasStemsPreview: Boolean(stemsPreviewUrl),
      hasMixPreview: Boolean(mixPreviewUrl),
    });
  }, [bpm, bpmAutoEnabled, layers, mixPreviewUrl, onSessionSnapshotChange, selectedLayerId, songKeyAutoEnabled, songKeyMode, songKeyRoot, stemsPreviewUrl]);

  useEffect(() => {
    drawRecordWaveIdle();
    const redraw = () => drawRecordWaveIdle();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimer() {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  }

  function cancelRecordWaveRaf() {
    if (recordWaveRafRef.current !== null) {
      window.cancelAnimationFrame(recordWaveRafRef.current);
      recordWaveRafRef.current = null;
    }
  }

  function drawRecordWaveIdle() {
    const canvas = recordWaveCanvasRef.current;
    if (!canvas) return;
    const width = Math.max(1, canvas.clientWidth || 320);
    const height = Math.max(1, canvas.clientHeight || 80);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f7faf2"; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#cfdcc9"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  }

  function startRecordWaveMonitor(stream: MediaStream) {
    try {
      recordWavePausedRef.current = false;
      cancelRecordWaveRaf();
      if (recordWaveSourceRef.current) { recordWaveSourceRef.current.disconnect(); recordWaveSourceRef.current = null; }
      if (recordWaveAnalyserRef.current) recordWaveAnalyserRef.current.disconnect();
      if (recordWaveCtxRef.current) recordWaveCtxRef.current.close().catch(() => null);

      const audioCtx = new window.AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      recordWaveCtxRef.current = audioCtx;
      recordWaveSourceRef.current = source;
      recordWaveAnalyserRef.current = analyser;
      recordWaveDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      recordWaveHistoryRef.current = [];
      recordWaveLastSampleAtRef.current = 0;

      const draw = (timestamp: number) => {
        if (recordWavePausedRef.current) { recordWaveRafRef.current = null; return; }
        const canvas = recordWaveCanvasRef.current;
        const activeAnalyser = recordWaveAnalyserRef.current;
        const data = recordWaveDataRef.current;
        if (!canvas || !activeAnalyser || !data) { drawRecordWaveIdle(); recordWaveRafRef.current = null; return; }

        const width = Math.max(1, canvas.clientWidth || 320);
        const height = Math.max(1, canvas.clientHeight || 80);
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const ctx = canvas.getContext("2d");
        if (!ctx) { recordWaveRafRef.current = window.requestAnimationFrame(draw); return; }

        const now = Number.isFinite(timestamp) ? timestamp : performance.now();
        if (now - recordWaveLastSampleAtRef.current >= 55) {
          activeAnalyser.getByteTimeDomainData(data);
          let energy = 0;
          for (let i = 0; i < data.length; i += 1) { const n = (data[i] - 128) / 128; energy += n * n; }
          const rms = Math.sqrt(energy / data.length);
          const history = recordWaveHistoryRef.current;
          const prev = history.length ? history[history.length - 1] ?? 0 : 0;
          const smoothed = clamp(prev * 0.72 + rms * 0.28, 0.02, 1);
          const maxPoints = Math.max(24, Math.floor(width / 3));
          history.push(smoothed);
          while (history.length > maxPoints) history.shift();
          recordWaveLastSampleAtRef.current = now;
        }

        const history = recordWaveHistoryRef.current;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#f7faf2"; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#d8e3d2"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();

        if (history.length > 0) {
          const centerY = height / 2; const maxAmp = height * 0.4;
          ctx.strokeStyle = "#315f3b"; ctx.lineWidth = 2; ctx.lineCap = "round";
          for (let i = 0; i < history.length; i += 1) {
            const x = width - (history.length - 1 - i) * 3;
            const amp = (history[i] ?? 0) * maxAmp;
            ctx.beginPath(); ctx.moveTo(x, centerY - amp); ctx.lineTo(x, centerY + amp); ctx.stroke();
          }
        }
        if (recordWavePausedRef.current) { recordWaveRafRef.current = null; return; }
        recordWaveRafRef.current = window.requestAnimationFrame(draw);
      };

      recordWaveDrawRef.current = draw;
      recordWaveRafRef.current = window.requestAnimationFrame(draw);
    } catch { drawRecordWaveIdle(); }
  }

  function pauseRecordWaveMonitor() { recordWavePausedRef.current = true; cancelRecordWaveRaf(); }

  function resumeRecordWaveMonitor() {
    if (!recordWaveAnalyserRef.current || !recordWaveDrawRef.current) return;
    recordWavePausedRef.current = false;
    if (recordWaveRafRef.current === null) {
      recordWaveRafRef.current = window.requestAnimationFrame(recordWaveDrawRef.current);
    }
  }

  function stopRecordWaveMonitor() {
    recordWavePausedRef.current = false; cancelRecordWaveRaf(); recordWaveDrawRef.current = null;
    if (recordWaveSourceRef.current) { try { recordWaveSourceRef.current.disconnect(); } catch {} recordWaveSourceRef.current = null; }
    if (recordWaveAnalyserRef.current) { try { recordWaveAnalyserRef.current.disconnect(); } catch {} recordWaveAnalyserRef.current = null; }
    if (recordWaveCtxRef.current) { recordWaveCtxRef.current.close().catch(() => null); recordWaveCtxRef.current = null; }
    recordWaveDataRef.current = null; recordWaveHistoryRef.current = []; recordWaveLastSampleAtRef.current = 0;
    drawRecordWaveIdle();
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopRecordWaveMonitor();
  }

  function stopBackingTracks() {
    backingAudioRef.current.forEach((a) => { a.pause(); a.currentTime = 0; });
    backingAudioRef.current = [];
  }

  function pauseBackingTracks() { backingAudioRef.current.forEach((a) => a.pause()); }

  function resumeBackingTracks() { backingAudioRef.current.forEach((a) => a.play().catch(() => null)); }

  function startBackingTracks() {
    stopBackingTracks();
    backingAudioRef.current = layersRef.current
      .filter((l) => !l.muted)
      .map((l) => {
        const a = new Audio(l.url);
        a.volume = clamp(l.volume, 0, 1);
        a.currentTime = 0;
        return a;
      });
    backingAudioRef.current.forEach((a) => a.play().catch(() => null));
  }

  function stopMetronome() {
    if (metronomeIntervalRef.current) { window.clearInterval(metronomeIntervalRef.current); metronomeIntervalRef.current = null; }
    if (metronomeCtxRef.current) { metronomeCtxRef.current.close().catch(() => null); metronomeCtxRef.current = null; }
  }

  function metronomeTick(audioCtx: AudioContext, accent: boolean) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = accent ? 1300 : 960;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.1, audioCtx.currentTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.045);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
  }

  function startMetronome(force = false) {
    if (!force && !metronomeEnabled) return;
    stopMetronome();
    const audioCtx = new window.AudioContext();
    metronomeCtxRef.current = audioCtx;
    let beat = 0;
    metronomeTick(audioCtx, true);
    metronomeIntervalRef.current = window.setInterval(() => {
      beat = (beat + 1) % 4;
      metronomeTick(audioCtx, beat === 0);
    }, Math.max(120, Math.round(60000 / bpm)));
  }

  function stopAllPlaybackHelpers() {
    clearTimer(); stopBackingTracks(); stopMetronome(); setMetronomePreviewPlaying(false);
  }

  function revokeLayerUrls(list: Layer[]) { list.forEach((l) => URL.revokeObjectURL(l.url)); }

  function clearPreviewUrls() {
    setFxPreviewUrl((p) => { if (p) URL.revokeObjectURL(p); return ""; });
    setStemsPreviewUrl((p) => { if (p) URL.revokeObjectURL(p); return ""; });
    setMixPreviewUrl((p) => { if (p) URL.revokeObjectURL(p); return ""; });
    setFxPreviewStatus("idle"); setFxPreviewError("");
    setStemsPreviewStatus("idle"); setStemsPreviewError("");
  }

  function resetRecorderSession(emitReset = true) {
    try { if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop(); } catch {}
    recorderRef.current = null;
    stopStream(); stopAllPlaybackHelpers();
    setRecordingState("idle"); recordingSecondsRef.current = 0; setRecordingSeconds(0);
    decodedLayerCacheRef.current.clear(); clearPreviewUrls();
    setLayers((prev) => { revokeLayerUrls(prev); return []; });
    setSelectedLayerId(null); setFxSettingsByLayerId({}); setTab("tracks");
    setBpm(90); setBpmAutoEnabled(false); setSongKeyRoot(null); setSongKeyMode("minor"); setSongKeyAutoEnabled(false);
    setAutoDetectLoading(null); setAutoDetectError(""); onError("");
    if (emitReset) onReset?.();
  }

  useEffect(() => {
    resetRecorderSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const cache = decodedLayerCacheRef.current;
    return () => {
      clearTimer(); stopBackingTracks(); stopMetronome(); stopStream();
      if (recorderRef.current && recorderRef.current.state !== "inactive") { try { recorderRef.current.stop(); } catch {} }
      cache.clear(); revokeLayerUrls(layersRef.current);
      setFxPreviewUrl((p) => { if (p) URL.revokeObjectURL(p); return p; });
      setStemsPreviewUrl((p) => { if (p) URL.revokeObjectURL(p); return p; });
      setMixPreviewUrl((p) => { if (p) URL.revokeObjectURL(p); return p; });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decodeLayerBuffer(layer: Layer): Promise<AudioBuffer> {
    const cached = decodedLayerCacheRef.current.get(layer.id);
    if (cached) return cached;
    const ctx = new window.AudioContext();
    try {
      const ab = await layer.blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(ab.slice(0));
      decodedLayerCacheRef.current.set(layer.id, decoded);
      return decoded;
    } finally { await ctx.close().catch(() => null); }
  }

  function updateLayer(layerId: string, updater: (layer: Layer) => Layer) {
    setLayers((prev) => prev.map((l) => (l.id === layerId ? updater(l) : l)));
  }

  function updateSelectedLayerFx(updater: (current: FxChainSettings) => FxChainSettings) {
    if (!selectedRecordedLayer) return;
    setFxSettingsByLayerId((prev) => {
      const current = prev[selectedRecordedLayer.id] ?? createDefaultFxChainSettings();
      return { ...prev, [selectedRecordedLayer.id]: updater(current) };
    });
  }

  function applyFxPreset(preset: "clean" | "warm" | "doubleWide" | "phone") {
    updateSelectedLayerFx(() => {
      const base = createDefaultFxChainSettings();
      if (preset === "clean") return base;
      if (preset === "warm") {
        base.eq.enabled = true; base.eq.bands[0].gainDb = 2; base.eq.bands[2].gainDb = 1.5; base.eq.bands[4].gainDb = 2.5;
        base.reverb.enabled = true; base.reverb.mix = 20;
        return base;
      }
      if (preset === "doubleWide") {
        base.delay.enabled = true; base.delay.mix = 28; base.delay.feedback = 18; base.delay.timeMs = 90;
        base.reverb.enabled = true; base.reverb.mix = 18; base.filter.enabled = false;
        return base;
      }
      base.filter.enabled = true; base.filter.mode = "bandpass"; base.filter.cutoff = 1700; base.filter.resonance = 2.4; base.filter.mix = 80;
      base.distortion.enabled = true; base.distortion.drive = 16; base.distortion.mix = 15;
      return base;
    });
  }

  async function processLayerForRender(layer: Layer, decoded: AudioBuffer): Promise<AudioBuffer> {
    if (layer.kind !== "recording") return decoded;
    const settings = fxSettingsByLayerId[layer.id];
    if (!settings || !hasEnabledFx(settings)) return decoded;
    return processAudioBufferWithFx({ inputBuffer: decoded, settings, bpm });
  }

  async function renderSessionAudioBlob(): Promise<{ blob: Blob; durationSec: number }> {
    const activeLayers = layers.filter((l) => !l.muted);
    if (!activeLayers.length) throw new Error("Включи хотя бы одну дорожку для preview/render.");

    const processed = await Promise.all(
      activeLayers.map(async (layer) => {
        const decoded = await decodeLayerBuffer(layer);
        const buffer = await processLayerForRender(layer, decoded);
        return { layer, buffer };
      })
    );

    const sampleRate = processed[0]?.buffer.sampleRate ?? 44100;
    const totalLength = processed.reduce((max, item) => Math.max(max, item.buffer.length), 0);
    const offline = new OfflineAudioContext(2, Math.max(1, totalLength), sampleRate);

    processed.forEach(({ layer, buffer }) => {
      const source = offline.createBufferSource();
      source.buffer = buffer;
      const gain = offline.createGain();
      gain.gain.value = clamp(layer.volume, 0, 1);
      const panner = offline.createStereoPanner();
      panner.pan.value = clampPanValue(layer.pan) / 100;
      source.connect(gain).connect(panner).connect(offline.destination);
      source.start(0);
    });

    const rendered = await offline.startRendering();
    return { blob: encodeWavFromBuffer(rendered), durationSec: Math.round(rendered.duration) };
  }

  async function renderSelectedFxPreview() {
    if (!selectedRecordedLayer || !selectedRecordedLayerFx) { setFxPreviewStatus("idle"); setFxPreviewError(""); return; }
    setFxPreviewStatus("processing"); setFxPreviewError(""); onError("");
    try {
      const decoded = await decodeLayerBuffer(selectedRecordedLayer);
      const processed = await processLayerForRender(selectedRecordedLayer, decoded);
      cloneUrlState(setFxPreviewUrl, URL.createObjectURL(encodeWavFromBuffer(processed)));
      setFxPreviewStatus("ready");
    } catch (error) {
      setFxPreviewStatus("error");
      setFxPreviewError(error instanceof Error ? error.message : "Не удалось собрать FX preview.");
    }
  }

  async function renderStemsPreview() {
    if (mixing || stemsPreviewStatus === "processing") return;
    setStemsPreviewStatus("processing"); setStemsPreviewError(""); onError("");
    try {
      const { blob } = await renderSessionAudioBlob();
      cloneUrlState(setStemsPreviewUrl, URL.createObjectURL(blob));
      setStemsPreviewStatus("ready"); setTab("mix");
    } catch (error) {
      setStemsPreviewStatus("error");
      const msg = error instanceof Error ? error.message : "Не удалось собрать preview.";
      setStemsPreviewError(msg); onError(msg);
    }
  }

  async function renderMixdown() {
    if (mixing) return;
    setMixing(true); onError("");
    try {
      const { blob, durationSec } = await renderSessionAudioBlob();
      cloneUrlState(setMixPreviewUrl, URL.createObjectURL(blob));
      onReady({ blob, durationSec, filename: `multitrack-mix-${Date.now()}.wav` });
      setTab("mix");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось сделать render.");
    } finally { setMixing(false); }
  }

  const autoDetectFromBlob = useCallback(async (blob: Blob, target: AutoDetectTarget) => {
    setAutoDetectLoading(target); setAutoDetectError("");
    try {
      const result = await analyzeAudioBlobInBrowser(blob);
      if ((target === "bpm" || target === "both") && result.bpm !== null) {
        setBpm(clampBpmValue(result.bpm)); setBpmAutoEnabled(true);
      }
      if ((target === "key" || target === "both") && result.keyRoot && result.keyMode) {
        setSongKeyRoot(result.keyRoot); setSongKeyMode(result.keyMode); setSongKeyAutoEnabled(true);
      }
      if (
        (target === "bpm" && result.bpm === null) ||
        (target === "key" && (!result.keyRoot || !result.keyMode)) ||
        (target === "both" && result.bpm === null && (!result.keyRoot || !result.keyMode))
      ) {
        setAutoDetectError("Не удалось уверенно определить BPM/тональность. Укажи вручную.");
      }
    } catch (error) {
      setAutoDetectError(error instanceof Error ? error.message : "Ошибка автоанализа.");
    } finally { setAutoDetectLoading(null); }
  }, []);

  async function runAutoDetect(target: Exclude<AutoDetectTarget, null>) {
    const source = selectedLayer?.blob ?? layers[layers.length - 1]?.blob ?? null;
    if (!source) { setAutoDetectError("Нет аудио для анализа. Загрузи бит или запиши дорожку."); return; }
    await autoDetectFromBlob(source, target);
  }

  function commitBpmInput() {
    const parsed = Number(bpmInputValue);
    if (!Number.isFinite(parsed)) { setBpmInputValue(String(bpm)); return; }
    const next = clampBpmValue(parsed);
    setBpm(next); setBpmInputValue(String(next)); setBpmAutoEnabled(false);
  }

  function startRecordingTimer() {
    clearTimer(); recordingSecondsRef.current = 0; setRecordingSeconds(0);
    timerRef.current = window.setInterval(() => { recordingSecondsRef.current += 1; setRecordingSeconds(recordingSecondsRef.current); }, 1000);
  }

  function pauseRecordingTimer() { clearTimer(); }

  function resumeRecordingTimer() {
    clearTimer();
    timerRef.current = window.setInterval(() => { recordingSecondsRef.current += 1; setRecordingSeconds(recordingSecondsRef.current); }, 1000);
  }

  async function startRecording() {
    if (recordingState !== "idle") return;
    onError("");
    try {
      discardRecordingOnStopRef.current = false; setMetronomePreviewPlaying(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; startRecordWaveMonitor(stream);
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder; chunksRef.current = [];

      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };

      recorder.onstop = async () => {
        try {
          const shouldDiscard = discardRecordingOnStopRef.current; discardRecordingOnStopRef.current = false;
          if (shouldDiscard) { chunksRef.current = []; recordingSecondsRef.current = 0; setRecordingSeconds(0); return; }
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const url = URL.createObjectURL(blob);
          const nextLayerId = crypto.randomUUID();
          const nextDuration = Math.max(recordingSecondsRef.current, await getBlobDurationSeconds(blob));
          const armedName = armedTrackTemplate?.name?.trim();
          const layer: Layer = {
            id: nextLayerId, kind: "recording",
            name: armedName || createLayerName(layersRef.current.length + 1),
            role: armedTrackTemplate?.role ?? null,
            blob, url, durationSec: nextDuration, muted: false, volume: 0.9, pan: 0,
          };
          setLayers((prev) => [...prev, layer]);
          setSelectedLayerId(nextLayerId);
          setFxSettingsByLayerId((prev) => ({ ...prev, [nextLayerId]: createDefaultFxChainSettings() }));
          setTab("tracks");
        } finally { stopStream(); stopAllPlaybackHelpers(); setRecordingState("idle"); }
      };

      if (layersRef.current.some((l) => !l.muted)) startBackingTracks();
      startMetronome(); startRecordingTimer(); recorder.start(); setRecordingState("recording");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось получить доступ к микрофону.");
      stopStream(); stopAllPlaybackHelpers(); setRecordingState("idle");
    }
  }

  function pauseRecording() {
    if (!recorderRef.current || recordingState !== "recording") return;
    recorderRef.current.pause(); pauseRecordingTimer(); pauseRecordWaveMonitor(); pauseBackingTracks(); stopMetronome();
    setRecordingState("paused");
  }

  function resumeRecording() {
    if (!recorderRef.current || recordingState !== "paused") return;
    setMetronomePreviewPlaying(false); recorderRef.current.resume();
    resumeRecordingTimer(); resumeRecordWaveMonitor(); resumeBackingTracks(); startMetronome();
    setRecordingState("recording");
  }

  function stopRecording() {
    if (!recorderRef.current) return;
    if (recordingState !== "recording" && recordingState !== "paused") return;
    discardRecordingOnStopRef.current = false;
    try { recorderRef.current.stop(); } catch {}
    clearTimer(); setRecordingState("idle");
  }

  function deleteCurrentTake() {
    if (!recorderRef.current || recordingState !== "paused") return;
    setMetronomePreviewPlaying(false); discardRecordingOnStopRef.current = true;
    try { recorderRef.current.stop(); } catch {}
    clearTimer(); setRecordingState("idle");
  }

  function removeLayer(layerId: string) {
    decodedLayerCacheRef.current.delete(layerId);
    setFxSettingsByLayerId((prev) => { if (!(layerId in prev)) return prev; const next = { ...prev }; delete next[layerId]; return next; });
    if (selectedLayerId === layerId) setSelectedLayerId(null);
    setLayers((prev) => { const found = prev.find((l) => l.id === layerId); if (found) URL.revokeObjectURL(found.url); return prev.filter((l) => l.id !== layerId); });
  }

  const importAudioLayerFromFile = useCallback(async (
    file: File,
    options?: { name?: string; volume?: number; pan?: number; role?: RecorderTrackRole | null; autoDetectTempoKey?: boolean }
  ) => {
    if (!file.type.startsWith("audio/")) { onError("Можно импортировать только аудиофайл."); return; }
    onError("");
    try {
      const durationSec = await getBlobDurationSeconds(file);
      const layerId = crypto.randomUUID();
      const url = URL.createObjectURL(file);
      const layer: Layer = {
        id: layerId, kind: "import",
        name: options?.name?.trim() || file.name || createLayerName(layersRef.current.length + 1),
        role: options?.role ?? null, blob: file, url, durationSec, muted: false,
        volume: typeof options?.volume === "number" ? clamp(options.volume, 0, 1) : 0.9,
        pan: clampPanValue(options?.pan ?? 0),
      };
      setLayers((prev) => [...prev, layer]);
      setSelectedLayerId(layerId); setTab("tracks");
      if (options?.autoDetectTempoKey) void autoDetectFromBlob(file, "both");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось импортировать аудиодорожку.");
    }
  }, [autoDetectFromBlob, onError]);

  function toggleMetronomePreview() {
    if (recordingState !== "idle") return;
    if (metronomePreviewPlaying) { stopMetronome(); setMetronomePreviewPlaying(false); return; }
    startMetronome(true); setMetronomePreviewPlaying(true);
  }

  useEffect(() => {
    if (!metronomePreviewPlaying || recordingState !== "idle") return;
    startMetronome(true); setMetronomePreviewPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  const canRecord = recordingState === "idle";
  const canPause = recordingState === "recording";
  const canResume = recordingState === "paused";
  const canStop = recordingState === "recording" || recordingState === "paused";
  const canPreviewMetronome = recordingState === "idle";
  const showSaveOnStopButton = recordingState === "paused" && recordingSeconds > 0;
  const primaryRecordButtonLabel = recordingState === "idle" ? "Record" : "Resume";
  const canPrimaryRecordButton = canRecord || canResume;

  return {
    // Tab
    tab, setTab,
    // Recording
    recordingState, recordingSeconds, recordWaveCanvasRef,
    startRecording, pauseRecording, resumeRecording, stopRecording, deleteCurrentTake,
    canRecord, canPause, canResume, canStop, canPreviewMetronome,
    showSaveOnStopButton, primaryRecordButtonLabel, canPrimaryRecordButton,
    // Layers
    layers, selectedLayerId, setSelectedLayerId,
    selectedLayer, selectedRecordedLayer, selectedRecordedLayerFx,
    updateLayer, removeLayer, importAudioLayerFromFile,
    // BPM / Key
    bpm, setBpm, bpmInputValue, setBpmInputValue, commitBpmInput,
    bpmAutoEnabled, setBpmAutoEnabled,
    songKeyRoot, setSongKeyRoot,
    songKeyMode, setSongKeyMode,
    songKeyAutoEnabled, setSongKeyAutoEnabled,
    autoDetectLoading, autoDetectError,
    runAutoDetect,
    // Metronome
    metronomeEnabled, setMetronomeEnabled,
    metronomePreviewPlaying, toggleMetronomePreview,
    // FX
    fxSettingsByLayerId,
    fxPreviewUrl, fxPreviewStatus, fxPreviewError,
    fxPanelsOpen, toggleFxPanel,
    updateSelectedLayerFx, applyFxPreset,
    renderSelectedFxPreview,
    // Mix / stems
    stemsPreviewUrl, stemsPreviewStatus, stemsPreviewError,
    mixPreviewUrl, mixing,
    renderStemsPreview, renderMixdown,
    // Session
    resetRecorderSession,
  };
}

export type UseMultiTrackRecorderReturn = ReturnType<typeof useMultiTrackRecorder>;
