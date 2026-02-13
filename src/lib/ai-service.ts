import { AIProvider } from "@/lib/ai-contract";
import { MockAIProvider } from "@/lib/ai-mock-provider";
import { recordAiTelemetry } from "@/lib/ai-telemetry";

function createProvider(): { name: string; provider: AIProvider } {
  const selected = process.env.AI_PROVIDER?.toLowerCase() ?? "mock";

  if (selected === "mock") {
    return { name: "mock", provider: new MockAIProvider() };
  }

  return { name: "mock", provider: new MockAIProvider() };
}

function withTelemetry(name: string, provider: AIProvider): AIProvider {
  return {
    async sendMessage(input) {
      const startedAt = Date.now();
      try {
        const result = await provider.sendMessage(input);
        recordAiTelemetry({
          operation: "sendMessage",
          provider: name,
          durationMs: Date.now() - startedAt,
          success: true,
          inputSize: input.message.length,
          outputSize: result.reply.length
        });
        return result;
      } catch (error) {
        recordAiTelemetry({
          operation: "sendMessage",
          provider: name,
          durationMs: Date.now() - startedAt,
          success: false,
          inputSize: input.message.length,
          outputSize: 0
        });
        throw error;
      }
    },
    async nextStep(input) {
      const startedAt = Date.now();
      try {
        const result = await provider.nextStep(input);
        recordAiTelemetry({
          operation: "nextStep",
          provider: name,
          durationMs: Date.now() - startedAt,
          success: true,
          inputSize: JSON.stringify(input).length,
          outputSize: result.nextStep.length
        });
        return result;
      } catch (error) {
        recordAiTelemetry({
          operation: "nextStep",
          provider: name,
          durationMs: Date.now() - startedAt,
          success: false,
          inputSize: JSON.stringify(input).length,
          outputSize: 0
        });
        throw error;
      }
    }
  };
}

const { name, provider } = createProvider();

export const aiProvider = withTelemetry(name, provider);
