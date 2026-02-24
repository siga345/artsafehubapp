import { FindCategory, type UserRole } from "@prisma/client";
import { z } from "zod";

import { aiNavigationInputSchema, aiNavigationOutputSchema } from "@/contracts/ai-navigation";
import { apiError } from "@/lib/api";
import {
  getStructuredAiProvider,
  type NavigationCandidateForAI,
  type NavigationProviderDraft
} from "@/lib/ai/provider";
import { logAiEvent } from "@/lib/ai/logger";
import { prisma } from "@/lib/prisma";

type NavigationInput = z.output<typeof aiNavigationInputSchema>;

type Actor = {
  id: string;
  role: UserRole;
};

const categoryHints: Array<{ category: FindCategory; patterns: RegExp[] }> = [
  { category: "PRODUCER", patterns: [/\b(продюсер|producer|аранж|arrangement)\b/i] },
  { category: "AUDIO_ENGINEER", patterns: [/\b(сведен|микс|mix|master|mastering|звукореж)\b/i] },
  { category: "RECORDING_STUDIO", patterns: [/\b(студи|recording|запись вокала|вокал)\b/i] },
  { category: "PROMO_CREW", patterns: [/\b(промо|promo|маркетинг|релиз|smm|pr)\b/i] }
];

function inferCategoriesFromObjective(objective: string): FindCategory[] {
  const matched = categoryHints.filter((hint) => hint.patterns.some((pattern) => pattern.test(objective)));
  return matched.map((hint) => hint.category);
}

function normalizeUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const normalized = new URL(value).toString();
    return normalized;
  } catch {
    return undefined;
  }
}

function normalizeTelegramUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw)) {
    return normalizeUrl(raw);
  }

  if (raw.startsWith("@")) {
    return `https://t.me/${raw.slice(1)}`;
  }

  if (/^[A-Za-z0-9_]{5,32}$/.test(raw)) {
    return `https://t.me/${raw}`;
  }

  return undefined;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function scoreCandidate(input: NavigationInput, candidate: NavigationCandidateForAI): number {
  let score = 0.2;
  const inferredCategories = inferCategoriesFromObjective(input.objective);

  if (inferredCategories.length === 0 || inferredCategories.includes(candidate.category as FindCategory)) {
    score += 0.25;
  }

  if (candidate.isAvailableNow) {
    score += 0.2;
  }

  if (candidate.isOnline && input.preferRemote) {
    score += 0.15;
  }

  if (input.city && candidate.city && candidate.city.toLowerCase().includes(input.city.toLowerCase())) {
    score += 0.15;
  }

  const userBudgetMax = input.budget?.max;
  if (userBudgetMax !== undefined) {
    if (candidate.budgetFrom === null || candidate.budgetFrom === undefined) {
      score += 0.05;
    } else if (candidate.budgetFrom <= userBudgetMax) {
      score += 0.15;
    } else {
      score -= 0.1;
    }
  }

  if (candidate.services.length > 0) {
    score += 0.05;
  }

  return clampScore(score);
}

function buildFallbackNavigationDraft(
  input: NavigationInput,
  candidates: NavigationCandidateForAI[]
): NavigationProviderDraft {
  const picked = candidates.slice(0, input.topK);
  return {
    summary:
      picked.length > 0
        ? `Найдено ${picked.length} кандидата(ов) по фильтрам. Рекомендуется начать с короткого запроса и актуального демо.`
        : "По текущим фильтрам кандидаты не найдены. Попробуйте расширить параметры поиска.",
    nextActions: [
      {
        title: "Уточни задачу",
        description: "Опиши желаемый результат, срок и формат работы.",
        etaMinutes: 10
      },
      {
        title: "Подготовь материал",
        description: "Выбери демо и добавь заметку, что именно нужно улучшить.",
        etaMinutes: 15
      },
      {
        title: "Свяжись с кандидатами",
        description: "Напиши 2-3 специалистам и сравни ответы по срокам и условиям.",
        etaMinutes: 20
      }
    ],
    rationalesBySpecialistId: Object.fromEntries(
      picked.map((candidate) => [
        candidate.specialistUserId,
        `${candidate.nickname} отобран по совпадению фильтров и базовой релевантности задаче.`
      ])
    )
  };
}

type NavigationCandidateLoaded = NavigationCandidateForAI & {
  _contactTelegramRaw?: string | null;
  _contactUrlRaw?: string | null;
};

async function loadCandidates(input: NavigationInput): Promise<NavigationCandidateLoaded[]> {
  const inferredCategories = inferCategoriesFromObjective(input.objective);

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { specialistProfile: { isNot: null } },
        ...(inferredCategories.length > 0 ? [{ specialistProfile: { is: { category: { in: inferredCategories } } } }] : [])
      ]
    },
    select: {
      id: true,
      safeId: true,
      nickname: true,
      specialistProfile: {
        select: {
          category: true,
          city: true,
          isOnline: true,
          isAvailableNow: true,
          budgetFrom: true,
          services: true,
          credits: true,
          contactTelegram: true,
          contactUrl: true
        }
      }
    },
    take: 50,
    orderBy: { updatedAt: "desc" }
  });

  const normalized = users
    .map((user) => {
      const profile = user.specialistProfile;
      if (!profile) return null;

      if (input.city && !input.preferRemote) {
        const cityMatches = profile.city?.toLowerCase().includes(input.city.toLowerCase()) ?? false;
        if (!cityMatches) return null;
      }

      if (input.budget?.max !== undefined && profile.budgetFrom !== null && profile.budgetFrom > input.budget.max) {
        return null;
      }

      return {
        specialistUserId: user.id,
        safeId: user.safeId,
        nickname: user.nickname,
        category: profile.category,
        city: profile.city,
        isOnline: profile.isOnline,
        isAvailableNow: profile.isAvailableNow,
        budgetFrom: profile.budgetFrom,
        services: profile.services ?? [],
        credits: profile.credits ?? [],
        heuristicScore: 0,
        _contactTelegramRaw: profile.contactTelegram,
        _contactUrlRaw: profile.contactUrl
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  return normalized
    .map((candidate) => ({
      ...candidate,
      heuristicScore: scoreCandidate(input, candidate)
    }))
    .sort((a, b) => b.heuristicScore - a.heuristicScore || a.nickname.localeCompare(b.nickname));
}

export async function suggestAiNavigation(input: NavigationInput, actor: Actor) {
  if (input.userId !== actor.id && !["me", "self", "__session__"].includes(input.userId)) {
    throw apiError(403, "userId does not match session");
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const provider = getStructuredAiProvider();

  const candidatesWithRawContacts = await loadCandidates(input);
  const topCandidates = candidatesWithRawContacts.slice(0, input.topK);

  let draft: NavigationProviderDraft = buildFallbackNavigationDraft(input, topCandidates);
  let providerReason = "fallback_only";
  let success = true;

  try {
    if (topCandidates.length > 0) {
      draft = await provider.suggestNavigation({
        objective: input.objective,
        pathContext: input.pathContext,
        city: input.city,
        preferRemote: input.preferRemote,
        topK: input.topK,
        candidates: topCandidates
      });
      providerReason = "provider_ok";
    }
  } catch (error) {
    success = false;
    providerReason = error instanceof Error ? error.message : "provider_error";
  }

  const response = aiNavigationOutputSchema.parse({
    requestId,
    generatedAt: new Date().toISOString(),
    summary: draft.summary,
    recommendations: topCandidates.map((candidate) => ({
      specialistUserId: candidate.specialistUserId,
      safeId: candidate.safeId,
      nickname: candidate.nickname,
      category: candidate.category,
      score: clampScore(candidate.heuristicScore),
      rationale:
        draft.rationalesBySpecialistId?.[candidate.specialistUserId] ??
        `${candidate.nickname} совпадает с частью ваших фильтров и может подойти для следующего шага.`,
      contactTelegram: normalizeTelegramUrl(candidate._contactTelegramRaw),
      contactUrl: normalizeUrl(candidate._contactUrlRaw)
    })),
    nextActions: draft.nextActions.slice(0, 5)
  });

  logAiEvent({
    endpoint: "ai/navigation/suggest",
    requestId,
    userId: actor.id,
    provider: provider.providerName,
    model: provider.navigationModel,
    latencyMs: Date.now() - startedAt,
    success,
    reason: providerReason,
    recommendationsCount: response.recommendations.length,
    stepsCount: response.nextActions.length
  });

  return response;
}
