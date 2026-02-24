import type { UserRole } from "@prisma/client";
import { z } from "zod";

import { aiSupportInputSchema, aiSupportOutputSchema } from "@/contracts/ai-support";
import { apiError } from "@/lib/api";
import { getStructuredAiProvider } from "@/lib/ai/provider";
import { getResourcesForEscalation } from "@/lib/ai/resources";
import { detectSupportEscalation, isUnsafeSupportResponseText } from "@/lib/ai/safety";
import { logAiEvent } from "@/lib/ai/logger";
import { prisma } from "@/lib/prisma";

type SupportInput = z.output<typeof aiSupportInputSchema>;

type Actor = {
  id: string;
  role: UserRole;
};

function getToneFallback(mood: SupportInput["mood"]) {
  if (mood === "FLYING") return "ENERGIZING" as const;
  if (mood === "TOUGH") return "CALM" as const;
  return "GROUNDING" as const;
}

function buildSupportFallback(input: SupportInput, escalationLevel: "NONE" | "SOFT_ALERT" | "URGENT_HELP") {
  if (escalationLevel === "URGENT_HELP") {
    return {
      tone: "GROUNDING" as const,
      responseText:
        "Сейчас приоритет — безопасность и контакт с живым человеком. Пожалуйста, обратись к близкому человеку или срочной помощи в твоей стране прямо сейчас.",
      suggestedSteps: [
        "Свяжись с человеком, которому доверяешь",
        "Используй один контакт из списка ресурсов",
        "Сделай паузу и не оставайся один(одна)"
      ]
    };
  }

  return {
    tone: getToneFallback(input.mood),
    responseText:
      input.mood === "TOUGH"
        ? "День может быть тяжелым. Давай сузим фокус до одного небольшого действия, которое реально сделать сегодня."
        : input.mood === "FLYING"
          ? "Хороший импульс лучше сразу закрепить действием. Выбери один конкретный шаг и доведи его до результата."
          : "Сохраняй ровный темп: один понятный шаг по музыке сегодня лучше, чем большой план без выполнения.",
    suggestedSteps:
      input.mood === "TOUGH"
        ? ["Сделай паузу 5 минут", "Выбери один микро-шаг", "Отметь прогресс после выполнения"]
        : input.mood === "FLYING"
          ? ["Зафиксируй цель на сегодня", "Сделай 25 минут фокус-работы", "Отправь результат на фидбек"]
          : ["Открой текущий трек", "Сделай одну правку", "Запиши короткую заметку о результате"]
  };
}

async function resolvePathContext(input: SupportInput, userId: string) {
  if (input.pathContext) {
    return input.pathContext;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pathStage: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!user?.pathStage) {
    return undefined;
  }

  return {
    pathStageId: user.pathStage.id,
    pathStageName: user.pathStage.name
  };
}

async function resolveRecentActivityDays(input: SupportInput, userId: string) {
  if (input.recentActivityDays !== undefined) {
    return input.recentActivityDays;
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = today.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(today);
  weekStartDate.setUTCDate(today.getUTCDate() + mondayOffset);

  const weekly = await prisma.weeklyActivity.findUnique({
    where: {
      userId_weekStartDate: {
        userId,
        weekStartDate
      }
    },
    select: { activeDays: true }
  });

  return Math.max(0, Math.min(7, weekly?.activeDays ?? 0));
}

export async function respondAiSupport(input: SupportInput, actor: Actor) {
  if (input.userId !== actor.id && !["me", "self", "__session__"].includes(input.userId)) {
    throw apiError(403, "userId does not match session");
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const provider = getStructuredAiProvider();

  const preEscalation = detectSupportEscalation(input.note);
  const pathContext = await resolvePathContext(input, actor.id);
  const recentActivityDays = await resolveRecentActivityDays(input, actor.id);

  let draft = buildSupportFallback(input, preEscalation.level);
  let success = true;
  let providerReason = "fallback_only";

  try {
    if (preEscalation.level !== "URGENT_HELP") {
      const providerDraft = await provider.respondSupport({
        mood: input.mood,
        note: input.note,
        pathContext,
        recentActivityDays,
        escalationLevel: preEscalation.level
      });

      if (isUnsafeSupportResponseText(providerDraft.responseText)) {
        providerReason = "provider_unsafe_output";
        success = false;
      } else {
        draft = providerDraft;
        providerReason = "provider_ok";
      }
    }
  } catch (error) {
    success = false;
    providerReason = error instanceof Error ? error.message : "provider_error";
  }

  const response = aiSupportOutputSchema.parse({
    requestId,
    generatedAt: new Date().toISOString(),
    tone: draft.tone,
    responseText: draft.responseText,
    suggestedSteps: draft.suggestedSteps.slice(0, 5),
    escalation: {
      level: preEscalation.level,
      reason: preEscalation.reason,
      resources: getResourcesForEscalation(preEscalation.level)
    }
  });

  logAiEvent({
    endpoint: "ai/support/respond",
    requestId,
    userId: actor.id,
    provider: provider.providerName,
    model: provider.supportModel,
    latencyMs: Date.now() - startedAt,
    success,
    reason: providerReason,
    escalationLevel: response.escalation.level,
    stepsCount: response.suggestedSteps.length
  });

  return response;
}
