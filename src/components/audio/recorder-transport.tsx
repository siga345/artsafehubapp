"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clampBpmValue,
  formatDuration,
  KEY_ROOTS,
  type AutoDetectTarget,
  type RecordingState,
  type TonalMode,
} from "./use-multi-track-recorder";

type RecorderTransportProps = {
  // BPM
  bpm: number;
  setBpm: (bpm: number) => void;
  bpmInputValue: string;
  setBpmInputValue: (v: string) => void;
  commitBpmInput: () => void;
  bpmAutoEnabled: boolean;
  setBpmAutoEnabled: (v: boolean) => void;
  autoDetectLoading: AutoDetectTarget;
  onAutoDetect: (target: Exclude<AutoDetectTarget, null>) => void;
  // Key
  songKeyRoot: string | null;
  setSongKeyRoot: (v: string | null) => void;
  songKeyMode: TonalMode;
  setSongKeyMode: (v: TonalMode) => void;
  songKeyAutoEnabled: boolean;
  setSongKeyAutoEnabled: (v: boolean) => void;
  // Metronome
  metronomeEnabled: boolean;
  setMetronomeEnabled: (v: boolean) => void;
  metronomePreviewPlaying: boolean;
  toggleMetronomePreview: () => void;
  canPreviewMetronome: boolean;
  // Recording
  recordingState: RecordingState;
  recordingSeconds: number;
  canPrimaryRecordButton: boolean;
  primaryRecordButtonLabel: string;
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
  showSaveOnStopButton: boolean;
  onRecord: () => void;
  onPause: () => void;
  onStop: () => void;
  onDeleteTake: () => void;
  recordWaveCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  // Errors
  autoDetectError: string;
};

export function RecorderTransport({
  bpm, setBpm, bpmInputValue, setBpmInputValue, commitBpmInput,
  bpmAutoEnabled, setBpmAutoEnabled, autoDetectLoading, onAutoDetect,
  songKeyRoot, setSongKeyRoot, songKeyMode, setSongKeyMode,
  songKeyAutoEnabled, setSongKeyAutoEnabled,
  metronomeEnabled, setMetronomeEnabled, metronomePreviewPlaying,
  toggleMetronomePreview, canPreviewMetronome,
  recordingState, recordingSeconds, canPrimaryRecordButton, primaryRecordButtonLabel,
  canPause, canResume, canStop, showSaveOnStopButton,
  onRecord, onPause, onStop, onDeleteTake, recordWaveCanvasRef, autoDetectError,
}: RecorderTransportProps) {
  return (
    <div className="rounded-2xl border border-brand-border bg-gradient-to-br from-[#f8fbf3] to-[#edf4e6] p-4">
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
        {/* BPM */}
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
              onClick={() => void onAutoDetect("bpm")}
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
              onChange={(e) => setBpmInputValue(e.target.value)}
              onBlur={commitBpmInput}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="h-10 min-w-0 flex-1"
            />
            <Button variant="secondary" className="h-10 shrink-0 px-3" onClick={() => { setBpm(clampBpmValue(bpm - 1)); setBpmAutoEnabled(false); }}>-</Button>
            <Button variant="secondary" className="h-10 shrink-0 px-3" onClick={() => { setBpm(clampBpmValue(bpm + 1)); setBpmAutoEnabled(false); }}>+</Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              className={`h-10 w-full rounded-xl border px-2 py-2 text-[11px] font-semibold leading-tight sm:text-xs ${
                metronomeEnabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"
              }`}
            >
              {metronomeEnabled ? "METRO: ON" : "METRO: OFF"}
            </button>
            <Button
              type="button"
              variant={metronomePreviewPlaying ? "primary" : "secondary"}
              className={metronomePreviewPlaying ? "h-10 w-full bg-[#6f9f7b] text-white hover:bg-[#5f8f6c]" : "h-10 w-full border-brand-border bg-white"}
              onClick={toggleMetronomePreview}
              disabled={!canPreviewMetronome}
            >
              {metronomePreviewPlaying ? "STOP" : "PLAY"}
            </Button>
          </div>
        </div>

        {/* Key */}
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
              onClick={() => void onAutoDetect("key")}
              disabled={autoDetectLoading !== null}
            >
              {autoDetectLoading === "key" || autoDetectLoading === "both" ? "Auto..." : songKeyAutoEnabled ? "Auto ✓" : "Auto"}
            </Button>
          </div>
          <div className="space-y-2">
            <select
              value={songKeyRoot ?? ""}
              onChange={(e) => { setSongKeyRoot(e.target.value || null); setSongKeyAutoEnabled(false); }}
              className="h-10 w-full min-w-0 rounded-xl border border-brand-border bg-white px-2 text-sm text-brand-ink"
            >
              <option value="">Не выбрано</option>
              {KEY_ROOTS.map((root) => <option key={root} value={root}>{root}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={songKeyMode === "minor" ? "primary" : "secondary"}
                className="h-10 w-full px-3"
                onClick={() => { setSongKeyMode("minor"); setSongKeyAutoEnabled(false); }}
              >Min</Button>
              <Button
                type="button"
                variant={songKeyMode === "major" ? "primary" : "secondary"}
                className="h-10 w-full px-3"
                onClick={() => { setSongKeyMode("major"); setSongKeyAutoEnabled(false); }}
              >Maj</Button>
            </div>
          </div>
        </div>

        {/* Record */}
        <div className="col-span-2 rounded-xl border border-brand-border bg-white p-3 xl:col-span-1">
          <p className="mb-2 text-xs uppercase tracking-[0.14em] text-brand-muted">Record</p>
          <div className="mb-3 overflow-hidden rounded-xl border border-brand-border bg-[#f7faf2]">
            <canvas ref={recordWaveCanvasRef as React.Ref<HTMLCanvasElement>} className="block h-20 w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onRecord}
              disabled={!canPrimaryRecordButton}
            >
              {primaryRecordButtonLabel}
            </Button>
            <Button type="button" variant="secondary" onClick={onPause} disabled={!canPause}>Pause</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onDeleteTake}
              disabled={!canResume}
              className="border-red-300 bg-[#fff2ef] text-[#a4372a] hover:bg-[#ffe7e0] disabled:border-brand-border disabled:bg-white disabled:text-brand-muted"
            >
              Delete
            </Button>
            <Button
              type="button"
              variant={showSaveOnStopButton ? "primary" : "secondary"}
              className={showSaveOnStopButton ? "bg-[#6f9f7b] text-white hover:bg-[#5f8f6c]" : "border-brand-border bg-white"}
              onClick={onStop}
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
  );
}
