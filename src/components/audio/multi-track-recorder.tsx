"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Trash2, Volume2, VolumeX } from "lucide-react";

import { AudioWaveformPlayer } from "@/components/audio/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createDefaultFxChainSettings,
  hasEnabledFx,
  processAudioBufferWithFx,
  type FxChainSettings
} from "@/lib/audio/fx-chain";
import { analyzeAudioBlobInBrowser } from "@/lib/audio/analysis";

export type RecorderTrackRole = "beat" | "guitar" | "lead_vocal" | "double" | "back_vocal" | "piano" | "custom";
export type RecorderTrackTemplate = {
  name?: string;
  role?: RecorderTrackRole | null;
};

type RecordingState = "idle" | "recording" | "paused";
type RecorderTab = "tracks" | "fx" | "mix";
type TonalMode = "minor" | "major";
type AsyncStatus = "idle" | "processing" | "ready" | "error";
type AutoDetectTarget = "bpm" | "key" | "both" | null;
type FxPanelId = "eq" | "reverb" | "delay" | "filter" | "driveTune";

type Layer = {
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

type ReadyPayload = {
  blob: Blob;
  durationSec: number;
  filename: string;
};

type MultiTrackRecorderProps = {
  onReady: (payload: ReadyPayload) => void;
  onError: (message: string) => void;
  onReset?: () => void;
  resetKey?: number;
  armedTrackTemplate?: RecorderTrackTemplate | null;
  onSessionSnapshotChange?: (snapshot: MultiTrackRecorderSessionSnapshot) => void;
};

export type MultiTrackRecorderSessionSnapshot = {
  bpm: number;
  bpmAutoEnabled: boolean;
  songKeyRoot: string | null;
  songKeyMode: TonalMode;
  songKeyAutoEnabled: boolean;
  selectedLayerId: string | null;
  layers: Array<{
    id: string;
    kind: Layer["kind"];
    role: RecorderTrackRole | null;
    name: string;
    muted: boolean;
    volume: number;
    pan: number;
    durationSec: number;
  }>;
  hasStemsPreview: boolean;
  hasMixPreview: boolean;
};

export type MultiTrackRecorderHandle = {
  importAudioLayerFromFile: (
    file: File,
    options?: { name?: string; volume?: number; pan?: number; role?: RecorderTrackRole | null; autoDetectTempoKey?: boolean }
  ) => Promise<void>;
};

const KEY_ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampBpmValue(value: number) {
  return clamp(Math.round(value), 40, 240);
}

function clampPanValue(value: number) {
  return clamp(Math.round(value), -100, 100);
}

function formatPanLabel(value: number) {
  const pan = clampPanValue(value);
  if (pan === 0) return "C";
  return `${pan < 0 ? "L" : "R"}${Math.abs(pan)}`;
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function createLayerName(index: number) {
  return `Дорожка ${index}`;
}

function formatRoleLabel(role: RecorderTrackRole | null) {
  switch (role) {
    case "beat":
      return "Beat";
    case "guitar":
      return "Guitar";
    case "lead_vocal":
      return "Lead";
    case "double":
      return "Double";
    case "back_vocal":
      return "Back";
    case "piano":
      return "Piano";
    case "custom":
      return "Custom";
    default:
      return null;
  }
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
  view.setUint32(offset, 36 + dataLength, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * channelCount * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, channelCount * bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 8 * bytesPerSample, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataLength, true);
  offset += 4;

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

type KnobControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
};

function snapKnobValue(value: number, min: number, max: number, step?: number) {
  const clamped = clamp(value, min, max);
  if (!step || step <= 0) return clamped;
  const snapped = Math.round((clamped - min) / step) * step + min;
  return Number(snapKnobValueToPrecision(snapped, step).toString());
}

function snapKnobValueToPrecision(value: number, step: number) {
  const stepString = String(step);
  const decimals = stepString.includes(".") ? stepString.split(".")[1]?.length ?? 0 : 0;
  return Number(value.toFixed(Math.min(4, decimals)));
}

function KnobControl({ label, value, min, max, step = 1, onChange, formatValue }: KnobControlProps) {
  const knobRef = useRef<HTMLButtonElement | null>(null);
  const safeRange = Math.max(0.0001, max - min);
  const normalized = clamp((value - min) / safeRange, 0, 1);
  const angle = -135 + normalized * 270;
  const displayValue = formatValue ? formatValue(value) : `${value}`;

  const updateFromDelta = (startValue: number, deltaPixels: number) => {
    const pixelsForFullTurn = 180;
    const next = startValue + (deltaPixels / pixelsForFullTurn) * safeRange;
    onChange(snapKnobValue(next, min, max, step));
  };

  return (
    <div className="rounded-xl border border-brand-border bg-white p-2">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-brand-muted">
        <span>{label}</span>
        <span className="font-medium text-brand-ink">{displayValue}</span>
      </div>
      <div className="flex justify-center">
        <button
          ref={knobRef}
          type="button"
          role="slider"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={Number(value.toFixed(3))}
          aria-valuetext={displayValue}
          onPointerDown={(event) => {
            event.preventDefault();
            const startX = event.clientX;
            const startY = event.clientY;
            const startValue = value;
            const pointerId = event.pointerId;
            knobRef.current?.setPointerCapture(pointerId);

            const handlePointerMove = (moveEvent: PointerEvent) => {
              const deltaY = startY - moveEvent.clientY;
              const deltaX = (moveEvent.clientX - startX) * 0.35;
              updateFromDelta(startValue, deltaY + deltaX);
            };

            const cleanup = () => {
              window.removeEventListener("pointermove", handlePointerMove);
              window.removeEventListener("pointerup", handlePointerUp);
              window.removeEventListener("pointercancel", handlePointerUp);
              try {
                knobRef.current?.releasePointerCapture(pointerId);
              } catch {
                // no-op if capture is not active anymore
              }
            };

            const handlePointerUp = () => {
              cleanup();
            };

            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp, { once: true });
            window.addEventListener("pointercancel", handlePointerUp, { once: true });
          }}
          onKeyDown={(event) => {
            const keyboardStep = step || safeRange / 100;
            if (event.key === "ArrowUp" || event.key === "ArrowRight") {
              event.preventDefault();
              onChange(snapKnobValue(value + keyboardStep, min, max, step));
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
              event.preventDefault();
              onChange(snapKnobValue(value - keyboardStep, min, max, step));
              return;
            }
            if (event.key === "PageUp") {
              event.preventDefault();
              onChange(snapKnobValue(value + keyboardStep * 5, min, max, step));
              return;
            }
            if (event.key === "PageDown") {
              event.preventDefault();
              onChange(snapKnobValue(value - keyboardStep * 5, min, max, step));
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              onChange(snapKnobValue(min, min, max, step));
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              onChange(snapKnobValue(max, min, max, step));
            }
          }}
          className="group relative h-16 w-16 rounded-full border border-[#c8d8c1] bg-[#edf4e8] outline-none ring-offset-2 transition hover:border-[#7ca27f] focus-visible:ring-2 focus-visible:ring-[#7ca27f]"
        >
          <div className="absolute inset-[4px] rounded-full border border-[#cfdcc9] bg-[#f8fbf4]" />
          <div
            className="absolute inset-0"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            <span className="absolute left-1/2 top-[7px] block h-4 w-1 -translate-x-1/2 rounded-full bg-[#315f3b]" />
          </div>
        <span className="sr-only">{displayValue}</span>
        </button>
      </div>
    </div>
  );
}

export const MultiTrackRecorder = forwardRef<MultiTrackRecorderHandle, MultiTrackRecorderProps>(function MultiTrackRecorder(
  { onReady, onError, onReset, resetKey = 0, armedTrackTemplate = null, onSessionSnapshotChange },
  ref
) {
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
    eq: false,
    reverb: false,
    delay: false,
    filter: false,
    driveTune: false
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
  const beatFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const selectedLayer = useMemo(() => layers.find((layer) => layer.id === selectedLayerId) ?? null, [layers, selectedLayerId]);
  const selectedRecordedLayer = useMemo(
    () => (selectedLayer?.kind === "recording" ? selectedLayer : null),
    [selectedLayer]
  );
  const selectedRecordedLayerFx = useMemo(
    () => (selectedRecordedLayer ? fxSettingsByLayerId[selectedRecordedLayer.id] ?? createDefaultFxChainSettings() : null),
    [fxSettingsByLayerId, selectedRecordedLayer]
  );

  function toggleFxPanel(panelId: FxPanelId) {
    setFxPanelsOpen((current) => ({ ...current, [panelId]: !current[panelId] }));
  }

  useEffect(() => {
    if (!layers.length) {
      setSelectedLayerId(null);
      return;
    }
    setSelectedLayerId((prev) => (prev && layers.some((layer) => layer.id === prev) ? prev : layers[layers.length - 1]?.id ?? null));
  }, [layers]);

  useEffect(() => {
    setBpmInputValue(String(bpm));
  }, [bpm]);

  useEffect(() => {
    if (!onSessionSnapshotChange) return;
    onSessionSnapshotChange({
      bpm,
      bpmAutoEnabled,
      songKeyRoot,
      songKeyMode,
      songKeyAutoEnabled,
      selectedLayerId,
      layers: layers.map((layer) => ({
        id: layer.id,
        kind: layer.kind,
        role: layer.role,
        name: layer.name,
        muted: layer.muted,
        volume: layer.volume,
        pan: layer.pan,
        durationSec: layer.durationSec
      })),
      hasStemsPreview: Boolean(stemsPreviewUrl),
      hasMixPreview: Boolean(mixPreviewUrl)
    });
  }, [
    bpm,
    bpmAutoEnabled,
    layers,
    mixPreviewUrl,
    onSessionSnapshotChange,
    selectedLayerId,
    songKeyAutoEnabled,
    songKeyMode,
    songKeyRoot,
    stemsPreviewUrl
  ]);

  useEffect(() => {
    drawRecordWaveIdle();
    const redraw = () => drawRecordWaveIdle();
    window.addEventListener("resize", redraw);
    return () => {
      window.removeEventListener("resize", redraw);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#f7faf2";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#cfdcc9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  function startRecordWaveMonitor(stream: MediaStream) {
    try {
      recordWavePausedRef.current = false;
      cancelRecordWaveRaf();
      if (recordWaveSourceRef.current) {
        recordWaveSourceRef.current.disconnect();
        recordWaveSourceRef.current = null;
      }
      if (recordWaveAnalyserRef.current) {
        recordWaveAnalyserRef.current.disconnect();
      }
      if (recordWaveCtxRef.current) {
        recordWaveCtxRef.current.close().catch(() => null);
      }

      const audioCtx = new window.AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      recordWaveCtxRef.current = audioCtx;
      recordWaveSourceRef.current = source;
      recordWaveAnalyserRef.current = analyser;
      recordWaveDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      recordWaveHistoryRef.current = [];
      recordWaveLastSampleAtRef.current = 0;

      const draw = (timestamp: number) => {
        if (recordWavePausedRef.current) {
          recordWaveRafRef.current = null;
          return;
        }
        const canvas = recordWaveCanvasRef.current;
        const activeAnalyser = recordWaveAnalyserRef.current;
        const data = recordWaveDataRef.current;
        if (!canvas || !activeAnalyser || !data) {
          drawRecordWaveIdle();
          recordWaveRafRef.current = null;
          return;
        }

        const width = Math.max(1, canvas.clientWidth || 320);
        const height = Math.max(1, canvas.clientHeight || 80);
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          recordWaveRafRef.current = window.requestAnimationFrame(draw);
          return;
        }

        const now = Number.isFinite(timestamp) ? timestamp : performance.now();
        const minFrameDeltaMs = 55;
        if (now - recordWaveLastSampleAtRef.current >= minFrameDeltaMs) {
          activeAnalyser.getByteTimeDomainData(data);
          let energy = 0;
          for (let i = 0; i < data.length; i += 1) {
            const normalized = (data[i] - 128) / 128;
            energy += normalized * normalized;
          }
          const rms = Math.sqrt(energy / data.length);
          const history = recordWaveHistoryRef.current;
          const prev = history.length ? history[history.length - 1] ?? 0 : 0;
          const smoothed = prev * 0.72 + rms * 0.28;
          const clamped = clamp(smoothed, 0.02, 1);

          const stepPx = 3;
          const maxPoints = Math.max(24, Math.floor(width / stepPx));
          history.push(clamped);
          while (history.length > maxPoints) history.shift();
          recordWaveLastSampleAtRef.current = now;
        }

        const history = recordWaveHistoryRef.current;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#f7faf2";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "#d8e3d2";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        if (history.length > 0) {
          const stepPx = 3;
          const centerY = height / 2;
          const maxAmp = height * 0.4;

          ctx.strokeStyle = "#315f3b";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          for (let i = 0; i < history.length; i += 1) {
            const x = width - (history.length - 1 - i) * stepPx;
            const amp = (history[i] ?? 0) * maxAmp;
            ctx.beginPath();
            ctx.moveTo(x, centerY - amp);
            ctx.lineTo(x, centerY + amp);
            ctx.stroke();
          }
        }
        if (recordWavePausedRef.current) {
          recordWaveRafRef.current = null;
          return;
        }
        recordWaveRafRef.current = window.requestAnimationFrame(draw);
      };

      recordWaveDrawRef.current = draw;
      recordWaveRafRef.current = window.requestAnimationFrame(draw);
    } catch {
      drawRecordWaveIdle();
    }
  }

  function pauseRecordWaveMonitor() {
    recordWavePausedRef.current = true;
    cancelRecordWaveRaf();
  }

  function resumeRecordWaveMonitor() {
    if (!recordWaveAnalyserRef.current || !recordWaveDrawRef.current) return;
    recordWavePausedRef.current = false;
    if (recordWaveRafRef.current === null) {
      recordWaveRafRef.current = window.requestAnimationFrame(recordWaveDrawRef.current);
    }
  }

  function stopRecordWaveMonitor() {
    recordWavePausedRef.current = false;
    cancelRecordWaveRaf();
    recordWaveDrawRef.current = null;
    if (recordWaveSourceRef.current) {
      try {
        recordWaveSourceRef.current.disconnect();
      } catch {}
      recordWaveSourceRef.current = null;
    }
    if (recordWaveAnalyserRef.current) {
      try {
        recordWaveAnalyserRef.current.disconnect();
      } catch {}
      recordWaveAnalyserRef.current = null;
    }
    if (recordWaveCtxRef.current) {
      recordWaveCtxRef.current.close().catch(() => null);
      recordWaveCtxRef.current = null;
    }
    recordWaveDataRef.current = null;
    recordWaveHistoryRef.current = [];
    recordWaveLastSampleAtRef.current = 0;
    drawRecordWaveIdle();
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopRecordWaveMonitor();
  }

  function stopBackingTracks() {
    backingAudioRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    backingAudioRef.current = [];
  }

  function pauseBackingTracks() {
    backingAudioRef.current.forEach((audio) => audio.pause());
  }

  function resumeBackingTracks() {
    backingAudioRef.current.forEach((audio) => {
      audio.play().catch(() => null);
    });
  }

  function startBackingTracks() {
    stopBackingTracks();
    const list = layersRef.current.filter((layer) => !layer.muted);
    backingAudioRef.current = list.map((layer) => {
      const audio = new Audio(layer.url);
      audio.volume = clamp(layer.volume, 0, 1);
      audio.currentTime = 0;
      return audio;
    });
    backingAudioRef.current.forEach((audio) => audio.play().catch(() => null));
  }

  function stopMetronome() {
    if (metronomeIntervalRef.current) {
      window.clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
    if (metronomeCtxRef.current) {
      metronomeCtxRef.current.close().catch(() => null);
      metronomeCtxRef.current = null;
    }
  }

  function metronomeTick(audioCtx: AudioContext, accent: boolean) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = accent ? 1300 : 960;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.1, audioCtx.currentTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.045);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
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
    clearTimer();
    stopBackingTracks();
    stopMetronome();
    setMetronomePreviewPlaying(false);
  }

  function revokeLayerUrls(list: Layer[]) {
    list.forEach((layer) => URL.revokeObjectURL(layer.url));
  }

  function clearPreviewUrls() {
    setFxPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setStemsPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setMixPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setFxPreviewStatus("idle");
    setFxPreviewError("");
    setStemsPreviewStatus("idle");
    setStemsPreviewError("");
  }

  function resetRecorderSession(emitReset = true) {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {}
    recorderRef.current = null;
    stopStream();
    stopAllPlaybackHelpers();
    setRecordingState("idle");
    recordingSecondsRef.current = 0;
    setRecordingSeconds(0);
    decodedLayerCacheRef.current.clear();
    clearPreviewUrls();
    setLayers((prev) => {
      revokeLayerUrls(prev);
      return [];
    });
    setSelectedLayerId(null);
    setFxSettingsByLayerId({});
    setTab("tracks");
    setBpm(90);
    setBpmAutoEnabled(false);
    setSongKeyRoot(null);
    setSongKeyMode("minor");
    setSongKeyAutoEnabled(false);
    setAutoDetectLoading(null);
    setAutoDetectError("");
    onError("");
    if (emitReset) onReset?.();
  }

  useEffect(() => {
    resetRecorderSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const cache = decodedLayerCacheRef.current;
    return () => {
      clearTimer();
      stopBackingTracks();
      stopMetronome();
      stopStream();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      cache.clear();
      revokeLayerUrls(layersRef.current);
      setFxPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return prev;
      });
      setStemsPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return prev;
      });
      setMixPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return prev;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decodeLayerBuffer(layer: Layer): Promise<AudioBuffer> {
    const cached = decodedLayerCacheRef.current.get(layer.id);
    if (cached) return cached;
    const ctx = new window.AudioContext();
    try {
      const arrayBuffer = await layer.blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      decodedLayerCacheRef.current.set(layer.id, decoded);
      return decoded;
    } finally {
      await ctx.close().catch(() => null);
    }
  }

  function updateLayer(layerId: string, updater: (layer: Layer) => Layer) {
    setLayers((prev) => prev.map((layer) => (layer.id === layerId ? updater(layer) : layer)));
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
        base.eq.enabled = true;
        base.eq.bands[0].gainDb = 2;
        base.eq.bands[2].gainDb = 1.5;
        base.eq.bands[4].gainDb = 2.5;
        base.reverb.enabled = true;
        base.reverb.mix = 20;
        return base;
      }
      if (preset === "doubleWide") {
        base.delay.enabled = true;
        base.delay.mix = 28;
        base.delay.feedback = 18;
        base.delay.timeMs = 90;
        base.reverb.enabled = true;
        base.reverb.mix = 18;
        base.filter.enabled = false;
        return base;
      }
      base.filter.enabled = true;
      base.filter.mode = "bandpass";
      base.filter.cutoff = 1700;
      base.filter.resonance = 2.4;
      base.filter.mix = 80;
      base.distortion.enabled = true;
      base.distortion.drive = 16;
      base.distortion.mix = 15;
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
    const activeLayers = layers.filter((layer) => !layer.muted);
    if (!activeLayers.length) {
      throw new Error("Включи хотя бы одну дорожку для preview/render.");
    }

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
    if (!selectedRecordedLayer || !selectedRecordedLayerFx) {
      setFxPreviewStatus("idle");
      setFxPreviewError("");
      return;
    }

    setFxPreviewStatus("processing");
    setFxPreviewError("");
    onError("");

    try {
      const decoded = await decodeLayerBuffer(selectedRecordedLayer);
      const processed = await processLayerForRender(selectedRecordedLayer, decoded);
      const url = URL.createObjectURL(encodeWavFromBuffer(processed));
      cloneUrlState(setFxPreviewUrl, url);
      setFxPreviewStatus("ready");
    } catch (error) {
      setFxPreviewStatus("error");
      setFxPreviewError(error instanceof Error ? error.message : "Не удалось собрать FX preview.");
    }
  }

  async function renderStemsPreview() {
    if (mixing || stemsPreviewStatus === "processing") return;
    setStemsPreviewStatus("processing");
    setStemsPreviewError("");
    onError("");
    try {
      const { blob } = await renderSessionAudioBlob();
      const url = URL.createObjectURL(blob);
      cloneUrlState(setStemsPreviewUrl, url);
      setStemsPreviewStatus("ready");
      setTab("mix");
    } catch (error) {
      setStemsPreviewStatus("error");
      setStemsPreviewError(error instanceof Error ? error.message : "Не удалось собрать preview.");
      onError(error instanceof Error ? error.message : "Не удалось собрать preview.");
    }
  }

  async function renderMixdown() {
    if (mixing) return;
    setMixing(true);
    onError("");
    try {
      const { blob, durationSec } = await renderSessionAudioBlob();
      const url = URL.createObjectURL(blob);
      cloneUrlState(setMixPreviewUrl, url);
      onReady({ blob, durationSec, filename: `multitrack-mix-${Date.now()}.wav` });
      setTab("mix");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось сделать render.");
    } finally {
      setMixing(false);
    }
  }

  const autoDetectFromBlob = useCallback(async (blob: Blob, target: AutoDetectTarget) => {
    setAutoDetectLoading(target);
    setAutoDetectError("");
    try {
      const result = await analyzeAudioBlobInBrowser(blob);
      if ((target === "bpm" || target === "both") && result.bpm !== null) {
        setBpm(clampBpmValue(result.bpm));
        setBpmAutoEnabled(true);
      }
      if ((target === "key" || target === "both") && result.keyRoot && result.keyMode) {
        setSongKeyRoot(result.keyRoot);
        setSongKeyMode(result.keyMode);
        setSongKeyAutoEnabled(true);
      }
      if (
        ((target === "bpm" && result.bpm === null) ||
          (target === "key" && (!result.keyRoot || !result.keyMode)) ||
          (target === "both" && result.bpm === null && (!result.keyRoot || !result.keyMode)))
      ) {
        setAutoDetectError("Не удалось уверенно определить BPM/тональность. Укажи вручную.");
      }
    } catch (error) {
      setAutoDetectError(error instanceof Error ? error.message : "Ошибка автоанализа.");
    } finally {
      setAutoDetectLoading(null);
    }
  }, []);

  async function runAutoDetect(target: Exclude<AutoDetectTarget, null>) {
    const source = selectedLayer?.blob ?? layers[layers.length - 1]?.blob ?? null;
    if (!source) {
      setAutoDetectError("Нет аудио для анализа. Загрузи бит или запиши дорожку.");
      return;
    }
    await autoDetectFromBlob(source, target);
  }

  function commitBpmInput() {
    const parsed = Number(bpmInputValue);
    if (!Number.isFinite(parsed)) {
      setBpmInputValue(String(bpm));
      return;
    }
    const next = clampBpmValue(parsed);
    setBpm(next);
    setBpmInputValue(String(next));
    setBpmAutoEnabled(false);
  }

  function startRecordingTimer() {
    clearTimer();
    recordingSecondsRef.current = 0;
    setRecordingSeconds(0);
    timerRef.current = window.setInterval(() => {
      recordingSecondsRef.current += 1;
      setRecordingSeconds(recordingSecondsRef.current);
    }, 1000);
  }

  function pauseRecordingTimer() {
    clearTimer();
  }

  function resumeRecordingTimer() {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      recordingSecondsRef.current += 1;
      setRecordingSeconds(recordingSecondsRef.current);
    }, 1000);
  }

  async function startRecording() {
    if (recordingState !== "idle") return;
    onError("");
    try {
      discardRecordingOnStopRef.current = false;
      setMetronomePreviewPlaying(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startRecordWaveMonitor(stream);
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const shouldDiscard = discardRecordingOnStopRef.current;
          discardRecordingOnStopRef.current = false;
          if (shouldDiscard) {
            chunksRef.current = [];
            recordingSecondsRef.current = 0;
            setRecordingSeconds(0);
            return;
          }
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const url = URL.createObjectURL(blob);
          const nextLayerId = crypto.randomUUID();
          const nextDuration = Math.max(recordingSecondsRef.current, await getBlobDurationSeconds(blob));
          const armedName = armedTrackTemplate?.name?.trim();
          const layer: Layer = {
            id: nextLayerId,
            kind: "recording",
            name: armedName || createLayerName(layersRef.current.length + 1),
            role: armedTrackTemplate?.role ?? null,
            blob,
            url,
            durationSec: nextDuration,
            muted: false,
            volume: 0.9,
            pan: 0
          };
          setLayers((prev) => [...prev, layer]);
          setSelectedLayerId(nextLayerId);
          setFxSettingsByLayerId((prev) => ({ ...prev, [nextLayerId]: createDefaultFxChainSettings() }));
          setTab("tracks");
        } finally {
          stopStream();
          stopAllPlaybackHelpers();
          setRecordingState("idle");
        }
      };

      if (layersRef.current.some((layer) => !layer.muted)) {
        startBackingTracks();
      }
      startMetronome();
      startRecordingTimer();
      recorder.start();
      setRecordingState("recording");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось получить доступ к микрофону.");
      stopStream();
      stopAllPlaybackHelpers();
      setRecordingState("idle");
    }
  }

  function pauseRecording() {
    if (!recorderRef.current || recordingState !== "recording") return;
    recorderRef.current.pause();
    pauseRecordingTimer();
    pauseRecordWaveMonitor();
    pauseBackingTracks();
    stopMetronome();
    setRecordingState("paused");
  }

  function resumeRecording() {
    if (!recorderRef.current || recordingState !== "paused") return;
    setMetronomePreviewPlaying(false);
    recorderRef.current.resume();
    resumeRecordingTimer();
    resumeRecordWaveMonitor();
    resumeBackingTracks();
    startMetronome();
    setRecordingState("recording");
  }

  function stopRecording() {
    if (!recorderRef.current) return;
    if (recordingState !== "recording" && recordingState !== "paused") return;
    discardRecordingOnStopRef.current = false;
    try {
      recorderRef.current.stop();
    } catch {}
    clearTimer();
    setRecordingState("idle");
  }

  function deleteCurrentTake() {
    if (!recorderRef.current || recordingState !== "paused") return;
    setMetronomePreviewPlaying(false);
    discardRecordingOnStopRef.current = true;
    try {
      recorderRef.current.stop();
    } catch {}
    clearTimer();
    setRecordingState("idle");
  }

  function removeLayer(layerId: string) {
    decodedLayerCacheRef.current.delete(layerId);
    setFxSettingsByLayerId((prev) => {
      if (!(layerId in prev)) return prev;
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
    if (selectedLayerId === layerId) setSelectedLayerId(null);
    setLayers((prev) => {
      const found = prev.find((layer) => layer.id === layerId);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((layer) => layer.id !== layerId);
    });
  }

  const importAudioLayerFromFile = useCallback(async (
    file: File,
    options?: { name?: string; volume?: number; pan?: number; role?: RecorderTrackRole | null; autoDetectTempoKey?: boolean }
  ) => {
    if (!file.type.startsWith("audio/")) {
      onError("Можно импортировать только аудиофайл.");
      return;
    }
    onError("");
    try {
      const durationSec = await getBlobDurationSeconds(file);
      const layerId = crypto.randomUUID();
      const url = URL.createObjectURL(file);
      const layer: Layer = {
        id: layerId,
        kind: "import",
        name: options?.name?.trim() || file.name || createLayerName(layersRef.current.length + 1),
        role: options?.role ?? null,
        blob: file,
        url,
        durationSec,
        muted: false,
        volume: typeof options?.volume === "number" ? clamp(options.volume, 0, 1) : 0.9,
        pan: clampPanValue(options?.pan ?? 0)
      };
      setLayers((prev) => [...prev, layer]);
      setSelectedLayerId(layerId);
      setTab("tracks");
      if (options?.autoDetectTempoKey) {
        void autoDetectFromBlob(file, "both");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось импортировать аудиодорожку.");
    }
  }, [autoDetectFromBlob, onError]);

  useImperativeHandle(
    ref,
    () => ({
      importAudioLayerFromFile
    }),
    [importAudioLayerFromFile]
  );

  const canRecord = recordingState === "idle";
  const canPause = recordingState === "recording";
  const canResume = recordingState === "paused";
  const canStop = recordingState === "recording" || recordingState === "paused";
  const canPreviewMetronome = recordingState === "idle";
  const hasRecordedChunkInCurrentTake = canStop && recordingSeconds > 0;
  const showSaveOnStopButton = recordingState === "paused" && recordingSeconds > 0;
  const primaryRecordButtonLabel = recordingState === "idle" ? "Record" : "Resume";
  const canPrimaryRecordButton = canRecord || canResume;
  const activeLayerCount = layers.filter((layer) => !layer.muted).length;

  function toggleMetronomePreview() {
    if (!canPreviewMetronome) return;
    if (metronomePreviewPlaying) {
      stopMetronome();
      setMetronomePreviewPlaying(false);
      return;
    }
    startMetronome(true);
    setMetronomePreviewPlaying(true);
  }

  useEffect(() => {
    if (!metronomePreviewPlaying || !canPreviewMetronome) return;
    startMetronome(true);
    setMetronomePreviewPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);
  return (
    <div className="space-y-4 rounded-3xl border border-brand-border bg-white/85 p-4 shadow-[0_18px_45px_rgba(61,84,46,0.08)]">
      <div className="rounded-2xl border border-brand-border bg-gradient-to-br from-[#f8fbf3] to-[#edf4e6] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">Multitrack Recorder</p>
            <h3 className="text-xl font-semibold tracking-tight text-brand-ink">Demo Session</h3>
            <p className="mt-1 text-sm text-brand-muted">
              Пошаговая запись дорожек, FX, панорама, preview и финальный render под ваш demo flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" className="border-brand-border bg-white" onClick={() => resetRecorderSession()}>
              Очистить рекордер
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
          <div className="rounded-xl border border-brand-border bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">BPM</p>
              <Button
                type="button"
                variant="secondary"
                className={`h-8 rounded-lg px-2 text-xs ${
                  bpmAutoEnabled
                    ? "border-[#c4d8c0] bg-[#eef7ea] text-[#315f3b] hover:bg-[#e7f3e2]"
                    : "border-brand-border bg-white text-brand-muted hover:bg-[#f7faf2]"
                }`}
                onClick={() => void runAutoDetect("bpm")}
                disabled={autoDetectLoading !== null}
              >
                {autoDetectLoading === "bpm" || autoDetectLoading === "both" ? "Auto..." : bpmAutoEnabled ? "Auto ✓" : "Auto"}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={40}
                max={240}
                value={bpmInputValue}
                onChange={(event) => setBpmInputValue(event.target.value)}
                onBlur={commitBpmInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="h-10 min-w-0 flex-1"
              />
              <Button variant="secondary" className="h-10 shrink-0 px-3" onClick={() => { setBpm(clampBpmValue(bpm - 1)); setBpmAutoEnabled(false); }}>
                -
              </Button>
              <Button variant="secondary" className="h-10 shrink-0 px-3" onClick={() => { setBpm(clampBpmValue(bpm + 1)); setBpmAutoEnabled(false); }}>
                +
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMetronomeEnabled((prev) => !prev)}
                className={`h-10 w-full rounded-xl border px-2 py-2 text-[11px] font-semibold leading-tight sm:text-xs ${
                  metronomeEnabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                }`}
              >
                {metronomeEnabled ? "METRO: ON" : "METRO: OFF"}
              </button>
              <Button
                type="button"
                variant={metronomePreviewPlaying ? "primary" : "secondary"}
                className={
                  metronomePreviewPlaying
                    ? "h-10 w-full bg-[#6f9f7b] text-white hover:bg-[#5f8f6c]"
                    : "h-10 w-full border-brand-border bg-white"
                }
                onClick={toggleMetronomePreview}
                disabled={!canPreviewMetronome}
              >
                {metronomePreviewPlaying ? "STOP" : "PLAY"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-brand-border bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Key</p>
              <Button
                type="button"
                variant="secondary"
                className={`h-8 rounded-lg px-2 text-xs ${
                  songKeyAutoEnabled
                    ? "border-[#c4d8c0] bg-[#eef7ea] text-[#315f3b] hover:bg-[#e7f3e2]"
                    : "border-brand-border bg-white text-brand-muted hover:bg-[#f7faf2]"
                }`}
                onClick={() => void runAutoDetect("key")}
                disabled={autoDetectLoading !== null}
              >
                {autoDetectLoading === "key" || autoDetectLoading === "both" ? "Auto..." : songKeyAutoEnabled ? "Auto ✓" : "Auto"}
              </Button>
            </div>
            <div className="space-y-2">
              <select
                value={songKeyRoot ?? ""}
                onChange={(event) => {
                  setSongKeyRoot(event.target.value || null);
                  setSongKeyAutoEnabled(false);
                }}
                className="h-10 w-full min-w-0 rounded-xl border border-brand-border bg-white px-2 text-sm text-brand-ink"
              >
                <option value="">Не выбрано</option>
                {KEY_ROOTS.map((root) => (
                  <option key={root} value={root}>{root}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={songKeyMode === "minor" ? "primary" : "secondary"}
                  className="h-10 w-full px-3"
                  onClick={() => {
                    setSongKeyMode("minor");
                    setSongKeyAutoEnabled(false);
                  }}
                >
                  Min
                </Button>
                <Button
                  type="button"
                  variant={songKeyMode === "major" ? "primary" : "secondary"}
                  className="h-10 w-full px-3"
                  onClick={() => {
                    setSongKeyMode("major");
                    setSongKeyAutoEnabled(false);
                  }}
                >
                  Maj
                </Button>
              </div>
            </div>
          </div>

          <div className="col-span-2 rounded-xl border border-brand-border bg-white p-3 xl:col-span-1">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-brand-muted">Record</p>
            <div className="mb-3 overflow-hidden rounded-xl border border-brand-border bg-[#f7faf2]">
              <canvas ref={recordWaveCanvasRef} className="block h-20 w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  if (recordingState === "idle") {
                    void startRecording();
                    return;
                  }
                  if (recordingState === "paused") {
                    resumeRecording();
                  }
                }}
                disabled={!canPrimaryRecordButton}
              >
                {primaryRecordButtonLabel}
              </Button>
              <Button type="button" variant="secondary" onClick={pauseRecording} disabled={!canPause}>
                Pause
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={deleteCurrentTake}
                disabled={!canResume}
                className="border-red-300 bg-[#fff2ef] text-[#a4372a] hover:bg-[#ffe7e0] disabled:border-brand-border disabled:bg-white disabled:text-brand-muted"
              >
                Delete
              </Button>
              <Button
                type="button"
                variant={showSaveOnStopButton ? "primary" : "secondary"}
                className={
                  showSaveOnStopButton
                    ? "bg-[#6f9f7b] text-white hover:bg-[#5f8f6c]"
                    : "border-brand-border bg-white"
                }
                onClick={stopRecording}
                disabled={!canStop}
              >
                {showSaveOnStopButton ? "Save" : "Stop"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-brand-muted">
              Состояние: <span className="font-medium text-brand-ink">{recordingState}</span> • {formatDuration(recordingSeconds)}
            </p>
          </div>

        </div>

        {autoDetectError && (
          <div className="mt-3 rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-xs text-[#a4372a]">
            {autoDetectError}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-brand-border bg-white/80 p-2">
        {([
          { id: "tracks", label: "Tracks" },
          { id: "fx", label: "FX" },
          { id: "mix", label: "Mix" }
        ] as const).map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={tab === item.id ? "primary" : "secondary"}
            className={tab === item.id ? "" : "border-brand-border bg-white"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "tracks" && (
        <div className="space-y-4 rounded-2xl border border-brand-border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="border-brand-border bg-white"
              onClick={() => beatFileInputRef.current?.click()}
            >
              Загрузить бит
            </Button>
            <Button type="button" onClick={() => void renderStemsPreview()} disabled={stemsPreviewStatus === "processing" || mixing || !layers.length}>
              {stemsPreviewStatus === "processing" ? "Собираем preview..." : "Preview Mix (быстро)"}
            </Button>
            <p className="text-sm text-brand-muted">Preview всех активных дорожек с учётом volume/pan и FX для записанных дорожек.</p>
          </div>
          <input
            ref={beatFileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.currentTarget.value = "";
              if (!file) return;
              void importAudioLayerFromFile(file, {
                role: "beat",
                autoDetectTempoKey: true
              });
            }}
          />
          {stemsPreviewError && <p className="text-xs text-[#a4372a]">{stemsPreviewError}</p>}
          {stemsPreviewUrl && (
            <div className="rounded-xl border border-brand-border bg-[#f7faf2] p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-brand-muted">Mix Preview</p>
              <AudioWaveformPlayer src={stemsPreviewUrl} className="[&_p]:text-brand-muted" />
            </div>
          )}

          {layers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-border bg-[#f7faf2] p-4 text-sm text-brand-muted">
              Пока нет дорожек. Запишите первую дорожку или импортируйте бит.
            </p>
          ) : (
            <div className="space-y-3">
              {layers.map((layer) => {
                const selected = selectedLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    className={`rounded-2xl border p-3 ${selected ? "border-[#7ca27f] bg-[#f4faef]" : "border-brand-border bg-[#fbfdf8]"}`}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedLayerId(layer.id)}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                          selected ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                        }`}
                      >
                        {selected ? "Выбрана" : "Выбрать"}
                      </button>
                      {formatRoleLabel(layer.role) && (
                        <span className="rounded-lg border border-brand-border bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                          {formatRoleLabel(layer.role)}
                        </span>
                      )}
                      <span className="text-xs text-brand-muted">{layer.kind === "import" ? "Импорт" : "Запись"}</span>
                      <span className="ml-auto text-xs text-brand-muted">{formatDuration(layer.durationSec)}</span>
                    </div>

                    <div className="mb-2 flex items-center gap-2">
                      <Input
                        value={layer.name}
                        onChange={(event) => updateLayer(layer.id, (current) => ({ ...current, name: event.target.value }))}
                        className="h-10"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 w-10 border-brand-border bg-white p-0"
                        onClick={() => updateLayer(layer.id, (current) => ({ ...current, muted: !current.muted }))}
                        title={layer.muted ? "Включить" : "Выключить"}
                      >
                        {layer.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 w-10 border-brand-border bg-white p-0"
                        onClick={() => removeLayer(layer.id)}
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <AudioWaveformPlayer src={layer.url} className="mb-2" />

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-xl border border-brand-border bg-white p-2">
                        <div className="mb-1 flex items-center justify-between text-xs text-brand-muted">
                          <span>Volume</span>
                          <span>{Math.round(layer.volume * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(layer.volume * 100)}
                          onChange={(event) =>
                            updateLayer(layer.id, (current) => ({ ...current, volume: clamp(Number(event.target.value) / 100, 0, 1) }))
                          }
                          className="h-2 w-full cursor-pointer accent-[#2A342C]"
                        />
                      </div>

                      <div className="rounded-xl border border-brand-border bg-white p-2">
                        <div className="mb-1 flex items-center justify-between text-xs text-brand-muted">
                          <span>Pan</span>
                          <span>{formatPanLabel(layer.pan)}</span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          value={clampPanValue(layer.pan)}
                          onChange={(event) =>
                            updateLayer(layer.id, (current) => ({ ...current, pan: clampPanValue(Number(event.target.value)) }))
                          }
                          className="h-2 w-full cursor-pointer accent-[#2A342C]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "fx" && (
        <div className="space-y-4 rounded-2xl border border-brand-border bg-white p-4">
          {!selectedRecordedLayer || !selectedRecordedLayerFx ? (
            <p className="rounded-xl border border-dashed border-brand-border bg-[#f7faf2] p-4 text-sm text-brand-muted">
              Выберите записанную дорожку в `Tracks`, чтобы открыть FX.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">FX for selected track</p>
                  <h4 className="text-lg font-semibold text-brand-ink">{selectedRecordedLayer.name}</h4>
                  <p className="text-sm text-brand-muted">{formatRoleLabel(selectedRecordedLayer.role) ?? "Track"} • {formatDuration(selectedRecordedLayer.durationSec)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="border-brand-border bg-white" onClick={() => applyFxPreset("clean")}>
                    Clean
                  </Button>
                  <Button type="button" variant="secondary" className="border-brand-border bg-white" onClick={() => applyFxPreset("warm")}>
                    Warm Vox
                  </Button>
                  <Button type="button" variant="secondary" className="border-brand-border bg-white" onClick={() => applyFxPreset("doubleWide")}>
                    Double Wide
                  </Button>
                  <Button type="button" variant="secondary" className="border-brand-border bg-white" onClick={() => applyFxPreset("phone")}>
                    Phone
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void renderSelectedFxPreview()} disabled={fxPreviewStatus === "processing"}>
                  {fxPreviewStatus === "processing" ? "Рендерим FX preview..." : "Preview selected track FX"}
                </Button>
                <Button type="button" variant="secondary" className="border-brand-border bg-white" onClick={() => updateSelectedLayerFx((fx) => ({
                  ...fx,
                  eq: { ...fx.eq, enabled: false },
                  autotune: { ...fx.autotune, enabled: false },
                  distortion: { ...fx.distortion, enabled: false },
                  filter: { ...fx.filter, enabled: false },
                  delay: { ...fx.delay, enabled: false },
                  reverb: { ...fx.reverb, enabled: false }
                }))}>
                  Bypass all
                </Button>
              </div>
              {fxPreviewError && <p className="text-xs text-[#a4372a]">{fxPreviewError}</p>}
              <div className="rounded-xl border border-brand-border bg-[#f7faf2] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-brand-muted">Selected Track Preview</p>
                <AudioWaveformPlayer src={fxPreviewUrl || selectedRecordedLayer.url} />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-ink">EQ (3 bands)</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFxPanel("eq")}
                        className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted"
                      >
                        {fxPanelsOpen.eq ? "Collapse" : "Expand"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, eq: { ...fx.eq, enabled: !fx.eq.enabled } }))}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                          selectedRecordedLayerFx.eq.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                        }`}
                      >
                        {selectedRecordedLayerFx.eq.enabled ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                  {fxPanelsOpen.eq && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[0, 2, 4].map((bandIndex, idx) => {
                        const band = selectedRecordedLayerFx.eq.bands[bandIndex];
                        const label = idx === 0 ? "Low" : idx === 1 ? "Mid" : "High";
                        return (
                          <KnobControl
                            key={`${label}-${bandIndex}`}
                            label={label}
                            value={band.gainDb}
                            min={-12}
                            max={12}
                            step={0.5}
                            formatValue={(nextValue) => `${nextValue > 0 ? "+" : ""}${nextValue.toFixed(1)} dB`}
                            onChange={(nextValue) =>
                              updateSelectedLayerFx((fx) => ({
                                ...fx,
                                eq: {
                                  ...fx.eq,
                                  bands: fx.eq.bands.map((current, currentIndex) =>
                                    currentIndex === bandIndex ? { ...current, gainDb: nextValue } : current
                                  )
                                }
                              }))
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-ink">Reverb</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFxPanel("reverb")}
                          className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted"
                        >
                          {fxPanelsOpen.reverb ? "Collapse" : "Expand"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, reverb: { ...fx.reverb, enabled: !fx.reverb.enabled } }))}
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                            selectedRecordedLayerFx.reverb.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                          }`}
                        >
                          {selectedRecordedLayerFx.reverb.enabled ? "On" : "Off"}
                        </button>
                      </div>
                    </div>
                    {fxPanelsOpen.reverb && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          ["Mix", "mix", 0, 100],
                          ["Decay", "decay", 0, 100],
                          ["Tone", "tone", 0, 100]
                        ].map(([label, key, min, max]) => (
                          <KnobControl
                            key={String(key)}
                            label={String(label)}
                            value={Number(selectedRecordedLayerFx.reverb[key as keyof typeof selectedRecordedLayerFx.reverb])}
                            min={Number(min)}
                            max={Number(max)}
                            step={1}
                            formatValue={(nextValue) => `${Math.round(nextValue)}`}
                            onChange={(nextValue) =>
                              updateSelectedLayerFx((fx) => ({
                                ...fx,
                                reverb: { ...fx.reverb, [key]: nextValue }
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-brand-ink">Delay</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFxPanel("delay")}
                          className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted"
                        >
                          {fxPanelsOpen.delay ? "Collapse" : "Expand"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, delay: { ...fx.delay, enabled: !fx.delay.enabled } }))}
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                            selectedRecordedLayerFx.delay.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                          }`}
                        >
                          {selectedRecordedLayerFx.delay.enabled ? "On" : "Off"}
                        </button>
                      </div>
                    </div>
                    {fxPanelsOpen.delay && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          ["Mix", "mix", 0, 100],
                          ["Feedback", "feedback", 0, 90],
                          ["Time ms", "timeMs", 40, 1200]
                        ].map(([label, key, min, max]) => (
                          <KnobControl
                            key={String(key)}
                            label={String(label)}
                            value={Number(selectedRecordedLayerFx.delay[key as keyof typeof selectedRecordedLayerFx.delay])}
                            min={Number(min)}
                            max={Number(max)}
                            step={1}
                            formatValue={(nextValue) => `${Math.round(nextValue)}`}
                            onChange={(nextValue) =>
                              updateSelectedLayerFx((fx) => ({
                                ...fx,
                                delay: { ...fx.delay, syncMode: "free", [key]: nextValue }
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-ink">Filter</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFxPanel("filter")}
                        className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted"
                      >
                        {fxPanelsOpen.filter ? "Collapse" : "Expand"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, filter: { ...fx.filter, enabled: !fx.filter.enabled } }))}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                          selectedRecordedLayerFx.filter.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                        }`}
                      >
                        {selectedRecordedLayerFx.filter.enabled ? "On" : "Off"}
                      </button>
                    </div>
                  </div>
                  {fxPanelsOpen.filter && (
                    <>
                      <div className="mb-2 grid grid-cols-3 gap-2">
                        {(["lowpass", "bandpass", "highpass"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, filter: { ...fx.filter, mode } }))}
                            className={`rounded-lg border px-2 py-1 text-xs ${
                              selectedRecordedLayerFx.filter.mode === mode
                                ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]"
                                : "border-brand-border bg-white text-brand-muted"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          ["Cutoff", "cutoff", 20, 20000],
                          ["Resonance", "resonance", 0, 20],
                          ["Mix", "mix", 0, 100]
                        ].map(([label, key, min, max]) => (
                          <KnobControl
                            key={String(key)}
                            label={String(label)}
                            value={Number(selectedRecordedLayerFx.filter[key as keyof typeof selectedRecordedLayerFx.filter])}
                            min={Number(min)}
                            max={Number(max)}
                            step={key === "resonance" ? 0.1 : 1}
                            formatValue={(nextValue) => (key === "resonance" ? nextValue.toFixed(1) : `${Math.round(nextValue)}`)}
                            onChange={(nextValue) =>
                              updateSelectedLayerFx((fx) => ({
                                ...fx,
                                filter: { ...fx.filter, [key]: nextValue }
                              }))
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-ink">Drive / Tune</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFxPanel("driveTune")}
                        className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted"
                      >
                        {fxPanelsOpen.driveTune ? "Collapse" : "Expand"}
                      </button>
                      <Button type="button" variant="secondary" className="border-brand-border bg-white" onClick={() => updateSelectedLayerFx(() => createDefaultFxChainSettings())}>
                        Reset FX
                      </Button>
                    </div>
                  </div>
                  {fxPanelsOpen.driveTune && (
                    <>
                  <div className="mb-3 rounded-xl border border-brand-border bg-white p-2">
                    <div className="mb-2 flex items-center justify-between text-xs text-brand-muted">
                      <span>Distortion</span>
                      <button
                        type="button"
                        onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, distortion: { ...fx.distortion, enabled: !fx.distortion.enabled } }))}
                        className={`rounded border px-2 py-0.5 text-[11px] ${
                          selectedRecordedLayerFx.distortion.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                        }`}
                      >
                        {selectedRecordedLayerFx.distortion.enabled ? "On" : "Off"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        ["Drive", "drive"],
                        ["Mix", "mix"],
                        ["Tone", "tone"]
                      ].map(([label, key]) => (
                        <KnobControl
                          key={String(key)}
                          label={String(label)}
                          value={Number(selectedRecordedLayerFx.distortion[key as keyof typeof selectedRecordedLayerFx.distortion])}
                          min={0}
                          max={100}
                          step={1}
                          formatValue={(nextValue) => `${Math.round(nextValue)}`}
                          onChange={(nextValue) =>
                            updateSelectedLayerFx((fx) => ({
                              ...fx,
                              distortion: { ...fx.distortion, [key]: nextValue }
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-brand-border bg-white p-2">
                    <div className="mb-2 flex items-center justify-between text-xs text-brand-muted">
                      <span>Autotune (experimental)</span>
                      <button
                        type="button"
                        onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, autotune: { ...fx.autotune, enabled: !fx.autotune.enabled } }))}
                        className={`rounded border px-2 py-0.5 text-[11px] ${
                          selectedRecordedLayerFx.autotune.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
                        }`}
                      >
                        {selectedRecordedLayerFx.autotune.enabled ? "On" : "Off"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        ["Amount", "amount"],
                        ["Speed", "retuneSpeed"],
                        ["Mix", "mix"]
                      ].map(([label, key]) => (
                        <KnobControl
                          key={String(key)}
                          label={String(label)}
                          value={Number(selectedRecordedLayerFx.autotune[key as keyof typeof selectedRecordedLayerFx.autotune])}
                          min={0}
                          max={100}
                          step={1}
                          formatValue={(nextValue) => `${Math.round(nextValue)}`}
                          onChange={(nextValue) =>
                            updateSelectedLayerFx((fx) => ({
                              ...fx,
                              autotune: { ...fx.autotune, [key]: nextValue }
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                    </>
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      )}

      {tab === "mix" && (
        <div className="space-y-4 rounded-2xl border border-brand-border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void renderStemsPreview()} disabled={stemsPreviewStatus === "processing" || mixing || !layers.length}>
              {stemsPreviewStatus === "processing" ? "Собираем preview..." : "Собрать preview mix"}
            </Button>
            <Button type="button" onClick={() => void renderMixdown()} disabled={mixing || !layers.length}>
              {mixing ? "Rendering..." : "Render Mix"}
            </Button>
            <p className="text-sm text-brand-muted">Финальный `Render Mix` передаст WAV в demo-flow для сохранения.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-brand-border bg-[#f7faf2] p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-brand-muted">Preview Mix</p>
              {stemsPreviewUrl ? (
                <AudioWaveformPlayer src={stemsPreviewUrl} />
              ) : (
                <p className="rounded-lg border border-dashed border-brand-border bg-white p-3 text-sm text-brand-muted">
                  Нажмите `Собрать preview mix`.
                </p>
              )}
              {stemsPreviewError && <p className="mt-2 text-xs text-[#a4372a]">{stemsPreviewError}</p>}
            </div>

            <div className="rounded-xl border border-brand-border bg-[#f7faf2] p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-brand-muted">Final Render</p>
              {mixPreviewUrl ? (
                <AudioWaveformPlayer src={mixPreviewUrl} />
              ) : (
                <p className="rounded-lg border border-dashed border-brand-border bg-white p-3 text-sm text-brand-muted">
                  После `Render Mix` здесь появится финальный preview (stereo WAV).
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MultiTrackRecorder.displayName = "MultiTrackRecorder";
