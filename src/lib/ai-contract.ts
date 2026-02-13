export type SongStatus =
  | "IDEA_DEMO"
  | "WRITING"
  | "ARRANGEMENT"
  | "RECORDING"
  | "MIXING"
  | "MASTERING"
  | "READY_FOR_RELEASE"
  | "RELEASED"
  | "ARCHIVED";

export interface AIProvider {
  sendMessage(input: {
    message: string;
    songStatus?: SongStatus | null;
    taskCount?: number;
    pathLevelName?: string | null;
  }): Promise<{ reply: string }>;
  nextStep(input: {
    songStatus?: SongStatus | null;
    taskCount?: number;
    pathLevelName?: string | null;
  }): Promise<{ nextStep: string }>;
}
