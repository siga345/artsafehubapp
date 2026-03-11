import { z } from "zod";

import { isoDateTimeSchema, pagingOutputSchema } from "@/contracts/common";

export const communityFeedFilterSchema = z.enum(["forYou", "all"]);
export type CommunityFeedFilter = z.infer<typeof communityFeedFilterSchema>;

export const communityFeedKindSchema = z.enum(["all", "feedback", "progress", "question", "general"]);
export type CommunityFeedKind = z.infer<typeof communityFeedKindSchema>;

export const friendshipRelationshipStateSchema = z.enum([
  "NONE",
  "OUTGOING_PENDING",
  "INCOMING_PENDING",
  "FRIENDS"
]);
export type FriendshipRelationshipState = z.infer<typeof friendshipRelationshipStateSchema>;

export const communityRoleBadgeSchema = z.enum(["ARTIST", "SPECIALIST", "STUDIO", "ADMIN"]);
export type CommunityRoleBadge = z.infer<typeof communityRoleBadgeSchema>;

export const communityLikeTargetTypeSchema = z.enum(["POST", "ACHIEVEMENT", "EVENT"]);
export type CommunityLikeTargetType = z.infer<typeof communityLikeTargetTypeSchema>;

export const communityFeedItemTypeSchema = z.enum(["POST", "ACHIEVEMENT", "EVENT"]);
export type CommunityFeedItemType = z.infer<typeof communityFeedItemTypeSchema>;

export const communityPostKindSchema = z.enum(["PROGRESS", "FEEDBACK_REQUEST", "CREATIVE_QUESTION", "GENERAL"]);
export type CommunityPostKind = z.infer<typeof communityPostKindSchema>;

export const communityHelpfulActionTypeSchema = z.enum(["I_CAN_HELP", "I_RELATED", "KEEP_GOING"]);
export type CommunityHelpfulActionType = z.infer<typeof communityHelpfulActionTypeSchema>;

export const artistSupportNeedTypeSchema = z.enum([
  "FEEDBACK",
  "ACCOUNTABILITY",
  "CREATIVE_DIRECTION",
  "COLLABORATION"
]);
export type ArtistSupportNeedType = z.infer<typeof artistSupportNeedTypeSchema>;

export const communityFeedbackThreadStatusSchema = z.enum(["OPEN", "CLOSED", "ARCHIVED"]);
export type CommunityFeedbackThreadStatus = z.infer<typeof communityFeedbackThreadStatusSchema>;

export const communityAchievementTypeSchema = z.enum([
  "PATH_STAGE_REACHED",
  "TRACK_CREATED",
  "DEMO_UPLOADED",
  "REQUEST_SUBMITTED",
  "RELEASE_READY",
  "TRACK_RETURNED",
  "DEMO_COMPLETED",
  "FEEDBACK_REQUESTED",
  "ARTIST_HELPED"
]);
export type CommunityAchievementType = z.infer<typeof communityAchievementTypeSchema>;

export const communityActorSchema = z.object({
  userId: z.string().min(1),
  safeId: z.string().min(1),
  nickname: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
  role: communityRoleBadgeSchema,
  pathStageName: z.string().nullable().optional()
});
export type CommunityActorDto = z.infer<typeof communityActorSchema>;

export const communityLikeSummarySchema = z.object({
  targetType: communityLikeTargetTypeSchema,
  targetId: z.string().min(1),
  count: z.number().int().nonnegative()
});
export type CommunityLikeSummaryDto = z.infer<typeof communityLikeSummarySchema>;

export const friendshipStateSchema = z.object({
  friendshipId: z.string().nullable(),
  state: friendshipRelationshipStateSchema,
  requestedByViewer: z.boolean(),
  canSendRequest: z.boolean(),
  canAccept: z.boolean(),
  canDecline: z.boolean(),
  canCancel: z.boolean(),
  canRemove: z.boolean()
});
export type FriendshipStateDto = z.infer<typeof friendshipStateSchema>;

export const featuredCreatorCardSchema = z.object({
  userId: z.string().min(1),
  safeId: z.string().min(1),
  nickname: z.string().min(1),
  avatarUrl: z.string().nullable(),
  role: communityRoleBadgeSchema,
  pathStageName: z.string().nullable(),
  identityStatement: z.string().nullable(),
  reason: z.string().nullable(),
  friendship: friendshipStateSchema
});
export type FeaturedCreatorCardDto = z.infer<typeof featuredCreatorCardSchema>;

export const communityTrackRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  pathStageName: z.string().nullable().optional(),
  workbenchState: z.string().nullable().optional(),
  workbenchStateLabel: z.string().nullable().optional(),
  href: z.string().min(1)
});
export type CommunityTrackRefDto = z.infer<typeof communityTrackRefSchema>;

export const communityDemoRefSchema = z.object({
  id: z.string().min(1),
  versionType: z.string().min(1),
  createdAt: isoDateTimeSchema,
  releaseDate: z.string().nullable().optional()
});
export type CommunityDemoRefDto = z.infer<typeof communityDemoRefSchema>;

export const communityHelpfulInteractionSummarySchema = z.object({
  totalReplies: z.number().int().nonnegative(),
  replyPreviewCount: z.number().int().nonnegative(),
  actionCounts: z.object({
    I_CAN_HELP: z.number().int().nonnegative(),
    I_RELATED: z.number().int().nonnegative(),
    KEEP_GOING: z.number().int().nonnegative()
  }),
  latestReplyAuthors: z.array(z.string())
});
export type CommunityHelpfulInteractionSummaryDto = z.infer<typeof communityHelpfulInteractionSummarySchema>;

export const communityFeedbackReplyItemSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["WHAT_WORKS", "NOT_READING", "SAGS", "WANT_TO_HEAR_NEXT"]),
  categoryLabel: z.string().min(1),
  body: z.string().min(1),
  sortIndex: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema
});
export type CommunityFeedbackReplyItemDto = z.infer<typeof communityFeedbackReplyItemSchema>;

export const communityFeedbackReplySchema = z.object({
  id: z.string().min(1),
  author: communityActorSchema,
  helpfulActionType: communityHelpfulActionTypeSchema,
  comment: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  items: z.array(communityFeedbackReplyItemSchema)
});
export type CommunityFeedbackReplyDto = z.infer<typeof communityFeedbackReplySchema>;

export const communityFeedbackThreadSchema = z.object({
  id: z.string().min(1),
  status: communityFeedbackThreadStatusSchema,
  replyCount: z.number().int().nonnegative(),
  lastReplyAt: isoDateTimeSchema.nullable(),
  helpfulInteractionSummary: communityHelpfulInteractionSummarySchema,
  repliesPreview: z.array(communityFeedbackReplySchema)
});
export type CommunityFeedbackThreadDto = z.infer<typeof communityFeedbackThreadSchema>;

export const communityFeedbackRequestRefSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["TEXT", "DEMO", "ARRANGEMENT", "GENERAL_IMPRESSION"]),
  typeLabel: z.string().min(1),
  status: z.enum(["PENDING", "RECEIVED", "REVIEWED"]),
  statusLabel: z.string().min(1),
  supportNeedTypes: z.array(artistSupportNeedTypeSchema),
  helpfulActionPrompt: z.string().nullable(),
  thread: communityFeedbackThreadSchema.nullable()
});
export type CommunityFeedbackRequestRefDto = z.infer<typeof communityFeedbackRequestRefSchema>;

export const communityPostContentSchema = z.object({
  type: z.literal("POST"),
  postKind: communityPostKindSchema,
  title: z.string().nullable(),
  text: z.string().min(1).max(2800),
  trackRef: communityTrackRefSchema.nullable().optional(),
  demoRef: communityDemoRefSchema.nullable().optional(),
  feedbackRequestRef: communityFeedbackRequestRefSchema.nullable().optional(),
  helpfulInteractionSummary: communityHelpfulInteractionSummarySchema.nullable().optional(),
  replyPreviewCount: z.number().int().nonnegative()
});
export type CommunityPostDto = z.infer<typeof communityPostContentSchema>;

export const communityAchievementContentSchema = z.object({
  type: z.literal("ACHIEVEMENT"),
  achievementType: communityAchievementTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
});
export type CommunityAchievementDto = z.infer<typeof communityAchievementContentSchema>;

export const communityEventContentSchema = z.object({
  type: z.literal("EVENT"),
  title: z.string().min(1),
  description: z.string().min(1),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable().optional(),
  city: z.string().nullable(),
  isOnline: z.boolean(),
  hostLabel: z.string().min(1),
  slug: z.string().min(1),
  coverImageUrl: z.string().nullable().optional(),
  attendeeCount: z.number().int().nonnegative(),
  viewerIsAttending: z.boolean()
});
export type CommunityEventDto = z.infer<typeof communityEventContentSchema>;

export const communityFeedItemSchema = z.object({
  id: z.string().min(1),
  type: communityFeedItemTypeSchema,
  createdAt: isoDateTimeSchema,
  author: communityActorSchema,
  isFriendAuthor: z.boolean(),
  likeSummary: communityLikeSummarySchema,
  viewerHasLiked: z.boolean(),
  rankingReason: z.string().optional(),
  content: z.discriminatedUnion("type", [
    communityPostContentSchema,
    communityAchievementContentSchema,
    communityEventContentSchema
  ])
});
export type CommunityFeedItemDto = z.infer<typeof communityFeedItemSchema>;

export const communityEventCardSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  city: z.string().nullable(),
  isOnline: z.boolean(),
  hostLabel: z.string().min(1),
  coverImageUrl: z.string().nullable(),
  attendeeCount: z.number().int().nonnegative(),
  viewerIsAttending: z.boolean(),
  likeSummary: communityLikeSummarySchema,
  viewerHasLiked: z.boolean()
});
export type CommunityEventCardDto = z.infer<typeof communityEventCardSchema>;

export const communityArtistSupportProfileSchema = z.object({
  currentFocusTitle: z.string().nullable(),
  currentFocusDetail: z.string().nullable(),
  seekingSupportDetail: z.string().nullable(),
  supportNeedTypes: z.array(artistSupportNeedTypeSchema)
});
export type CommunityArtistSupportProfileDto = z.infer<typeof communityArtistSupportProfileSchema>;

export const communityArtistFocusSchema = z.object({
  track: communityTrackRefSchema.nullable(),
  nextStepTitle: z.string().nullable(),
  nextStepDetail: z.string().nullable(),
  unresolvedFeedbackCount: z.number().int().nonnegative(),
  supportNeedTypes: z.array(artistSupportNeedTypeSchema)
});
export type CommunityArtistFocusDto = z.infer<typeof communityArtistFocusSchema>;

export const communityProfileSchema = z.object({
  userId: z.string().min(1),
  safeId: z.string().min(1),
  nickname: z.string().min(1),
  avatarUrl: z.string().nullable(),
  role: communityRoleBadgeSchema,
  pathStageName: z.string().nullable(),
  identityStatement: z.string().nullable(),
  mission: z.string().nullable(),
  philosophy: z.string().nullable(),
  visualDirection: z.string().nullable(),
  audienceCore: z.string().nullable(),
  differentiator: z.string().nullable(),
  aestheticKeywords: z.array(z.string()),
  coreThemes: z.array(z.string()),
  fashionSignals: z.array(z.string()),
  links: z.object({
    bandlink: z.string().nullable()
  }),
  isViewer: z.boolean(),
  friendship: friendshipStateSchema,
  supportProfile: communityArtistSupportProfileSchema,
  derivedFocus: communityArtistFocusSchema.nullable(),
  stats: z.object({
    friendsCount: z.number().int().nonnegative(),
    achievementsCount: z.number().int().nonnegative(),
    goingEventsCount: z.number().int().nonnegative(),
    totalLikesReceived: z.number().int().nonnegative()
  }),
  recentActivity: z.array(communityFeedItemSchema)
});
export type CommunityProfileDto = z.infer<typeof communityProfileSchema>;

export const communityOverviewSchema = z.object({
  events: z.array(communityEventCardSchema),
  counts: z.object({
    friends: z.number().int().nonnegative(),
    upcomingEvents: z.number().int().nonnegative(),
    myEvents: z.number().int().nonnegative(),
    friendWinsThisWeek: z.number().int().nonnegative()
  })
});
export type CommunityOverviewDto = z.infer<typeof communityOverviewSchema>;

export const communityFeedResponseSchema = z.object({
  items: z.array(communityFeedItemSchema),
  paging: pagingOutputSchema
});
export type CommunityFeedResponseDto = z.infer<typeof communityFeedResponseSchema>;

export const communityEventsResponseSchema = z.object({
  items: z.array(communityEventCardSchema),
  paging: pagingOutputSchema
});
export type CommunityEventsResponseDto = z.infer<typeof communityEventsResponseSchema>;

export const communityFriendsResponseSchema = z.object({
  friends: z.array(featuredCreatorCardSchema),
  incoming: z.array(featuredCreatorCardSchema),
  outgoing: z.array(featuredCreatorCardSchema)
});
export type CommunityFriendsResponseDto = z.infer<typeof communityFriendsResponseSchema>;
