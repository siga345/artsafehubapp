export type ExperimentalHardtuneParams = {
  amount: number;
  retuneSpeed: number;
  robot: boolean;
  mix: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hzToMidi(hz: number) {
  return 69 + 12 * Math.log2(hz / 440);
}

function midiToHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function linearSampleAt(data: Float32Array, position: number) {
  if (!Number.isFinite(position)) return 0;
  if (position <= 0) return data[0] ?? 0;
  const lastIndex = data.length - 1;
  if (position >= lastIndex) return data[lastIndex] ?? 0;
  const left = Math.floor(position);
  const right = Math.min(lastIndex, left + 1);
  const frac = position - left;
  return (data[left] ?? 0) * (1 - frac) + (data[right] ?? 0) * frac;
}

function hannWindow(size: number, index: number) {
  if (size <= 1) return 1;
  return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
}

function detectPitchAutocorrelation(frame: Float32Array, sampleRate: number): { hz: number | null; confidence: number } {
  if (!frame.length || !sampleRate) {
    return { hz: null, confidence: 0 };
  }

  let mean = 0;
  for (let i = 0; i < frame.length; i += 1) mean += frame[i];
  mean /= frame.length;

  const centered = new Float32Array(frame.length);
  let energy = 0;
  for (let i = 0; i < frame.length; i += 1) {
    const value = frame[i] - mean;
    centered[i] = value;
    energy += value * value;
  }
  if (energy < 1e-6) {
    return { hz: null, confidence: 0 };
  }

  const minHz = 80;
  const maxHz = 1000;
  const minLag = Math.max(1, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(frame.length - 2, Math.floor(sampleRate / minHz));
  if (maxLag <= minLag) {
    return { hz: null, confidence: 0 };
  }

  let bestLag = -1;
  let bestScore = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < frame.length - lag; i += 1) {
      const a = centered[i];
      const b = centered[i + lag];
      corr += a * b;
      normA += a * a;
      normB += b * b;
    }
    const denom = Math.sqrt(normA * normB) || 1;
    const score = corr / denom;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestScore < 0.55) {
    return { hz: null, confidence: Math.max(0, bestScore) };
  }

  return { hz: sampleRate / bestLag, confidence: bestScore };
}

export function applyExperimentalHardtuneToMono(
  input: Float32Array,
  sampleRate: number,
  params: ExperimentalHardtuneParams
): Float32Array {
  const dry = new Float32Array(input);
  const mix = clamp(params.mix, 0, 100) / 100;
  const amount = clamp(params.amount, 0, 100) / 100;
  const retuneSpeed = clamp(params.retuneSpeed, 0, 100) / 100;
  if (!input.length || mix <= 0 || amount <= 0) {
    return dry;
  }

  const frameSize = params.robot ? 1024 : 2048;
  const hopSize = params.robot ? 256 : 512;
  const wetAccum = new Float32Array(input.length);
  const weightAccum = new Float32Array(input.length);

  let smoothedRatio = 1;
  const alphaBase = params.robot ? 0.85 : 0.15 + retuneSpeed * 0.75;

  for (let start = 0; start < input.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i += 1) {
      const sourceIndex = start + i;
      frame[i] = sourceIndex < input.length ? input[sourceIndex] : 0;
    }

    const { hz, confidence } = detectPitchAutocorrelation(frame, sampleRate);
    let ratio = 1;

    if (hz && confidence >= 0.55 && hz > 0) {
      const targetMidi = Math.round(hzToMidi(hz));
      const targetHz = midiToHz(targetMidi);
      const rawRatio = clamp(targetHz / hz, 0.5, 2);
      const desiredRatio = 1 + (rawRatio - 1) * amount;
      const alpha = params.robot ? Math.max(alphaBase, 0.92) : alphaBase;
      smoothedRatio = smoothedRatio + (desiredRatio - smoothedRatio) * alpha;
      ratio = smoothedRatio;
    } else {
      smoothedRatio = params.robot ? smoothedRatio : smoothedRatio + (1 - smoothedRatio) * 0.08;
      ratio = smoothedRatio;
    }

    for (let i = 0; i < frameSize; i += 1) {
      const outIndex = start + i;
      if (outIndex >= input.length) break;

      const inPos = i / ratio;
      const sample = linearSampleAt(frame, inPos);
      const window = hannWindow(frameSize, i);
      wetAccum[outIndex] += sample * window;
      weightAccum[outIndex] += window;
    }
  }

  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const wet = weightAccum[i] > 1e-5 ? wetAccum[i] / weightAccum[i] : dry[i];
    const mixed = dry[i] * (1 - mix) + wet * mix;
    output[i] = clamp(mixed, -1, 1);
  }

  return output;
}
