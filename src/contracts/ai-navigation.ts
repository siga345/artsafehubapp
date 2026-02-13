import { z } from "zod";

import { isoDateTimeSchema, pathStageRefSchema, priceRangeSchema } from "@/contracts/common";

export const aiNavigationInputSchema = z.object({
  userId: z.string().min(1),
  objective: z.string().min(3).max(300),
  pathContext: pathStageRefSchema,
  trackId: z.string().optional(),
  city: z.string().max(120).optional(),
  preferRemote: z.boolean().default(true),
  budget: priceRangeSchema.optional(),
  topK: z.number().int().min(1).max(10).default(3)
});

export const specialistRecommendationSchema = z.object({
  specialistUserId: z.string().min(1),
  safeId: z.string().min(1),
  nickname: z.string().min(1),
  category: z.enum(["PRODUCER", "AUDIO_ENGINEER", "RECORDING_STUDIO", "PROMO_CREW"]),
  score: z.number().min(0).max(1),
  rationale: z.string().min(1).max(500),
  contactTelegram: z.string().url().optional(),
  contactUrl: z.string().url().optional()
});

export const aiNextActionSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
  etaMinutes: z.number().int().positive().optional()
});

export const aiNavigationOutputSchema = z.object({
  requestId: z.string().min(1),
  generatedAt: isoDateTimeSchema,
  summary: z.string().min(1).max(600),
  recommendations: z.array(specialistRecommendationSchema),
  nextActions: z.array(aiNextActionSchema).min(1).max(5)
});

// Planned endpoint (contract only):
// POST /api/ai/navigation/suggest
