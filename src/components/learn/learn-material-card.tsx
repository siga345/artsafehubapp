import Link from "next/link";
import { ArrowRight, Clock3, ExternalLink, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getLearnMaterialTimeLabel,
  getLearnMaterialTypeLabel,
  getLearnProgressStatusLabel,
  getLearnProviderLabel,
  supportsInlineEmbed
} from "@/lib/learn/providers";
import type { LearnMaterialListItem } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type LearnMaterialCardProps = {
  material: LearnMaterialListItem;
  featured?: boolean;
};

export function LearnMaterialCard({ material, featured = false }: LearnMaterialCardProps) {
  const timeLabel = getLearnMaterialTimeLabel(material);
  const hasEmbed = supportsInlineEmbed(material);

  return (
    <Link href={`/learn/${material.slug}`} className="group block">
      <Card
        className={cn(
          "h-full overflow-hidden p-0 transition-transform duration-200 hover:-translate-y-0.5",
          featured ? "rounded-[28px]" : ""
        )}
      >
        <div className="relative">
          <div
            className={cn(
              "w-full border-b border-brand-border bg-[#ebf2e2] bg-cover bg-center",
              featured ? "h-28 sm:h-40 md:h-64" : "h-24 sm:h-36 md:h-44"
            )}
            style={{ backgroundImage: `url(${material.thumbnailUrl})` }}
            aria-hidden="true"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />
	          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5 md:left-3 md:top-3 md:gap-2">
            <Badge className="border-white/70 bg-white/90 px-2 py-0.5 text-[10px] text-brand-ink md:px-2.5 md:py-1 md:text-xs">
              {material.type === "VIDEO" ? <PlayCircle className="mr-1 h-3 w-3 md:h-3.5 md:w-3.5" /> : null}
              {getLearnMaterialTypeLabel(material.type)}
            </Badge>
	            <Badge className="border-white/70 bg-[#2A342C]/90 px-2 py-0.5 text-[10px] text-white md:px-2.5 md:py-1 md:text-xs">
	              {getLearnProviderLabel(material.provider)}
	            </Badge>
              {material.progress.status ? (
                <Badge className="border-white/70 bg-[#f7fbf2]/95 px-2 py-0.5 text-[10px] text-brand-ink md:px-2.5 md:py-1 md:text-xs">
                  {getLearnProgressStatusLabel(material.progress.status)}
                </Badge>
              ) : null}
	          </div>
	        </div>

        <div className="space-y-2.5 p-3 md:space-y-3 md:p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-brand-muted md:gap-2 md:text-xs">
            <span className="font-medium text-brand-ink">{material.authorName}</span>
            {timeLabel ? (
              <>
                <span aria-hidden="true">•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  {timeLabel}
                </span>
              </>
            ) : null}
          </div>

          <div>
            <h3
              className={cn(
                "line-clamp-2 font-semibold tracking-tight text-brand-ink",
                featured ? "text-sm sm:text-base md:text-2xl" : "text-sm md:text-base"
              )}
            >
              {material.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-muted md:mt-2 md:line-clamp-3 md:text-sm">
              {material.summary}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {material.tags.slice(0, featured ? 4 : 3).map((tag, index) => (
              <span
                key={`${material.id}-${tag}`}
                className={cn(
                  "inline-flex items-center rounded-full border border-brand-border bg-white px-2 py-0.5 text-[10px] text-brand-muted md:px-2 md:py-1 md:text-xs",
                  index > 1 ? "hidden sm:inline-flex" : ""
                )}
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs md:text-sm">
            <span className="inline-flex items-center gap-1 text-brand-muted">
              {hasEmbed ? "Внутри приложения" : "Preview + источник"}
              {!hasEmbed ? <ExternalLink className="h-3 w-3 md:h-3.5 md:w-3.5" /> : null}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-brand-ink transition-transform group-hover:translate-x-0.5">
              Открыть
              <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
