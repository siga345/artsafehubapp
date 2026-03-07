"use client";

import { useRef } from "react";
import { AudioWaveformPlayer } from "@/components/audio/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { createDefaultFxChainSettings, type FxChainSettings } from "@/lib/audio/fx-chain";
import { formatDuration, formatRoleLabel, clamp, type AsyncStatus, type FxPanelId, type Layer } from "./use-multi-track-recorder";

// --- KnobControl ---
type KnobControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
};

function snapKnobValueToPrecision(value: number, step: number) {
  const stepString = String(step);
  const decimals = stepString.includes(".") ? stepString.split(".")[1]?.length ?? 0 : 0;
  return Number(value.toFixed(Math.min(4, decimals)));
}

function snapKnobValue(value: number, min: number, max: number, step?: number) {
  const clamped = clamp(value, min, max);
  if (!step || step <= 0) return clamped;
  const snapped = Math.round((clamped - min) / step) * step + min;
  return Number(snapKnobValueToPrecision(snapped, step).toString());
}

function KnobControl({ label, value, min, max, step = 1, onChange, formatValue }: KnobControlProps) {
  const knobRef = useRef<HTMLButtonElement | null>(null);
  const safeRange = Math.max(0.0001, max - min);
  const normalized = clamp((value - min) / safeRange, 0, 1);
  const angle = -135 + normalized * 270;
  const displayValue = formatValue ? formatValue(value) : `${value}`;

  const updateFromDelta = (startValue: number, deltaPixels: number) => {
    const next = startValue + (deltaPixels / 180) * safeRange;
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

            const handlePointerMove = (e: PointerEvent) => {
              const deltaY = startY - e.clientY;
              const deltaX = (e.clientX - startX) * 0.35;
              updateFromDelta(startValue, deltaY + deltaX);
            };

            const cleanup = () => {
              window.removeEventListener("pointermove", handlePointerMove);
              window.removeEventListener("pointerup", handlePointerUp);
              window.removeEventListener("pointercancel", handlePointerUp);
              try { knobRef.current?.releasePointerCapture(pointerId); } catch {}
            };

            const handlePointerUp = () => cleanup();

            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp, { once: true });
            window.addEventListener("pointercancel", handlePointerUp, { once: true });
          }}
          onKeyDown={(event) => {
            const keyboardStep = step || safeRange / 100;
            if (event.key === "ArrowUp" || event.key === "ArrowRight") { event.preventDefault(); onChange(snapKnobValue(value + keyboardStep, min, max, step)); return; }
            if (event.key === "ArrowDown" || event.key === "ArrowLeft") { event.preventDefault(); onChange(snapKnobValue(value - keyboardStep, min, max, step)); return; }
            if (event.key === "PageUp") { event.preventDefault(); onChange(snapKnobValue(value + keyboardStep * 5, min, max, step)); return; }
            if (event.key === "PageDown") { event.preventDefault(); onChange(snapKnobValue(value - keyboardStep * 5, min, max, step)); return; }
            if (event.key === "Home") { event.preventDefault(); onChange(snapKnobValue(min, min, max, step)); return; }
            if (event.key === "End") { event.preventDefault(); onChange(snapKnobValue(max, min, max, step)); }
          }}
          className="group relative h-16 w-16 rounded-full border border-[#c8d8c1] bg-[#edf4e8] outline-none ring-offset-2 transition hover:border-[#7ca27f] focus-visible:ring-2 focus-visible:ring-[#7ca27f]"
        >
          <div className="absolute inset-[4px] rounded-full border border-[#cfdcc9] bg-[#f8fbf4]" />
          <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
            <span className="absolute left-1/2 top-[7px] block h-4 w-1 -translate-x-1/2 rounded-full bg-[#315f3b]" />
          </div>
          <span className="sr-only">{displayValue}</span>
        </button>
      </div>
    </div>
  );
}

// --- Panel ---
type RecorderFxPanelProps = {
  selectedRecordedLayer: Layer | null;
  selectedRecordedLayerFx: FxChainSettings | null;
  fxPanelsOpen: Record<FxPanelId, boolean>;
  toggleFxPanel: (panelId: FxPanelId) => void;
  updateSelectedLayerFx: (updater: (current: FxChainSettings) => FxChainSettings) => void;
  applyFxPreset: (preset: "clean" | "warm" | "doubleWide" | "phone") => void;
  fxPreviewUrl: string;
  fxPreviewStatus: AsyncStatus;
  fxPreviewError: string;
  onRenderFxPreview: () => void;
};

export function RecorderFxPanel({
  selectedRecordedLayer, selectedRecordedLayerFx,
  fxPanelsOpen, toggleFxPanel,
  updateSelectedLayerFx, applyFxPreset,
  fxPreviewUrl, fxPreviewStatus, fxPreviewError, onRenderFxPreview,
}: RecorderFxPanelProps) {
  if (!selectedRecordedLayer || !selectedRecordedLayerFx) {
    return (
      <div className="space-y-4 rounded-2xl border border-brand-border bg-white p-4">
        <p className="rounded-xl border border-dashed border-brand-border bg-[#f7faf2] p-4 text-sm text-brand-muted">
          Выберите записанную дорожку в `Tracks`, чтобы открыть FX.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-brand-border bg-white p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">FX for selected track</p>
          <h4 className="text-lg font-semibold text-brand-ink">{selectedRecordedLayer.name}</h4>
          <p className="text-sm text-brand-muted">
            {formatRoleLabel(selectedRecordedLayer.role) ?? "Track"} • {formatDuration(selectedRecordedLayer.durationSec)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["clean", "warm", "doubleWide", "phone"] as const).map((preset) => (
            <Button key={preset} type="button" variant="secondary" className="border-brand-border bg-white" onClick={() => applyFxPreset(preset)}>
              {preset === "clean" ? "Clean" : preset === "warm" ? "Warm Vox" : preset === "doubleWide" ? "Double Wide" : "Phone"}
            </Button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void onRenderFxPreview()} disabled={fxPreviewStatus === "processing"}>
          {fxPreviewStatus === "processing" ? "Рендерим FX preview..." : "Preview selected track FX"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="border-brand-border bg-white"
          onClick={() => updateSelectedLayerFx((fx) => ({
            ...fx,
            eq: { ...fx.eq, enabled: false },
            autotune: { ...fx.autotune, enabled: false },
            distortion: { ...fx.distortion, enabled: false },
            filter: { ...fx.filter, enabled: false },
            delay: { ...fx.delay, enabled: false },
            reverb: { ...fx.reverb, enabled: false },
          }))}
        >
          Bypass all
        </Button>
      </div>

      {fxPreviewError && <p className="text-xs text-[#a4372a]">{fxPreviewError}</p>}

      <div className="rounded-xl border border-brand-border bg-[#f7faf2] p-3">
        <p className="mb-2 text-xs uppercase tracking-[0.16em] text-brand-muted">Selected Track Preview</p>
        <AudioWaveformPlayer src={fxPreviewUrl || selectedRecordedLayer.url} />
      </div>

      {/* EQ + Reverb + Delay */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* EQ */}
        <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-ink">EQ (3 bands)</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => toggleFxPanel("eq")} className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted">
                {fxPanelsOpen.eq ? "Collapse" : "Expand"}
              </button>
              <button
                type="button"
                onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, eq: { ...fx.eq, enabled: !fx.eq.enabled } }))}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold ${selectedRecordedLayerFx.eq.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"}`}
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
                    formatValue={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`}
                    onChange={(v) =>
                      updateSelectedLayerFx((fx) => ({
                        ...fx,
                        eq: { ...fx.eq, bands: fx.eq.bands.map((b, i) => i === bandIndex ? { ...b, gainDb: v } : b) },
                      }))
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Reverb */}
          <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-brand-ink">Reverb</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleFxPanel("reverb")} className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted">
                  {fxPanelsOpen.reverb ? "Collapse" : "Expand"}
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, reverb: { ...fx.reverb, enabled: !fx.reverb.enabled } }))}
                  className={`rounded-lg border px-2 py-1 text-xs font-semibold ${selectedRecordedLayerFx.reverb.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"}`}
                >
                  {selectedRecordedLayerFx.reverb.enabled ? "On" : "Off"}
                </button>
              </div>
            </div>
            {fxPanelsOpen.reverb && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(["mix", "decay", "tone"] as const).map((key) => (
                  <KnobControl
                    key={key}
                    label={key.charAt(0).toUpperCase() + key.slice(1)}
                    value={Number(selectedRecordedLayerFx.reverb[key])}
                    min={0}
                    max={100}
                    step={1}
                    formatValue={(v) => `${Math.round(v)}`}
                    onChange={(v) => updateSelectedLayerFx((fx) => ({ ...fx, reverb: { ...fx.reverb, [key]: v } }))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Delay */}
          <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-brand-ink">Delay</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleFxPanel("delay")} className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted">
                  {fxPanelsOpen.delay ? "Collapse" : "Expand"}
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, delay: { ...fx.delay, enabled: !fx.delay.enabled } }))}
                  className={`rounded-lg border px-2 py-1 text-xs font-semibold ${selectedRecordedLayerFx.delay.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"}`}
                >
                  {selectedRecordedLayerFx.delay.enabled ? "On" : "Off"}
                </button>
              </div>
            </div>
            {fxPanelsOpen.delay && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {([["Mix", "mix", 0, 100], ["Feedback", "feedback", 0, 90], ["Time ms", "timeMs", 40, 1200]] as const).map(([label, key, min, max]) => (
                  <KnobControl
                    key={key}
                    label={label}
                    value={Number(selectedRecordedLayerFx.delay[key])}
                    min={min}
                    max={max}
                    step={1}
                    formatValue={(v) => `${Math.round(v)}`}
                    onChange={(v) => updateSelectedLayerFx((fx) => ({ ...fx, delay: { ...fx.delay, syncMode: "free", [key]: v } }))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter + Drive/Tune */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Filter */}
        <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-ink">Filter</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => toggleFxPanel("filter")} className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted">
                {fxPanelsOpen.filter ? "Collapse" : "Expand"}
              </button>
              <button
                type="button"
                onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, filter: { ...fx.filter, enabled: !fx.filter.enabled } }))}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold ${selectedRecordedLayerFx.filter.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"}`}
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
                    className={`rounded-lg border px-2 py-1 text-xs ${selectedRecordedLayerFx.filter.mode === mode ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {([["Cutoff", "cutoff", 20, 20000, 1], ["Resonance", "resonance", 0, 20, 0.1], ["Mix", "mix", 0, 100, 1]] as const).map(([label, key, min, max, step]) => (
                  <KnobControl
                    key={key}
                    label={label}
                    value={Number(selectedRecordedLayerFx.filter[key])}
                    min={min}
                    max={max}
                    step={step}
                    formatValue={(v) => key === "resonance" ? v.toFixed(1) : `${Math.round(v)}`}
                    onChange={(v) => updateSelectedLayerFx((fx) => ({ ...fx, filter: { ...fx.filter, [key]: v } }))}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Drive / Tune */}
        <div className="rounded-xl border border-brand-border bg-[#fbfdf8] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-ink">Drive / Tune</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => toggleFxPanel("driveTune")} className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-semibold text-brand-muted">
                {fxPanelsOpen.driveTune ? "Collapse" : "Expand"}
              </button>
              <Button
                type="button"
                variant="secondary"
                className="border-brand-border bg-white"
                onClick={() => updateSelectedLayerFx(() => createDefaultFxChainSettings())}
              >
                Reset FX
              </Button>
            </div>
          </div>
          {fxPanelsOpen.driveTune && (
            <>
              {/* Distortion */}
              <div className="mb-3 rounded-xl border border-brand-border bg-white p-2">
                <div className="mb-2 flex items-center justify-between text-xs text-brand-muted">
                  <span>Distortion</span>
                  <button
                    type="button"
                    onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, distortion: { ...fx.distortion, enabled: !fx.distortion.enabled } }))}
                    className={`rounded border px-2 py-0.5 text-[11px] ${selectedRecordedLayerFx.distortion.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"}`}
                  >
                    {selectedRecordedLayerFx.distortion.enabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(["drive", "mix", "tone"] as const).map((key) => (
                    <KnobControl
                      key={key}
                      label={key.charAt(0).toUpperCase() + key.slice(1)}
                      value={Number(selectedRecordedLayerFx.distortion[key])}
                      min={0}
                      max={100}
                      step={1}
                      formatValue={(v) => `${Math.round(v)}`}
                      onChange={(v) => updateSelectedLayerFx((fx) => ({ ...fx, distortion: { ...fx.distortion, [key]: v } }))}
                    />
                  ))}
                </div>
              </div>

              {/* Autotune */}
              <div className="rounded-xl border border-brand-border bg-white p-2">
                <div className="mb-2 flex items-center justify-between text-xs text-brand-muted">
                  <span>Autotune (experimental)</span>
                  <button
                    type="button"
                    onClick={() => updateSelectedLayerFx((fx) => ({ ...fx, autotune: { ...fx.autotune, enabled: !fx.autotune.enabled } }))}
                    className={`rounded border px-2 py-0.5 text-[11px] ${selectedRecordedLayerFx.autotune.enabled ? "border-[#7ca27f] bg-[#eef7ea] text-[#315f3b]" : "border-brand-border bg-white text-brand-muted"}`}
                  >
                    {selectedRecordedLayerFx.autotune.enabled ? "On" : "Off"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {([["Amount", "amount"], ["Speed", "retuneSpeed"], ["Mix", "mix"]] as const).map(([label, key]) => (
                    <KnobControl
                      key={key}
                      label={label}
                      value={Number(selectedRecordedLayerFx.autotune[key])}
                      min={0}
                      max={100}
                      step={1}
                      formatValue={(v) => `${Math.round(v)}`}
                      onChange={(v) => updateSelectedLayerFx((fx) => ({ ...fx, autotune: { ...fx.autotune, [key]: v } }))}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
