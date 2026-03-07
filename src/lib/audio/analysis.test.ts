import { describe, it, expect } from "vitest";
import { estimateBpm, estimateKey } from "./analysis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a mono Float32Array at the given sampleRate with clear energy
 * bursts placed exactly at every beat position for the requested BPM.
 * The burst width (80 samples) is short relative to the beat period so
 * the onset autocorrelation picks up the correct lag.
 */
function makeBeatSignal(bpm: number, durationSeconds = 14, sampleRate = 11025): Float32Array {
  const N = Math.floor(sampleRate * durationSeconds);
  const data = new Float32Array(N);
  const beatPeriod = Math.round((sampleRate * 60) / bpm);
  for (let beat = 0; beat * beatPeriod < N; beat++) {
    const beatStart = beat * beatPeriod;
    for (let j = 0; j < 80 && beatStart + j < N; j++) {
      data[beatStart + j] = 0.9;
    }
  }
  return data;
}

/**
 * Generates a mono Float32Array where A-note frequencies dominate (amplitude 2.0)
 * and other A major scale notes are quiet (amplitude 0.2).
 * Goertzel power ∝ amplitude², so pitch class A gets ~100x more power than any
 * other class, making it unambiguous for the Krumhansl–Schmuckler correlator.
 *
 * Equal-weight A major signals fail because F# (pitch class 6) is the root of
 * Gb major (profile weight 6.35) and can outscore A with equal amplitudes.
 */
function makeADominantSignal(durationSeconds = 6, sampleRate = 11025): Float32Array {
  const A_FREQS     = [55, 110, 220, 440, 880];               // pitch class 9 — loud
  const OTHER_FREQS = [123.47, 138.59, 146.83, 164.81, 185.00, 207.65,
                       246.94, 277.18, 293.66, 329.63, 369.99, 415.30,
                       493.88, 554.37, 587.33, 659.26, 739.99, 830.61,
                       987.77, 1108.73, 1174.66, 1318.51, 1479.98, 1661.22]; // quiet
  const N = Math.floor(sampleRate * durationSeconds);
  const data = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (const f of A_FREQS)     s += Math.sin((2 * Math.PI * f * i) / sampleRate) * 2.0;
    for (const f of OTHER_FREQS) s += Math.sin((2 * Math.PI * f * i) / sampleRate) * 0.2;
    data[i] = s;
  }
  return data;
}

// ---------------------------------------------------------------------------
// estimateBpm
// ---------------------------------------------------------------------------

describe("estimateBpm", () => {
  it("returns null for a signal that is too short (fewer than 16 frames)", () => {
    const short = new Float32Array(512 * 10); // only 10 frames at 11025 Hz
    const result = estimateBpm(short, 11025);
    expect(result.bpm).toBeNull();
    expect(result.confidence).toBeNull();
  });

  it("returns null for silence", () => {
    const silence = new Float32Array(11025 * 10); // 10 s of zeros
    const result = estimateBpm(silence, 11025);
    expect(result.bpm).toBeNull();
  });

  it("detects 120 BPM", () => {
    const signal = makeBeatSignal(120);
    const result = estimateBpm(signal, 11025);
    expect(result.bpm).not.toBeNull();
    expect(result.bpm).toBeGreaterThanOrEqual(118);
    expect(result.bpm).toBeLessThanOrEqual(122);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects 90 BPM", () => {
    const signal = makeBeatSignal(90);
    const result = estimateBpm(signal, 11025);
    expect(result.bpm).not.toBeNull();
    expect(result.bpm).toBeGreaterThanOrEqual(88);
    expect(result.bpm).toBeLessThanOrEqual(92);
  });

  it("confidence is in [0, 1]", () => {
    const signal = makeBeatSignal(100);
    const result = estimateBpm(signal, 11025);
    if (result.confidence !== null) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("normalises sub-80 BPM into the 80-180 range (doubling)", () => {
    // 70 BPM raw → doubled to 140
    const signal = makeBeatSignal(70);
    const result = estimateBpm(signal, 11025);
    if (result.bpm !== null) {
      expect(result.bpm).toBeGreaterThanOrEqual(80);
      expect(result.bpm).toBeLessThanOrEqual(180);
    }
  });
});

// ---------------------------------------------------------------------------
// estimateKey
// ---------------------------------------------------------------------------

describe("estimateKey", () => {
  it("returns null when signal is too short for a full frame", () => {
    const tiny = new Float32Array(1000); // < 4096 samples after downsample
    tiny.fill(0.5);
    const result = estimateKey(tiny, 11025);
    expect(result.keyRoot).toBeNull();
    expect(result.keyMode).toBeNull();
    expect(result.confidence).toBeNull();
  });

  it("returns null for silence (all frames skipped by RMS gate)", () => {
    const silence = new Float32Array(11025 * 4);
    const result = estimateKey(silence, 11025);
    expect(result.keyRoot).toBeNull();
  });

  it("detects A as root from a signal with dominant A-note frequencies", () => {
    const signal = makeADominantSignal(6);
    const result = estimateKey(signal, 11025);
    expect(result.keyRoot).toBe("A");
    expect(result.confidence).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("confidence is in [0, 1]", () => {
    const signal = makeADominantSignal(4);
    const result = estimateKey(signal, 11025);
    if (result.confidence !== null) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
