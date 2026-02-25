export type RecorderAdjustSettings = {
  varispeedPercent: number;
  pitchSemitones: number;
  inputGainPercent: number;
  outputGainPercent: number;
};

const DEFAULT_ADJUST_SETTINGS: RecorderAdjustSettings = {
  varispeedPercent: 100,
  pitchSemitones: 0,
  inputGainPercent: 100,
  outputGainPercent: 100
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteOrFallback(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function sanitizeRecorderAdjustSettings(input: Partial<RecorderAdjustSettings> | RecorderAdjustSettings): RecorderAdjustSettings {
  return {
    varispeedPercent: clamp(Math.round(finiteOrFallback(input.varispeedPercent, DEFAULT_ADJUST_SETTINGS.varispeedPercent)), 50, 150),
    pitchSemitones: clamp(Math.round(finiteOrFallback(input.pitchSemitones, DEFAULT_ADJUST_SETTINGS.pitchSemitones)), -12, 12),
    inputGainPercent: clamp(Math.round(finiteOrFallback(input.inputGainPercent, DEFAULT_ADJUST_SETTINGS.inputGainPercent)), 0, 200),
    outputGainPercent: clamp(Math.round(finiteOrFallback(input.outputGainPercent, DEFAULT_ADJUST_SETTINGS.outputGainPercent)), 0, 200)
  };
}

export function hasActiveRecorderAdjust(settings: RecorderAdjustSettings): boolean {
  const safe = sanitizeRecorderAdjustSettings(settings);
  return (
    safe.varispeedPercent !== DEFAULT_ADJUST_SETTINGS.varispeedPercent ||
    safe.pitchSemitones !== DEFAULT_ADJUST_SETTINGS.pitchSemitones ||
    safe.inputGainPercent !== DEFAULT_ADJUST_SETTINGS.inputGainPercent ||
    safe.outputGainPercent !== DEFAULT_ADJUST_SETTINGS.outputGainPercent
  );
}

export function computeRecorderAdjustPlaybackRate(settings: RecorderAdjustSettings): number {
  const safe = sanitizeRecorderAdjustSettings(settings);
  const varispeed = safe.varispeedPercent / 100;
  const transposeRatio = 2 ** (safe.pitchSemitones / 12);
  return Math.max(0.05, varispeed * transposeRatio);
}

export function clampLoopPercentRange(start: number, end: number): { start: number; end: number } {
  const safeStart = clamp(Math.round(Number(start) || 0), 0, 99);
  const safeEnd = clamp(Math.round(Number(end) || 100), 1, 100);
  if (safeEnd <= safeStart) {
    return { start: Math.max(0, safeEnd - 1), end: safeEnd };
  }
  return { start: safeStart, end: safeEnd };
}

type RenderAdjustedBufferMvpOptions = {
  inputBuffer: AudioBuffer;
  settings: RecorderAdjustSettings;
};

export async function renderAdjustedBufferMvp({ inputBuffer, settings }: RenderAdjustedBufferMvpOptions): Promise<AudioBuffer> {
  const safe = sanitizeRecorderAdjustSettings(settings);
  if (!hasActiveRecorderAdjust(safe)) {
    return inputBuffer;
  }

  const playbackRate = computeRecorderAdjustPlaybackRate(safe);
  const estimatedLength = Math.max(1, Math.ceil(inputBuffer.length / playbackRate));
  const offline = new OfflineAudioContext(inputBuffer.numberOfChannels, estimatedLength, inputBuffer.sampleRate);

  const source = offline.createBufferSource();
  source.buffer = inputBuffer;
  source.playbackRate.value = playbackRate;

  const inputGain = offline.createGain();
  inputGain.gain.value = safe.inputGainPercent / 100;

  const outputGain = offline.createGain();
  outputGain.gain.value = safe.outputGainPercent / 100;

  source.connect(inputGain).connect(outputGain).connect(offline.destination);
  source.start(0);

  return offline.startRendering();
}
