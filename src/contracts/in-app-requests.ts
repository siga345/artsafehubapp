import { z } from "zod";

import { actorSchema, isoDateTimeSchema, pagingInputSchema, pagingOutputSchema, pathStageRefSchema, priceRangeSchema } from "@/contracts/common";

export const requestTypeSchema = z.enum([
  "PRODUCTION",
  "MIX_MASTER",
  "STUDIO_SESSION",
  "PROMO_PRODUCTION"
]);

export const requestStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "VIEWED",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
  "ARCHIVED"
]);

export const createRequestSchema = z.object({
  type: requestTypeSchema,
  specialistUserId: z.string().min(1),
  trackId: z.string().optional(),
  pathContext: pathStageRefSchema.optional(),
  brief: z.string().min(10).max(3000),
  budget: priceRangeSchema.optional(),
  preferredStartAt: isoDateTimeSchema.optional(),
  city: z.string().max(120).optional(),
  isRemote: z.boolean().default(true)
});

export const requestCardSchema = z.object({
  id: z.string().min(1),
  type: requestTypeSchema,
  status: requestStatusSchema,
  artist: actorSchema,
  specialist: actorSchema,
  trackId: z.string().optional(),
  pathContext: pathStageRefSchema.optional(),
  brief: z.string().min(1),
  budget: priceRangeSchema.optional(),
  preferredStartAt: isoDateTimeSchema.optional(),
  city: z.string().optional(),
  isRemote: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const requestActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("MARK_VIEWED") }),
  z.object({ action: z.literal("ACCEPT"), comment: z.string().max(1000).optional() }),
  z.object({ action: z.literal("DECLINE"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("CANCEL"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("ARCHIVE") })
]);

export const requestsListInputSchema = z
  .object({
    role: z.enum(["ARTIST", "SPECIALIST"]).default("ARTIST"),
    status: requestStatusSchema.optional(),
    specialistUserId: z.string().optional(),
    trackId: z.string().optional()
  })
  .merge(pagingInputSchema);

export const requestsListOutputSchema = z.object({
  items: z.array(requestCardSchema),
  paging: pagingOutputSchema
});

// Planned endpoints (contract only):
// POST   /api/requests
// GET    /api/requests
// GET    /api/requests/:id
// PATCH  /api/requests/:id/action
