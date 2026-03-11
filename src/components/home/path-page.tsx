"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { type ComponentType, useMemo } from "react";
import { Camera, CircleDot, Clapperboard, Megaphone, Mic, Rocket, SlidersHorizontal, Sparkles, Waves, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { apiFetchJson } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

type HomeOverview = {
  stage: {
    order: number;
    name: string;
    iconKey: string;
    description: string;
  };
};

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  spark: Sparkles,
  mic: Mic,
  knobs: CircleDot,
  record: Clapperboard,
  sliders: SlidersHorizontal,
  wave: Waves,
  rocket: Rocket,
  camera: Camera,
  megaphone: Megaphone
};

const stageImageByOrder: Record<number, string> = {
  1: "/images/stage-1-iskra-symbol.png",
  2: "/images/stage-2-formirovanie-symbol.png",
  3: "/images/stage-3-vyhod-v-svet-symbol.png",
  4: "/images/stage-4-proryv-symbol.png",
  5: "/images/stage-5-priznanie-symbol.png",
  6: "/images/stage-6-shirokaya-izvestnost-symbol.png",
  7: "/images/stage-7-nasledie-symbol.png"
};

function getStageGradientStyle(order?: number) {
  switch (order) {
    case 2:
      return {
        background:
          "linear-gradient(135deg, rgba(203, 213, 225, 0.46) 0%, rgba(148, 163, 184, 0.32) 48%, rgba(226, 232, 240, 0.42) 100%)"
      } as const;
    case 3:
      return {
        background:
          "linear-gradient(135deg, rgba(253, 230, 138, 0.52) 0%, rgba(250, 204, 21, 0.34) 48%, rgba(254, 249, 195, 0.48) 100%)"
      } as const;
    case 4:
      return {
        background:
          "linear-gradient(135deg, rgba(134, 239, 172, 0.46) 0%, rgba(74, 222, 128, 0.32) 48%, rgba(220, 252, 231, 0.44) 100%)"
      } as const;
    case 5:
      return {
        background:
          "linear-gradient(135deg, rgba(253, 186, 116, 0.50) 0%, rgba(249, 115, 22, 0.30) 48%, rgba(255, 237, 213, 0.46) 100%)"
      } as const;
    case 6:
      return {
        background:
          "linear-gradient(135deg, rgba(125, 181, 255, 0.62) 0%, rgba(37, 99, 235, 0.54) 48%, rgba(191, 219, 254, 0.54) 100%)"
      } as const;
    case 7:
      return {
        background:
          "linear-gradient(140deg, #ff7a7a 0%, #ff2b2b 44%, #9a1111 78%, #3a0b0b 100%)"
      } as const;
    default:
      return undefined;
  }
}

export function PathPage({ compact = false, onClose }: { compact?: boolean; onClose?: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["home-overview"],
    queryFn: () => fetcher<HomeOverview>("/api/home/overview")
  });
  const stageImageSrc = data?.stage?.order ? stageImageByOrder[data.stage.order] : undefined;
  const StageIcon = useMemo(() => {
    const key = data?.stage.iconKey ?? "spark";
    return iconMap[key] ?? Sparkles;
  }, [data?.stage?.iconKey]);
  const useBrightText = (data?.stage?.order ?? 1) >= 2 && (data?.stage?.order ?? 1) <= 6;
  const isSeventhStage = data?.stage?.order === 7;
  const stageGradientStyle = getStageGradientStyle(data?.stage?.order);

  return (
    <div className={cn("w-full", compact ? "max-w-[30rem]" : "")}>
      <Card
        style={stageGradientStyle}
        className={cn(
          "relative w-full overflow-hidden border p-0",
          compact ? "mx-auto h-[min(80dvh,44rem)] rounded-[2rem] sm:rounded-[2.35rem]" : "min-h-[78vh] rounded-[2.2rem]",
          isSeventhStage ? "border-[#7f0000]" : "border-white/60"
        )}
      >
        {compact && onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть PATH"
            className="absolute right-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/22 bg-black/18 text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md transition-colors hover:bg-black/28"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${
            isSeventhStage
              ? "bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.16),transparent_42%),radial-gradient(circle_at_85%_88%,rgba(255,120,120,0.18),transparent_45%)]"
              : "bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.65),transparent_44%),radial-gradient(circle_at_84%_84%,rgba(42,52,44,0.08),transparent_46%)]"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-10 top-8 h-44 w-44 rounded-full blur-3xl ${
            isSeventhStage ? "bg-red-200/25" : "bg-lime-200/45"
          }`}
        />
        <div
          className={cn(
            "relative flex flex-col items-center justify-center px-6 py-10 md:px-10 md:py-14",
            compact ? "h-full" : "min-h-[78vh]"
          )}
        >
          <div className={cn("relative flex w-full flex-col items-center justify-center", compact ? "min-h-0 flex-1" : "min-h-[420px]")}>
            <div
              aria-hidden
              className={`absolute h-52 w-52 rounded-full border md:h-72 md:w-72 ${
                isSeventhStage ? "border-white/20" : "border-brand-ink/10"
              }`}
            />
            <div
              aria-hidden
              className={`absolute h-72 w-72 rounded-full border md:h-[29rem] md:w-[29rem] ${
                isSeventhStage ? "border-white/10" : "border-brand-ink/5"
              }`}
            />
            <div
              aria-hidden
              className={`absolute h-32 w-32 rounded-full blur-2xl md:h-44 md:w-44 ${
                isSeventhStage ? "bg-white/10" : "bg-white/60"
              }`}
            />

            <div
              className={cn(
                "relative z-20 flex h-52 w-52 items-center justify-center md:h-72 md:w-72",
                compact && "absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 sm:h-[26rem] sm:w-[26rem]"
              )}
            >
              <div aria-hidden className="path-logo-shadow pointer-events-none absolute left-1/2 top-[62%] h-10 w-28 -translate-x-1/2 rounded-full bg-black/12 blur-2xl md:h-12 md:w-36" />
              <div className="path-logo-float relative flex h-full w-full items-center justify-center">
                {stageImageSrc ? (
                  <Image
                    src={stageImageSrc}
                    alt={data?.stage?.name ? `Этап PATH: ${data.stage.name}` : "Текущий этап PATH"}
                    fill
                    sizes="(max-width: 768px) 208px, 288px"
                    className={`object-contain ${isSeventhStage ? "invert brightness-[2.2] contrast-[1.15]" : ""}`}
                    priority
                  />
                ) : (
                  <StageIcon className={`h-32 w-32 md:h-44 md:w-44 ${isSeventhStage ? "text-white" : "text-brand-ink"}`} />
                )}
              </div>
            </div>

            <div
              className={cn(
                "relative z-20 text-center",
                compact
                  ? "absolute inset-x-0 bottom-[9%] mx-auto max-w-[20rem] sm:bottom-[8%] sm:max-w-[22rem]"
                  : "mt-10 max-w-[20rem] md:mt-12 md:max-w-[24rem]"
              )}
            >
              <p
                className={cn(
                  "text-[2.05rem] font-semibold leading-none tracking-tight md:text-[3.2rem]",
                  isSeventhStage || useBrightText ? "text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.28)]" : "text-brand-ink"
                )}
              >
                {isLoading ? "Загрузка..." : data?.stage.name}
              </p>
              <p
                className={cn(
                  "mt-3 text-lg leading-tight md:mt-4 md:text-[2rem]",
                  isSeventhStage || useBrightText ? "text-white/78 drop-shadow-[0_8px_24px_rgba(0,0,0,0.22)]" : "text-brand-muted"
                )}
              >
                {data?.stage.description}
              </p>
            </div>
          </div>
        </div>
      </Card>
      <style jsx>{`
        .path-logo-float {
          filter: drop-shadow(0 18px 28px rgba(18, 24, 20, 0.08));
        }

        .path-logo-shadow {
          opacity: 0.18;
          transform: translate3d(-50%, 0, 0) scale(0.92);
          filter: blur(20px);
        }
      `}</style>
    </div>
  );
}
