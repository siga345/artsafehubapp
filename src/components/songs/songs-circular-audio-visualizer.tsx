"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const BAR_COUNT = 90;
const MIN_BAR = 4;
const PARTICLE_COUNT = 34;
const HIGH_FREQ_SENSITIVITY = 0.9;
const MID_FREQ_SENSITIVITY = 0.93;
const MID_FREQ_CENTER = 0.56;
const MID_FREQ_WIDTH = 0.22;

type OrbitParticle = {
  angle: number;
  radiusOffset: number;
  speed: number;
  size: number;
  alpha: number;
  twinkle: number;
  phase: number;
};

export type SongsVisualizerIntensity = {
  energy: number;
  motion: number;
  shake: number;
  trailFrames: number;
};

type SongsCircularAudioVisualizerProps = {
  analyser: AnalyserNode | null;
  playing: boolean;
  coverStyle: React.CSSProperties;
  coverColors?: { colorA?: string | null; colorB?: string | null };
  intensity?: Partial<SongsVisualizerIntensity>;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function resolveIntensity(raw: Partial<SongsVisualizerIntensity> | undefined): SongsVisualizerIntensity {
  return {
    energy: clamp(raw?.energy ?? 1, 0.4, 2.2),
    motion: clamp(raw?.motion ?? 1, 0.2, 2),
    shake: clamp(raw?.shake ?? 1, 0, 2),
    trailFrames: Math.round(clamp(raw?.trailFrames ?? 3, 0, 6))
  };
}

function collectLogBars(data: ArrayLike<number>, targetCount: number) {
  const values = new Array<number>(targetCount).fill(0);
  if (!data.length || targetCount <= 0) return values;

  const maxIndex = data.length - 1;
  for (let idx = 0; idx < targetCount; idx += 1) {
    const startNorm = idx / targetCount;
    const endNorm = (idx + 1) / targetCount;
    const startIndex = Math.floor(Math.pow(startNorm, 2.05) * maxIndex);
    const endIndex = Math.max(startIndex + 1, Math.ceil(Math.pow(endNorm, 2.05) * maxIndex));
    let sum = 0;
    let count = 0;
    for (let sampleIdx = startIndex; sampleIdx <= Math.min(endIndex, maxIndex); sampleIdx += 1) {
      sum += data[sampleIdx];
      count += 1;
    }
    const normalized = count > 0 ? sum / count / 255 : 0;
    const frequencyRatio = targetCount <= 1 ? 0 : idx / (targetCount - 1);
    const highFreqAttenuation = 1 - Math.pow(frequencyRatio, 1.45) * (1 - HIGH_FREQ_SENSITIVITY);
    const midDistance = (frequencyRatio - MID_FREQ_CENTER) / MID_FREQ_WIDTH;
    const midWeight = Math.exp(-(midDistance * midDistance) / 2);
    const midFreqAttenuation = 1 - midWeight * (1 - MID_FREQ_SENSITIVITY);
    values[idx] = normalized * highFreqAttenuation * midFreqAttenuation;
  }

  return values;
}

function mirrorBars(values: number[], targetCount: number) {
  const mirrored = new Array<number>(targetCount).fill(0);
  if (!values.length || targetCount <= 0) return mirrored;
  for (let idx = 0; idx < targetCount; idx += 1) {
    const sourceIdx = idx < targetCount / 2 ? idx : targetCount - 1 - idx;
    mirrored[idx] = values[clamp(sourceIdx, 0, values.length - 1)];
  }
  return mirrored;
}

function collectWaveSamples(data: ArrayLike<number>, targetCount: number) {
  const values = new Array<number>(targetCount).fill(0);
  if (!data.length || targetCount <= 0) return values;
  const step = data.length / targetCount;
  for (let idx = 0; idx < targetCount; idx += 1) {
    const sourceIndex = Math.min(data.length - 1, Math.floor(idx * step));
    const sample = data[sourceIndex] ?? 128;
    values[idx] = (sample - 128) / 128;
  }
  return values;
}

function createParticles(count: number): OrbitParticle[] {
  return Array.from({ length: count }, () => ({
    angle: Math.random() * Math.PI * 2,
    radiusOffset: (Math.random() - 0.5) * 26,
    speed: (Math.random() * 0.6 + 0.15) * (Math.random() > 0.5 ? 1 : -1),
    size: Math.random() * 1.8 + 0.8,
    alpha: Math.random() * 0.55 + 0.2,
    twinkle: Math.random() * 2.4 + 0.8,
    phase: Math.random() * Math.PI * 2
  }));
}

export function SongsCircularAudioVisualizer({
  analyser,
  playing,
  coverStyle,
  coverColors,
  intensity,
  className
}: SongsCircularAudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothedBarsRef = useRef<number[]>([]);
  const trailRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const driftRef = useRef(0);
  const particlesRef = useRef<OrbitParticle[]>([]);
  const shakeRef = useRef({ x: 0, y: 0 });
  const lastTsRef = useRef<number | null>(null);
  const kickRef = useRef(0);
  const [surface, setSurface] = useState({ size: 0, dpr: 1, padding: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mediaQuery.matches);
    onChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      const nextSize = Math.max(0, Math.round(Math.min(rect.width || 0, rect.height || rect.width || 0)));
      const nextPadding = Math.round(nextSize * 0.36);
      const nextDpr = typeof window === "undefined" ? 1 : clamp(window.devicePixelRatio || 1, 1, 2);
      const canvasSize = Math.max(1, nextSize + nextPadding * 2);
      canvas.width = Math.max(1, Math.round(canvasSize * nextDpr));
      canvas.height = Math.max(1, Math.round(canvasSize * nextDpr));
      setSurface((prev) =>
        prev.size === nextSize && prev.dpr === nextDpr && prev.padding === nextPadding
          ? prev
          : { size: nextSize, dpr: nextDpr, padding: nextPadding }
      );
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => measure());
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || surface.size <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colorA = coverColors?.colorA || "#d9f99d";
    const colorB = coverColors?.colorB || "#65a30d";
    const lineWidth = Math.max(2, surface.size * 0.008);
    const ringInnerRadius = surface.size * 0.372;
    const ringOuterRadius = surface.size * 0.505;
    const ringThickness = ringOuterRadius - ringInnerRadius;
    const baseCenter = surface.padding + surface.size / 2;
    const coverRadius = surface.size * 0.36;
    const resolvedIntensity = resolveIntensity(intensity);
    const energyIntensity = resolvedIntensity.energy;
    const motionIntensity = resolvedIntensity.motion;
    const shakeIntensity = resolvedIntensity.shake;
    const trailFrames = resolvedIntensity.trailFrames;

    if (particlesRef.current.length !== PARTICLE_COUNT) {
      particlesRef.current = createParticles(PARTICLE_COUNT);
    }

    const drawWavePath = (
      points: Array<{ x: number; y: number }>,
      close = true
    ) => {
      if (!points.length) return;
      ctx.beginPath();
      const first = points[0];
      const second = points[1] ?? first;
      const startMidX = (first.x + second.x) / 2;
      const startMidY = (first.y + second.y) / 2;
      ctx.moveTo(startMidX, startMidY);

      for (let idx = 1; idx < points.length; idx += 1) {
        const current = points[idx];
        const next = points[(idx + 1) % points.length];
        if (!next) continue;
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;
        ctx.quadraticCurveTo(current.x, current.y, midX, midY);
      }

      if (close) {
        ctx.closePath();
      }
    };

    const draw = (timestamp: number) => {
      const prevTs = lastTsRef.current ?? timestamp;
      const dt = clamp((timestamp - prevTs) / 1000, 0, 0.05);
      lastTsRef.current = timestamp;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(surface.dpr, 0, 0, surface.dpr, 0, 0);

      let centerX = baseCenter;
      let centerY = baseCenter;

      const shakeStrength = analyser ? kickRef.current * surface.size * 0.014 * shakeIntensity : 0;
      if (analyser && !reducedMotion) {
        const targetX = Math.sin(timestamp * 0.012 + driftRef.current * 4.2) * shakeStrength;
        const targetY = Math.cos(timestamp * 0.011 - driftRef.current * 3.4) * shakeStrength;
        shakeRef.current.x = lerp(shakeRef.current.x, targetX, 0.18);
        shakeRef.current.y = lerp(shakeRef.current.y, targetY, 0.18);
      } else {
        shakeRef.current.x = lerp(shakeRef.current.x, 0, 0.16);
        shakeRef.current.y = lerp(shakeRef.current.y, 0, 0.16);
      }
      centerX += shakeRef.current.x;
      centerY += shakeRef.current.y;

      const gradient = ctx.createLinearGradient(
        centerX - ringOuterRadius,
        centerY - ringOuterRadius,
        centerX + ringOuterRadius,
        centerY + ringOuterRadius
      );
      gradient.addColorStop(0, colorA);
      gradient.addColorStop(0.5, "#f8fff0");
      gradient.addColorStop(1, colorB);

      ctx.save();
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.arc(centerX, centerY, ringInnerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = Math.max(1, surface.size * 0.004);
      ctx.stroke();

      let bars: number[];
      const halfCount = Math.ceil(BAR_COUNT / 2);
      if (analyser) {
        const expectedLength = analyser.frequencyBinCount;
        if (!freqDataRef.current || freqDataRef.current.length !== expectedLength) {
          freqDataRef.current = new Uint8Array(new ArrayBuffer(expectedLength));
        }
        analyser.getByteFrequencyData(freqDataRef.current);
        bars = mirrorBars(collectLogBars(freqDataRef.current, halfCount), BAR_COUNT);
      } else {
        bars = mirrorBars(
          Array.from({ length: halfCount }, (_, idx) => 0.14 + Math.sin(idx * 0.35) * 0.04 + Math.cos(idx * 0.12) * 0.02),
          BAR_COUNT
        );
      }
      const waveSamples = (() => {
        if (!analyser) return Array.from({ length: BAR_COUNT }, (_, idx) => Math.sin(idx * 0.18 + driftRef.current) * 0.08);
        const expectedLength = analyser.fftSize;
        if (!timeDataRef.current || timeDataRef.current.length !== expectedLength) {
          timeDataRef.current = new Uint8Array(new ArrayBuffer(expectedLength));
        }
        analyser.getByteTimeDomainData(timeDataRef.current);
        return collectWaveSamples(timeDataRef.current, BAR_COUNT);
      })();

      if (smoothedBarsRef.current.length !== BAR_COUNT) {
        smoothedBarsRef.current = Array.from({ length: BAR_COUNT }, () => 0);
      }

      for (let idx = 0; idx < BAR_COUNT; idx += 1) {
        const prev = smoothedBarsRef.current[idx] ?? 0;
        const raw = clamp(bars[idx] ?? 0, 0, 1);
        const boosted = clamp(Math.pow(raw * (1.22 * energyIntensity), 0.92), 0, 1);
        const factor = boosted > prev ? 0.68 : 0.1;
        smoothedBarsRef.current[idx] = prev + (boosted - prev) * factor;
      }

      const bassEnergy =
        smoothedBarsRef.current.slice(0, Math.max(4, Math.floor(BAR_COUNT * 0.12))).reduce((sum, value) => sum + value, 0) /
        Math.max(1, Math.floor(BAR_COUNT * 0.12));
      const overallEnergy =
        smoothedBarsRef.current.reduce((sum, value) => sum + value, 0) / Math.max(1, smoothedBarsRef.current.length);
      const targetKick = clamp(Math.max(bassEnergy, overallEnergy * 0.7) * energyIntensity, 0, 1.25);
      kickRef.current += (targetKick - kickRef.current) * (targetKick > kickRef.current ? 0.56 : 0.09);
      const kickPulse = kickRef.current;
      const pulseRadius = ringInnerRadius + lerp(0, surface.size * 0.02 * energyIntensity, kickPulse);
      const pulseAlpha = analyser ? lerp(0.2, 0.48, kickPulse) : 0.14;

      ctx.shadowBlur = surface.size * 0.035;
      ctx.shadowColor = colorA;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = gradient;
      ctx.globalAlpha = pulseAlpha;
      ctx.lineWidth = Math.max(2, lineWidth * 0.9);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, coverRadius + lerp(6, 16, kickPulse), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.globalAlpha = analyser ? lerp(0.12, 0.28, kickPulse) : 0.1;
      ctx.lineWidth = Math.max(1.5, lineWidth * 0.7);
      ctx.shadowBlur = surface.size * 0.05;
      ctx.shadowColor = colorB;
      ctx.stroke();

      ctx.shadowBlur = surface.size * 0.02;
      ctx.shadowColor = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringInnerRadius - Math.max(2, lineWidth * 0.55), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.globalAlpha = analyser ? 0.55 : 0.32;
      ctx.lineWidth = Math.max(1.5, lineWidth * 0.5);
      ctx.stroke();

      const step = (Math.PI * 2) / BAR_COUNT;
      if (analyser && !reducedMotion) {
        driftRef.current += dt * (0.24 + overallEnergy * 0.7 * motionIntensity);
      }
      const angleOffset = 0;

      const wavePoints: Array<{ x: number; y: number; r: number }> = [];
      const innerWavePoints: Array<{ x: number; y: number }> = [];
      for (let idx = 0; idx < BAR_COUNT; idx += 1) {
        const angle = -Math.PI / 2 + angleOffset + idx * step;
        const raw = clamp(smoothedBarsRef.current[idx] ?? 0, 0, 1);
        const baseNorm = Math.pow(raw, 0.96);
        const spikeNorm = Math.pow(raw, 2.35);
        const waveNorm = clamp(waveSamples[idx] ?? 0, -1, 1);
        const aggression = 0.55 + kickPulse * 0.95;
        const angleNoise = (Math.sin(angle * 3) + Math.cos(angle * 5)) * 0.5;
        const bottomAccent = Math.max(0, Math.sin(angle));
        const topDamping = Math.max(0, -Math.sin(angle));
        const spikeBoost =
          spikeNorm * surface.size * (0.095 + aggression * 0.058) * (0.68 + Math.max(0, angleNoise) * 1.0) * energyIntensity;
        const baseRadius = ringInnerRadius + MIN_BAR + ringThickness * 0.08;
        const lowerLift =
          bottomAccent *
          (baseNorm * ringThickness * (0.34 + kickPulse * 0.36) + spikeNorm * surface.size * (0.05 + kickPulse * 0.075)) *
          energyIntensity;
        const upperTrim = topDamping * (surface.size * 0.02 + baseNorm * ringThickness * 0.08);
        const timeWaveBoost = waveNorm * surface.size * (0.014 + kickPulse * 0.012) * (0.45 + baseNorm * 0.9) * motionIntensity;
        const waveRadius =
          baseRadius +
          baseNorm * ringThickness * 0.96 +
          spikeBoost +
          kickPulse * surface.size * 0.022 * energyIntensity +
          lowerLift -
          upperTrim +
          timeWaveBoost;
        wavePoints.push({
          x: centerX + Math.cos(angle) * waveRadius,
          y: centerY + Math.sin(angle) * waveRadius,
          r: waveRadius
        });
        const innerRadius = coverRadius + surface.size * 0.038 + waveNorm * surface.size * (0.008 + kickPulse * 0.01) * motionIntensity;
        innerWavePoints.push({
          x: centerX + Math.cos(angle) * innerRadius,
          y: centerY + Math.sin(angle) * innerRadius
        });
      }

      const innerFillRadius = coverRadius + surface.size * 0.015;
      const fillGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        innerFillRadius,
        centerX,
        centerY,
        ringOuterRadius + surface.size * 0.11
      );
      fillGradient.addColorStop(0, "rgba(255,255,255,0)");
      fillGradient.addColorStop(0.45, `${colorA}10`);
      fillGradient.addColorStop(1, `${colorB}06`);

      if (analyser && !reducedMotion && trailFrames > 0) {
        trailRef.current.unshift(wavePoints.map((point) => ({ x: point.x, y: point.y })));
        if (trailRef.current.length > trailFrames) {
          trailRef.current = trailRef.current.slice(0, trailFrames);
        }
      } else {
        trailRef.current = [];
      }

      for (let idx = trailRef.current.length - 1; idx >= 1; idx -= 1) {
        const trail = trailRef.current[idx];
        if (!trail?.length) continue;
        const trailWeight = 1 - idx / (trailFrames + 1);
        ctx.shadowBlur = surface.size * 0.028 * trailWeight;
        ctx.shadowColor = colorB;
        ctx.globalAlpha = clamp((0.08 + trailWeight * 0.13) * motionIntensity, 0, 1);
        ctx.lineWidth = lineWidth * (1.3 + trailWeight * 1.2);
        ctx.strokeStyle = gradient;
        drawWavePath(trail);
        ctx.stroke();
      }

      ctx.shadowBlur = surface.size * 0.05;
      ctx.shadowColor = colorB;
      ctx.globalAlpha = analyser ? 0.34 : 0.14;
      ctx.fillStyle = fillGradient;
      drawWavePath(wavePoints);
      ctx.fill();

      ctx.shadowBlur = surface.size * 0.045;
      ctx.shadowColor = colorB;
      ctx.globalAlpha = analyser ? 0.48 : 0.16;
      ctx.lineWidth = lineWidth * 2.8;
      ctx.strokeStyle = gradient;
      drawWavePath(wavePoints);
      ctx.stroke();

      ctx.shadowBlur = surface.size * 0.02;
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.globalAlpha = analyser ? 0.98 : 0.62;
      ctx.lineWidth = Math.max(1.8, lineWidth * 1.2);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      drawWavePath(wavePoints);
      ctx.stroke();

      ctx.shadowBlur = surface.size * 0.03;
      ctx.shadowColor = colorA;
      ctx.globalAlpha = analyser ? 0.46 : 0.18;
      ctx.lineWidth = Math.max(1, lineWidth * 0.65);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      drawWavePath(innerWavePoints);
      ctx.stroke();

      const particlesRadius = ringOuterRadius + surface.size * 0.045 + kickPulse * surface.size * 0.018;
      ctx.shadowBlur = surface.size * 0.02;
      ctx.shadowColor = colorA;
      for (let idx = 0; idx < particlesRef.current.length; idx += 1) {
        const particle = particlesRef.current[idx];
        if (!reducedMotion) {
          particle.phase += particle.twinkle * dt;
        }
        const localAlpha = particle.alpha * (0.55 + 0.45 * (0.5 + Math.sin(particle.phase) * 0.5));
        const radialJitter = reducedMotion ? 0 : Math.sin(particle.phase * 0.7) * (2 + kickPulse * 6);
        const pr = particlesRadius + particle.radiusOffset + radialJitter;
        const px = centerX + Math.cos(particle.angle) * pr;
        const py = centerY + Math.sin(particle.angle) * pr;
        const radius = particle.size + kickPulse * 1.1;
        const particleGradient = ctx.createRadialGradient(px, py, 0, px, py, radius * 3.5);
        particleGradient.addColorStop(0, "rgba(255,255,255,0.95)");
        particleGradient.addColorStop(0.45, colorA);
        particleGradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.globalAlpha = localAlpha;
        ctx.fillStyle = particleGradient;
        ctx.beginPath();
        ctx.arc(px, py, radius * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    draw(performance.now());

    const shouldAnimate = Boolean(analyser) && playing && !reducedMotion;
    if (!shouldAnimate) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const loop = (ts: number) => {
      if (cancelled) return;
      draw(ts);
      rafRef.current = window.requestAnimationFrame(loop);
    };

    rafRef.current = window.requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [analyser, playing, reducedMotion, surface, coverColors?.colorA, coverColors?.colorB, intensity, intensity?.energy, intensity?.motion, intensity?.shake, intensity?.trailFrames]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      trailRef.current = [];
    },
    []
  );

  return (
    <div ref={containerRef} className={cn("relative z-0 mx-auto aspect-square w-full overflow-visible", className)}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute"
        style={{
          top: -surface.padding,
          left: -surface.padding,
          width: `calc(100% + ${surface.padding * 2}px)`,
          height: `calc(100% + ${surface.padding * 2}px)`
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-[14%] z-10 rounded-full border border-black/20 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),0_20px_40px_rgba(0,0,0,0.25)]"
        style={coverStyle}
        aria-hidden="true"
      />
    </div>
  );
}
