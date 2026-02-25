import { applyExperimentalHardtuneToMono } from "@/lib/audio/fx-autotune";

export type DelaySyncMode = "free" | "bpm";
export type DelayNoteDivision = "1/4" | "1/8" | "1/8D" | "1/8T" | "1/16";
export type FxFilterMode = "lowpass" | "highpass" | "bandpass";

export type EqBandSettings = {
  enabled: boolean;
  label: string;
  type: BiquadFilterType;
  frequency: number;
  gainDb: number;
  q: number;
};

export type EqSettings = {
  enabled: boolean;
  bands: EqBandSettings[];
};

export type AutotuneSettings = {
  enabled: boolean;
  amount: number;
  retuneSpeed: number;
  robot: boolean;
  mix: number;
};

export type DistortionSettings = {
  enabled: boolean;
  drive: number;
  tone: number;
  output: number;
  mix: number;
};

export type FilterSettings = {
  enabled: boolean;
  mode: FxFilterMode;
  cutoff: number;
  resonance: number;
  mix: number;
};

export type DelaySettings = {
  enabled: boolean;
  syncMode: DelaySyncMode;
  timeMs: number;
  noteDivision: DelayNoteDivision;
  feedback: number;
  tone: number;
  mix: number;
};

export type ReverbSettings = {
  enabled: boolean;
  size: number;
  decay: number;
  preDelayMs: number;
  tone: number;
  mix: number;
};

export type FxChainSettings = {
  eq: EqSettings;
  autotune: AutotuneSettings;
  distortion: DistortionSettings;
  filter: FilterSettings;
  delay: DelaySettings;
  reverb: ReverbSettings;
};

type ProcessAudioBufferWithFxOptions = {
  inputBuffer: AudioBuffer;
  settings: FxChainSettings;
  bpm?: number;
};

type RenderProcessedLayerBlobOptions = ProcessAudioBufferWithFxOptions;

const DEFAULT_EQ_BANDS: EqBandSettings[] = [
  { enabled: true, label: "Low Shelf", type: "lowshelf", frequency: 120, gainDb: 0, q: 0.7 },
  { enabled: true, label: "Low-Mid", type: "peaking", frequency: 350, gainDb: 0, q: 1 },
  { enabled: true, label: "Mid", type: "peaking", frequency: 1200, gainDb: 0, q: 1 },
  { enabled: true, label: "High-Mid", type: "peaking", frequency: 4200, gainDb: 0, q: 1 },
  { enabled: true, label: "High Shelf", type: "highshelf", frequency: 9000, gainDb: 0, q: 0.7 }
];

const DEFAULT_SETTINGS: FxChainSettings = {
  eq: { enabled: false, bands: DEFAULT_EQ_BANDS },
  autotune: { enabled: false, amount: 45, retuneSpeed: 70, robot: false, mix: 60 },
  distortion: { enabled: false, drive: 28, tone: 55, output: 100, mix: 40 },
  filter: { enabled: false, mode: "lowpass", cutoff: 14000, resonance: 0.8, mix: 100 },
  delay: { enabled: false, syncMode: "free", timeMs: 220, noteDivision: "1/8", feedback: 30, tone: 45, mix: 35 },
  reverb: { enabled: false, size: 35, decay: 45, preDelayMs: 12, tone: 45, mix: 28 }
};

const reverbIrCache = new Map<string, AudioBuffer>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeBpm(value: number | undefined) {
  if (!Number.isFinite(value) || !value) return 90;
  return clamp(Math.round(value), 40, 240);
}

function cloneEqBand(band: EqBandSettings): EqBandSettings {
  return { ...band };
}

export function createDefaultFxChainSettings(): FxChainSettings {
  return {
    eq: { enabled: DEFAULT_SETTINGS.eq.enabled, bands: DEFAULT_SETTINGS.eq.bands.map(cloneEqBand) },
    autotune: { ...DEFAULT_SETTINGS.autotune },
    distortion: { ...DEFAULT_SETTINGS.distortion },
    filter: { ...DEFAULT_SETTINGS.filter },
    delay: { ...DEFAULT_SETTINGS.delay },
    reverb: { ...DEFAULT_SETTINGS.reverb }
  };
}

export function computeDelayTimeMsFromBpm(bpm: number, division: DelayNoteDivision): number {
  const safe = safeBpm(bpm);
  const quarterMs = 60000 / safe;
  const ratioMap: Record<DelayNoteDivision, number> = {
    "1/4": 1,
    "1/8": 0.5,
    "1/8D": 0.75,
    "1/8T": 1 / 3,
    "1/16": 0.25
  };
  return Math.round(quarterMs * ratioMap[division]);
}

function sanitizeEqBand(input: EqBandSettings, fallback: EqBandSettings): EqBandSettings {
  return {
    enabled: Boolean(input.enabled),
    label: fallback.label,
    type: fallback.type,
    frequency: clamp(Number(input.frequency) || fallback.frequency, 20, 20000),
    gainDb: clamp(Number(input.gainDb) || 0, -18, 18),
    q: clamp(Number(input.q) || fallback.q, 0.2, 12)
  };
}

export function sanitizeFxSettings(settings: FxChainSettings): FxChainSettings {
  const base = createDefaultFxChainSettings();
  const nextEqBands = base.eq.bands.map((fallback, index) =>
    sanitizeEqBand(settings.eq?.bands?.[index] ?? fallback, fallback)
  );

  const next: FxChainSettings = {
    eq: {
      enabled: Boolean(settings.eq?.enabled),
      bands: nextEqBands
    },
    autotune: {
      enabled: Boolean(settings.autotune?.enabled),
      amount: clamp(Number(settings.autotune?.amount) || 0, 0, 100),
      retuneSpeed: clamp(Number(settings.autotune?.retuneSpeed) || 0, 0, 100),
      robot: Boolean(settings.autotune?.robot),
      mix: clamp(Number(settings.autotune?.mix) || 0, 0, 100)
    },
    distortion: {
      enabled: Boolean(settings.distortion?.enabled),
      drive: clamp(Number(settings.distortion?.drive) || 0, 0, 100),
      tone: clamp(Number(settings.distortion?.tone) || 0, 0, 100),
      output: clamp(Number(settings.distortion?.output) || 0, 0, 150),
      mix: clamp(Number(settings.distortion?.mix) || 0, 0, 100)
    },
    filter: {
      enabled: Boolean(settings.filter?.enabled),
      mode:
        settings.filter?.mode === "highpass" || settings.filter?.mode === "bandpass" || settings.filter?.mode === "lowpass"
          ? settings.filter.mode
          : "lowpass",
      cutoff: clamp(Number(settings.filter?.cutoff) || base.filter.cutoff, 20, 20000),
      resonance: clamp(Number(settings.filter?.resonance) || base.filter.resonance, 0.1, 20),
      mix: clamp(Number(settings.filter?.mix) || 0, 0, 100)
    },
    delay: {
      enabled: Boolean(settings.delay?.enabled),
      syncMode: settings.delay?.syncMode === "bpm" ? "bpm" : "free",
      timeMs: clamp(Number(settings.delay?.timeMs) || base.delay.timeMs, 40, 1200),
      noteDivision:
        settings.delay?.noteDivision && ["1/4", "1/8", "1/8D", "1/8T", "1/16"].includes(settings.delay.noteDivision)
          ? settings.delay.noteDivision
          : "1/8",
      feedback: clamp(Number(settings.delay?.feedback) || 0, 0, 90),
      tone: clamp(Number(settings.delay?.tone) || 0, 0, 100),
      mix: clamp(Number(settings.delay?.mix) || 0, 0, 100)
    },
    reverb: {
      enabled: Boolean(settings.reverb?.enabled),
      size: clamp(Number(settings.reverb?.size) || 0, 0, 100),
      decay: clamp(Number(settings.reverb?.decay) || 0, 0, 100),
      preDelayMs: clamp(Number(settings.reverb?.preDelayMs) || 0, 0, 120),
      tone: clamp(Number(settings.reverb?.tone) || 0, 0, 100),
      mix: clamp(Number(settings.reverb?.mix) || 0, 0, 100)
    }
  };

  return next;
}

function isEqEffectivelyEnabled(eq: EqSettings) {
  return eq.enabled && eq.bands.some((band) => band.enabled && (Math.abs(band.gainDb) > 0.01 || band.type === "peaking"));
}

export function hasEnabledFx(settings: FxChainSettings): boolean {
  const s = sanitizeFxSettings(settings);
  return (
    s.eq.enabled ||
    s.autotune.enabled ||
    s.distortion.enabled ||
    s.filter.enabled ||
    s.delay.enabled ||
    s.reverb.enabled
  );
}

function mixToMonoArray(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < buffer.length; i += 1) {
      mono[i] += data[i] / buffer.numberOfChannels;
    }
  }
  return mono;
}

function monoArrayToAudioBuffer(data: Float32Array, sampleRate: number): AudioBuffer {
  const buffer = new AudioBuffer({ numberOfChannels: 1, length: data.length, sampleRate });
  buffer.getChannelData(0).set(data);
  return buffer;
}

function cloneAsMonoAudioBuffer(buffer: AudioBuffer): AudioBuffer {
  return monoArrayToAudioBuffer(mixToMonoArray(buffer), buffer.sampleRate);
}

function createDryWetSerialBlock(
  ctx: BaseAudioContext,
  input: AudioNode,
  mixPercent: number,
  buildWet: (wetInput: AudioNode) => AudioNode
): AudioNode {
  const mix = clamp(mixPercent, 0, 100) / 100;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - mix;
  const wetGain = ctx.createGain();
  wetGain.gain.value = mix;
  const sum = ctx.createGain();

  input.connect(dryGain).connect(sum);
  const wetEntry = ctx.createGain();
  input.connect(wetEntry);
  const wetTail = buildWet(wetEntry);
  wetTail.connect(wetGain).connect(sum);
  return sum;
}

async function renderOfflineWithBuilder(
  inputBuffer: AudioBuffer,
  buildGraph: (ctx: OfflineAudioContext, source: AudioBufferSourceNode) => AudioNode
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(1, inputBuffer.length, inputBuffer.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = inputBuffer;
  const tail = buildGraph(offline, source);
  tail.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

function createDistortionCurve(drivePercent: number) {
  const samples = 2048;
  const curve = new Float32Array(samples);
  const k = 1 + (clamp(drivePercent, 0, 100) / 100) * 80;
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function buildEqGraph(ctx: OfflineAudioContext, source: AudioBufferSourceNode, eq: EqSettings) {
  let current: AudioNode = source;
  for (const band of eq.bands) {
    if (!band.enabled) continue;
    const node = ctx.createBiquadFilter();
    node.type = band.type;
    node.frequency.value = band.frequency;
    node.Q.value = band.q;
    if (typeof node.gain?.value === "number") {
      node.gain.value = band.gainDb;
    }
    current.connect(node);
    current = node;
  }
  return current;
}

async function applyEqOffline(inputBuffer: AudioBuffer, eq: EqSettings): Promise<AudioBuffer> {
  if (!isEqEffectivelyEnabled(eq)) return cloneAsMonoAudioBuffer(inputBuffer);
  return renderOfflineWithBuilder(inputBuffer, (ctx, source) => buildEqGraph(ctx, source, eq));
}

async function applyAutotuneOffline(inputBuffer: AudioBuffer, autotune: AutotuneSettings): Promise<AudioBuffer> {
  if (!autotune.enabled || autotune.mix <= 0 || autotune.amount <= 0) return cloneAsMonoAudioBuffer(inputBuffer);
  const mono = mixToMonoArray(inputBuffer);
  const processed = applyExperimentalHardtuneToMono(mono, inputBuffer.sampleRate, autotune);
  return monoArrayToAudioBuffer(processed, inputBuffer.sampleRate);
}

function buildDistortionBlock(ctx: OfflineAudioContext, input: AudioNode, settings: DistortionSettings): AudioNode {
  return createDryWetSerialBlock(ctx, input, settings.mix, (wetInput) => {
    const pre = ctx.createGain();
    pre.gain.value = 1 + (settings.drive / 100) * 8;

    const shaper = ctx.createWaveShaper();
    shaper.curve = createDistortionCurve(settings.drive);
    shaper.oversample = "4x";

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 40 + (settings.tone / 100) * 300;
    hp.Q.value = 0.7;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800 + (settings.tone / 100) * 15000;
    lp.Q.value = 0.7;

    const post = ctx.createGain();
    post.gain.value = clamp(settings.output, 0, 150) / 100;

    wetInput.connect(pre).connect(shaper).connect(hp).connect(lp).connect(post);
    return post;
  });
}

function buildFilterBlock(ctx: OfflineAudioContext, input: AudioNode, settings: FilterSettings): AudioNode {
  return createDryWetSerialBlock(ctx, input, settings.mix, (wetInput) => {
    const filter = ctx.createBiquadFilter();
    filter.type = settings.mode;
    filter.frequency.value = settings.cutoff;
    filter.Q.value = settings.resonance;
    wetInput.connect(filter);
    return filter;
  });
}

function buildDelayBlock(ctx: OfflineAudioContext, input: AudioNode, settings: DelaySettings, bpm: number): AudioNode {
  const timeMs = settings.syncMode === "bpm" ? computeDelayTimeMsFromBpm(bpm, settings.noteDivision) : settings.timeMs;
  return createDryWetSerialBlock(ctx, input, settings.mix, (wetInput) => {
    const delay = ctx.createDelay(2.5);
    delay.delayTime.value = clamp(timeMs, 40, 1200) / 1000;

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 800 + (settings.tone / 100) * 15000;
    tone.Q.value = 0.7;

    const feedback = ctx.createGain();
    feedback.gain.value = clamp(settings.feedback, 0, 90) / 100;

    const output = ctx.createGain();

    wetInput.connect(delay);
    delay.connect(tone);
    tone.connect(output);
    tone.connect(feedback);
    feedback.connect(delay);

    return output;
  });
}

function buildReverbImpulse(sampleRate: number, size: number, decay: number, tone: number): AudioBuffer {
  const safeSize = clamp(size, 0, 100) / 100;
  const safeDecay = clamp(decay, 0, 100) / 100;
  const safeTone = clamp(tone, 0, 100) / 100;
  const seconds = 0.25 + safeSize * 2.5;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const key = `${sampleRate}:${Math.round(size)}:${Math.round(decay)}:${Math.round(tone)}`;
  const cached = reverbIrCache.get(key);
  if (cached) return cached;

  const buffer = new AudioBuffer({ numberOfChannels: 1, length, sampleRate });
  const data = buffer.getChannelData(0);
  const decayPow = 0.15 + safeDecay * 2.85;
  const damping = 0.35 + safeTone * 0.65;
  for (let i = 0; i < length; i += 1) {
    const t = i / Math.max(1, length - 1);
    const envelope = (1 - t) ** decayPow;
    const pseudoRand = Math.sin((i + 1) * 12.9898) * 43758.5453;
    const noise = (pseudoRand - Math.floor(pseudoRand)) * 2 - 1;
    const tonal = Math.sin((i / sampleRate) * (320 + 4200 * damping) * Math.PI * 2) * 0.15;
    data[i] = (noise * 0.9 + tonal) * envelope;
  }
  reverbIrCache.set(key, buffer);
  return buffer;
}

function buildReverbBlock(ctx: OfflineAudioContext, input: AudioNode, settings: ReverbSettings): AudioNode {
  return createDryWetSerialBlock(ctx, input, settings.mix, (wetInput) => {
    const preDelay = ctx.createDelay(0.25);
    preDelay.delayTime.value = clamp(settings.preDelayMs, 0, 120) / 1000;

    const convolver = ctx.createConvolver();
    convolver.buffer = buildReverbImpulse(ctx.sampleRate, settings.size, settings.decay, settings.tone);

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 800 + (settings.tone / 100) * 15000;
    tone.Q.value = 0.7;

    wetInput.connect(preDelay).connect(convolver).connect(tone);
    return tone;
  });
}

async function applyPostEffectsOffline(inputBuffer: AudioBuffer, settings: FxChainSettings, bpm: number): Promise<AudioBuffer> {
  const anyPost =
    settings.distortion.enabled || settings.filter.enabled || settings.delay.enabled || settings.reverb.enabled;
  if (!anyPost) return cloneAsMonoAudioBuffer(inputBuffer);

  return renderOfflineWithBuilder(inputBuffer, (ctx, source) => {
    let current: AudioNode = source;
    if (settings.distortion.enabled) {
      current = buildDistortionBlock(ctx, current, settings.distortion);
    }
    if (settings.filter.enabled) {
      current = buildFilterBlock(ctx, current, settings.filter);
    }
    if (settings.delay.enabled) {
      current = buildDelayBlock(ctx, current, settings.delay, bpm);
    }
    if (settings.reverb.enabled) {
      current = buildReverbBlock(ctx, current, settings.reverb);
    }
    return current;
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

  const mono = mixToMonoArray(buffer);
  for (let i = 0; i < mono.length; i += 1) {
    const sample = clamp(mono[i], -1, 1);
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

export async function processAudioBufferWithFx({
  inputBuffer,
  settings,
  bpm
}: ProcessAudioBufferWithFxOptions): Promise<AudioBuffer> {
  const safeSettings = sanitizeFxSettings(settings);
  let current = cloneAsMonoAudioBuffer(inputBuffer);
  const resolvedBpm = safeBpm(bpm);

  if (safeSettings.eq.enabled) {
    current = await applyEqOffline(current, safeSettings.eq);
  }

  if (safeSettings.autotune.enabled) {
    current = await applyAutotuneOffline(current, safeSettings.autotune);
  }

  current = await applyPostEffectsOffline(current, safeSettings, resolvedBpm);
  return current;
}

export async function renderProcessedLayerBlob({
  inputBuffer,
  settings,
  bpm
}: RenderProcessedLayerBlobOptions): Promise<{ blob: Blob; durationSec: number }> {
  const rendered = await processAudioBufferWithFx({ inputBuffer, settings, bpm });
  return {
    blob: encodeWavFromBuffer(rendered),
    durationSec: Math.max(0, Math.round(rendered.duration))
  };
}
