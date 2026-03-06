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
 * Generates a mono Float32Array at the given sampleRate that contains only
 * frequencies from the A major scale (A B C# D E F# G#) within 55–1900 Hz.
 * All pitch classes outside A major are silent, so the Krumhansl–Schmuckler
 * profile should strongly correlate with A major.
 */
function makeAMajorSignal(durationSeconds = 6, sampleRate = 11025): Float32Array {
  // A major pitch classes: A=9, B=11, C#=1, D=2, E=4, F#=6, G#=8
  // Frequencies (Hz) of those notes within the 55–1900 Hz detection range.
  const freqs = [
    55,       // A1
    110,      // A2
    123.47,   // B2
    138.59,   // C#3
    146.83,   // D3
    164.81,   // E3
    185.00,   // F#3
    207.65,   // G#3
    220,      // A3
    246.94,   // B3
    277.18,   // C#4
    293.66,   // D4
    329.63,   // E4
    369.99,   // F#4
    415.30,   // G#4
    440,      // A4
    493.88,   // B4
    554.37,   // C#5
    587.33,   // D5
    659.26,   // E5
    739.99,   // F#5
    830.61,   // G#5
    880,      // A5
    987.77,   // B5
    1108.73,  // C#6
    1174.66,  // D6
    1318.51,  // E6
    1479.98,  // F#6
    1661.22,  // G#6
  ];

  const N = Math.floor(sampleRate * durationSeconds);
  const data = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let sample = 0;
    for (const f of freqs) {
      sample += Math.sin((2 * Math.PI * f * i) / sampleRate);
    }
    data[i] = sample / freqs.length;
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

  it("detects A major from a signal containing only A major scale frequencies", () => {
    const signal = makeAMajorSignal(6);
    const result = estimateKey(signal, 11025);
    expect(result.keyRoot).toBe("A");
    expect(result.keyMode).toBe("major");
    expect(result.confidence).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("confidence is in [0, 1]", () => {
    const signal = makeAMajorSignal(4);
    const result = estimateKey(signal, 11025);
    if (result.confidence !== null) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
