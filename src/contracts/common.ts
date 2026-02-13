import { z } from "zod";

export const isoDateTimeSchema = z.string().datetime();

export const pagingInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
});

export const pagingOutputSchema = z.object({
  nextCursor: z.string().optional(),
  hasMore: z.boolean()
});

export const actorSchema = z.object({
  userId: z.string().min(1),
  safeId: z.string().min(1)
});

export const priceRangeSchema = z
  .object({
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
    currency: z.string().min(1).default("RUB")
  })
  .refine((value) => value.max === undefined || value.min === undefined || value.max >= value.min, {
    message: "max must be greater than or equal to min"
  });

export const pathStageRefSchema = z.object({
  pathStageId: z.number().int().positive(),
  pathStageName: z.string().min(1)
});
