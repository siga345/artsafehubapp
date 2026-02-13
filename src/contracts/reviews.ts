import { z } from "zod";

import { actorSchema, isoDateTimeSchema, pagingInputSchema, pagingOutputSchema } from "@/contracts/common";

export const reviewModerationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const reviewTagSchema = z.enum([
  "FAST_RESPONSE",
  "CLEAR_COMMUNICATION",
  "GOOD_QUALITY",
  "ON_TIME",
  "BUDGET_OK",
  "NEEDS_ATTENTION"
]);

export const createReviewSchema = z.object({
  requestId: z.string().min(1),
  specialistUserId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(5).max(2000),
  tags: z.array(reviewTagSchema).max(8).default([])
});

export const reviewItemSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  specialistUserId: z.string().min(1),
  author: actorSchema,
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  tags: z.array(reviewTagSchema),
  moderationStatus: reviewModerationStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const listReviewsInputSchema = z
  .object({
    specialistUserId: z.string().min(1),
    ratingMin: z.number().int().min(1).max(5).optional()
  })
  .merge(pagingInputSchema);

export const listReviewsOutputSchema = z.object({
  items: z.array(reviewItemSchema),
  paging: pagingOutputSchema,
  summary: z.object({
    averageRating: z.number().min(0).max(5),
    ratingsCount: z.number().int().nonnegative()
  })
});

// Planned endpoints (contract only):
// POST /api/reviews
// GET  /api/reviews?specialistUserId=...
// PATCH /api/reviews/:id/moderation
