type AIOperation = "sendMessage" | "nextStep";

export function recordAiTelemetry(options: {
  operation: AIOperation;
  provider: string;
  durationMs: number;
  success: boolean;
  inputSize: number;
  outputSize: number;
}) {
  if (process.env.AI_TELEMETRY_ENABLED === "false") {
    return;
  }

  console.info(
    "[ai.telemetry]",
    JSON.stringify({
      at: new Date().toISOString(),
      operation: options.operation,
      provider: options.provider,
      durationMs: options.durationMs,
      success: options.success,
      inputSize: options.inputSize,
      outputSize: options.outputSize
    })
  );
}
