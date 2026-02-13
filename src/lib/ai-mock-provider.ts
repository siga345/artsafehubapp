import { type AIProvider, type SongStatus } from "@/lib/ai-contract";

export class MockAIProvider implements AIProvider {
  async sendMessage(input: {
    message: string;
    songStatus?: SongStatus | null;
    taskCount?: number;
    pathLevelName?: string | null;
  }) {
    const status = input.songStatus ?? "IDEA_DEMO";
    const pathLevel = input.pathLevelName ?? "your current PATH";
    const taskCount = input.taskCount ?? 0;

    return {
      reply: `Mock AI: For ${status} in ${pathLevel}, focus on one clear outcome today. You currently have ${taskCount} active tasks. Start by clarifying the next lyric or arrangement milestone.`
    };
  }

  async nextStep(input: {
    songStatus?: SongStatus | null;
    taskCount?: number;
    pathLevelName?: string | null;
  }) {
    const status = input.songStatus ?? "IDEA_DEMO";
    const taskCount = input.taskCount ?? 0;
    const action = taskCount > 0 ? "complete the top priority task" : "create a focused task";

    return {
      nextStep: `Mock AI next step for ${status}: ${action} and log a short PATH note.`
    };
  }
}
