import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";
import type { RecommendationContext } from "@/contracts/recommendations";
import type { LearnContextBlock, LearnMaterialProgressState, LearnSurface } from "@/lib/learn/types";

type LearnClientProgressAction =
  | { action: "OPEN" | "LATER" | "NOT_RELEVANT"; surface: "LEARN" | LearnSurface; recommendationContext?: RecommendationContext }
  | {
      action: "APPLY";
      surface: "LEARN" | LearnSurface;
      targetType: "TRACK" | "GOAL";
      targetId: string;
      recommendationContext?: RecommendationContext;
    };

export async function postLearnProgress(
  slug: string,
  body: LearnClientProgressAction
): Promise<{ progress: LearnMaterialProgressState }> {
  const response = await apiFetch(`/api/learn/materials/${slug}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, "Не удалось обновить статус материала."));
  }

  return response.json() as Promise<{ progress: LearnMaterialProgressState }>;
}

export async function fetchLearnContext(
  input: {
    surface: LearnSurface;
    goalId?: string | null;
    limit?: number;
  }
): Promise<LearnContextBlock> {
  const params = new URLSearchParams({
    surface: input.surface
  });
  if (input.goalId) params.set("goalId", input.goalId);
  if (typeof input.limit === "number") params.set("limit", String(input.limit));

  return apiFetchJson<LearnContextBlock>(`/api/learn/context?${params.toString()}`);
}
