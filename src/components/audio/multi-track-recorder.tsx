"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { AudioWaveformPlayer } from "@/components/audio/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RecordingState = "idle" | "recording" | "paused" | "stopped";
type RecorderPanel = "adjust" | "stems" | "mix";

type Layer = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  durationSec: number;
  muted: boolean;
  volume: number;
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
};

export type MultiTrackRecorderHandle = {
  importAudioLayerFromFile: (file: File, options?: { name?: string; volume?: number }) => Promise<void>;
};

const WAVEFORM_SAMPLES = 140;

function formatDuration(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
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

export const MultiTrackRecorder = forwardRef<MultiTrackRecorderHandle, MultiTrackRecorderProps>(function MultiTrackRecorder(
  { onReady, onError, onReset, resetKey = 0 },
  ref
) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [bpm, setBpm] = useState(90);
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [mixPreviewUrl, setMixPreviewUrl] = useState("");
  const [mixing, setMixing] = useState(false);
  const [signalLevel, setSignalLevel] = useState(0);
  const [activePanel, setActivePanel] = useState<RecorderPanel>("adjust");

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

  const canStart = recordingState === "idle" || recordingState === "stopped";
  const canPause = recordingState === "recording";
  const canResume = recordingState === "paused";
  const canStop = recordingState === "recording" || recordingState === "paused";
  const activeLayerCount = useMemo(() => layers.filter((layer) => !layer.muted).length, [layers]);
  const latestLayerDuration = layers[layers.length - 1]?.durationSec ?? 0;
  const primaryActionLabel = canPause ? "Pause" : canResume ? "Resume" : layers.length ? "Record Next" : "Record";
  const statusHint =
    recordingState === "recording"
      ? "Recording..."
      : recordingState === "paused"
        ? "Paused"
        : `${Math.round(signalLevel * 100)}% input level`;
  const displayedTotalDuration = Math.max(recordingSeconds, latestLayerDuration);

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
      layers.forEach((layer) => URL.revokeObjectURL(layer.url));
    },
    [layers, mixPreviewUrl]
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
    setActivePanel("adjust");
    setMixPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
    setLayers((prev) => {
      prev.forEach((layer) => URL.revokeObjectURL(layer.url));
      return [];
    });
  }, [resetKey]);

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
    ctx.fillStyle = "#f7faef";
    ctx.fillRect(0, 0, width, height);

    const gridStep = Math.max(16, Math.floor(width / 14));
    ctx.strokeStyle = "rgba(111,127,115,0.22)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let i = 0; i < points.length; i += 1) {
      const amplitude = Math.max(0.02, Math.min(1, points[i]));
      const barHeight = Math.max(height * 0.05, amplitude * height * 0.9);
      const x = i * barWidth;
      const y = centerY - barHeight / 2;

      const ratio = i / points.length;
      if (live && amplitude > 0.62 && ratio > 0.58) {
        ctx.fillStyle = "#d75f5f";
      } else {
        ctx.fillStyle = "#294237";
      }
      ctx.fillRect(x, y, Math.max(1, barWidth * 0.7), barHeight);
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
    setRecordingState("idle");
    setRecordingSeconds(0);
    setActivePanel("adjust");
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
        setLayers((prev) => {
          const next = [
            ...prev,
            {
              id: crypto.randomUUID(),
              name: createLayerName(prev.length + 1),
              blob,
              url,
              durationSec: recordingSeconds,
              muted: false,
              volume: 0.9
            }
          ];
          return next;
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
    if (!layers.length) {
      onError("Сначала запиши хотя бы одну дорожку.");
      return;
    }

    setMixing(true);
    onError("");
    try {
      const activeLayers = layers.filter((layer) => !layer.muted);
      if (!activeLayers.length) {
        onError("Все дорожки выключены. Включи хотя бы одну для сведения.");
        return;
      }

      const decodingContext = new window.AudioContext();
      const decoded = await Promise.all(
        activeLayers.map(async (layer) => {
          const arrayBuffer = await layer.blob.arrayBuffer();
          const audioBuffer = await decodingContext.decodeAudioData(arrayBuffer.slice(0));
          return { layer, audioBuffer };
        })
      );

      const sampleRate = decoded[0].audioBuffer.sampleRate;
      const totalLength = decoded.reduce((max, item) => Math.max(max, item.audioBuffer.length), 0);
      const offline = new OfflineAudioContext(1, totalLength, sampleRate);

      decoded.forEach(({ layer, audioBuffer }) => {
        const source = offline.createBufferSource();
        source.buffer = audioBuffer;
        const gain = offline.createGain();
        gain.gain.value = layer.volume;
        source.connect(gain).connect(offline.destination);
        source.start(0);
      });

      const rendered = await offline.startRendering();
      const mixBlob = encodeWavFromBuffer(rendered);
      const mixDuration = Math.round(rendered.duration);
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

      await decodingContext.close();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось свести дорожки.");
    } finally {
      setMixing(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[28px] border border-brand-border bg-[#f7faef] p-4 text-brand-ink shadow-[0_12px_34px_rgba(55,74,61,0.14)]">
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          className="rounded-full border-brand-border bg-white px-4 py-1.5 text-brand-ink hover:bg-[#eff4e6]"
          onClick={resetRecorderSession}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          className="rounded-full border-brand-border bg-white px-4 py-1.5 text-brand-ink hover:bg-[#eff4e6] disabled:opacity-40"
          disabled={!layers.length || mixing}
          onClick={renderMixdown}
        >
          {mixing ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="rounded-[26px] border border-brand-border bg-[#f1f6e8] p-3">
        <div className="space-y-1 px-2 pt-1 text-center">
          <p className="text-2xl font-semibold tracking-tight">{layers.length ? `take ${layers.length}` : "new recording"}</p>
          <p className="text-sm text-brand-muted">
            {layers.length
              ? `${activeLayerCount} active tracks • ${metronomeEnabled ? `${bpm} BPM` : "metronome off"}`
              : "Сразу запись, потом сведение и версия."}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <span className="rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs font-semibold text-brand-ink">
              {metronomeEnabled ? "Metronome On" : "Metronome Off"}
            </span>
            <span className="rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs font-semibold text-brand-ink">{bpm} BPM</span>
            <span className="rounded-lg border border-brand-border bg-white px-2.5 py-1 text-xs font-semibold text-brand-ink">
              {layers.length} stems
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-[22px] border border-brand-border bg-[#edf3e1] p-3">
          <div className="relative overflow-hidden rounded-[18px] border border-brand-border bg-[#f7faef] p-3">
            <canvas ref={waveformCanvasRef} className="relative h-44 w-full sm:h-52" />
            <div className="pointer-events-none absolute bottom-3 top-3 left-1/2 w-1 -translate-x-1/2 rounded bg-[#2A342C]" />
            {recordingState === "recording" && (
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full border border-[#f1b0b0] bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
                REC
              </div>
            )}
          </div>

          <p className="mt-4 text-center font-mono text-2xl tracking-wider text-brand-ink">
            {formatDuration(recordingSeconds)} / {formatDuration(displayedTotalDuration)}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-brand-border bg-white text-base text-brand-ink hover:bg-[#eff4e6]"
              onClick={resetRecorderSession}
            >
              New
            </Button>
            <Button className="h-12 rounded-xl bg-[#2A342C] text-base font-semibold text-white hover:bg-[#1F2822]" onClick={handlePrimaryAction}>
              {primaryActionLabel}
            </Button>
            <Button
              variant="secondary"
              className="h-12 rounded-xl border-brand-border bg-white text-base text-brand-ink hover:bg-[#eff4e6] disabled:opacity-40"
              disabled={!canStop}
              onClick={stopRecording}
            >
              Stop
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-brand-muted">{statusHint}</p>
        </div>

        <div className="mt-3 rounded-[18px] border border-brand-border bg-white/85 p-2">
          <div className="flex items-center gap-2">
            {([
              { id: "adjust", label: "Adjust" },
              { id: "stems", label: "Stems" },
              { id: "mix", label: "Mix" }
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePanel(tab.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  activePanel === tab.id ? "bg-[#2A342C] text-white" : "bg-[#eef3e6] text-brand-ink hover:bg-[#e6eddc]"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              aria-label={recordingState === "recording" ? "Pause recording" : "Start recording"}
              onClick={handlePrimaryAction}
              className={`ml-auto flex h-10 w-10 items-center justify-center rounded-full border ${
                recordingState === "recording"
                  ? "border-red-200 bg-red-500/90 text-white"
                  : "border-brand-border bg-white text-brand-ink"
              }`}
            >
              <span className={`h-3 w-3 ${recordingState === "recording" ? "rounded-sm bg-white" : "rounded-full bg-red-500"}`} />
            </button>
          </div>

          <div className="mt-2 rounded-[14px] border border-brand-border bg-[#f7faef] p-3">
            {activePanel === "adjust" && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[84px_110px_1fr]">
                  <div className="flex items-center justify-center rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium">
                    BPM
                  </div>
                  <Input
                    type="number"
                    min={40}
                    max={240}
                    value={String(bpm)}
                    onChange={(event) => setBpm(Math.min(240, Math.max(40, Number(event.target.value) || 90)))}
                    className="h-10 rounded-xl border-brand-border bg-white text-center"
                  />
                  <Button
                    type="button"
                    variant={metronomeEnabled ? "primary" : "secondary"}
                    className="h-10 rounded-xl"
                    onClick={() => setMetronomeEnabled((prev) => !prev)}
                  >
                    {metronomeEnabled ? "Metronome On" : "Metronome Off"}
                  </Button>
                </div>

                <div className="rounded-xl border border-brand-border bg-white p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-brand-muted">
                    <span>Input level</span>
                    <span>{Math.round(signalLevel * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e3ebd9]">
                    <div
                      className={`h-full rounded-full transition-[width,background-color] duration-150 ${
                        signalLevel > 0.62 ? "bg-[#d75f5f]" : "bg-[#2A342C]"
                      }`}
                      style={{ width: `${Math.max(2, Math.round(signalLevel * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-brand-border bg-white p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-brand-muted">
                    <span>Session</span>
                    <span>{layers.length} stems</span>
                  </div>
                  <p className="text-sm text-brand-muted">
                    {layers.length
                      ? "При записи новой дорожки активные дорожки воспроизводятся в фоне."
                      : "Нажми Record, чтобы записать первую дорожку."}
                  </p>
                </div>
              </div>
            )}

            {activePanel === "stems" && (
              <div className="space-y-2">
                {layers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-brand-border bg-white p-4 text-center text-sm text-brand-muted">
                    Пока нет дорожек. Запиши первую, и они появятся здесь.
                  </p>
                ) : (
                  layers.map((layer) => (
                    <div key={layer.id} className="space-y-2 rounded-xl border border-brand-border bg-white p-3">
                      <div className="grid gap-2 md:grid-cols-[1fr_96px_96px]">
                        <Input
                          value={layer.name}
                          onChange={(event) =>
                            setLayers((prev) =>
                              prev.map((current) => (current.id === layer.id ? { ...current, name: event.target.value } : current))
                            )
                          }
                          className="border-brand-border bg-white text-brand-ink"
                        />
                        <Button
                          variant="secondary"
                          className="border-brand-border bg-white text-brand-ink hover:bg-[#eff4e6]"
                          onClick={() =>
                            setLayers((prev) =>
                              prev.map((current) => (current.id === layer.id ? { ...current, muted: !current.muted } : current))
                            )
                          }
                        >
                          {layer.muted ? "Unmute" : "Mute"}
                        </Button>
                        <Button
                          variant="secondary"
                          className="border-brand-border bg-white text-brand-ink hover:bg-[#eff4e6]"
                          onClick={() => removeLayer(layer.id)}
                        >
                          Delete
                        </Button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-16 text-xs font-medium uppercase tracking-wider text-brand-muted">Volume</span>
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
                          className="h-2 w-full cursor-pointer accent-[#2A342C]"
                        />
                        <span className="w-10 text-right text-xs text-brand-muted">{Math.round(layer.volume * 100)}%</span>
                      </div>
                      <p className="text-xs text-brand-muted">{formatDuration(layer.durationSec)}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activePanel === "mix" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="rounded-xl bg-[#2A342C] text-white hover:bg-[#1F2822]" onClick={renderMixdown} disabled={!layers.length || mixing}>
                    {mixing ? "Rendering..." : "Render Mix"}
                  </Button>
                  <p className="text-sm text-brand-muted">
                    {layers.length ? "Сводит активные дорожки в один файл." : "Сначала запиши хотя бы одну дорожку."}
                  </p>
                </div>
                {mixPreviewUrl ? (
                  <div className="space-y-2 rounded-xl border border-brand-border bg-white p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">Preview</p>
                    <AudioWaveformPlayer src={mixPreviewUrl} barCount={160} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-brand-border bg-white p-4 text-center text-sm text-brand-muted">
                    После `Render Mix` здесь появится предпросмотр волны.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MultiTrackRecorder.displayName = "MultiTrackRecorder";
