type AiLogEvent = {
  endpoint: string;
  requestId: string;
  userId: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  success: boolean;
  reason?: string;
  escalationLevel?: "NONE" | "SOFT_ALERT" | "URGENT_HELP";
  recommendationsCount?: number;
  stepsCount?: number;
};

export function logAiEvent(event: AiLogEvent) {
  console.info("[ai]", JSON.stringify(event));
}

