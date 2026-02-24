export type AiRuntimeConfig = {
  enabled: boolean;
  provider: string;
  timeoutMs: number;
  navigationModel: string;
  supportModel: string;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAiRuntimeConfig(): AiRuntimeConfig {
  return {
    enabled: process.env.AI_ASSIST_ENABLED === "true",
    provider: (process.env.AI_PROVIDER ?? "mock").toLowerCase(),
    timeoutMs: parsePositiveInt(process.env.AI_REQUEST_TIMEOUT_MS, 8000),
    navigationModel: process.env.AI_MODEL_NAVIGATION ?? "mock-navigation-v1",
    supportModel: process.env.AI_MODEL_SUPPORT ?? "mock-support-v1"
  };
}

