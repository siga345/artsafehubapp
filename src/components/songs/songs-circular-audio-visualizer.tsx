"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const BAR_COUNT = 90;
const MIN_BAR = 4;
const PARTICLE_COUNT = 34;

type OrbitParticle = {
  angle: number;
  radiusOffset: number;
  speed: number;
  size: number;
  alpha: number;
  twinkle: number;
  phase: number;
};

type SongsCircularAudioVisualizerProps = {
  analyser: AnalyserNode | null;
  playing: boolean;
  coverStyle: React.CSSProperties;
  coverColors?: { colorA?: string | null; colorB?: string | null };
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
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
    values[idx] = count > 0 ? sum / count / 255 : 0;
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
  className
}: SongsCircularAudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothedBarsRef = useRef<number[]>([]);
  const driftRef = useRef(0);
  const particlesRef = useRef<OrbitParticle[]>([]);
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
    const center = surface.padding + surface.size / 2;
    const coverRadius = surface.size * 0.36;

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

      const gradient = ctx.createLinearGradient(center - ringOuterRadius, center - ringOuterRadius, center + ringOuterRadius, center + ringOuterRadius);
      gradient.addColorStop(0, colorA);
      gradient.addColorStop(0.5, "#f8fff0");
      gradient.addColorStop(1, colorB);

      ctx.save();
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.arc(center, center, ringInnerRadius, 0, Math.PI * 2);
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

      if (smoothedBarsRef.current.length !== BAR_COUNT) {
        smoothedBarsRef.current = Array.from({ length: BAR_COUNT }, () => 0);
      }

      for (let idx = 0; idx < BAR_COUNT; idx += 1) {
        const prev = smoothedBarsRef.current[idx] ?? 0;
        const raw = clamp(bars[idx] ?? 0, 0, 1);
        const boosted = clamp(Math.pow(raw * 1.22, 0.92), 0, 1);
        const factor = boosted > prev ? 0.68 : 0.1;
        smoothedBarsRef.current[idx] = prev + (boosted - prev) * factor;
      }

      const bassEnergy =
        smoothedBarsRef.current.slice(0, Math.max(4, Math.floor(BAR_COUNT * 0.12))).reduce((sum, value) => sum + value, 0) /
        Math.max(1, Math.floor(BAR_COUNT * 0.12));
      const overallEnergy =
        smoothedBarsRef.current.reduce((sum, value) => sum + value, 0) / Math.max(1, smoothedBarsRef.current.length);
      const targetKick = Math.max(bassEnergy, overallEnergy * 0.7);
      kickRef.current += (targetKick - kickRef.current) * (targetKick > kickRef.current ? 0.56 : 0.09);
      const kickPulse = kickRef.current;
      const pulseRadius = ringInnerRadius + lerp(0, surface.size * 0.02, kickPulse);
      const pulseAlpha = analyser ? lerp(0.2, 0.48, kickPulse) : 0.14;

      ctx.shadowBlur = surface.size * 0.035;
      ctx.shadowColor = colorA;
      ctx.beginPath();
      ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = gradient;
      ctx.globalAlpha = pulseAlpha;
      ctx.lineWidth = Math.max(2, lineWidth * 0.9);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center, center, coverRadius + lerp(6, 16, kickPulse), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.globalAlpha = analyser ? lerp(0.12, 0.28, kickPulse) : 0.1;
      ctx.lineWidth = Math.max(1.5, lineWidth * 0.7);
      ctx.shadowBlur = surface.size * 0.05;
      ctx.shadowColor = colorB;
      ctx.stroke();

      ctx.shadowBlur = surface.size * 0.02;
      ctx.shadowColor = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(center, center, ringInnerRadius - Math.max(2, lineWidth * 0.55), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.globalAlpha = analyser ? 0.55 : 0.32;
      ctx.lineWidth = Math.max(1.5, lineWidth * 0.5);
      ctx.stroke();

      const step = (Math.PI * 2) / BAR_COUNT;
      if (analyser && !reducedMotion) {
        driftRef.current += dt * (0.25 + overallEnergy * 0.7);
      }
      const angleOffset = 0;

      const wavePoints: Array<{ x: number; y: number; r: number }> = [];
      for (let idx = 0; idx < BAR_COUNT; idx += 1) {
        const angle = -Math.PI / 2 + angleOffset + idx * step;
        const raw = clamp(smoothedBarsRef.current[idx] ?? 0, 0, 1);
        const baseNorm = Math.pow(raw, 0.96);
        const spikeNorm = Math.pow(raw, 2.35);
        const aggression = 0.55 + kickPulse * 0.95;
        const angleNoise = (Math.sin(angle * 3 + driftRef.current * 1.4) + Math.cos(angle * 5 - driftRef.current * 0.9)) * 0.5;
        const bottomAccent = Math.max(0, Math.sin(angle));
        const topDamping = Math.max(0, -Math.sin(angle));
        const spikeBoost = spikeNorm * surface.size * (0.095 + aggression * 0.058) * (0.68 + Math.max(0, angleNoise) * 1.0);
        const baseRadius = ringInnerRadius + MIN_BAR + ringThickness * 0.08;
        const lowerLift =
          bottomAccent *
          (baseNorm * ringThickness * (0.34 + kickPulse * 0.36) + spikeNorm * surface.size * (0.05 + kickPulse * 0.075));
        const upperTrim = topDamping * (surface.size * 0.02 + baseNorm * ringThickness * 0.08);
        const waveRadius = baseRadius + baseNorm * ringThickness * 0.96 + spikeBoost + kickPulse * surface.size * 0.022 + lowerLift - upperTrim;
        wavePoints.push({
          x: center + Math.cos(angle) * waveRadius,
          y: center + Math.sin(angle) * waveRadius,
          r: waveRadius
        });
      }

      const innerFillRadius = coverRadius + surface.size * 0.015;
      const fillGradient = ctx.createRadialGradient(center, center, innerFillRadius, center, center, ringOuterRadius + surface.size * 0.11);
      fillGradient.addColorStop(0, "rgba(255,255,255,0)");
      fillGradient.addColorStop(0.45, `${colorA}10`);
      fillGradient.addColorStop(1, `${colorB}06`);

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

      const particlesRadius = ringOuterRadius + surface.size * 0.045 + kickPulse * surface.size * 0.018;
      ctx.shadowBlur = surface.size * 0.02;
      ctx.shadowColor = colorA;
      for (let idx = 0; idx < particlesRef.current.length; idx += 1) {
        const particle = particlesRef.current[idx];
        if (!reducedMotion) {
          particle.angle += particle.speed * dt;
          particle.phase += particle.twinkle * dt;
        }
        const localAlpha = particle.alpha * (0.55 + 0.45 * (0.5 + Math.sin(particle.phase) * 0.5));
        const radialJitter = reducedMotion ? 0 : Math.sin(particle.phase * 0.7) * (2 + kickPulse * 6);
        const pr = particlesRadius + particle.radiusOffset + radialJitter;
        const px = center + Math.cos(particle.angle) * pr;
        const py = center + Math.sin(particle.angle) * pr;
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
  }, [analyser, playing, reducedMotion, surface, coverColors?.colorA, coverColors?.colorB]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
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
