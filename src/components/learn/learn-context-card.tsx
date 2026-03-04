"use client";

import Link from "next/link";
import { BookOpen, ExternalLink, Sparkles } from "lucide-react";

import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import type { RecommendationContext } from "@/contracts/recommendations";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLearnMatchReasonLabel, getLearnProgressStatusLabel, getLearnProviderLabel } from "@/lib/learn/providers";
import type { LearnContextBlock } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

export type LearnContextCardAction =
    | {
      kind: "APPLY_TO_TRACK" | "APPLY_TO_GOAL";
      targetId: string;
      targetLabel: string | null;
      recommendationContext?: RecommendationContext;
    }
  | {
      kind: "SAVE_FOR_LATER" | "LATER" | "NOT_RELEVANT";
      recommendationContext?: RecommendationContext;
    };

type LearnContextCardProps = {
  block: LearnContextBlock | null;
  onAction: (materialSlug: string, action: LearnContextCardAction) => Promise<void>;
  compact?: boolean;
  targetLabelOverride?: string | null;
  className?: string;
};

function getPrimaryLabel(
  action: LearnContextBlock["items"][number]["primaryAction"],
  targetLabelOverride?: string | null
) {
  const label = targetLabelOverride ?? action.targetLabel;
  if (action.kind === "APPLY_TO_TRACK") {
    return label ? `Применить к треку: ${label}` : "Применить к треку";
  }
  if (action.kind === "APPLY_TO_GOAL") {
    return label ? `Применить к цели: ${label}` : "Применить к цели";
  }
  return "Вернуться позже";
}

export function LearnContextCard({
  block,
  onAction,
  compact = false,
  targetLabelOverride,
  className
}: LearnContextCardProps) {
  if (!block) return null;

  return (
    <Card className={cn("overflow-hidden border-brand-border bg-white/85", className)}>
      <CardHeader className={compact ? "p-4" : undefined}>
        <div className="flex items-center gap-2">
          <Badge className="border-brand-border bg-white text-brand-muted">
            <BookOpen className="mr-1 h-3.5 w-3.5" />
            Learn
          </Badge>
          <Badge className="border-brand-border bg-[#f7fbf2] text-brand-ink">
            <Sparkles className="mr-1 h-3 w-3" />
            In workflow
          </Badge>
        </div>
        <CardTitle className={compact ? "text-lg" : "text-xl"}>{block.title}</CardTitle>
        <CardDescription>{block.subtitle}</CardDescription>
      </CardHeader>

      <div className={cn("space-y-3 px-6 pb-6", compact && "px-4 pb-4")}>
        {block.empty ? (
          <div className="rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted">
            Сейчас нет активных рекомендаций. Вернись чуть позже или открой общий каталог Learn.
          </div>
        ) : null}

        {block.items.map((item) => (
          <section key={`${block.surface}:${item.material.id}`} className="rounded-2xl border border-brand-border bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-brand-border bg-white text-brand-ink">{getLearnProviderLabel(item.material.provider)}</Badge>
                  {item.material.progress.status ? (
                    <Badge className="border-brand-border bg-[#f7fbf2] text-brand-ink">
                      {getLearnProgressStatusLabel(item.material.progress.status)}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-base font-semibold text-brand-ink">{item.material.title}</p>
                <p className="mt-2 text-sm text-brand-muted">{item.material.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.matchReasons.map((reason) => (
                    <Badge key={`${item.material.id}:${reason}`} className="border-brand-border bg-[#eef7ff] text-brand-ink">
                      {getLearnMatchReasonLabel(reason)}
                    </Badge>
                  ))}
                </div>
              </div>

              <Link
                href={`/learn/${item.material.slug}`}
                className="inline-flex items-center gap-1 rounded-xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-[#f2f5eb]"
              >
                Открыть
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <RecommendationCard
              className="mt-4"
              recommendation={{
                ...item.recommendation,
                primaryAction: item.recommendation.primaryAction
                  ? {
                      ...item.recommendation.primaryAction,
                      label: getPrimaryLabel(item.primaryAction, targetLabelOverride)
                    }
                  : null
              }}
              onAction={async (action) => {
                const kind = typeof action.payload?.kind === "string" ? action.payload.kind : null;
                if (kind === "LATER") {
                  await onAction(item.material.slug, {
                    kind: "LATER",
                    recommendationContext: {
                      recommendationKey: item.recommendation.key,
                      surface: item.recommendation.surface,
                      kind: item.recommendation.kind,
                      source: item.recommendation.source
                    }
                  });
                  return;
                }
                if (kind === "NOT_RELEVANT") {
                  await onAction(item.material.slug, {
                    kind: "NOT_RELEVANT",
                    recommendationContext: {
                      recommendationKey: item.recommendation.key,
                      surface: item.recommendation.surface,
                      kind: item.recommendation.kind,
                      source: item.recommendation.source
                    }
                  });
                  return;
                }
                if (kind === "APPLY_TO_TRACK" || kind === "APPLY_TO_GOAL") {
                  const targetId =
                    typeof action.payload?.targetId === "string" && action.payload.targetId.trim()
                      ? action.payload.targetId
                      : item.primaryAction.targetId ?? "";
                  await onAction(item.material.slug, {
                    kind,
                    targetId,
                    targetLabel:
                      (typeof action.payload?.targetLabel === "string" ? action.payload.targetLabel : null) ??
                      targetLabelOverride ??
                      item.primaryAction.targetLabel,
                    recommendationContext: {
                      recommendationKey: item.recommendation.key,
                      surface: item.recommendation.surface,
                      kind: item.recommendation.kind,
                      source: item.recommendation.source
                    }
                  });
                  return;
                }
                await onAction(item.material.slug, {
                  kind: "LATER",
                  recommendationContext: {
                    recommendationKey: item.recommendation.key,
                    surface: item.recommendation.surface,
                    kind: item.recommendation.kind,
                    source: item.recommendation.source
                  }
                });
              }}
            />
          </section>
        ))}
      </div>
    </Card>
  );
}
