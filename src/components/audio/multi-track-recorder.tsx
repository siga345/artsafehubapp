"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Trash2, Volume2, VolumeX } from "lucide-react";

import { AudioWaveformPlayer } from "@/components/audio/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  computeDelayTimeMsFromBpm,
  createDefaultFxChainSettings,
  hasEnabledFx,
  processAudioBufferWithFx,
  type DelaySyncMode,
  type DelayNoteDivision,
  type FxChainSettings,
  type FxFilterMode
} from "@/lib/audio/fx-chain";
import {
  clampLoopPercentRange,
  hasActiveRecorderAdjust,
  renderAdjustedBufferMvp,
  type RecorderAdjustSettings
} from "@/lib/audio/recorder-adjust";
import { analyzeAudioBlobInBrowser } from "@/lib/audio/analysis";

type RecordingState = "idle" | "recording" | "paused" | "stopped";
type RecorderPanel = "adjust" | "fx" | "stems" | "mix";
type AdjustMode = "varispeed" | "gain";
type FxPreviewStatus = "idle" | "processing" | "ready" | "error";
type FxBlockUiKey = "eq" | "autotune" | "distortion" | "filter" | "delay" | "reverb";
type TopPopover = "key" | "bpm" | null;
type TonalMode = "minor" | "major";

type Layer = {
  id: string;
  kind: "import" | "recording";
  name: string;
  blob: Blob;
  url: string;
  durationSec: number;
  muted: boolean;
  volume: number;
};

type PendingRecordedTake = Omit<Layer, "kind" | "muted" | "volume">;

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
};

export type MultiTrackRecorderHandle = {
  importAudioLayerFromFile: (file: File, options?: { name?: string; volume?: number }) => Promise<void>;
};

const WAVEFORM_SAMPLES = 140;
const FX_PREVIEW_DEBOUNCE_MS = 320;
const DELAY_DIVISION_OPTIONS: Array<{ value: DelayNoteDivision; label: string }> = [
  { value: "1/4", label: "1/4" },
  { value: "1/8", label: "1/8" },
  { value: "1/8D", label: "1/8D" },
  { value: "1/8T", label: "1/8T" },
  { value: "1/16", label: "1/16" }
];
const ENHARMONIC_KEY_COLUMNS = [
  { sharp: "C#", flat: "Db" },
  { sharp: "D#", flat: "Eb" },
  { sharp: "F#", flat: "Gb" },
  { sharp: "G#", flat: "Ab" },
  { sharp: "A#", flat: "Bb" }
] as const;
const NATURAL_KEYS = ["C", "D", "E", "F", "G", "A", "B"] as const;

function formatDuration(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatKeyChipLabel(root: string | null, mode: TonalMode, auto: boolean) {
  if (auto) return root ? `${root} ${mode === "minor" ? "Min" : "Maj"}` : "Auto";
  if (!root) return "Set Key";
  return `${root} ${mode === "minor" ? "Min" : "Maj"}`;
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
  const dataLength = sampleCount * bytesPerSample;
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
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 8 * bytesPerSample, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataLength, true);
  offset += 4;

  const mono = new Float32Array(sampleCount);
  for (let ch = 0; ch < channelCount; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < sampleCount; i += 1) {
      mono[i] += data[i] / channelCount;
    }
  }

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function createLayerName(index: number) {
  return `Дорожка ${index}`;
}

function clampBpmValue(value: number) {
  return Math.min(240, Math.max(40, Math.round(value)));
}

type AdjustRailSliderProps = {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  valueLabel: string;
  onChange: (next: number) => void;
  centerValue?: number;
};

function AdjustRailSlider({
  label,
  min,
  max,
  step = 1,
  value,
  valueLabel,
  onChange,
  centerValue
}: AdjustRailSliderProps) {
  const safeRange = Math.max(1, max - min);
  const thumbPercent = ((value - min) / safeRange) * 100;
  const centerPercent = typeof centerValue === "number" ? ((centerValue - min) / safeRange) * 100 : null;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#141519] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
        <div className="pl-2 font-mono text-sm text-white/80">{label}</div>

        <div className="relative h-14 overflow-hidden rounded-xl border border-white/5 bg-[#101114]">
          <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/10" />

          <div className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2">
            <div className="flex items-center justify-between">
              {Array.from({ length: 13 }).map((_, index) => (
                <span
                  key={index}
                  className={`w-px rounded-full ${index === 6 ? "h-8 bg-white/35" : "h-5 bg-white/18"}`}
                />
              ))}
            </div>
          </div>

          {centerPercent !== null && (
            <div
              className="pointer-events-none absolute top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-full bg-white/90"
              style={{ left: `calc(${centerPercent}% - 1.5px)` }}
            />
          )}

          <div
            className="pointer-events-none absolute top-1/2 h-10 w-[6px] -translate-y-1/2 rounded-full bg-[#ffe900] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
            style={{ left: `calc(${thumbPercent}% - 3px)` }}
          />

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="min-w-[64px] pr-2 text-right font-mono text-sm font-semibold text-white/75">{valueLabel}</div>
      </div>
    </div>
  );
}

type FxSectionCardProps = {
  title: string;
  subtitle?: string;
  enabled: boolean;
  collapsed: boolean;
  onToggleEnabled: (next: boolean) => void;
  onToggleCollapsed: () => void;
  onReset: () => void;
  children: React.ReactNode;
};

function FxSectionCard({
  title,
  subtitle,
  enabled,
  collapsed,
  onToggleEnabled,
  onToggleCollapsed,
  onReset,
  children
}: FxSectionCardProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#1a1b20] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white"
        >
          {collapsed ? "+" : "-"} {title}
        </button>
        <button
          type="button"
          onClick={() => onToggleEnabled(!enabled)}
          className={`rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
            enabled ? "bg-[#ffe900] text-black" : "border border-white/10 bg-white/5 text-white/55"
          }`}
        >
          {enabled ? "On" : "Off"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/60 hover:text-white"
        >
          Reset
        </button>
        {subtitle && <p className="ml-auto text-xs text-white/45">{subtitle}</p>}
      </div>
      {!collapsed && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

type FxSliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  valueLabel?: string;
};

function FxSliderRow({ label, value, min, max, step = 1, onChange, valueLabel }: FxSliderRowProps) {
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-2 rounded-xl border border-white/5 bg-[#141519] px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-[#ffe900]"
      />
      <span className="min-w-[56px] text-right font-mono text-xs text-white/80">
        {valueLabel ?? (Number.isInteger(value) ? String(value) : value.toFixed(2))}
      </span>
    </div>
  );
}

type FxSelectRowProps<T extends string> = {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
};

function FxSelectRow<T extends string>({ label, value, onChange, options }: FxSelectRowProps<T>) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 rounded-xl border border-white/5 bg-[#141519] px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 rounded-lg border border-white/10 bg-[#202127] px-2 text-sm text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type FxEqGraphPanelProps = {
  bands: FxChainSettings["eq"]["bands"];
  onBandToggle: (index: number) => void;
  onBandGainChange: (index: number, nextGainDb: number) => void;
};

function FxEqGraphPanel({ bands, onBandToggle, onBandGainChange }: FxEqGraphPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const minDb = -18;
  const maxDb = 18;
  const graphWidth = 100;
  const graphHeight = 100;
  const plotTop = 14;
  const plotBottom = 86;
  const plotHeight = plotBottom - plotTop;
  const zeroDbY = plotTop + plotHeight / 2;

  const toXPercent = (frequency: number) => {
    const minHz = 20;
    const maxHz = 20000;
    const safeHz = Math.min(maxHz, Math.max(minHz, frequency));
    const ratio = (Math.log10(safeHz) - Math.log10(minHz)) / (Math.log10(maxHz) - Math.log10(minHz));
    return 8 + ratio * 84;
  };

  const toYPercent = (gainDb: number) => {
    const clamped = Math.min(maxDb, Math.max(minDb, gainDb));
    const ratio = (clamped - minDb) / (maxDb - minDb);
    return plotBottom - ratio * plotHeight;
  };

  const pointerToGain = (clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const topPad = (plotTop / 100) * rect.height;
    const bottomPad = ((100 - plotBottom) / 100) * rect.height;
    const usable = Math.max(1, rect.height - topPad - bottomPad);
    const y = Math.min(rect.height - bottomPad, Math.max(topPad, clientY - rect.top));
    const ratio = 1 - (y - topPad) / usable;
    const gain = minDb + ratio * (maxDb - minDb);
    return Math.round(gain * 2) / 2;
  };

  const points = bands.map((band) => ({
    ...band,
    x: toXPercent(band.frequency),
    y: toYPercent(band.gainDb)
  }));

  const curvePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  return (
    <div className="rounded-[22px] border border-white/5 bg-[#1a1b1f] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
        <span>Equalizer Curve</span>
        <span>{minDb}..+{maxDb} dB</span>
      </div>

      <div ref={containerRef} className="relative h-52 overflow-hidden rounded-[18px] border border-white/5 bg-[#121316]">
        <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {[plotTop, plotTop + plotHeight * 0.25, zeroDbY, plotTop + plotHeight * 0.75, plotBottom].map((y) => (
            <line key={`grid-y-${y}`} x1="0" y1={y} x2={graphWidth} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="1.3 1.8" />
          ))}
          {[10, 25, 40, 55, 70, 85].map((x) => (
            <line key={`grid-x-${x}`} x1={x} y1="0" x2={x} y2={graphHeight} stroke="rgba(255,255,255,0.05)" />
          ))}

          <line x1="0" y1={zeroDbY} x2={graphWidth} y2={zeroDbY} stroke="#ffffff" strokeOpacity="0.75" strokeWidth="0.8" />

          <path d={`${curvePath} L 100 ${zeroDbY} L 0 ${zeroDbY} Z`} fill="url(#eqFill)" />
          <path d={curvePath} fill="none" stroke="#2d3138" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {points.map((point, index) => (
          <button
            key={`${point.label}-${index}`}
            type="button"
            title={`${point.label}: ${point.gainDb > 0 ? "+" : ""}${point.gainDb.toFixed(1)} dB`}
            onDoubleClick={() => onBandToggle(index)}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              onBandGainChange(index, pointerToGain(event.clientY));
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              onBandGainChange(index, pointerToGain(event.clientY));
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm transition ${
              point.enabled
                ? "border-white bg-white"
                : "border-white/35 bg-[#1a1b1f]"
            }`}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <span className="sr-only">{point.label}</span>
          </button>
        ))}

        <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
          <span>Low</span>
          <span>Mid</span>
          <span>High</span>
        </div>
      </div>

      <p className="mt-2 text-xs text-white/45">Тяни точки вверх/вниз для `Gain`. Двойной клик по точке — on/off полосы.</p>
    </div>
  );
}

export const MultiTrackRecorder = forwardRef<MultiTrackRecorderHandle, MultiTrackRecorderProps>(function MultiTrackRecorder(
  { onReady, onError, onReset, resetKey = 0 },
  ref
) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [bpm, setBpm] = useState(90);
  const [bpmInputValue, setBpmInputValue] = useState("90");
  const [topPopover, setTopPopover] = useState<TopPopover>(null);
  const [songKeyRoot, setSongKeyRoot] = useState<string | null>("Eb");
  const [songKeyMode, setSongKeyMode] = useState<TonalMode>("minor");
  const [songKeyAutoEnabled, setSongKeyAutoEnabled] = useState(false);
  const [bpmAutoEnabled, setBpmAutoEnabled] = useState(false);
  const [autoAnalysisLoading, setAutoAnalysisLoading] = useState<TopPopover>(null);
  const [autoAnalysisError, setAutoAnalysisError] = useState("");
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [mixPreviewUrl, setMixPreviewUrl] = useState("");
  const [mixing, setMixing] = useState(false);
  const [signalLevel, setSignalLevel] = useState(0);
  const [activePanel, setActivePanel] = useState<RecorderPanel>("adjust");
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("varispeed");
  const [varispeedPercent, setVarispeedPercent] = useState(100);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [inputGainPercent, setInputGainPercent] = useState(100);
  const [outputGainPercent, setOutputGainPercent] = useState(100);
  const [loopStartPercent, setLoopStartPercent] = useState(0);
  const [loopEndPercent, setLoopEndPercent] = useState(100);
  const [fxSettingsByLayerId, setFxSettingsByLayerId] = useState<Record<string, FxChainSettings>>({});
  const [fxPreviewUrl, setFxPreviewUrl] = useState("");
  const [fxPreviewStatus, setFxPreviewStatus] = useState<FxPreviewStatus>("idle");
  const [fxPreviewError, setFxPreviewError] = useState("");
  const [fxAutoPreviewEnabled, setFxAutoPreviewEnabled] = useState(true);
  const [stemsPreviewUrl, setStemsPreviewUrl] = useState("");
  const [stemsPreviewStatus, setStemsPreviewStatus] = useState<FxPreviewStatus>("idle");
  const [stemsPreviewError, setStemsPreviewError] = useState("");
  const [pendingRecordedTake, setPendingRecordedTake] = useState<PendingRecordedTake | null>(null);
  const [fxBlockCollapsed, setFxBlockCollapsed] = useState<Record<FxBlockUiKey, boolean>>({
    eq: false,
    autotune: true,
    distortion: true,
    filter: true,
    delay: false,
    reverb: true
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const backingAudioRef = useRef<HTMLAudioElement[]>([]);
  const metronomeCtxRef = useRef<AudioContext | null>(null);
  const metronomeTickRef = useRef<number | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformHistoryRef = useRef<number[]>(Array.from({ length: WAVEFORM_SAMPLES }, () => 0.02));
  const waveformPushTsRef = useRef(0);
  const waveformLevelTsRef = useRef(0);
  const fxPreviewDebounceRef = useRef<number | null>(null);
  const fxPreviewRenderSeqRef = useRef(0);
  const stemsPreviewRenderSeqRef = useRef(0);
  const decodedLayerCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  const canStart = (recordingState === "idle" || recordingState === "stopped") && !pendingRecordedTake;
  const canPause = recordingState === "recording";
  const canResume = recordingState === "paused";
  const canStop = recordingState === "recording" || recordingState === "paused";
  const activeLayerCount = useMemo(() => layers.filter((layer) => !layer.muted).length, [layers]);
  const lastRecordedLayer = useMemo(
    () => [...layers].reverse().find((layer) => layer.kind === "recording") ?? null,
    [layers]
  );
  const lastRecordedLayerFxSettings = useMemo(
    () => (lastRecordedLayer ? fxSettingsByLayerId[lastRecordedLayer.id] ?? createDefaultFxChainSettings() : null),
    [fxSettingsByLayerId, lastRecordedLayer]
  );
  const lastTakeAdjustSettings = useMemo<RecorderAdjustSettings>(
    () => ({
      varispeedPercent,
      pitchSemitones,
      inputGainPercent,
      outputGainPercent
    }),
    [inputGainPercent, outputGainPercent, pitchSemitones, varispeedPercent]
  );
  const lastTakeHasActiveAdjust = useMemo(() => hasActiveRecorderAdjust(lastTakeAdjustSettings), [lastTakeAdjustSettings]);
  const lastRecordedLayerHasEnabledFx = Boolean(lastRecordedLayerFxSettings && hasEnabledFx(lastRecordedLayerFxSettings));
  const lastTakeNeedsProcessedPreview = Boolean(lastRecordedLayer && (lastTakeHasActiveAdjust || lastRecordedLayerHasEnabledFx));
  const latestLayerDuration = layers[layers.length - 1]?.durationSec ?? 0;
  const primaryActionLabel = canPause ? "Pause" : canResume ? "Resume" : layers.length ? "Record Next" : "Record";
  const statusHint =
    recordingState === "recording"
      ? "Recording..."
      : recordingState === "paused"
        ? "Paused"
        : `${Math.round(signalLevel * 100)}% input level`;
  const displayedTotalDuration = Math.max(recordingSeconds, latestLayerDuration);
  const playheadPercent = displayedTotalDuration > 0 ? Math.min(100, (recordingSeconds / displayedTotalDuration) * 100) : 0;
  const lastTakePreviewSrc =
    lastRecordedLayer && lastTakeNeedsProcessedPreview && fxPreviewStatus === "ready" && fxPreviewUrl ? fxPreviewUrl : lastRecordedLayer?.url ?? "";
  const lastTakePreviewBadge =
    lastRecordedLayer && lastTakeNeedsProcessedPreview && fxPreviewStatus === "ready" ? "Processed preview" : "Dry preview";
  const loopPreviewRange = useMemo(() => clampLoopPercentRange(loopStartPercent, loopEndPercent), [loopEndPercent, loopStartPercent]);
  const sessionRenderBusy = mixing || stemsPreviewStatus === "processing" || Boolean(pendingRecordedTake);
  const showPendingTakeReview = Boolean(pendingRecordedTake);
  const hasBackingForOverdub = activeLayerCount > 0;
  const showMultitrackLaneOverlay =
    hasBackingForOverdub && (recordingState === "recording" || recordingState === "paused" || showPendingTakeReview);
  const recorderTitle = "cream recording";
  const recorderSubtitle = "untitled project • Maryen";
  const keyChipLabel = formatKeyChipLabel(songKeyRoot, songKeyMode, songKeyAutoEnabled);

  useEffect(() => {
    setBpmInputValue(String(bpm));
  }, [bpm]);

  function clearFxPreviewDebounce() {
    if (fxPreviewDebounceRef.current) {
      window.clearTimeout(fxPreviewDebounceRef.current);
      fxPreviewDebounceRef.current = null;
    }
  }

  function clearFxPreviewUrl() {
    setFxPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }

  function clearStemsPreviewUrl() {
    setStemsPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }

  function resetFxPreviewState() {
    clearFxPreviewDebounce();
    fxPreviewRenderSeqRef.current += 1;
    clearFxPreviewUrl();
    setFxPreviewStatus("idle");
    setFxPreviewError("");
  }

  function resetStemsPreviewState() {
    stemsPreviewRenderSeqRef.current += 1;
    clearStemsPreviewUrl();
    setStemsPreviewStatus("idle");
    setStemsPreviewError("");
  }

  function clearPendingRecordedTake() {
    setPendingRecordedTake((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });
  }

  function commitPendingRecordedTake() {
    if (!pendingRecordedTake) return;
    const takeToCommit = pendingRecordedTake;
    setPendingRecordedTake(null);
    setLayers((prev) => [
      ...prev,
      {
        ...takeToCommit,
        kind: "recording" as const,
        muted: false,
        volume: 0.9
      }
    ]);
    setFxSettingsByLayerId((prev) => ({
      ...prev,
      [takeToCommit.id]: createDefaultFxChainSettings()
    }));
    setRecordingState("stopped");
    setActivePanel("adjust");
  }

  function discardPendingRecordedTake() {
    if (!pendingRecordedTake) return;
    clearPendingRecordedTake();
    setRecordingState(layers.length ? "stopped" : "idle");
    setRecordingSeconds(0);
    resetWaveform();
  }

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

  function updateFxForLastRecorded(updater: (prev: FxChainSettings) => FxChainSettings) {
    if (!lastRecordedLayer) return;
    setFxSettingsByLayerId((prev) => {
      const current = prev[lastRecordedLayer.id] ?? createDefaultFxChainSettings();
      return {
        ...prev,
        [lastRecordedLayer.id]: updater(current)
      };
    });
  }

  function setFxBlockEnabled(block: keyof FxChainSettings, enabled: boolean) {
    updateFxForLastRecorded((prev) => ({
      ...prev,
      [block]: { ...prev[block], enabled }
    }));
  }

  function enableAllFx() {
    updateFxForLastRecorded((prev) => ({
      ...prev,
      eq: { ...prev.eq, enabled: true },
      autotune: { ...prev.autotune, enabled: true },
      distortion: { ...prev.distortion, enabled: true },
      filter: { ...prev.filter, enabled: true },
      delay: { ...prev.delay, enabled: true },
      reverb: { ...prev.reverb, enabled: true }
    }));
  }

  function toggleFxBlockCollapsed(block: FxBlockUiKey) {
    setFxBlockCollapsed((prev) => ({ ...prev, [block]: !prev[block] }));
  }

  function resetFxBlock(block: keyof FxChainSettings) {
    const defaults = createDefaultFxChainSettings();
    updateFxForLastRecorded((prev) => ({
      ...prev,
      [block]: defaults[block]
    }));
  }

  function bypassAllFx() {
    updateFxForLastRecorded((prev) => ({
      ...prev,
      eq: { ...prev.eq, enabled: false },
      autotune: { ...prev.autotune, enabled: false },
      distortion: { ...prev.distortion, enabled: false },
      filter: { ...prev.filter, enabled: false },
      delay: { ...prev.delay, enabled: false },
      reverb: { ...prev.reverb, enabled: false }
    }));
  }

  async function processLayerForSessionRender(
    layer: Layer,
    audioBuffer: AudioBuffer,
    options: {
      lastTakeId: string | null;
      adjustSettings: RecorderAdjustSettings;
      applyAdjustToLastTake: boolean;
      fxSettingsForLastTake: FxChainSettings | null;
      applyFxToLastTake: boolean;
      bpmForFx: number;
    }
  ): Promise<AudioBuffer> {
    if (!options.lastTakeId || layer.id !== options.lastTakeId) {
      return audioBuffer;
    }

    let nextBuffer = audioBuffer;
    if (options.applyAdjustToLastTake) {
      nextBuffer = await renderAdjustedBufferMvp({
        inputBuffer: nextBuffer,
        settings: options.adjustSettings
      });
    }

    if (options.applyFxToLastTake && options.fxSettingsForLastTake) {
      nextBuffer = await processAudioBufferWithFx({
        inputBuffer: nextBuffer,
        settings: options.fxSettingsForLastTake,
        bpm: options.bpmForFx
      });
    }

    return nextBuffer;
  }

  async function renderSessionAudioBlob(): Promise<{ blob: Blob; durationSec: number }> {
    if (!layers.length) {
      throw new Error("Сначала запиши хотя бы одну дорожку.");
    }

    const activeLayers = layers.filter((layer) => !layer.muted);
    if (!activeLayers.length) {
      throw new Error("Все дорожки выключены. Включи хотя бы одну для сведения.");
    }

    const lastTakeId = lastRecordedLayer?.id ?? null;
    const fxSettingsForLastTake = lastTakeId ? fxSettingsByLayerId[lastTakeId] ?? createDefaultFxChainSettings() : null;
    const applyFxToLastTake = Boolean(lastTakeId && fxSettingsForLastTake && hasEnabledFx(fxSettingsForLastTake));
    const applyAdjustToLastTake = Boolean(lastTakeId && hasActiveRecorderAdjust(lastTakeAdjustSettings));

    const processed = await Promise.all(
      activeLayers.map(async (layer) => {
        const decoded = await decodeLayerBuffer(layer);
        const audioBuffer = await processLayerForSessionRender(layer, decoded, {
          lastTakeId,
          adjustSettings: lastTakeAdjustSettings,
          applyAdjustToLastTake,
          fxSettingsForLastTake,
          applyFxToLastTake,
          bpmForFx: bpm
        });
        return { layer, audioBuffer };
      })
    );

    const sampleRate = processed[0]?.audioBuffer.sampleRate ?? 44100;
    const totalLength = processed.reduce((max, item) => Math.max(max, item.audioBuffer.length), 0);
    const offline = new OfflineAudioContext(1, Math.max(1, totalLength), sampleRate);

    processed.forEach(({ layer, audioBuffer }) => {
      const source = offline.createBufferSource();
      source.buffer = audioBuffer;
      const gain = offline.createGain();
      gain.gain.value = layer.volume;
      source.connect(gain).connect(offline.destination);
      source.start(0);
    });

    const rendered = await offline.startRendering();
    return {
      blob: encodeWavFromBuffer(rendered),
      durationSec: Math.round(rendered.duration)
    };
  }

  async function renderFxPreviewNow() {
    const targetLayer = lastRecordedLayer;
    const settings = lastRecordedLayerFxSettings;
    const hasAdjust = hasActiveRecorderAdjust(lastTakeAdjustSettings);
    const hasFx = Boolean(settings && hasEnabledFx(settings));
    if (!targetLayer) {
      resetFxPreviewState();
      return;
    }
    if (!settings) {
      resetFxPreviewState();
      return;
    }
    if (!hasAdjust && !hasFx) {
      clearFxPreviewDebounce();
      clearFxPreviewUrl();
      setFxPreviewStatus("idle");
      setFxPreviewError("");
      return;
    }

    const renderSeq = ++fxPreviewRenderSeqRef.current;
    setFxPreviewStatus("processing");
    setFxPreviewError("");

    try {
      const decoded = await decodeLayerBuffer(targetLayer);
      const processedBuffer = await processLayerForSessionRender(targetLayer, decoded, {
        lastTakeId: targetLayer.id,
        adjustSettings: lastTakeAdjustSettings,
        applyAdjustToLastTake: hasAdjust,
        fxSettingsForLastTake: settings,
        applyFxToLastTake: hasFx,
        bpmForFx: bpm
      });
      const nextUrl = URL.createObjectURL(encodeWavFromBuffer(processedBuffer));
      if (renderSeq !== fxPreviewRenderSeqRef.current) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      setFxPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setFxPreviewStatus("ready");
      setFxPreviewError("");
    } catch (error) {
      if (renderSeq !== fxPreviewRenderSeqRef.current) return;
      clearFxPreviewUrl();
      setFxPreviewStatus("error");
      setFxPreviewError(error instanceof Error ? error.message : "Preview render failed.");
    }
  }

  function queueFxPreviewRender() {
    clearFxPreviewDebounce();
    fxPreviewDebounceRef.current = window.setTimeout(() => {
      fxPreviewDebounceRef.current = null;
      void renderFxPreviewNow();
    }, FX_PREVIEW_DEBOUNCE_MS);
  }

  useImperativeHandle(
    ref,
    () => ({
      async importAudioLayerFromFile(file, options) {
        if (!file.type.startsWith("audio/")) {
          onError("Можно импортировать только аудиофайл.");
          return;
        }

        try {
          onError("");
          const durationSec = await getBlobDurationSeconds(file);
          const url = URL.createObjectURL(file);
          setLayers((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              kind: "import" as const,
              name: options?.name?.trim() || file.name || createLayerName(prev.length + 1),
              blob: file,
              url,
              durationSec,
              muted: false,
              volume: typeof options?.volume === "number" ? Math.max(0, Math.min(1, options.volume)) : 0.9
            }
          ]);
          setActivePanel("stems");
        } catch (error) {
          onError(error instanceof Error ? error.message : "Не удалось импортировать аудиодорожку.");
        }
      }
    }),
    [onError]
  );

  useEffect(
    () => () => {
      clearFxPreviewDebounce();
      fxPreviewRenderSeqRef.current += 1;
      stopTimer();
      stopStream();
      stopBackingTracks();
      stopMetronome();
      if (meterRafRef.current) {
        window.cancelAnimationFrame(meterRafRef.current);
        meterRafRef.current = null;
      }
      if (meterCtxRef.current) {
        meterCtxRef.current.close().catch(() => null);
        meterCtxRef.current = null;
      }
      meterAnalyserRef.current = null;
      if (mixPreviewUrl) {
        URL.revokeObjectURL(mixPreviewUrl);
      }
      if (fxPreviewUrl) {
        URL.revokeObjectURL(fxPreviewUrl);
      }
      if (stemsPreviewUrl) {
        URL.revokeObjectURL(stemsPreviewUrl);
      }
      if (pendingRecordedTake) {
        URL.revokeObjectURL(pendingRecordedTake.url);
      }
      decodedLayerCacheRef.current.clear();
      layers.forEach((layer) => URL.revokeObjectURL(layer.url));
    },
    [fxPreviewUrl, layers, mixPreviewUrl, pendingRecordedTake, stemsPreviewUrl]
  );

  useEffect(() => {
    stopTimer();
    stopStream();
    stopBackingTracks();
    stopMetronome();
    if (meterRafRef.current) {
      window.cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      meterCtxRef.current.close().catch(() => null);
      meterCtxRef.current = null;
    }
    meterAnalyserRef.current = null;
    waveformHistoryRef.current = Array.from({ length: WAVEFORM_SAMPLES }, () => 0.02);
    waveformPushTsRef.current = 0;
    waveformLevelTsRef.current = 0;
    setSignalLevel(0);
    drawWaveform(false);
    setRecordingState("idle");
    setRecordingSeconds(0);
    setTopPopover(null);
    setActivePanel("adjust");
    setAdjustMode("varispeed");
    setVarispeedPercent(100);
    setPitchSemitones(0);
    setInputGainPercent(100);
    setOutputGainPercent(100);
    setLoopStartPercent(0);
    setLoopEndPercent(100);
    setFxSettingsByLayerId({});
    setFxAutoPreviewEnabled(true);
    setSongKeyAutoEnabled(false);
    setBpmAutoEnabled(false);
    clearPendingRecordedTake();
    setFxPreviewStatus("idle");
    setFxPreviewError("");
    setStemsPreviewStatus("idle");
    setStemsPreviewError("");
    clearFxPreviewDebounce();
    fxPreviewRenderSeqRef.current += 1;
    stemsPreviewRenderSeqRef.current += 1;
    decodedLayerCacheRef.current.clear();
    setMixPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
    setFxPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
    setStemsPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
    clearPendingRecordedTake();
    setLayers((prev) => {
      prev.forEach((layer) => URL.revokeObjectURL(layer.url));
      return [];
    });
  }, [resetKey]);

  useEffect(() => {
    if (!lastRecordedLayer || !lastRecordedLayerFxSettings) {
      resetFxPreviewState();
      return;
    }
    if (!fxAutoPreviewEnabled) {
      clearFxPreviewDebounce();
      return;
    }
    queueFxPreviewRender();
    return () => clearFxPreviewDebounce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, fxAutoPreviewEnabled, lastRecordedLayer, lastRecordedLayerFxSettings, lastTakeAdjustSettings]);

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopBackingTracks() {
    backingAudioRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    backingAudioRef.current = [];
  }

  function drawWaveform(live: boolean) {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

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

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerY = height / 2;
    const points = waveformHistoryRef.current;
    const barWidth = width / points.length;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#171717";
    ctx.fillRect(0, 0, width, height);

    const gridStep = Math.max(16, Math.floor(width / 14));
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(Math.min(width * 0.2, gridStep * 3), centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < points.length; i += 1) {
      const amplitude = Math.max(0.02, Math.min(1, points[i]));
      const barHeight = Math.max(height * 0.05, amplitude * height * 0.9);
      const x = i * barWidth;
      const y = centerY - barHeight / 2;

      const ratio = i / points.length;
      if (live && amplitude > 0.62 && ratio > 0.74) {
        ctx.fillStyle = "rgba(255, 79, 79, 0.85)";
      } else if (ratio > 0.82) {
        ctx.fillStyle = "rgba(255,255,255,0.75)";
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
      }
      ctx.fillRect(x, y, Math.max(1, barWidth * 0.56), barHeight);
    }
  }

  function resetWaveform() {
    waveformHistoryRef.current = Array.from({ length: WAVEFORM_SAMPLES }, () => 0.02);
    waveformPushTsRef.current = 0;
    waveformLevelTsRef.current = 0;
    setSignalLevel(0);
    drawWaveform(false);
  }

  function stopSignalMeter(resetWaveformView = true) {
    if (meterRafRef.current) {
      window.cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    if (meterCtxRef.current) {
      meterCtxRef.current.close().catch(() => null);
      meterCtxRef.current = null;
    }
    meterAnalyserRef.current = null;
    if (resetWaveformView) {
      resetWaveform();
    } else {
      drawWaveform(false);
    }
  }

  function startSignalMeter(stream: MediaStream) {
    stopSignalMeter(false);
    resetWaveform();
    const audioCtx = new window.AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.88;
    source.connect(analyser);

    meterCtxRef.current = audioCtx;
    meterAnalyserRef.current = analyser;
    const timeData = new Uint8Array(analyser.fftSize);

    const tick = (timestamp: number) => {
      const currentAnalyser = meterAnalyserRef.current;
      if (!currentAnalyser) return;

      currentAnalyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i += 1) {
        const normalized = (timeData[i] - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / timeData.length);
      const amplitude = Math.max(0.02, Math.min(1, rms * 3.2));

      if (timestamp - waveformPushTsRef.current >= 28) {
        waveformHistoryRef.current = [...waveformHistoryRef.current.slice(1), amplitude];
        waveformPushTsRef.current = timestamp;
      }
      if (timestamp - waveformLevelTsRef.current >= 110) {
        setSignalLevel(amplitude);
        waveformLevelTsRef.current = timestamp;
      }

      drawWaveform(true);
      meterRafRef.current = window.requestAnimationFrame(tick);
    };

    drawWaveform(true);
    meterRafRef.current = window.requestAnimationFrame(tick);
  }

  function clickMetronome(audioCtx: AudioContext, accent: boolean) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = accent ? 1560 : 1120;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.15, audioCtx.currentTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
  }

  function stopMetronome() {
    if (metronomeTickRef.current) {
      window.clearInterval(metronomeTickRef.current);
      metronomeTickRef.current = null;
    }
    if (metronomeCtxRef.current) {
      metronomeCtxRef.current.close().catch(() => null);
      metronomeCtxRef.current = null;
    }
  }

  function startMetronome() {
    if (!metronomeEnabled) return;
    stopMetronome();

    const audioCtx = new window.AudioContext();
    metronomeCtxRef.current = audioCtx;
    let beat = 0;
    clickMetronome(audioCtx, true);
    metronomeTickRef.current = window.setInterval(() => {
      beat = (beat + 1) % 4;
      clickMetronome(audioCtx, beat === 0);
    }, Math.max(120, Math.round(60000 / bpm)));
  }

  function startBackingTracks() {
    stopBackingTracks();
    const audios: HTMLAudioElement[] = [];
    layers
      .filter((layer) => !layer.muted)
      .forEach((layer) => {
        const audio = new Audio(layer.url);
        audio.volume = layer.volume;
        audio.currentTime = 0;
        audios.push(audio);
      });
    backingAudioRef.current = audios;
    backingAudioRef.current.forEach((audio) => {
      audio.play().catch(() => null);
    });
  }

  function pauseBackingTracks() {
    backingAudioRef.current.forEach((audio) => audio.pause());
  }

  function resumeBackingTracks() {
    backingAudioRef.current.forEach((audio) => {
      audio.play().catch(() => null);
    });
  }

  function stopAll() {
    stopTimer();
    stopStream();
    stopBackingTracks();
    stopMetronome();
    stopSignalMeter(false);
  }

  function resetRecorderSession() {
    stopAll();
    resetFxPreviewState();
    resetStemsPreviewState();
    decodedLayerCacheRef.current.clear();
    setRecordingState("idle");
    setRecordingSeconds(0);
    setTopPopover(null);
    setActivePanel("adjust");
    setAdjustMode("varispeed");
    setVarispeedPercent(100);
    setPitchSemitones(0);
    setInputGainPercent(100);
    setOutputGainPercent(100);
    setLoopStartPercent(0);
    setLoopEndPercent(100);
    setFxSettingsByLayerId({});
    setFxAutoPreviewEnabled(true);
    setSongKeyAutoEnabled(false);
    setBpmAutoEnabled(false);
    clearPendingRecordedTake();
    setLayers((prev) => {
      prev.forEach((layer) => URL.revokeObjectURL(layer.url));
      return [];
    });
    setMixPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
    resetWaveform();
    onError("");
    onReset?.();
  }

  async function startRecording() {
    try {
      onError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const nextLayerId = crypto.randomUUID();
        setPendingRecordedTake({
          id: nextLayerId,
          name: createLayerName(layers.length + 1),
          blob,
          url,
          durationSec: recordingSeconds
        });
        setRecordingState("stopped");
        stopAll();
      };

      if (activeLayerCount > 0) {
        startBackingTracks();
      }
      startMetronome();
      recorder.start();
      setRecordingState("recording");
      startSignalMeter(stream);
      startTimer();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось получить доступ к микрофону.");
      stopAll();
    }
  }

  function pauseRecording() {
    if (!recorderRef.current || recordingState !== "recording") return;
    recorderRef.current.pause();
    setRecordingState("paused");
    stopTimer();
    pauseBackingTracks();
    stopMetronome();
    stopSignalMeter(false);
  }

  function resumeRecording() {
    if (!recorderRef.current || recordingState !== "paused") return;
    recorderRef.current.resume();
    setRecordingState("recording");
    startTimer();
    resumeBackingTracks();
    startMetronome();
    if (streamRef.current) {
      startSignalMeter(streamRef.current);
    }
  }

  function stopRecording() {
    if (!recorderRef.current || (recordingState !== "recording" && recordingState !== "paused")) return;
    recorderRef.current.stop();
  }

  function handlePrimaryAction() {
    if (canPause) {
      pauseRecording();
      return;
    }
    if (canResume) {
      resumeRecording();
      return;
    }
    if (canStart) {
      startRecording();
    }
  }

  function removeLayer(layerId: string) {
    decodedLayerCacheRef.current.delete(layerId);
    setFxSettingsByLayerId((prev) => {
      if (!(layerId in prev)) return prev;
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
    if (lastRecordedLayer?.id === layerId) {
      resetFxPreviewState();
      resetStemsPreviewState();
    }
    setLayers((prev) => {
      const target = prev.find((layer) => layer.id === layerId);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return prev
        .filter((layer) => layer.id !== layerId)
        .map((layer, index) => ({ ...layer, name: createLayerName(index + 1) }));
    });
  }

  async function renderMixdown() {
    setMixing(true);
    onError("");
    try {
      const { blob: mixBlob, durationSec: mixDuration } = await renderSessionAudioBlob();
      if (mixPreviewUrl) {
        URL.revokeObjectURL(mixPreviewUrl);
      }
      const previewUrl = URL.createObjectURL(mixBlob);
      setMixPreviewUrl(previewUrl);
      onReady({
        blob: mixBlob,
        durationSec: mixDuration,
        filename: `multitrack-mix-${Date.now()}.wav`
      });

    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось свести дорожки.");
    } finally {
      setMixing(false);
    }
  }

  async function renderStemsPreview() {
    if (stemsPreviewStatus === "processing" || mixing) return;
    setStemsPreviewStatus("processing");
    setStemsPreviewError("");
    const renderSeq = ++stemsPreviewRenderSeqRef.current;
    try {
      const { blob } = await renderSessionAudioBlob();
      const nextUrl = URL.createObjectURL(blob);
      if (renderSeq !== stemsPreviewRenderSeqRef.current) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      setStemsPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setStemsPreviewStatus("ready");
      setStemsPreviewError("");
    } catch (error) {
      if (renderSeq !== stemsPreviewRenderSeqRef.current) return;
      clearStemsPreviewUrl();
      setStemsPreviewStatus("error");
      setStemsPreviewError(error instanceof Error ? error.message : "Не удалось собрать preview дорожек.");
    }
  }

  function handleBpmInputChange(rawValue: string) {
    setBpmInputValue(rawValue);
    if (rawValue.trim() === "") return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    if (parsed < 40 || parsed > 240) return;
    setBpm(Math.round(parsed));
  }

  function commitBpmInput() {
    if (bpmInputValue.trim() === "") {
      setBpmInputValue(String(bpm));
      return;
    }
    const parsed = Number(bpmInputValue);
    if (!Number.isFinite(parsed)) {
      setBpmInputValue(String(bpm));
      return;
    }
    const next = clampBpmValue(parsed);
    setBpm(next);
    setBpmInputValue(String(next));
  }

  function toggleTopPopover(next: Exclude<TopPopover, null>) {
    setTopPopover((prev) => (prev === next ? null : next));
  }

  function closeTopPopover() {
    setTopPopover(null);
  }

  function selectSongKey(root: string) {
    setSongKeyRoot(root);
    setSongKeyAutoEnabled(false);
  }

  function clearSongKeySelection() {
    setSongKeyRoot(null);
    setSongKeyAutoEnabled(false);
  }

  function toggleSongKeyAuto() {
    setSongKeyAutoEnabled((prev) => !prev);
  }

  function setSongKeyModeAndDisableAuto(nextMode: TonalMode) {
    setSongKeyMode(nextMode);
    setSongKeyAutoEnabled(false);
  }

  function applyBpmValue(nextValue: number) {
    const next = clampBpmValue(nextValue);
    setBpm(next);
    setBpmInputValue(String(next));
    setBpmAutoEnabled(false);
  }

  function applyBpmDelta(delta: number) {
    applyBpmValue(bpm + delta);
  }

  function clearBpmSelection() {
    applyBpmValue(90);
  }

  function toggleBpmAuto() {
    setBpmAutoEnabled((prev) => !prev);
  }

  async function runAutoDetect(target: Exclude<TopPopover, null>) {
    const sourceBlob =
      pendingRecordedTake?.blob ?? [...layers].reverse().find((layer) => layer.kind === "import" || layer.kind === "recording")?.blob ?? null;

    if (!sourceBlob) {
      setAutoAnalysisError("Нет аудио для анализа. Загрузите файл или запишите дубль.");
      return;
    }

    setAutoAnalysisLoading(target);
    setAutoAnalysisError("");
    try {
      const result = await analyzeAudioBlobInBrowser(sourceBlob);
      if (target === "key") {
        if (result.keyRoot && result.keyMode) {
          setSongKeyRoot(result.keyRoot);
          setSongKeyMode(result.keyMode);
          setSongKeyAutoEnabled(true);
        } else {
          setAutoAnalysisError("Не удалось уверенно определить тональность.");
        }
      }
      if (target === "bpm") {
        if (result.bpm !== null) {
          applyBpmValue(result.bpm);
          setBpmAutoEnabled(true);
        } else {
          setAutoAnalysisError("Не удалось определить BPM.");
        }
      }
    } catch (error) {
      setAutoAnalysisError(error instanceof Error ? error.message : "Ошибка анализа аудио.");
    } finally {
      setAutoAnalysisLoading(null);
    }
  }

  return (
    <div className="relative space-y-4 overflow-hidden rounded-[40px] border border-white/10 bg-[radial-gradient(circle_at_30%_-10%,rgba(255,255,255,0.1),transparent_45%),linear-gradient(180deg,#1f2024_0%,#17181b_65%,#141518_100%)] p-4 text-white shadow-[0_28px_70px_rgba(0,0,0,0.42)]">
      <div className="relative rounded-[30px] border border-white/5 bg-transparent px-2 pb-1 pt-5">
        <div className="space-y-1 px-2 pt-1 text-center">
          <p className="text-2xl font-medium tracking-tight text-white sm:text-[2.05rem]">{recorderTitle}</p>
          <p className="text-lg leading-tight text-white/60">{recorderSubtitle}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => toggleTopPopover("key")}
              className="rounded-xl border border-white/5 bg-white/10 px-3 py-1.5 font-mono text-sm text-white/90 hover:bg-white/15"
              aria-expanded={topPopover === "key"}
            >
              {keyChipLabel}
            </button>
            <button
              type="button"
              onClick={() => toggleTopPopover("bpm")}
              className="rounded-xl border border-white/5 bg-white/10 px-3 py-1.5 font-mono text-sm text-white/90 hover:bg-white/15"
              aria-expanded={topPopover === "bpm"}
            >
              {bpm} BPM
            </button>
          </div>
        </div>

        {topPopover && (
          <>
            <button
              type="button"
              aria-label="Close picker"
              onClick={closeTopPopover}
              className="absolute inset-0 z-10 cursor-default rounded-[30px] bg-transparent"
            />
            <div className="absolute inset-x-3 top-[8.8rem] z-20">
              <div className="relative rounded-[24px] border border-white/10 bg-[#202125]/95 p-4 shadow-[0_24px_50px_rgba(0,0,0,0.45)] backdrop-blur">
                <div className="pointer-events-none absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[4px] border-l border-t border-white/10 bg-[#202125]/95" />

                {topPopover === "key" ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-3">
                      {ENHARMONIC_KEY_COLUMNS.map((col) => (
                        <div key={`${col.sharp}-${col.flat}`} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => selectSongKey(col.sharp)}
                            className={`flex h-16 w-full items-center justify-center rounded-xl border text-2xl font-semibold ${
                              songKeyRoot === col.sharp
                                ? "border-white bg-white/10 text-white"
                                : "border-white/10 bg-[#1a1b1f] text-white/85 hover:bg-white/5"
                            }`}
                          >
                            {col.sharp}
                          </button>
                          <button
                            type="button"
                            onClick={() => selectSongKey(col.flat)}
                            className={`flex h-16 w-full items-center justify-center rounded-xl border text-2xl font-semibold ${
                              songKeyRoot === col.flat
                                ? "border-white bg-white/10 text-white"
                                : "border-white/10 bg-[#1a1b1f] text-white/85 hover:bg-white/5"
                            }`}
                          >
                            {col.flat}
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {NATURAL_KEYS.map((note) => (
                        <button
                          key={note}
                          type="button"
                          onClick={() => selectSongKey(note)}
                          className={`h-14 rounded-xl border text-xl font-semibold ${
                            songKeyRoot === note
                              ? "border-white bg-white/10 text-white"
                              : "border-white/10 bg-[#1a1b1f] text-white/85 hover:bg-white/5"
                          }`}
                        >
                          {note}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSongKeyModeAndDisableAuto("minor")}
                        className={`h-16 rounded-2xl border text-2xl font-semibold ${
                          songKeyMode === "minor"
                            ? "border-white bg-white/10 text-white"
                            : "border-white/10 bg-[#1a1b1f] text-white/75"
                        }`}
                      >
                        Minor
                      </button>
                      <button
                        type="button"
                        onClick={() => setSongKeyModeAndDisableAuto("major")}
                        className={`h-16 rounded-2xl border text-2xl font-semibold ${
                          songKeyMode === "major"
                            ? "border-white bg-white/10 text-white"
                            : "border-white/10 bg-[#1a1b1f] text-white/75"
                        }`}
                      >
                        Major
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => void runAutoDetect("key")}
                        disabled={autoAnalysisLoading !== null}
                        className={`text-xl font-semibold ${
                          songKeyAutoEnabled ? "text-white" : "text-white/35 hover:text-white/70"
                        } disabled:opacity-50`}
                      >
                        {autoAnalysisLoading === "key" ? "Auto..." : "Auto"}
                      </button>
                      <button type="button" onClick={clearSongKeySelection} className="text-xl font-semibold text-white hover:text-[#ffe900]">
                        Clear
                      </button>
                    </div>
                    {autoAnalysisError && <p className="text-sm text-red-300">{autoAnalysisError}</p>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <button
                        type="button"
                        onClick={() => applyBpmDelta(-1)}
                        className="h-16 rounded-2xl border border-white/10 bg-[#1a1b1f] text-3xl font-semibold text-white hover:bg-white/5"
                      >
                        -
                      </button>
                      <div className="flex h-16 min-w-[11rem] items-center justify-center rounded-2xl border-2 border-white bg-[#202125] px-4 text-2xl font-semibold text-white">
                        {bpm} BPM
                      </div>
                      <button
                        type="button"
                        onClick={() => applyBpmDelta(1)}
                        className="h-16 rounded-2xl border border-white/10 bg-[#1a1b1f] text-3xl font-semibold text-white hover:bg-white/5"
                      >
                        +
                      </button>
                    </div>

                    <div className="relative h-16 rounded-xl bg-transparent">
                      <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2">
                        <div className="flex items-center justify-between">
                          {Array.from({ length: 33 }).map((_, index) => (
                            <span
                              key={index}
                              className={`w-px rounded-full ${index % 8 === 0 ? "h-10 bg-white/40" : "h-7 bg-white/25"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div
                        className="pointer-events-none absolute top-1/2 h-12 w-[3px] -translate-y-1/2 rounded-full bg-white"
                        style={{ left: `calc(${((bpm - 40) / 200) * 100}% - 1.5px)` }}
                      />
                      <input
                        type="range"
                        min={40}
                        max={240}
                        value={bpm}
                        onChange={(event) => applyBpmValue(Number(event.target.value))}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="BPM picker"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => void runAutoDetect("bpm")}
                        disabled={autoAnalysisLoading !== null}
                        className={`text-xl font-semibold ${bpmAutoEnabled ? "text-white" : "text-white/35 hover:text-white/70"} disabled:opacity-50`}
                      >
                        {autoAnalysisLoading === "bpm" ? "Auto..." : "Auto"}
                      </button>
                      <button type="button" onClick={clearBpmSelection} className="text-xl font-semibold text-white hover:text-[#ffe900]">
                        Clear
                      </button>
                    </div>
                    {autoAnalysisError && <p className="text-sm text-red-300">{autoAnalysisError}</p>}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="mt-4 rounded-[24px] border border-white/5 bg-transparent p-3">
          <div className="relative overflow-hidden rounded-[16px] border border-white/5 bg-[#171717] p-3">
            <canvas ref={waveformCanvasRef} className="relative h-44 w-full sm:h-52" />
            {showMultitrackLaneOverlay && (
              <>
                <div className="pointer-events-none absolute inset-x-3 bottom-3 h-[36%] bg-[#4a171d]/55" />
                <div className="pointer-events-none absolute bottom-[18%] left-[28%] right-3 border-t-2 border-dotted border-red-500/90" />
              </>
            )}
            <div
              className="pointer-events-none absolute bottom-3 top-3 w-[3px] rounded bg-[#ffe900] shadow-[0_0_10px_rgba(255,233,0,0.4)]"
              style={{ left: `calc(${Math.max(2, Math.min(98, playheadPercent))}% - 1.5px)` }}
            />
            {recordingState === "recording" && (
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full border border-red-400/30 bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                REC
              </div>
            )}
          </div>

          <p className="mt-4 text-center font-mono text-2xl tracking-wide text-white/90">
            {formatDuration(recordingSeconds)} / {formatDuration(displayedTotalDuration)}
          </p>

          {!showPendingTakeReview ? (
            <>
              <div className="mt-5 grid grid-cols-3 items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-14 rounded-2xl border-white/10 bg-white/5 text-base font-medium text-white hover:bg-white/10"
                  onClick={resetRecorderSession}
                >
                  New take
                </Button>
                <Button
                  type="button"
                  className="h-14 rounded-2xl bg-[#ffe900] text-base font-semibold text-black hover:bg-[#fff04a]"
                  onClick={handlePrimaryAction}
                >
                  {primaryActionLabel}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-14 rounded-2xl border-white/10 bg-white/5 text-base font-medium text-white hover:bg-white/10 disabled:opacity-40"
                  disabled={!canStop}
                  onClick={stopRecording}
                >
                  Save
                </Button>
              </div>

              <p className="mt-3 text-center text-xs text-white/45">{statusHint}</p>
            </>
          ) : (
            <div className="mt-6 h-10" />
          )}
        </div>

        {showPendingTakeReview && (
          <div className="mt-10 flex min-h-[22rem] items-end px-2">
            <div className="grid w-full grid-cols-2 gap-4">
              <button
                type="button"
                onClick={discardPendingRecordedTake}
                className="h-16 rounded-2xl border border-white/5 bg-white/5 text-2xl font-semibold text-white/90 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitPendingRecordedTake}
                className="h-16 rounded-2xl bg-[#ff4044] text-2xl font-semibold text-white hover:bg-[#ff5357]"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {!showPendingTakeReview && lastRecordedLayer && recordingState !== "recording" && (
          <div className="mt-3 rounded-[18px] border border-white/5 bg-[#1a1b1f] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Last Take Preview</p>
                <p className="text-sm text-white/45">
                  Прослушай только последний записанный дубль, чтобы решить, оставлять его или перезаписать.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-white/5 bg-[#141519] px-2.5 py-1 text-xs font-semibold text-white/80">
                  {lastTakePreviewBadge}
                </span>
                <span className="rounded-lg border border-white/5 bg-[#141519] px-2.5 py-1 text-xs font-semibold text-white/70">
                  {formatDuration(lastRecordedLayer.durationSec)}
                </span>
              </div>
            </div>
            {fxPreviewStatus === "processing" && lastTakeNeedsProcessedPreview && (
              <p className="mb-2 text-xs text-white/45">Processing preview...</p>
            )}
            {fxPreviewStatus === "error" && fxPreviewError && (
              <p className="mb-2 text-xs text-[#a4372a]">Preview render error, dry fallback: {fxPreviewError}</p>
            )}
            <AudioWaveformPlayer src={lastTakePreviewSrc} barCount={96} loopRangePercent={loopPreviewRange} />
          </div>
        )}

          <div className={`mt-4 rounded-[22px] border border-white/5 bg-[#1b1c20]/95 p-2 ${showPendingTakeReview ? "hidden" : ""}`}>
            <div className="flex items-center gap-2">
              {([
                { id: "adjust", label: "Adjust" },
                { id: "stems", label: "Stems" },
                { id: "fx", label: "EQ" }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivePanel(tab.id)}
                  className={`rounded-2xl px-6 py-3 text-base font-semibold transition-colors ${
                    activePanel === tab.id
                      ? "bg-[#26282d] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "bg-transparent text-white/55 hover:text-white/85"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                aria-label={recordingState === "recording" ? "Pause recording" : "Start recording"}
                onClick={handlePrimaryAction}
                className="ml-auto flex h-14 w-16 items-center justify-center rounded-2xl border border-white/5 bg-[#141519] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <span className={`block h-6 w-6 ${recordingState === "recording" ? "rounded-sm bg-red-500" : "rounded-full bg-red-500"}`} />
              </button>
            </div>
          </div>

          <div className={`mt-3 rounded-[22px] border border-white/5 bg-[#222327] p-3 ${showPendingTakeReview ? "hidden" : ""}`}>
            {activePanel === "adjust" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/5 bg-[#1a1b1f] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-xl border border-white/5 bg-[#101114] p-1">
                      <button
                        type="button"
                        onClick={() => setAdjustMode("varispeed")}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold tracking-[0.08em] ${
                          adjustMode === "varispeed"
                            ? "bg-[#ffe900] text-black shadow-sm"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        VARISPEED
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustMode("gain")}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold tracking-[0.08em] ${
                          adjustMode === "gain"
                            ? "bg-[#ffe900] text-black shadow-sm"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        GAIN
                      </button>
                    </div>

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-[#101114] px-2 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">BPM</span>
                        <Input
                          type="number"
                          min={40}
                          max={240}
                          value={bpmInputValue}
                          onChange={(event) => handleBpmInputChange(event.target.value)}
                          onBlur={commitBpmInput}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                          className="h-8 w-20 rounded-lg border-white/10 bg-[#222327] px-2 text-center text-sm text-white"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setMetronomeEnabled((prev) => !prev)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold tracking-[0.08em] ${
                          metronomeEnabled
                            ? "border-[#ffe900]/40 bg-[#ffe900] text-black"
                            : "border-white/10 bg-[#141519] text-white/55"
                        }`}
                      >
                        {metronomeEnabled ? "METRO ON" : "METRO OFF"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-[#1a1b1f] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Adjust</p>
                      <p className="text-sm text-white/45">
                        {adjustMode === "varispeed"
                          ? "Темп и тональность для удобной записи и поиска кармана."
                          : "Визуальные gain-контролы для предварительной настройки сессии."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-[#101114] px-3 py-2 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Input</p>
                      <p className="font-mono text-sm font-semibold text-white/85">{Math.round(signalLevel * 100)}%</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {adjustMode === "varispeed" ? (
                      <>
                        <AdjustRailSlider
                          label="Speed"
                          min={50}
                          max={150}
                          value={varispeedPercent}
                          valueLabel={`${varispeedPercent}%`}
                          centerValue={100}
                          onChange={setVarispeedPercent}
                        />
                        <AdjustRailSlider
                          label="Pitch"
                          min={-12}
                          max={12}
                          value={pitchSemitones}
                          valueLabel={`${pitchSemitones > 0 ? "+" : ""}${pitchSemitones} st`}
                          centerValue={0}
                          onChange={setPitchSemitones}
                        />
                      </>
                    ) : (
                      <>
                        <AdjustRailSlider
                          label="Input"
                          min={0}
                          max={200}
                          value={inputGainPercent}
                          valueLabel={`${inputGainPercent}%`}
                          centerValue={100}
                          onChange={setInputGainPercent}
                        />
                        <AdjustRailSlider
                          label="Output"
                          min={0}
                          max={200}
                          value={outputGainPercent}
                          valueLabel={`${outputGainPercent}%`}
                          centerValue={100}
                          onChange={setOutputGainPercent}
                        />
                      </>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/5 bg-[#141519] p-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-white/50">
                      <span>Loop Window</span>
                      <span>
                        {loopStartPercent}% - {loopEndPercent}%
                      </span>
                    </div>

                    <div className="relative h-14 rounded-xl border border-white/5 bg-[#101114]">
                      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dotted border-white/20" />
                      <div className="pointer-events-none absolute inset-y-0 left-3 right-3">
                        <div
                          className="absolute bottom-2 top-2 rounded-lg border border-[#ffe900]/40 bg-[#ffe900]/12"
                          style={{
                            left: `${loopStartPercent}%`,
                            right: `${100 - loopEndPercent}%`
                          }}
                        />
                        <div
                          className="absolute bottom-1.5 top-1.5 w-2 rounded-full bg-[#ffe900] shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
                          style={{ left: `calc(${loopStartPercent}% - 4px)` }}
                        />
                        <div
                          className="absolute bottom-1.5 top-1.5 w-2 rounded-full bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
                          style={{ left: `calc(${loopEndPercent}% - 4px)` }}
                        />
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={99}
                        value={loopStartPercent}
                        onChange={(event) =>
                          setLoopStartPercent(Math.min(loopEndPercent - 1, Math.max(0, Number(event.target.value) || 0)))
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Loop start"
                      />
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={loopEndPercent}
                        onChange={(event) =>
                          setLoopEndPercent(Math.max(loopStartPercent + 1, Math.min(100, Number(event.target.value) || 100)))
                        }
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Loop end"
                      />
                    </div>

                    <p className="mt-2 text-xs text-white/45">
                      {layers.length
                        ? "Loop preview работает в блоке Last Take Preview и зацикливает выбранный фрагмент последнего тейка."
                        : "Запиши первую дорожку, затем используй adjust-панель для настройки перед следующими тейками."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activePanel === "stems" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/5 bg-[#1a1b1f] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-xl bg-[#ffe900] text-black hover:bg-[#fff04a] disabled:bg-white/10 disabled:text-white/60"
                      onClick={() => void renderStemsPreview()}
                      disabled={!layers.length || sessionRenderBusy}
                    >
                      {stemsPreviewStatus === "processing" ? "Rendering..." : "Preview All Stems"}
                    </Button>
                    <p className="text-sm text-white/45">
                      {layers.length
                        ? "Быстрый preview всех активных дорожек перед финальным mix."
                        : "Сначала запиши хотя бы одну дорожку."}
                    </p>
                  </div>
                  {stemsPreviewError && <p className="mt-2 text-xs text-[#a4372a]">{stemsPreviewError}</p>}
                </div>

                {stemsPreviewUrl ? (
                  <div className="rounded-xl border border-white/5 bg-[#141519] p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/45">Stems Preview</p>
                    <AudioWaveformPlayer src={stemsPreviewUrl} barCount={140} />
                  </div>
                ) : stemsPreviewStatus === "processing" ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-[#141519] p-4 text-center text-sm text-white/45">
                    Собираем общий preview дорожек...
                  </div>
                ) : null}

                {layers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 bg-[#141519] p-4 text-center text-sm text-white/45">
                    Пока нет дорожек. Запиши первую, и они появятся здесь.
                  </p>
                ) : (
                  layers.map((layer) => (
                    <div key={layer.id} className="space-y-2 rounded-xl border border-white/5 bg-[#141519] p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={layer.name}
                          onChange={(event) =>
                            setLayers((prev) =>
                              prev.map((current) => (current.id === layer.id ? { ...current, name: event.target.value } : current))
                            )
                          }
                          className="min-w-0 flex-1 border-white/10 bg-[#202127] text-white"
                        />
                        <Button
                          variant="secondary"
                          className={`h-8 w-8 shrink-0 rounded-lg border-white/10 p-0 text-white hover:bg-white/10 ${
                            layer.muted ? "bg-[#26282d]" : "bg-[#1a1b1f]"
                          }`}
                          onClick={() =>
                            setLayers((prev) =>
                              prev.map((current) => (current.id === layer.id ? { ...current, muted: !current.muted } : current))
                            )
                          }
                          aria-label={layer.muted ? "Включить звук дорожки" : "Выключить звук дорожки"}
                          title={layer.muted ? "Включить звук" : "Выключить звук"}
                        >
                          {layer.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-8 w-8 shrink-0 rounded-lg border-white/10 bg-[#1a1b1f] p-0 text-white hover:bg-white/10"
                          onClick={() => removeLayer(layer.id)}
                          aria-label="Удалить дорожку"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <AudioWaveformPlayer src={layer.url} barCount={120} className="w-full min-w-0" />
                      <div className="flex items-center gap-3">
                        <span className="w-16 text-xs font-medium uppercase tracking-wider text-white/45">Volume</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(layer.volume * 100)}
                          onChange={(event) =>
                            setLayers((prev) =>
                              prev.map((current) =>
                                current.id === layer.id ? { ...current, volume: Number(event.target.value) / 100 } : current
                              )
                            )
                          }
                          className="h-2 w-full cursor-pointer accent-[#ffe900]"
                        />
                        <span className="w-10 text-right text-xs text-white/55">{Math.round(layer.volume * 100)}%</span>
                      </div>
                      <p className="text-xs text-white/45">{formatDuration(layer.durationSec)}</p>
                    </div>
                  ))
                )}
              </div>
            )}
            {activePanel === "fx" && (
              <div className="space-y-3">
                {!lastRecordedLayer || !lastRecordedLayerFxSettings ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-[#141519] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Equalizer</p>
                    <p className="mt-1 text-sm text-white/45">Сначала запиши дубль, чтобы открыть EQ-панель.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/5 bg-[#1a1b1f] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-2xl font-semibold tracking-tight text-white">Equalizer</p>
                        <p className="text-sm text-white/45">
                          {lastRecordedLayer.name} • {formatDuration(lastRecordedLayer.durationSec)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFxBlockEnabled("eq", !lastRecordedLayerFxSettings.eq.enabled)}
                        className={
                          lastRecordedLayerFxSettings.eq.enabled
                            ? "rounded-2xl bg-[#ffe900] px-4 py-2 text-sm font-semibold text-black"
                            : "rounded-2xl border border-white/10 bg-[#141519] px-4 py-2 text-sm font-semibold text-white/60"
                        }
                      >
                        {lastRecordedLayerFxSettings.eq.enabled ? "BYPASS" : "ENABLE"}
                      </button>
                    </div>

                    <FxEqGraphPanel
                      bands={lastRecordedLayerFxSettings.eq.bands}
                      onBandToggle={(index) =>
                        updateFxForLastRecorded((prev) => ({
                          ...prev,
                          eq: {
                            ...prev.eq,
                            bands: prev.eq.bands.map((current, bandIndex) =>
                              bandIndex === index ? { ...current, enabled: !current.enabled } : current
                            )
                          }
                        }))
                      }
                      onBandGainChange={(index, nextGainDb) =>
                        updateFxForLastRecorded((prev) => ({
                          ...prev,
                          eq: {
                            ...prev.eq,
                            bands: prev.eq.bands.map((current, bandIndex) =>
                              bandIndex === index ? { ...current, gainDb: nextGainDb } : current
                            )
                          }
                        }))
                      }
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 rounded-xl border-white/10 bg-[#141519] text-white hover:bg-white/10"
                        onClick={() => void renderFxPreviewNow()}
                        disabled={fxPreviewStatus === "processing"}
                      >
                        {fxPreviewStatus === "processing" ? "Rendering..." : "Refresh preview"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 rounded-xl border-white/10 bg-[#141519] text-white hover:bg-white/10"
                        onClick={bypassAllFx}
                      >
                        Bypass all FX
                      </Button>
                    </div>
                    {fxPreviewError && <p className="mt-2 text-xs text-red-300">{fxPreviewError}</p>}
                  </div>
                )}
              </div>
            )}
            {activePanel === "mix" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="rounded-xl border border-white/10 bg-[#141519] text-white hover:bg-white/10"
                    onClick={renderMixdown}
                    disabled={!layers.length || sessionRenderBusy}
                  >
                    {mixing ? "Rendering..." : "Render Mix"}
                  </Button>
                  <p className="text-sm text-white/45">
                    {layers.length ? "Сводит активные дорожки в один файл." : "Сначала запиши хотя бы одну дорожку."}
                  </p>
                </div>
                {mixPreviewUrl ? (
                  <div className="space-y-2 rounded-xl border border-white/5 bg-[#141519] p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-white/45">Preview</p>
                    <AudioWaveformPlayer src={mixPreviewUrl} barCount={160} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-[#141519] p-4 text-center text-sm text-white/45">
                    После `Render Mix` здесь появится предпросмотр волны.
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
});

MultiTrackRecorder.displayName = "MultiTrackRecorder";
