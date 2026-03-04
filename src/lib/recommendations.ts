import { DailyFocusSource } from "@prisma/client";

import type {
  RecommendationCard,
  RecommendationEventInput,
  RecommendationKind,
  RecommendationSource,
  RecommendationSurface
} from "@/contracts/recommendations";
import { apiFetch } from "@/lib/client-fetch";

const recommendationSourceLabels: Record<RecommendationSource, string> = {
  MANUAL: "Manual",
  SYSTEM: "System",
  AI: "AI"
};

export function getRecommendationSourceLabel(source: RecommendationSource) {
  return recommendationSourceLabels[source];
}

export function createFutureAiSlot(surface: RecommendationSurface, kind: RecommendationKind, key: string) {
  return {
    key: `${surface}:${kind}:${key}:future-ai`,
    state: "EMPTY" as const,
    title: "AI slot",
    description: "Здесь позже появится AI-усиление, но текущий поток уже полностью рабочий."
  };
}

export function buildRecommendationCard(input: Omit<RecommendationCard, "futureAiSlot"> & { futureAiSlotKey?: string | null }) {
  return {
    ...input,
    secondaryActions: input.secondaryActions ?? [],
    futureAiSlot: input.futureAiSlotKey ? createFutureAiSlot(input.surface, input.kind, input.futureAiSlotKey) : null
  } satisfies RecommendationCard;
}

export function mapDailyFocusSourceToRecommendationSource(source: DailyFocusSource): RecommendationSource {
  return source === DailyFocusSource.MANUAL ? "MANUAL" : "SYSTEM";
}

function getViewDedupeStorageKey(input: Pick<RecommendationEventInput, "recommendationKey" | "eventType">) {
  const today = new Date().toISOString().slice(0, 10);
  return `recommendation-event:${today}:${input.eventType}:${input.recommendationKey}`;
}

export async function postRecommendationEvent(input: RecommendationEventInput) {
  await apiFetch("/api/recommendations/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function postRecommendationViewEvent(input: RecommendationEventInput) {
  if (typeof window === "undefined") return;

  const storageKey = getViewDedupeStorageKey(input);
  if (window.sessionStorage.getItem(storageKey)) {
    return;
  }

  window.sessionStorage.setItem(storageKey, "1");
  try {
    await postRecommendationEvent(input);
  } catch {
    window.sessionStorage.removeItem(storageKey);
  }
}
