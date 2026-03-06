import { describe, it, expect } from "vitest";
import { sanitizeFxSettings, createDefaultFxChainSettings, computeDelayTimeMsFromBpm, type FxChainSettings } from "./fx-chain";

describe("createDefaultFxChainSettings", () => {
  it("returns a valid settings object with all FX disabled", () => {
    const s = createDefaultFxChainSettings();
    expect(s.eq.enabled).toBe(false);
    expect(s.autotune.enabled).toBe(false);
    expect(s.distortion.enabled).toBe(false);
    expect(s.filter.enabled).toBe(false);
    expect(s.delay.enabled).toBe(false);
    expect(s.reverb.enabled).toBe(false);
  });

  it("returns 5 EQ bands", () => {
    const s = createDefaultFxChainSettings();
    expect(s.eq.bands).toHaveLength(5);
  });
});

describe("sanitizeFxSettings", () => {
  function defaults(): FxChainSettings {
    return createDefaultFxChainSettings();
  }

  it("passes through valid default settings unchanged in structure", () => {
    const s = sanitizeFxSettings(defaults());
    expect(s.eq.bands).toHaveLength(5);
    expect(s.autotune.amount).toBe(45);
    expect(s.reverb.mix).toBe(28);
  });

  it("clamps autotune.amount above 100 to 100", () => {
    const input = { ...defaults(), autotune: { ...defaults().autotune, enabled: true, amount: 999 } };
    const s = sanitizeFxSettings(input);
    expect(s.autotune.amount).toBe(100);
  });

  it("clamps autotune.amount below 0 to 0", () => {
    const input = { ...defaults(), autotune: { ...defaults().autotune, enabled: true, amount: -50 } };
    const s = sanitizeFxSettings(input);
    expect(s.autotune.amount).toBe(0);
  });

  it("clamps distortion.output above 150 to 150", () => {
    const input = { ...defaults(), distortion: { ...defaults().distortion, enabled: true, output: 200 } };
    const s = sanitizeFxSettings(input);
    expect(s.distortion.output).toBe(150);
  });

  it("clamps delay.feedback above 90 to 90 (prevents runaway feedback)", () => {
    const input = { ...defaults(), delay: { ...defaults().delay, enabled: true, feedback: 100 } };
    const s = sanitizeFxSettings(input);
    expect(s.delay.feedback).toBe(90);
  });

  it("clamps reverb.preDelayMs above 120 to 120", () => {
    const input = { ...defaults(), reverb: { ...defaults().reverb, enabled: true, preDelayMs: 999 } };
    const s = sanitizeFxSettings(input);
    expect(s.reverb.preDelayMs).toBe(120);
  });

  it("falls back to 'lowpass' when filter.mode is invalid", () => {
    const input = { ...defaults(), filter: { ...defaults().filter, mode: "invalid" as never } };
    const s = sanitizeFxSettings(input);
    expect(s.filter.mode).toBe("lowpass");
  });

  it("preserves valid filter modes", () => {
    for (const mode of ["lowpass", "highpass", "bandpass"] as const) {
      const input = { ...defaults(), filter: { ...defaults().filter, mode } };
      expect(sanitizeFxSettings(input).filter.mode).toBe(mode);
    }
  });

  it("falls back to '1/8' when delay.noteDivision is invalid", () => {
    const input = { ...defaults(), delay: { ...defaults().delay, noteDivision: "1/7" as never } };
    const s = sanitizeFxSettings(input);
    expect(s.delay.noteDivision).toBe("1/8");
  });

  it("clamps EQ band gainDb to [-18, 18]", () => {
    const s = createDefaultFxChainSettings();
    s.eq.bands[0].gainDb = 999;
    const result = sanitizeFxSettings(s);
    expect(result.eq.bands[0].gainDb).toBe(18);
  });

  it("clamps EQ band frequency to [20, 20000]", () => {
    const s = createDefaultFxChainSettings();
    s.eq.bands[1].frequency = 0;
    const result = sanitizeFxSettings(s);
    expect(result.eq.bands[1].frequency).toBeGreaterThanOrEqual(20);
  });

  it("coerces non-boolean enabled to boolean", () => {
    const input = { ...defaults(), eq: { ...defaults().eq, enabled: 1 as unknown as boolean } };
    const s = sanitizeFxSettings(input);
    expect(typeof s.eq.enabled).toBe("boolean");
  });
});

describe("computeDelayTimeMsFromBpm", () => {
  it("computes quarter-note delay at 120 BPM (500 ms)", () => {
    expect(computeDelayTimeMsFromBpm(120, "1/4")).toBe(500);
  });

  it("computes eighth-note delay at 120 BPM (250 ms)", () => {
    expect(computeDelayTimeMsFromBpm(120, "1/8")).toBe(250);
  });

  it("computes dotted-eighth delay at 120 BPM (375 ms)", () => {
    expect(computeDelayTimeMsFromBpm(120, "1/8D")).toBe(375);
  });

  it("computes 16th-note delay at 120 BPM (125 ms)", () => {
    expect(computeDelayTimeMsFromBpm(120, "1/16")).toBe(125);
  });

  it("clamps BPM below 40 to 40", () => {
    // Should not throw or return Infinity
    const ms = computeDelayTimeMsFromBpm(0, "1/4");
    expect(Number.isFinite(ms)).toBe(true);
    expect(ms).toBeGreaterThan(0);
  });

  it("clamps BPM above 240 to 240", () => {
    const ms = computeDelayTimeMsFromBpm(9999, "1/4");
    expect(Number.isFinite(ms)).toBe(true);
    expect(ms).toBeGreaterThan(0);
  });
});
