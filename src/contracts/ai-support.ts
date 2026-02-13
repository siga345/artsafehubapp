import { z } from "zod";

import { isoDateTimeSchema, pathStageRefSchema } from "@/contracts/common";

export const supportMoodSchema = z.enum(["NORMAL", "TOUGH", "FLYING"]);

export const aiSupportInputSchema = z.object({
  userId: z.string().min(1),
  mood: supportMoodSchema,
  note: z.string().max(1000).optional(),
  pathContext: pathStageRefSchema.optional(),
  recentActivityDays: z.number().int().min(0).max(7).optional()
});

export const supportEscalationSchema = z.object({
  level: z.enum(["NONE", "SOFT_ALERT", "URGENT_HELP"]),
  reason: z.string().max(400).optional(),
  resources: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().url()
    })
  )
});

export const aiSupportOutputSchema = z.object({
  requestId: z.string().min(1),
  generatedAt: isoDateTimeSchema,
  tone: z.enum(["CALM", "ENERGIZING", "GROUNDING"]),
  responseText: z.string().min(1).max(1200),
  suggestedSteps: z.array(z.string().min(1).max(200)).min(1).max(5),
  escalation: supportEscalationSchema
});

// Planned endpoint (contract only):
// POST /api/ai/support/respond
