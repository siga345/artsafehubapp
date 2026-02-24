import { getAiRuntimeConfig } from "@/lib/ai/config";
import { MockStructuredAiProvider } from "@/lib/ai/mock-structured-provider";

export type NavigationCandidateForAI = {
  specialistUserId: string;
  safeId: string;
  nickname: string;
  category: "PRODUCER" | "AUDIO_ENGINEER" | "RECORDING_STUDIO" | "PROMO_CREW";
  city?: string | null;
  isOnline: boolean;
  isAvailableNow: boolean;
  budgetFrom?: number | null;
  services: string[];
  credits: string[];
  heuristicScore: number;
};

export type NavigationProviderInput = {
  objective: string;
  pathContext: {
    pathStageId: number;
    pathStageName: string;
  };
  city?: string;
  preferRemote: boolean;
  topK: number;
  candidates: NavigationCandidateForAI[];
};

export type NavigationProviderDraft = {
  summary: string;
  nextActions: Array<{
    title: string;
    description: string;
    etaMinutes?: number;
  }>;
  rationalesBySpecialistId?: Record<string, string>;
};

export type SupportProviderInput = {
  mood: "NORMAL" | "TOUGH" | "FLYING";
  note?: string;
  pathContext?: {
    pathStageId: number;
    pathStageName: string;
  };
  recentActivityDays?: number;
  escalationLevel: "NONE" | "SOFT_ALERT" | "URGENT_HELP";
};

export type SupportProviderDraft = {
  tone: "CALM" | "ENERGIZING" | "GROUNDING";
  responseText: string;
  suggestedSteps: string[];
};

export interface StructuredAiProvider {
  readonly providerName: string;
  readonly navigationModel: string;
  readonly supportModel: string;
  suggestNavigation(input: NavigationProviderInput): Promise<NavigationProviderDraft>;
  respondSupport(input: SupportProviderInput): Promise<SupportProviderDraft>;
}

let cachedProvider: StructuredAiProvider | null = null;

export function getStructuredAiProvider(): StructuredAiProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const config = getAiRuntimeConfig();
  switch (config.provider) {
    case "mock":
    default:
      cachedProvider = new MockStructuredAiProvider(config.navigationModel, config.supportModel);
      return cachedProvider;
  }
}

