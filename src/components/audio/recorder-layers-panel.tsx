"use client";

import { useRef } from "react";
import { Trash2, Volume2, VolumeX } from "lucide-react";
import { AudioWaveformPlayer } from "@/components/audio/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecorderTrackRole } from "./multi-track-recorder";
import {
  clamp,
  clampPanValue,
  formatDuration,
  formatPanLabel,
  formatRoleLabel,
  type AsyncStatus,
  type Layer,
} from "./use-multi-track-recorder";

type RecorderLayersPanelProps = {
  layers: Layer[];
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string) => void;
  stemsPreviewUrl: string;
  stemsPreviewStatus: AsyncStatus;
  stemsPreviewError: string;
  mixing: boolean;
  onPreviewMix: () => void;
  onImportBeat: (file: File, options?: { role?: RecorderTrackRole | null; autoDetectTempoKey?: boolean }) => void;
  updateLayer: (layerId: string, updater: (layer: Layer) => Layer) => void;
  removeLayer: (layerId: string) => void;
};

export function RecorderLayersPanel({
  layers, selectedLayerId, setSelectedLayerId,
  stemsPreviewUrl, stemsPreviewStatus, stemsPreviewError,
  mixing, onPreviewMix, onImportBeat,
  updateLayer, removeLayer,
}: RecorderLayersPanelProps) {
  const beatFileInputRef = useRef<HTMLInputElement | null>(null);

  return (
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
        <Button
          type="button"
          onClick={() => void onPreviewMix()}
          disabled={stemsPreviewStatus === "processing" || mixing || !layers.length}
        >
          {stemsPreviewStatus === "processing" ? "Собираем preview..." : "Preview Mix (быстро)"}
        </Button>
        <p className="text-sm text-brand-muted">Preview всех активных дорожек с учётом volume/pan и FX для записанных дорожек.</p>
      </div>
      <input
        ref={beatFileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.currentTarget.value = "";
          if (!file) return;
          onImportBeat(file, { role: "beat", autoDetectTempoKey: true });
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
                    onChange={(e) => updateLayer(layer.id, (cur) => ({ ...cur, name: e.target.value }))}
                    className="h-10"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 w-10 border-brand-border bg-white p-0"
                    onClick={() => updateLayer(layer.id, (cur) => ({ ...cur, muted: !cur.muted }))}
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
                      onChange={(e) =>
                        updateLayer(layer.id, (cur) => ({ ...cur, volume: clamp(Number(e.target.value) / 100, 0, 1) }))
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
                      onChange={(e) =>
                        updateLayer(layer.id, (cur) => ({ ...cur, pan: clampPanValue(Number(e.target.value)) }))
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
  );
}
