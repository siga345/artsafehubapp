"use client";

export type DetectedKeyMode = "major" | "minor";

export type AudioAnalysisResult = {
  bpm: number | null;
  bpmConfidence: number | null;
  keyRoot: string | null;
  keyMode: DetectedKeyMode | null;
  keyConfidence: number | null;
  methodVersion: "mvp-1";
};

const KEY_LABELS_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeMono(buffer: AudioBuffer, maxSeconds = 75) {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.min(buffer.length, Math.floor(sampleRate * maxSeconds));
  const mono = new Float32Array(maxSamples);
  for (let ch = 0; ch < channelCount; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < maxSamples; i += 1) {
      mono[i] += data[i] / channelCount;
    }
  }
  return { mono, sampleRate };
}

function downsampleLinear(input: Float32Array, sourceRate: number, targetRate: number) {
  if (targetRate >= sourceRate) return { data: input.slice(), sampleRate: sourceRate };
  const ratio = sourceRate / targetRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(input.length - 1, left + 1);
    const frac = pos - left;
    out[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return { data: out, sampleRate: targetRate };
}

function estimateBpm(mono: Float32Array, sampleRate: number) {
  const target = downsampleLinear(mono, sampleRate, 11025);
  const frameSize = 512;
  const frameCount = Math.max(0, Math.floor(target.data.length / frameSize));
  if (frameCount < 16) return { bpm: null, confidence: null };

  const energies = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i += 1) {
    let sum = 0;
    const start = i * frameSize;
    for (let j = 0; j < frameSize; j += 1) {
      const s = target.data[start + j] ?? 0;
      sum += s * s;
    }
    energies[i] = Math.sqrt(sum / frameSize);
  }

  let mean = 0;
  for (let i = 0; i < energies.length; i += 1) mean += energies[i];
  mean /= Math.max(1, energies.length);
  for (let i = 0; i < energies.length; i += 1) energies[i] = Math.max(0, energies[i] - mean * 0.85);

  const onset = new Float32Array(frameCount);
  for (let i = 1; i < frameCount; i += 1) {
    onset[i] = Math.max(0, energies[i] - energies[i - 1]);
  }

  const framesPerSecond = target.sampleRate / frameSize;
  let bestScore = -Infinity;
  let secondScore = -Infinity;
  let bestBpm = 0;

  for (let bpm = 60; bpm <= 200; bpm += 1) {
    const lag = (framesPerSecond * 60) / bpm;
    const lagInt = Math.floor(lag);
    const frac = lag - lagInt;
    if (lagInt < 1) continue;
    let score = 0;
    for (let i = lagInt + 1; i < onset.length; i += 1) {
      const prev = onset[i - lagInt] * (1 - frac) + onset[Math.max(0, i - lagInt - 1)] * frac;
      score += onset[i] * prev;
    }
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestBpm = bpm;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (!Number.isFinite(bestScore) || bestScore <= 0 || !bestBpm) {
    return { bpm: null, confidence: null };
  }

  let normalizedBpm = bestBpm;
  while (normalizedBpm < 80) normalizedBpm *= 2;
  while (normalizedBpm > 180) normalizedBpm /= 2;
  const confidence = clamp(bestScore / Math.max(bestScore + Math.max(0, secondScore), 1e-6), 0, 1);
  return { bpm: Math.round(normalizedBpm), confidence: Number(confidence.toFixed(3)) };
}

function goertzelPower(samples: Float32Array, start: number, length: number, sampleRate: number, freqHz: number) {
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let sPrev = 0;
  let sPrev2 = 0;
  for (let i = 0; i < length; i += 1) {
    const s = (samples[start + i] ?? 0) + coeff * sPrev - sPrev2;
    sPrev2 = sPrev;
    sPrev = s;
  }
  return sPrev2 * sPrev2 + sPrev * sPrev - coeff * sPrev * sPrev2;
}

function rotateProfile(profile: number[], shift: number) {
  return profile.map((_, index) => profile[(index - shift + 12) % 12]);
}

function dot(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function estimateKey(mono: Float32Array, sampleRate: number) {
  const target = downsampleLinear(mono, sampleRate, 11025);
  const frameSize = 4096;
  const hop = 2048;
  if (target.data.length < frameSize) return { keyRoot: null, keyMode: null, confidence: null };

  const chroma = new Array<number>(12).fill(0);
  const targetFrequencies: Array<{ pitchClass: number; hz: number }> = [];
  for (let midi = 36; midi <= 95; midi += 1) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    if (hz >= 55 && hz <= 1900) {
      targetFrequencies.push({ pitchClass: ((midi % 12) + 12) % 12, hz });
    }
  }

  for (let start = 0; start + frameSize <= target.data.length; start += hop) {
    let rms = 0;
    for (let i = 0; i < frameSize; i += 1) {
      const s = target.data[start + i];
      rms += s * s;
    }
    rms = Math.sqrt(rms / frameSize);
    if (rms < 0.01) continue;

    for (const targetFreq of targetFrequencies) {
      const power = goertzelPower(target.data, start, frameSize, target.sampleRate, targetFreq.hz);
      chroma[targetFreq.pitchClass] += power * rms;
    }
  }

  const total = chroma.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { keyRoot: null, keyMode: null, confidence: null };
  }

  const normalized = chroma.map((value) => value / total);
  let bestScore = -Infinity;
  let secondScore = -Infinity;
  let bestPitchClass = 0;
  let bestMode: DetectedKeyMode = "minor";

  for (let shift = 0; shift < 12; shift += 1) {
    const majorScore = dot(normalized, rotateProfile(MAJOR_PROFILE, shift));
    const minorScore = dot(normalized, rotateProfile(MINOR_PROFILE, shift));

    const candidates: Array<{ mode: DetectedKeyMode; score: number }> = [
      { mode: "major", score: majorScore },
      { mode: "minor", score: minorScore }
    ];
    for (const candidate of candidates) {
      if (candidate.score > bestScore) {
        secondScore = bestScore;
        bestScore = candidate.score;
        bestPitchClass = shift;
        bestMode = candidate.mode;
      } else if (candidate.score > secondScore) {
        secondScore = candidate.score;
      }
    }
  }

  const confidence = clamp((bestScore - Math.max(0, secondScore)) / Math.max(bestScore, 1e-6), 0, 1);
  return {
    keyRoot: KEY_LABELS_FLAT[bestPitchClass],
    keyMode: bestMode,
    confidence: Number(confidence.toFixed(3))
  };
}

async function decodeAudioBlobInBrowser(blob: Blob) {
  const AudioContextCtor =
    typeof window !== "undefined"
      ? (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : null;
  if (!AudioContextCtor) {
    throw new Error("AudioContext is not available in this browser.");
  }

  const ctx = new AudioContextCtor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close().catch(() => null);
  }
}

export async function analyzeAudioBlobInBrowser(blob: Blob): Promise<AudioAnalysisResult> {
  const decoded = await decodeAudioBlobInBrowser(blob);
  const { mono, sampleRate } = normalizeMono(decoded);
  const bpm = estimateBpm(mono, sampleRate);
  const key = estimateKey(mono, sampleRate);

  return {
    bpm: bpm.bpm,
    bpmConfidence: bpm.confidence,
    keyRoot: key.keyRoot,
    keyMode: key.keyMode,
    keyConfidence: key.confidence,
    methodVersion: "mvp-1"
  };
}
