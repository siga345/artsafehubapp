import { z } from "zod";

export const songSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  status: z.string(),
  bpm: z.number().int().optional().nullable(),
  key: z.string().optional().nullable()
});

export const ideaSchema = z.object({
  title: z.string().min(1),
  text: z.string().default(""),
  tags: z.array(z.string()).default([])
});

export const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  status: z.string(),
  dueDate: z.string().datetime().optional().nullable(),
  songId: z.string().optional().nullable(),
  pathLevelId: z.number().optional().nullable()
});

export const pathLogSchema = z.object({
  type: z.string(),
  text: z.string().min(1)
});

export const pathLevelSchema = z.object({
  order: z.number().int(),
  name: z.string().min(1),
  description: z.string().min(1),
  criteria: z.record(z.any()).default({}),
  checklistTemplate: z.record(z.any()).default({})
});

export const bookingSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  status: z.string(),
  notes: z.string().default("")
});

export const learningItemSchema = z.object({
  type: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  tags: z.array(z.string()).default([]),
  pathLevelIds: z.array(z.number()).default([]),
  songStatuses: z.array(z.string()).default([])
});

export const budgetItemSchema = z.object({
  songId: z.string().min(1),
  category: z.string(),
  amount: z.number(),
  currency: z.string().default(\"RUB\"),
  note: z.string().default(\"\")
});

export const assistantMessageSchema = z.object({
  message: z.string().min(1),
  songStatus: z.string().optional().nullable(),
  taskCount: z.number().optional().nullable(),
  pathLevelName: z.string().optional().nullable()
});

export const assistantNextStepSchema = z.object({
  songStatus: z.string().optional().nullable(),
  taskCount: z.number().optional().nullable(),
  pathLevelName: z.string().optional().nullable()
});
