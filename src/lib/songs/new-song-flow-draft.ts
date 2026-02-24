"use client";

export type NewSongFlowBranch = "TEXT_ONLY" | "NON_DEMO_UPLOAD" | "DEMO_UPLOAD" | "DEMO_RECORD" | null;

export type NewSongFlowDraft = {
  title: string;
  lyricsText: string;
  lyricsWasSkipped: boolean;
  selectedStageId: number | null;
  branch: NewSongFlowBranch;
  demoReadyFileMeta?: { name: string } | null;
  sourceContext: "songs-page" | "project-page";
  targetProject?: {
    id: string;
    title: string;
    folderId: string | null;
  } | null;
  createdAt: number;
};

const STORAGE_KEY = "songs:new-song-flow:draft:v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function saveNewSongFlowDraft(draft: NewSongFlowDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function loadNewSongFlowDraft(): NewSongFlowDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return null;
    if (typeof parsed.title !== "string") return null;
    if (typeof parsed.lyricsText !== "string") return null;
    if (typeof parsed.lyricsWasSkipped !== "boolean") return null;
    if (!(parsed.selectedStageId === null || typeof parsed.selectedStageId === "number")) return null;
    if (
      !(
        parsed.branch === null ||
        parsed.branch === "TEXT_ONLY" ||
        parsed.branch === "NON_DEMO_UPLOAD" ||
        parsed.branch === "DEMO_UPLOAD" ||
        parsed.branch === "DEMO_RECORD"
      )
    ) {
      return null;
    }
    if (!(parsed.sourceContext === "songs-page" || parsed.sourceContext === "project-page")) return null;
    if (typeof parsed.createdAt !== "number") return null;

    const demoReadyFileMeta = isObject(parsed.demoReadyFileMeta)
      ? { name: typeof parsed.demoReadyFileMeta.name === "string" ? parsed.demoReadyFileMeta.name : "" }
      : null;

    const targetProject =
      isObject(parsed.targetProject) &&
      typeof parsed.targetProject.id === "string" &&
      typeof parsed.targetProject.title === "string" &&
      (parsed.targetProject.folderId === null || typeof parsed.targetProject.folderId === "string")
        ? {
            id: parsed.targetProject.id,
            title: parsed.targetProject.title,
            folderId: parsed.targetProject.folderId
          }
        : null;

    return {
      title: parsed.title,
      lyricsText: parsed.lyricsText,
      lyricsWasSkipped: parsed.lyricsWasSkipped,
      selectedStageId: parsed.selectedStageId,
      branch: parsed.branch,
      demoReadyFileMeta,
      sourceContext: parsed.sourceContext,
      targetProject,
      createdAt: parsed.createdAt
    };
  } catch {
    return null;
  }
}

export function clearNewSongFlowDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
