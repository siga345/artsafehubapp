"use client";

import { analyzeAudioBlobInBrowser, type AudioAnalysisResult } from "@/lib/audio/analysis";

export type UploadAudioAnalysisMeta = Pick<
  AudioAnalysisResult,
  "bpm" | "bpmConfidence" | "keyRoot" | "keyMode" | "keyConfidence" | "methodVersion"
>;

export async function detectAudioAnalysisMvp(blob: Blob): Promise<UploadAudioAnalysisMeta | null> {
  try {
    const result = await analyzeAudioBlobInBrowser(blob);
    if (result.bpm === null && (!result.keyRoot || !result.keyMode)) return null;
    return result;
  } catch (error) {
    console.warn("Audio analysis failed", error);
    return null;
  }
}

export function appendAudioAnalysisToFormData(formData: FormData, analysis: UploadAudioAnalysisMeta | null) {
  if (!analysis) return;
  if (analysis.bpm !== null) formData.append("analysisBpm", String(Math.round(analysis.bpm)));
  if (analysis.bpmConfidence !== null) formData.append("analysisBpmConfidence", String(analysis.bpmConfidence));
  if (analysis.keyRoot) formData.append("analysisKeyRoot", analysis.keyRoot);
  if (analysis.keyMode) formData.append("analysisKeyMode", analysis.keyMode);
  if (analysis.keyConfidence !== null) formData.append("analysisKeyConfidence", String(analysis.keyConfidence));
  formData.append("analysisSource", "AUTO");
  formData.append("analysisVersion", analysis.methodVersion);
}
