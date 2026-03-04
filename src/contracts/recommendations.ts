import { z } from "zod";

import { isoDateTimeSchema } from "@/contracts/common";

export const recommendationSourceSchema = z.enum(["MANUAL", "SYSTEM", "AI"]);

export const recommendationSurfaceSchema = z.enum(["HOME_COMMAND_CENTER", "TODAY", "SONGS", "LEARN"]);

export const recommendationKindSchema = z.enum(["NEXT_STEP", "DIAGNOSTIC", "GOAL_ACTION", "TODAY_FOCUS", "LEARN_CONTEXT"]);

export const recommendationEventTypeSchema = z.enum([
  "VIEWED",
  "CLICKED_PRIMARY",
  "CLICKED_SECONDARY",
  "DISMISSED",
  "APPLIED",
  "COMPLETED"
]);

export const nextStepOriginSchema = z.enum(["SONG_DETAIL", "MORNING_FOCUS", "WRAP_UP"]);

export const recommendationActionSchema = z.object({
  label: z.string().min(1),
  href: z.string().nullable().optional(),
  action: z.enum(["NAVIGATE", "APPLY", "DISMISS", "OPEN"]).optional(),
  payload: z.record(z.any()).optional()
});

export const futureAiSlotSchema = z.object({
  key: z.string().min(1),
  state: z.literal("EMPTY"),
  title: z.string().min(1),
  description: z.string().min(1)
});

export const recommendationEntityRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1)
});

export const nextStepRecommendationSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(160),
  reason: z.string().nullable(),
  source: recommendationSourceSchema,
  origin: nextStepOriginSchema,
  status: z.enum(["ACTIVE", "DONE", "CANCELED"]),
  createdAt: isoDateTimeSchema.nullable(),
  updatedAt: isoDateTimeSchema.nullable()
});

export const recommendationCardSchema = z.object({
  key: z.string().min(1),
  surface: recommendationSurfaceSchema,
  kind: recommendationKindSchema,
  source: recommendationSourceSchema,
  title: z.string().min(1),
  text: z.string().min(1),
  reason: z.string().nullable(),
  primaryAction: recommendationActionSchema.nullable(),
  secondaryActions: z.array(recommendationActionSchema).default([]),
  entityRef: recommendationEntityRefSchema.nullable(),
  futureAiSlot: futureAiSlotSchema.nullable()
});

export const recommendationEventInputSchema = z.object({
  recommendationKey: z.string().min(1),
  surface: recommendationSurfaceSchema,
  kind: recommendationKindSchema,
  eventType: recommendationEventTypeSchema,
  source: recommendationSourceSchema,
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  trackId: z.string().trim().min(1).optional(),
  goalId: z.string().trim().min(1).optional(),
  materialKey: z.string().trim().min(1).optional(),
  payload: z.record(z.any()).optional()
});

export const recommendationContextSchema = z.object({
  recommendationKey: z.string().min(1),
  surface: recommendationSurfaceSchema,
  kind: recommendationKindSchema,
  source: recommendationSourceSchema,
  payload: z.record(z.any()).optional()
});

export type RecommendationSource = z.infer<typeof recommendationSourceSchema>;
export type RecommendationSurface = z.infer<typeof recommendationSurfaceSchema>;
export type RecommendationKind = z.infer<typeof recommendationKindSchema>;
export type RecommendationEventType = z.infer<typeof recommendationEventTypeSchema>;
export type NextStepOrigin = z.infer<typeof nextStepOriginSchema>;
export type RecommendationAction = z.infer<typeof recommendationActionSchema>;
export type RecommendationCard = z.infer<typeof recommendationCardSchema>;
export type NextStepRecommendation = z.infer<typeof nextStepRecommendationSchema>;
export type RecommendationEventInput = z.infer<typeof recommendationEventInputSchema>;
export type RecommendationContext = z.infer<typeof recommendationContextSchema>;
