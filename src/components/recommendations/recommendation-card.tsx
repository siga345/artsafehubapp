"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { RecommendationAction, RecommendationCard as RecommendationCardData } from "@/contracts/recommendations";
import { postRecommendationEvent, postRecommendationViewEvent } from "@/lib/recommendations";
import { cn } from "@/lib/utils";

import { FutureAiSlot } from "@/components/recommendations/future-ai-slot";
import { RecommendationSourceBadge } from "@/components/recommendations/recommendation-source-badge";

type Props = {
  recommendation: RecommendationCardData;
  className?: string;
  meta?: React.ReactNode;
  onAction?: (action: RecommendationAction, recommendation: RecommendationCardData) => void | Promise<void>;
  hideFutureAiSlot?: boolean;
};

async function trackAction(
  recommendation: RecommendationCardData,
  action: RecommendationAction,
  eventType: "CLICKED_PRIMARY" | "CLICKED_SECONDARY" | "DISMISSED"
) {
  try {
    await postRecommendationEvent({
      recommendationKey: recommendation.key,
      surface: recommendation.surface,
      kind: recommendation.kind,
      eventType,
      source: recommendation.source,
      entityType: recommendation.entityRef?.type,
      entityId: recommendation.entityRef?.id
    });
  } catch {
    // Recommendation logging should never block primary UX.
  }

  return action;
}

export function RecommendationCard({ recommendation, className, meta, onAction, hideFutureAiSlot = false }: Props) {
  useEffect(() => {
    void postRecommendationViewEvent({
      recommendationKey: recommendation.key,
      surface: recommendation.surface,
      kind: recommendation.kind,
      eventType: "VIEWED",
      source: recommendation.source,
      entityType: recommendation.entityRef?.type,
      entityId: recommendation.entityRef?.id
    });
  }, [recommendation]);

  const primaryAction = recommendation.primaryAction;

  return (
    <section className={cn("rounded-2xl border border-brand-border bg-white/85 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RecommendationSourceBadge source={recommendation.source} />
        {meta}
      </div>

      <p className="mt-3 text-base font-semibold text-brand-ink">{recommendation.title}</p>
      <p className="mt-2 text-sm text-brand-ink">{recommendation.text}</p>
      {recommendation.reason ? <p className="mt-2 text-sm text-brand-muted">{recommendation.reason}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {primaryAction ? (
          primaryAction.href && !onAction ? (
            <Link
              href={primaryAction.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2A342C] px-4 py-2 text-sm font-medium tracking-tight text-white transition-colors hover:bg-[#1F2822]"
              onClick={() => {
                void trackAction(recommendation, primaryAction, "CLICKED_PRIMARY");
              }}
            >
              {primaryAction.label}
            </Link>
          ) : (
            <Button
              onClick={async () => {
                const action = await trackAction(
                  recommendation,
                  primaryAction,
                  primaryAction.action === "DISMISS" ? "DISMISSED" : "CLICKED_PRIMARY"
                );
                await onAction?.(action, recommendation);
              }}
            >
              {primaryAction.label}
            </Button>
          )
        ) : null}

        {recommendation.secondaryActions.map((action, index) => (
          <Button
            key={`${recommendation.key}:secondary:${index}:${action.label}`}
            variant={action.action === "DISMISS" ? "ghost" : "secondary"}
            onClick={async () => {
              const trackedAction = await trackAction(
                recommendation,
                action,
                action.action === "DISMISS" ? "DISMISSED" : "CLICKED_SECONDARY"
              );
              await onAction?.(trackedAction, recommendation);
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {!hideFutureAiSlot && recommendation.futureAiSlot ? (
        <div className="mt-4">
          <FutureAiSlot slot={recommendation.futureAiSlot} />
        </div>
      ) : null}
    </section>
  );
}
