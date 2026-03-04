import { z } from "zod";

import { isoDateTimeSchema } from "@/contracts/common";

export const feedbackRequestTypeSchema = z.enum([
  "TEXT",
  "DEMO",
  "ARRANGEMENT",
  "GENERAL_IMPRESSION"
]);

export const feedbackRequestStatusSchema = z.enum([
  "PENDING",
  "RECEIVED",
  "REVIEWED"
]);

export const feedbackRecipientModeSchema = z.enum([
  "INTERNAL_USER",
  "EXTERNAL_CONTACT",
  "COMMUNITY"
]);

export const feedbackItemCategorySchema = z.enum([
  "WHAT_WORKS",
  "NOT_READING",
  "SAGS",
  "WANT_TO_HEAR_NEXT"
]);

export const feedbackResolutionStatusSchema = z.enum([
  "ACCEPTED",
  "REJECTED",
  "NEXT_VERSION"
]);

export const createFeedbackRequestInputSchema = z.object({
  type: feedbackRequestTypeSchema,
  demoId: z.string().min(1).optional(),
  recipientMode: feedbackRecipientModeSchema,
  recipientSafeId: z.string().min(1).optional(),
  recipientLabel: z.string().min(1).max(160).optional(),
  recipientChannel: z.string().max(120).optional().nullable(),
  recipientContact: z.string().max(240).optional().nullable(),
  requestMessage: z.string().max(2000).optional().nullable(),
  communityTitle: z.string().min(1).max(160).optional(),
  communityHelpfulActionPrompt: z.string().max(240).optional().nullable(),
  supportNeedTypes: z
    .array(z.enum(["FEEDBACK", "ACCOUNTABILITY", "CREATIVE_DIRECTION", "COLLABORATION"]))
    .max(4)
    .optional()
});

export const createFeedbackResponseInputSchema = z.object({
  sections: z.object({
    whatWorks: z.array(z.string().max(1000)).default([]),
    notReading: z.array(z.string().max(1000)).default([]),
    sags: z.array(z.string().max(1000)).default([]),
    wantToHearNext: z.array(z.string().max(1000)).default([])
  })
});

export const updateFeedbackResolutionInputSchema = z.object({
  status: feedbackResolutionStatusSchema,
  note: z.string().max(1000).optional().nullable(),
  targetDemoId: z.string().min(1).optional().nullable()
});

export const feedbackDemoRefSchema = z.object({
  id: z.string().min(1),
  versionType: z.string().min(1),
  createdAt: isoDateTimeSchema,
  releaseDate: z.string().nullable().optional()
});

export const feedbackResolutionSchema = z.object({
  id: z.string().min(1),
  status: feedbackResolutionStatusSchema,
  statusLabel: z.string().min(1),
  note: z.string().nullable(),
  resolvedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  targetDemo: feedbackDemoRefSchema.nullable()
});

export const feedbackItemSchema = z.object({
  id: z.string().min(1),
  category: feedbackItemCategorySchema,
  categoryLabel: z.string().min(1),
  body: z.string().min(1),
  source: z.string().min(1),
  author: z
    .object({
      userId: z.string().min(1),
      safeId: z.string().min(1),
      nickname: z.string().min(1)
    })
    .nullable()
    .optional(),
  sortIndex: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  resolution: feedbackResolutionSchema.nullable()
});

export const feedbackRequestRecipientSchema = z.object({
  mode: feedbackRecipientModeSchema,
  label: z.string().min(1),
  safeId: z.string().nullable(),
  nickname: z.string().nullable(),
  channel: z.string().nullable(),
  contact: z.string().nullable()
});

export const feedbackCommunityThreadSchema = z.object({
  postId: z.string().min(1),
  threadId: z.string().min(1),
  postKind: z.enum(["FEEDBACK_REQUEST"]),
  title: z.string().nullable(),
  helpfulActionPrompt: z.string().nullable(),
  supportNeedTypes: z.array(z.enum(["FEEDBACK", "ACCOUNTABILITY", "CREATIVE_DIRECTION", "COLLABORATION"])),
  status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]),
  replyCount: z.number().int().nonnegative()
});

export const trackFeedbackSummarySchema = z.object({
  latestStatus: feedbackRequestStatusSchema.nullable(),
  latestStatusLabel: z.string().nullable(),
  openRequestCount: z.number().int().nonnegative(),
  pendingRequestCount: z.number().int().nonnegative(),
  unresolvedItemsCount: z.number().int().nonnegative(),
  nextVersionItemsCount: z.number().int().nonnegative(),
  latestReceivedAt: isoDateTimeSchema.nullable(),
  latestReviewedAt: isoDateTimeSchema.nullable()
});

export const feedbackRequestSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  demoId: z.string().nullable(),
  type: feedbackRequestTypeSchema,
  typeLabel: z.string().min(1),
  status: feedbackRequestStatusSchema,
  statusLabel: z.string().min(1),
  recipient: feedbackRequestRecipientSchema,
  requestMessage: z.string().nullable(),
  lyricsSnapshot: z.string().nullable(),
  sentAt: isoDateTimeSchema,
  receivedAt: isoDateTimeSchema.nullable(),
  reviewedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  demoRef: feedbackDemoRefSchema.nullable(),
  community: feedbackCommunityThreadSchema.nullable().optional(),
  items: z.array(feedbackItemSchema),
  counts: z.object({
    totalItems: z.number().int().nonnegative(),
    resolvedItems: z.number().int().nonnegative(),
    nextVersionItems: z.number().int().nonnegative()
  })
});

export const feedbackRequestsListSchema = z.object({
  items: z.array(feedbackRequestSchema)
});

export const incomingFeedbackRequestSchema = feedbackRequestSchema.extend({
  requester: z.object({
    userId: z.string().min(1),
    safeId: z.string().min(1),
    nickname: z.string().min(1)
  }),
  track: z.object({
    id: z.string().min(1),
    title: z.string().min(1)
  })
});

export const incomingFeedbackRequestsListSchema = z.object({
  items: z.array(incomingFeedbackRequestSchema)
});

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
export type FeedbackRequestsList = z.infer<typeof feedbackRequestsListSchema>;
export type IncomingFeedbackRequest = z.infer<typeof incomingFeedbackRequestSchema>;
export type IncomingFeedbackRequestsList = z.infer<typeof incomingFeedbackRequestsListSchema>;
