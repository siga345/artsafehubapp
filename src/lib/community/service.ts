import {
  CommunityAchievementType,
  CommunityEventStatus,
  CommunityFeedbackThreadStatus,
  CommunityHelpfulActionType,
  CommunityLikeTargetType,
  CommunityPostKind,
  FriendshipStatus,
  type FeedbackItemCategory,
  type Prisma,
  type PrismaClient,
  type UserRole
} from "@prisma/client";

import type {
  ArtistSupportNeedType,
  CommunityActorDto,
  CommunityArtistFocusDto,
  CommunityEventCardDto,
  CommunityFeedFilter,
  CommunityFeedItemDto,
  CommunityFeedKind,
  CommunityFeedResponseDto,
  CommunityFeedbackReplyDto,
  CommunityFeedbackRequestRefDto,
  CommunityFeedbackThreadDto,
  CommunityFriendsResponseDto,
  CommunityHelpfulActionType as CommunityHelpfulActionTypeDto,
  CommunityLikeSummaryDto,
  CommunityOverviewDto,
  CommunityPostKind as CommunityPostKindDto,
  CommunityProfileDto,
  CommunityTrackRefDto,
  FeaturedCreatorCardDto,
  FriendshipStateDto
} from "@/contracts/community";
import { createArtistHelpedAchievement } from "@/lib/community/achievements";
import {
  deriveFeedbackRequestLifecycle,
  feedbackItemCategoryLabelRu,
  feedbackRequestInclude,
  feedbackRequestStatusLabelRu,
  feedbackRequestTypeLabelRu,
  normalizeFeedbackLines
} from "@/lib/feedback";
import { apiError } from "@/lib/api";
import { getCanonicalPathStageName } from "@/lib/path-stages";
import { getWorkbenchStateLabel } from "@/lib/track-workbench";

type DbClient = PrismaClient | Prisma.TransactionClient;

const SYSTEM_EVENT_AVATAR = "/images/artsafeplace-logo.jpeg";
const MAX_FEED_BATCH = 60;

const FRIEND_ACHIEVEMENT_TYPES = [
  CommunityAchievementType.TRACK_CREATED,
  CommunityAchievementType.DEMO_UPLOADED,
  CommunityAchievementType.PATH_STAGE_REACHED,
  CommunityAchievementType.RELEASE_READY,
  CommunityAchievementType.TRACK_RETURNED,
  CommunityAchievementType.DEMO_COMPLETED
] as const;

type CommunityPostMetadata = {
  supportNeedTypes?: string[];
  helpfulActionPrompt?: string | null;
  focusSnapshot?: string | null;
};

function encodeCursor(payload: { createdAt: string; id: string }) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor?: string | null) {
  if (!cursor) return null;

  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };
    if (!payload.createdAt || !payload.id) return null;
    const createdAt = new Date(payload.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: payload.id };
  } catch {
    return null;
  }
}

function parseLinks(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { bandlink: null };
  }

  const value = raw as Record<string, unknown>;
  return {
    bandlink:
      typeof value.bandlink === "string" && value.bandlink.trim()
        ? value.bandlink.trim()
        : typeof value.website === "string" && value.website.trim()
          ? value.website.trim()
          : null
  };
}

function parseCommunityPostMetadata(raw: unknown): CommunityPostMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  return {
    supportNeedTypes: Array.isArray(value.supportNeedTypes)
      ? value.supportNeedTypes.filter((item): item is string => typeof item === "string")
      : undefined,
    helpfulActionPrompt: typeof value.helpfulActionPrompt === "string" ? value.helpfulActionPrompt : null,
    focusSnapshot: typeof value.focusSnapshot === "string" ? value.focusSnapshot : null
  };
}

function normalizeSupportNeedTypes(types: string[] | undefined | null): ArtistSupportNeedType[] {
  return (types ?? []).filter((value): value is ArtistSupportNeedType =>
    ["FEEDBACK", "ACCOUNTABILITY", "CREATIVE_DIRECTION", "COLLABORATION"].includes(value)
  );
}

function toActor(user: {
  id: string;
  safeId: string;
  nickname: string;
  avatarUrl: string | null;
  role: UserRole;
  pathStage?: { order: number | null; name: string | null } | null;
}): CommunityActorDto {
  return {
    userId: user.id,
    safeId: user.safeId,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    pathStageName:
      getCanonicalPathStageName({
        order: user.pathStage?.order ?? null,
        name: user.pathStage?.name ?? null
      }) ?? null
  };
}

function toSystemEventActor(event: { id: string; slug: string; hostLabel: string | null }): CommunityActorDto {
  return {
    userId: `event:${event.id}`,
    safeId: `EVENT:${event.slug}`,
    nickname: event.hostLabel || "ART SAFE PLACE",
    avatarUrl: SYSTEM_EVENT_AVATAR,
    role: "ADMIN",
    pathStageName: null
  };
}

function toTrackRef(track: {
  id: string;
  title: string;
  pathStage?: { order: number | null; name: string | null } | null;
  workbenchState?: string | null;
} | null | undefined): CommunityTrackRefDto | null {
  if (!track) return null;
  return {
    id: track.id,
    title: track.title,
    pathStageName:
      getCanonicalPathStageName({
        order: track.pathStage?.order ?? null,
        name: track.pathStage?.name ?? null
      }) ?? null,
    workbenchState: track.workbenchState ?? null,
    workbenchStateLabel: track.workbenchState ? getWorkbenchStateLabel(track.workbenchState as never) : null,
    href: `/songs/${track.id}`
  };
}

function toHelpfulInteractionSummary(
  replies: Array<{
    helpfulActionType: CommunityHelpfulActionType;
    authorUser: { nickname: string };
  }>
) {
  const actionCounts = {
    I_CAN_HELP: 0,
    I_RELATED: 0,
    KEEP_GOING: 0
  };

  for (const reply of replies) {
    actionCounts[reply.helpfulActionType] += 1;
  }

  return {
    totalReplies: replies.length,
    replyPreviewCount: Math.min(replies.length, 2),
    actionCounts,
    latestReplyAuthors: replies.slice(0, 2).map((reply) => reply.authorUser.nickname)
  };
}

function toReplyPreview(
  reply: {
    id: string;
    authorUser: {
      id: string;
      safeId: string;
      nickname: string;
      avatarUrl: string | null;
      role: UserRole;
      pathStage?: { order: number | null; name: string | null } | null;
    };
    helpfulActionType: CommunityHelpfulActionType;
    comment: string | null;
    createdAt: Date;
    items: Array<{
      id: string;
      category: FeedbackItemCategory;
      body: string;
      sortIndex: number;
      createdAt: Date;
    }>;
  }): CommunityFeedbackReplyDto {
  return {
    id: reply.id,
    author: toActor(reply.authorUser),
    helpfulActionType: reply.helpfulActionType as CommunityHelpfulActionTypeDto,
    comment: reply.comment ?? null,
    createdAt: reply.createdAt.toISOString(),
    items: reply.items.map((item) => ({
      id: item.id,
      category: item.category,
      categoryLabel: feedbackItemCategoryLabelRu[item.category],
      body: item.body,
      sortIndex: item.sortIndex,
      createdAt: item.createdAt.toISOString()
    }))
  };
}

function toThreadDto(
  thread:
    | {
        id: string;
        status: CommunityFeedbackThreadStatus;
        replies: Array<{
          id: string;
          helpfulActionType: CommunityHelpfulActionType;
          comment: string | null;
          createdAt: Date;
          authorUser: {
            id: string;
            safeId: string;
            nickname: string;
            avatarUrl: string | null;
            role: UserRole;
            pathStage?: { order: number | null; name: string | null } | null;
          };
          items: Array<{
            id: string;
            category: FeedbackItemCategory;
            body: string;
            sortIndex: number;
            createdAt: Date;
          }>;
        }>;
      }
    | null
    | undefined
): CommunityFeedbackThreadDto | null {
  if (!thread) return null;
  const replies = [...thread.replies].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  return {
    id: thread.id,
    status: thread.status,
    replyCount: replies.length,
    lastReplyAt: replies[0]?.createdAt.toISOString() ?? null,
    helpfulInteractionSummary: toHelpfulInteractionSummary(replies),
    repliesPreview: replies.slice(0, 2).map(toReplyPreview)
  };
}

function toFeedbackRequestRef(
  request:
    | {
        id: string;
        type: string;
        status: string;
        communityThread:
          | {
              id: string;
              status: CommunityFeedbackThreadStatus;
              replies: Array<{
                id: string;
                helpfulActionType: CommunityHelpfulActionType;
                comment: string | null;
                createdAt: Date;
                authorUser: {
                  id: string;
                  safeId: string;
                  nickname: string;
                  avatarUrl: string | null;
                  role: UserRole;
                  pathStage?: { order: number | null; name: string | null } | null;
                };
                items: Array<{
                  id: string;
                  category: FeedbackItemCategory;
                  body: string;
                  sortIndex: number;
                  createdAt: Date;
                }>;
              }>;
            }
          | null;
        metadata?: unknown;
      }
    | null
    | undefined
): CommunityFeedbackRequestRefDto | null {
  if (!request) return null;
  const metadata = parseCommunityPostMetadata(request.metadata);
  return {
    id: request.id,
    type: request.type as "TEXT" | "DEMO" | "ARRANGEMENT" | "GENERAL_IMPRESSION",
    typeLabel: feedbackRequestTypeLabelRu[request.type as keyof typeof feedbackRequestTypeLabelRu],
    status: request.status as "PENDING" | "RECEIVED" | "REVIEWED",
    statusLabel: feedbackRequestStatusLabelRu[request.status as keyof typeof feedbackRequestStatusLabelRu],
    supportNeedTypes: normalizeSupportNeedTypes(metadata.supportNeedTypes),
    helpfulActionPrompt: metadata.helpfulActionPrompt ?? null,
    thread: toThreadDto(request.communityThread)
  };
}

function scoreFeedItem(args: {
  item: CommunityFeedItemDto;
  filter: CommunityFeedFilter;
  featuredCreatorIds: Set<string>;
  now: number;
}) {
  const { item, filter, featuredCreatorIds, now } = args;
  const createdAtMs = new Date(item.createdAt).getTime();
  const ageHours = Math.max(0, (now - createdAtMs) / 3_600_000);

  let score = filter === "all" ? createdAtMs / 1_000_000 : -ageHours;
  const reasons: string[] = filter === "all" ? ["latest"] : ["recency"];

  if (item.isFriendAuthor) {
    score += filter === "all" ? 20 : 220;
    reasons.push("friend");
  }

  if (featuredCreatorIds.has(item.author.userId)) {
    score += filter === "all" ? 10 : 80;
    reasons.push("featured");
  }

  if (item.type === "POST" && item.content.type === "POST" && item.content.postKind === "FEEDBACK_REQUEST") {
    const thread = item.content.feedbackRequestRef?.thread;
    if (thread?.status === "OPEN") {
      score += filter === "all" ? 40 : 340;
      reasons.push("open_feedback");
    } else {
      score -= filter === "all" ? 5 : 24;
      reasons.push("closed_feedback");
    }

    score += Math.min(45, thread?.replyCount ?? 0);
    if ((thread?.replyCount ?? 0) > 0) reasons.push("replied");
  }

  if (item.type === "POST" && item.content.type === "POST" && item.content.postKind === "PROGRESS") {
    score += filter === "all" ? 12 : 45;
    reasons.push("progress");
  }

  if (item.type === "ACHIEVEMENT") {
    score += filter === "all" ? 6 : 18;
    reasons.push("achievement");
  }

  if (item.type === "EVENT" && item.content.type === "EVENT") {
    const startsAtMs = new Date(item.content.startsAt).getTime();
    const hoursUntilStart = (startsAtMs - now) / 3_600_000;
    if (hoursUntilStart >= 0 && hoursUntilStart <= 7 * 24) {
      score += filter === "all" ? 25 : 80 - hoursUntilStart / 2;
      reasons.push("event_soon");
    }
  }

  if (item.likeSummary.count > 0) {
    score += Math.min(20, item.likeSummary.count * 2);
    reasons.push("liked");
  }

  return {
    score,
    rankingReason: reasons.join("+")
  };
}

function compareFeedOrder(a: { score: number; item: CommunityFeedItemDto }, b: { score: number; item: CommunityFeedItemDto }) {
  if (b.score !== a.score) return b.score - a.score;
  const timeDiff = new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return b.item.id.localeCompare(a.item.id);
}

async function getAcceptedFriendIds(db: DbClient, userId: string) {
  const rows = await db.friendship.findMany({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ requesterUserId: userId }, { addresseeUserId: userId }]
    },
    select: {
      requesterUserId: true,
      addresseeUserId: true
    }
  });

  return rows.map((row) => (row.requesterUserId === userId ? row.addresseeUserId : row.requesterUserId));
}

async function getFriendshipRows(db: DbClient, viewerUserId: string, targetUserIds: string[]) {
  if (!targetUserIds.length) return [];

  return db.friendship.findMany({
    where: {
      OR: [
        {
          requesterUserId: viewerUserId,
          addresseeUserId: { in: targetUserIds }
        },
        {
          requesterUserId: { in: targetUserIds },
          addresseeUserId: viewerUserId
        }
      ]
    },
    orderBy: [{ updatedAt: "desc" }]
  });
}

function resolveFriendshipState(viewerUserId: string, targetUserId: string, rows: Array<{
  id: string;
  requesterUserId: string;
  addresseeUserId: string;
  status: FriendshipStatus;
}>) {
  if (viewerUserId === targetUserId) {
    return {
      friendshipId: null,
      state: "NONE",
      requestedByViewer: false,
      canSendRequest: false,
      canAccept: false,
      canDecline: false,
      canCancel: false,
      canRemove: false
    } satisfies FriendshipStateDto;
  }

  const accepted = rows.find((row) => row.status === FriendshipStatus.ACCEPTED);
  if (accepted) {
    return {
      friendshipId: accepted.id,
      state: "FRIENDS",
      requestedByViewer: accepted.requesterUserId === viewerUserId,
      canSendRequest: false,
      canAccept: false,
      canDecline: false,
      canCancel: false,
      canRemove: true
    } satisfies FriendshipStateDto;
  }

  const outgoingPending = rows.find(
    (row) => row.status === FriendshipStatus.PENDING && row.requesterUserId === viewerUserId
  );
  if (outgoingPending) {
    return {
      friendshipId: outgoingPending.id,
      state: "OUTGOING_PENDING",
      requestedByViewer: true,
      canSendRequest: false,
      canAccept: false,
      canDecline: false,
      canCancel: true,
      canRemove: false
    } satisfies FriendshipStateDto;
  }

  const incomingPending = rows.find(
    (row) => row.status === FriendshipStatus.PENDING && row.addresseeUserId === viewerUserId
  );
  if (incomingPending) {
    return {
      friendshipId: incomingPending.id,
      state: "INCOMING_PENDING",
      requestedByViewer: false,
      canSendRequest: false,
      canAccept: true,
      canDecline: true,
      canCancel: false,
      canRemove: false
    } satisfies FriendshipStateDto;
  }

  return {
    friendshipId: null,
    state: "NONE",
    requestedByViewer: false,
    canSendRequest: true,
    canAccept: false,
    canDecline: false,
    canCancel: false,
    canRemove: false
  } satisfies FriendshipStateDto;
}

async function buildUserCards(args: {
  db: DbClient;
  viewerUserId: string;
  users: Array<{
    id: string;
    safeId: string;
    nickname: string;
    avatarUrl: string | null;
    role: UserRole;
    pathStage?: { order: number | null; name: string | null } | null;
    identityProfile?: { identityStatement: string | null } | null;
    specialistProfile?: { bio: string | null } | null;
  }>;
  featuredReasonByUserId?: Map<string, string | null>;
}): Promise<FeaturedCreatorCardDto[]> {
  const rows = await getFriendshipRows(
    args.db,
    args.viewerUserId,
    args.users.map((user) => user.id)
  );

  return args.users.map((user) => {
    const state = resolveFriendshipState(
      args.viewerUserId,
      user.id,
      rows.filter((row) =>
        [row.requesterUserId, row.addresseeUserId].includes(user.id) &&
        [row.requesterUserId, row.addresseeUserId].includes(args.viewerUserId)
      )
    );

    return {
      userId: user.id,
      safeId: user.safeId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role,
      pathStageName:
        getCanonicalPathStageName({
          order: user.pathStage?.order ?? null,
          name: user.pathStage?.name ?? null
        }) ?? null,
      identityStatement: user.identityProfile?.identityStatement ?? user.specialistProfile?.bio ?? null,
      reason: args.featuredReasonByUserId?.get(user.id) ?? null,
      friendship: state
    };
  });
}

async function getLikeStateMap(
  db: DbClient,
  viewerUserId: string,
  targets: Array<{ targetType: CommunityLikeTargetType; targetId: string }>
) {
  const uniqueTargets = targets.filter(
    (target, index) =>
      targets.findIndex((candidate) => candidate.targetId === target.targetId && candidate.targetType === target.targetType) ===
      index
  );
  if (!uniqueTargets.length) {
    return new Map<string, { count: number; viewerHasLiked: boolean }>();
  }

  const likes = await db.communityLike.findMany({
    where: {
      OR: uniqueTargets.map((target) => ({
        targetType: target.targetType,
        targetId: target.targetId
      }))
    },
    select: {
      userId: true,
      targetId: true,
      targetType: true
    }
  });

  const map = new Map<string, { count: number; viewerHasLiked: boolean }>();
  for (const target of uniqueTargets) {
    map.set(`${target.targetType}:${target.targetId}`, { count: 0, viewerHasLiked: false });
  }

  for (const like of likes) {
    const key = `${like.targetType}:${like.targetId}`;
    const current = map.get(key);
    if (!current) continue;
    current.count += 1;
    if (like.userId === viewerUserId) {
      current.viewerHasLiked = true;
    }
  }

  return map;
}

function toLikeSummary(
  targetType: CommunityLikeTargetType,
  targetId: string,
  likeMap: Map<string, { count: number; viewerHasLiked: boolean }>
) {
  const entry = likeMap.get(`${targetType}:${targetId}`) ?? { count: 0, viewerHasLiked: false };
  return {
    likeSummary: {
      targetType,
      targetId,
      count: entry.count
    } satisfies CommunityLikeSummaryDto,
    viewerHasLiked: entry.viewerHasLiked
  };
}

function matchesFeedKind(kind: CommunityPostKind, filter: CommunityFeedKind) {
  if (filter === "all") return true;
  if (filter === "feedback") return kind === CommunityPostKind.FEEDBACK_REQUEST;
  if (filter === "progress") return kind === CommunityPostKind.PROGRESS;
  if (filter === "question") return kind === CommunityPostKind.CREATIVE_QUESTION;
  return kind === CommunityPostKind.GENERAL;
}

async function fetchFeedCandidates(
  db: DbClient,
  viewerUserId: string,
  limit: number,
  cursor?: string | null,
  options?: {
    onlyAuthorUserId?: string;
    kind?: CommunityFeedKind;
  }
) {
  const decodedCursor = decodeCursor(cursor);
  const createdAtFilter = decodedCursor ? { lt: decodedCursor.createdAt } : undefined;
  const feedKind = options?.kind ?? "all";

  const [posts, achievements, events, friendIds] = await Promise.all([
    db.communityPost.findMany({
      where: {
        ...(options?.onlyAuthorUserId ? { authorUserId: options.onlyAuthorUserId } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        ...(feedKind === "all"
          ? {}
          : {
              kind: {
                in: [CommunityPostKind.PROGRESS, CommunityPostKind.FEEDBACK_REQUEST, CommunityPostKind.CREATIVE_QUESTION, CommunityPostKind.GENERAL].filter(
                  (value) => matchesFeedKind(value, feedKind)
                )
              }
            })
      },
      include: {
        author: {
          select: {
            id: true,
            safeId: true,
            nickname: true,
            avatarUrl: true,
            role: true,
            pathStage: { select: { order: true, name: true } }
          }
        },
        track: {
          select: {
            id: true,
            title: true,
            workbenchState: true,
            pathStage: { select: { order: true, name: true } }
          }
        },
        demo: {
          select: {
            id: true,
            versionType: true,
            createdAt: true,
            releaseDate: true
          }
        },
        feedbackRequest: {
          select: {
            id: true,
            type: true,
            status: true,
            communityThread: {
              include: {
                replies: {
                  orderBy: [{ createdAt: "desc" }],
                  include: {
                    authorUser: {
                      select: {
                        id: true,
                        safeId: true,
                        nickname: true,
                        avatarUrl: true,
                        role: true,
                        pathStage: { select: { order: true, name: true } }
                      }
                    },
                    items: {
                      orderBy: [{ category: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }]
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: Math.max(limit * 3, MAX_FEED_BATCH / 2)
    }),
    db.communityAchievement.findMany({
      where: {
        ...(options?.onlyAuthorUserId ? { userId: options.onlyAuthorUserId } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
      },
      include: {
        user: {
          select: {
            id: true,
            safeId: true,
            nickname: true,
            avatarUrl: true,
            role: true,
            pathStage: { select: { order: true, name: true } }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: Math.max(limit * 2, MAX_FEED_BATCH / 2)
    }),
    options?.onlyAuthorUserId
      ? Promise.resolve([])
      : db.communityEvent.findMany({
          where: {
            status: CommunityEventStatus.PUBLISHED,
            ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
          },
          include: {
            createdByUser: {
              select: {
                id: true,
                safeId: true,
                nickname: true,
                avatarUrl: true,
                role: true,
                pathStage: { select: { order: true, name: true } }
              }
            },
            attendances: {
              where: { userId: viewerUserId },
              select: { id: true },
              take: 1
            },
            _count: {
              select: {
                attendances: true
              }
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: Math.max(limit * 2, 20)
        }),
    getAcceptedFriendIds(db, viewerUserId)
  ]);

  const likeTargets = [
    ...posts.map((post) => ({ targetType: CommunityLikeTargetType.POST, targetId: post.id })),
    ...achievements.map((achievement) => ({
      targetType: CommunityLikeTargetType.ACHIEVEMENT,
      targetId: achievement.id
    })),
    ...events.map((event) => ({ targetType: CommunityLikeTargetType.EVENT, targetId: event.id }))
  ];
  const likeMap = await getLikeStateMap(db, viewerUserId, likeTargets);
  const friendIdSet = new Set(friendIds);

  const items: CommunityFeedItemDto[] = [
    ...posts.map((post) => {
      const likeState = toLikeSummary(CommunityLikeTargetType.POST, post.id, likeMap);
      const thread = post.feedbackRequest?.communityThread ?? null;
      const threadDto = toThreadDto(thread);
      const metadata = parseCommunityPostMetadata(post.metadata);

      return {
        id: post.id,
        type: "POST",
        createdAt: post.createdAt.toISOString(),
        author: toActor(post.author),
        isFriendAuthor: friendIdSet.has(post.authorUserId),
        likeSummary: likeState.likeSummary,
        viewerHasLiked: likeState.viewerHasLiked,
        content: {
          type: "POST",
          postKind: post.kind as CommunityPostKindDto,
          title: post.title ?? null,
          text: post.text,
          trackRef: toTrackRef(post.track),
          demoRef: post.demo
            ? {
                id: post.demo.id,
                versionType: post.demo.versionType,
                createdAt: post.demo.createdAt.toISOString(),
                releaseDate: post.demo.releaseDate ? post.demo.releaseDate.toISOString().slice(0, 10) : null
              }
            : null,
          feedbackRequestRef: post.feedbackRequest
            ? {
                id: post.feedbackRequest.id,
                type: post.feedbackRequest.type,
                typeLabel: feedbackRequestTypeLabelRu[post.feedbackRequest.type],
                status: post.feedbackRequest.status,
                statusLabel: feedbackRequestStatusLabelRu[post.feedbackRequest.status],
                supportNeedTypes: normalizeSupportNeedTypes(metadata.supportNeedTypes),
                helpfulActionPrompt: metadata.helpfulActionPrompt ?? null,
                thread: threadDto
              }
            : null,
          helpfulInteractionSummary: threadDto?.helpfulInteractionSummary ?? null,
          replyPreviewCount: threadDto?.repliesPreview.length ?? 0
        }
      } satisfies CommunityFeedItemDto;
    }),
    ...achievements.map((achievement) => {
      const likeState = toLikeSummary(CommunityLikeTargetType.ACHIEVEMENT, achievement.id, likeMap);
      return {
        id: achievement.id,
        type: "ACHIEVEMENT",
        createdAt: achievement.createdAt.toISOString(),
        author: toActor(achievement.user),
        isFriendAuthor: friendIdSet.has(achievement.userId),
        likeSummary: likeState.likeSummary,
        viewerHasLiked: likeState.viewerHasLiked,
        content: {
          type: "ACHIEVEMENT",
          achievementType: achievement.type,
          title: achievement.title,
          body: achievement.body,
          metadata:
            achievement.metadata && typeof achievement.metadata === "object" && !Array.isArray(achievement.metadata)
              ? (achievement.metadata as Record<string, unknown>)
              : null
        }
      } satisfies CommunityFeedItemDto;
    }),
    ...events.map((event) => {
      const likeState = toLikeSummary(CommunityLikeTargetType.EVENT, event.id, likeMap);
      return {
        id: event.id,
        type: "EVENT",
        createdAt: event.createdAt.toISOString(),
        author: event.createdByUser ? toActor(event.createdByUser) : toSystemEventActor(event),
        isFriendAuthor: false,
        likeSummary: likeState.likeSummary,
        viewerHasLiked: likeState.viewerHasLiked,
        content: {
          type: "EVENT",
          title: event.title,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt ? event.endsAt.toISOString() : null,
          city: event.city ?? null,
          isOnline: event.isOnline,
          hostLabel: event.hostLabel,
          slug: event.slug,
          coverImageUrl: event.coverImageUrl ?? null,
          attendeeCount: event._count.attendances,
          viewerIsAttending: event.attendances.length > 0
        }
      } satisfies CommunityFeedItemDto;
    })
  ];

  return { items };
}

async function getFeaturedCreatorIds(db: DbClient) {
  const rows = await db.featuredCreator.findMany({
    where: { isActive: true },
    select: { userId: true }
  });
  return new Set(rows.map((row) => row.userId));
}

async function buildDerivedFocus(db: DbClient, userId: string): Promise<CommunityArtistFocusDto | null> {
  const activeTrack = await db.track.findFirst({
    where: {
      userId,
      workbenchState: { not: "DEFERRED" }
    },
    include: {
      pathStage: { select: { order: true, name: true } },
      trackIntent: true,
      nextSteps: {
        where: { status: "ACTIVE" },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 1
      },
      feedbackRequests: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          items: {
            select: {
              id: true,
              resolution: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  if (!activeTrack) return null;

  const unresolvedFeedbackCount = activeTrack.feedbackRequests.reduce(
    (sum, request) => sum + request.items.filter((item) => !item.resolution).length,
    0
  );

  return {
    track: toTrackRef(activeTrack),
    nextStepTitle: activeTrack.nextSteps[0]?.text ?? activeTrack.trackIntent?.summary ?? null,
    nextStepDetail: activeTrack.nextSteps[0]?.reason ?? activeTrack.trackIntent?.whyNow ?? null,
    unresolvedFeedbackCount,
    supportNeedTypes: activeTrack.workbenchState === "NEEDS_FEEDBACK" ? ["FEEDBACK"] : []
  };
}

export async function getCommunityFeed(
  db: DbClient,
  viewerUserId: string,
  filter: CommunityFeedFilter,
  limit: number,
  cursor?: string | null,
  kind: CommunityFeedKind = "all"
): Promise<CommunityFeedResponseDto> {
  const [{ items }, featuredCreatorIds] = await Promise.all([
    fetchFeedCandidates(db, viewerUserId, limit, cursor, { kind }),
    getFeaturedCreatorIds(db)
  ]);
  const now = Date.now();

  const ranked = items
    .map((item) => {
      const ranking = scoreFeedItem({
        item,
        filter,
        featuredCreatorIds,
        now
      });

      return {
        item: ranking.rankingReason ? { ...item, rankingReason: ranking.rankingReason } : item,
        score: ranking.score
      };
    })
    .sort(compareFeedOrder);

  const pageItems = ranked.slice(0, limit).map((entry) => entry.item);
  const nextEntry = ranked[limit];

  return {
    items: pageItems,
    paging: {
      hasMore: Boolean(nextEntry),
      nextCursor: nextEntry
        ? encodeCursor({
            createdAt: nextEntry.item.createdAt,
            id: nextEntry.item.id
          })
        : undefined
    }
  };
}

export async function getCommunityFriendAchievements(
  db: DbClient,
  viewerUserId: string,
  limit: number,
  cursor?: string | null
): Promise<CommunityFeedResponseDto> {
  const friendIds = await getAcceptedFriendIds(db, viewerUserId);
  if (!friendIds.length) {
    return {
      items: [],
      paging: {
        hasMore: false,
        nextCursor: undefined
      }
    };
  }

  const decodedCursor = decodeCursor(cursor);
  const rows = await db.communityAchievement.findMany({
    where: {
      userId: { in: friendIds },
      type: { in: [...FRIEND_ACHIEVEMENT_TYPES] },
      ...(decodedCursor
        ? {
            OR: [
              { createdAt: { lt: decodedCursor.createdAt } },
              {
                createdAt: decodedCursor.createdAt,
                id: { lt: decodedCursor.id }
              }
            ]
          }
        : {})
    },
    include: {
      user: {
        select: {
          id: true,
          safeId: true,
          nickname: true,
          avatarUrl: true,
          role: true,
          pathStage: { select: { order: true, name: true } }
        }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1
  });

  const visibleRows = rows.slice(0, limit);
  const likeMap = await getLikeStateMap(
    db,
    viewerUserId,
    visibleRows.map((achievement) => ({
      targetType: CommunityLikeTargetType.ACHIEVEMENT,
      targetId: achievement.id
    }))
  );

  return {
    items: visibleRows.map((achievement) => {
      const likeState = toLikeSummary(CommunityLikeTargetType.ACHIEVEMENT, achievement.id, likeMap);
      return {
        id: achievement.id,
        type: "ACHIEVEMENT",
        createdAt: achievement.createdAt.toISOString(),
        author: toActor(achievement.user),
        isFriendAuthor: true,
        likeSummary: likeState.likeSummary,
        viewerHasLiked: likeState.viewerHasLiked,
        content: {
          type: "ACHIEVEMENT",
          achievementType: achievement.type,
          title: achievement.title,
          body: achievement.body,
          metadata:
            achievement.metadata && typeof achievement.metadata === "object" && !Array.isArray(achievement.metadata)
              ? (achievement.metadata as Record<string, unknown>)
              : null
        }
      } satisfies CommunityFeedItemDto;
    }),
    paging: {
      hasMore: rows.length > limit,
      nextCursor:
        rows.length > limit
          ? encodeCursor({
              createdAt: visibleRows[visibleRows.length - 1]!.createdAt.toISOString(),
              id: visibleRows[visibleRows.length - 1]!.id
            })
          : undefined
    }
  };
}

export async function getCommunityEvents(
  db: DbClient,
  viewerUserId: string,
  limit: number,
  cursor?: string | null
) {
  const now = new Date();
  const decodedCursor = decodeCursor(cursor);
  const where: Prisma.CommunityEventWhereInput = {
    status: CommunityEventStatus.PUBLISHED,
    startsAt: { gte: now }
  };

  if (decodedCursor) {
    where.OR = [
      { startsAt: { gt: decodedCursor.createdAt } },
      { startsAt: decodedCursor.createdAt, id: { gt: decodedCursor.id } }
    ];
  }

  const rows = await db.communityEvent.findMany({
    where,
    include: {
      attendances: {
        where: { userId: viewerUserId },
        select: { id: true },
        take: 1
      },
      _count: {
        select: {
          attendances: true
        }
      }
    },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: limit + 1
  });
  const visibleRows = rows.slice(0, limit);
  const likeMap = await getLikeStateMap(
    db,
    viewerUserId,
    visibleRows.map((row) => ({ targetType: CommunityLikeTargetType.EVENT, targetId: row.id }))
  );

  return {
    items: visibleRows.map((row) => {
      const likeState = toLikeSummary(CommunityLikeTargetType.EVENT, row.id, likeMap);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt ? row.endsAt.toISOString() : null,
        city: row.city ?? null,
        isOnline: row.isOnline,
        hostLabel: row.hostLabel,
        coverImageUrl: row.coverImageUrl ?? null,
        attendeeCount: row._count.attendances,
        viewerIsAttending: row.attendances.length > 0,
        likeSummary: likeState.likeSummary,
        viewerHasLiked: likeState.viewerHasLiked
      } satisfies CommunityEventCardDto;
    }),
    paging: {
      hasMore: rows.length > limit,
      nextCursor:
        rows.length > limit
          ? encodeCursor({
              createdAt: rows[limit].startsAt.toISOString(),
              id: rows[limit].id
            })
          : undefined
    }
  };
}

export async function getCommunityOverview(db: DbClient, viewerUserId: string): Promise<CommunityOverviewDto> {
  const acceptedFriendIds = await getAcceptedFriendIds(db, viewerUserId);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [events, friendsCount, upcomingEventsCount, myEventsCount, friendWinsThisWeek] =
    await Promise.all([
      getCommunityEvents(db, viewerUserId, 4),
      db.friendship.count({
        where: {
          status: FriendshipStatus.ACCEPTED,
          OR: [{ requesterUserId: viewerUserId }, { addresseeUserId: viewerUserId }]
        }
      }),
      db.communityEvent.count({
        where: {
          status: CommunityEventStatus.PUBLISHED,
          startsAt: { gte: new Date() }
        }
      }),
      db.communityEventAttendance.count({
        where: {
          userId: viewerUserId,
          event: {
            status: CommunityEventStatus.PUBLISHED,
            startsAt: { gte: new Date() }
          }
        }
      }),
      db.communityAchievement.count({
        where: {
          userId: { in: acceptedFriendIds },
          type: { in: [...FRIEND_ACHIEVEMENT_TYPES] },
          createdAt: { gte: weekAgo }
        }
      })
    ]);

  return {
    events: events.items,
    counts: {
      friends: friendsCount,
      upcomingEvents: upcomingEventsCount,
      myEvents: myEventsCount,
      friendWinsThisWeek
    }
  };
}

export async function attendCommunityEvent(db: DbClient, viewerUserId: string, eventId: string) {
  const event = await db.communityEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      status: true,
      startsAt: true
    }
  });

  if (!event) {
    throw apiError(404, "Ивент не найден.");
  }

  if (event.status !== CommunityEventStatus.PUBLISHED || event.startsAt < new Date()) {
    throw apiError(409, "Запись доступна только на опубликованные будущие ивенты.");
  }

  await db.communityEventAttendance.upsert({
    where: {
      eventId_userId: {
        eventId,
        userId: viewerUserId
      }
    },
    create: {
      eventId,
      userId: viewerUserId
    },
    update: {}
  });

  return getCommunityEventCard(db, viewerUserId, eventId);
}

export async function leaveCommunityEvent(db: DbClient, viewerUserId: string, eventId: string) {
  await db.communityEventAttendance.deleteMany({
    where: {
      eventId,
      userId: viewerUserId
    }
  });

  return getCommunityEventCard(db, viewerUserId, eventId);
}

async function getCommunityEventCard(db: DbClient, viewerUserId: string, eventId: string) {
  const row = await db.communityEvent.findFirst({
    where: {
      id: eventId,
      status: CommunityEventStatus.PUBLISHED,
      startsAt: { gte: new Date() }
    },
    include: {
      attendances: {
        where: { userId: viewerUserId },
        select: { id: true },
        take: 1
      },
      _count: {
        select: {
          attendances: true
        }
      }
    }
  });

  if (!row) {
    throw apiError(404, "Ивент не найден.");
  }

  const likeMap = await getLikeStateMap(db, viewerUserId, [{ targetType: CommunityLikeTargetType.EVENT, targetId: row.id }]);
  const likeState = toLikeSummary(CommunityLikeTargetType.EVENT, row.id, likeMap);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    city: row.city ?? null,
    isOnline: row.isOnline,
    hostLabel: row.hostLabel,
    coverImageUrl: row.coverImageUrl ?? null,
    attendeeCount: row._count.attendances,
    viewerIsAttending: row.attendances.length > 0,
    likeSummary: likeState.likeSummary,
    viewerHasLiked: likeState.viewerHasLiked
  } satisfies CommunityEventCardDto;
}

export async function getCommunityProfile(db: DbClient, viewerUserId: string, safeId: string): Promise<CommunityProfileDto> {
  const profile = await db.user.findUnique({
    where: { safeId },
    select: {
      id: true,
      safeId: true,
      nickname: true,
      avatarUrl: true,
      role: true,
      links: true,
      pathStage: { select: { order: true, name: true } },
      specialistProfile: {
        select: {
          bio: true
        }
      },
      identityProfile: {
        select: {
          identityStatement: true,
          mission: true,
          philosophy: true,
          visualDirection: true,
          audienceCore: true,
          differentiator: true,
          aestheticKeywords: true,
          coreThemes: true,
          fashionSignals: true,
          currentFocusTitle: true,
          currentFocusDetail: true,
          seekingSupportDetail: true,
          supportNeedTypes: true
        }
      }
    }
  });

  if (!profile) {
    throw apiError(404, "Креатор не найден.");
  }

  const [friendRows, friendsCount, visibleAchievementRows, visibleAchievementIds, goingEventsCount, derivedFocus] = await Promise.all([
    getFriendshipRows(db, viewerUserId, [profile.id]),
    db.friendship.count({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterUserId: profile.id }, { addresseeUserId: profile.id }]
      }
    }),
    db.communityAchievement.findMany({
      where: {
        userId: profile.id,
        type: { in: [...FRIEND_ACHIEVEMENT_TYPES] }
      },
      include: {
        user: {
          select: {
            id: true,
            safeId: true,
            nickname: true,
            avatarUrl: true,
            role: true,
            pathStage: { select: { order: true, name: true } }
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8
    }),
    db.communityAchievement.findMany({
      where: {
        userId: profile.id,
        type: { in: [...FRIEND_ACHIEVEMENT_TYPES] }
      },
      select: { id: true }
    }),
    db.communityEventAttendance.count({
      where: {
        userId: profile.id,
        event: {
          status: CommunityEventStatus.PUBLISHED,
          startsAt: { gte: new Date() }
        }
      }
    }),
    buildDerivedFocus(db, profile.id),
  ]);

  const likeMap = await getLikeStateMap(
    db,
    viewerUserId,
    visibleAchievementRows.map((achievement) => ({
      targetType: CommunityLikeTargetType.ACHIEVEMENT,
      targetId: achievement.id
    }))
  );

  const ownActivity = visibleAchievementRows.map((achievement) => {
    const likeState = toLikeSummary(CommunityLikeTargetType.ACHIEVEMENT, achievement.id, likeMap);
    return {
      id: achievement.id,
      type: "ACHIEVEMENT",
      createdAt: achievement.createdAt.toISOString(),
      author: toActor(achievement.user),
      isFriendAuthor: achievement.userId !== viewerUserId,
      likeSummary: likeState.likeSummary,
      viewerHasLiked: likeState.viewerHasLiked,
      content: {
        type: "ACHIEVEMENT",
        achievementType: achievement.type,
        title: achievement.title,
        body: achievement.body,
        metadata:
          achievement.metadata && typeof achievement.metadata === "object" && !Array.isArray(achievement.metadata)
            ? (achievement.metadata as Record<string, unknown>)
            : null
      }
    } satisfies CommunityFeedItemDto;
  });

  const totalLikesReceived = visibleAchievementIds.length
    ? await db.communityLike.count({
        where: {
          targetType: CommunityLikeTargetType.ACHIEVEMENT,
          targetId: {
            in: visibleAchievementIds.map((achievement) => achievement.id)
          }
        }
      })
    : 0;

  const featuredCreator = await buildUserCards({
    db,
    viewerUserId,
    users: [profile]
  });

  return {
    userId: profile.id,
    safeId: profile.safeId,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl ?? null,
    role: profile.role,
    pathStageName:
      getCanonicalPathStageName({
        order: profile.pathStage?.order ?? null,
        name: profile.pathStage?.name ?? null
      }) ?? null,
    identityStatement: profile.identityProfile?.identityStatement ?? profile.specialistProfile?.bio ?? null,
    mission: profile.identityProfile?.mission ?? null,
    philosophy: profile.identityProfile?.philosophy ?? null,
    visualDirection: profile.identityProfile?.visualDirection ?? null,
    audienceCore: profile.identityProfile?.audienceCore ?? null,
    differentiator: profile.identityProfile?.differentiator ?? null,
    aestheticKeywords: profile.identityProfile?.aestheticKeywords ?? [],
    coreThemes: profile.identityProfile?.coreThemes ?? [],
    fashionSignals: profile.identityProfile?.fashionSignals ?? [],
    links: parseLinks(profile.links),
    isViewer: profile.id === viewerUserId,
    friendship: featuredCreator[0]?.friendship ?? resolveFriendshipState(viewerUserId, profile.id, friendRows),
    supportProfile: {
      currentFocusTitle: profile.identityProfile?.currentFocusTitle ?? null,
      currentFocusDetail: profile.identityProfile?.currentFocusDetail ?? null,
      seekingSupportDetail: profile.identityProfile?.seekingSupportDetail ?? null,
      supportNeedTypes: profile.identityProfile?.supportNeedTypes ?? []
    },
    derivedFocus: derivedFocus
      ? {
          ...derivedFocus,
          supportNeedTypes:
            (profile.identityProfile?.supportNeedTypes?.length ? profile.identityProfile.supportNeedTypes : derivedFocus.supportNeedTypes) ??
            []
        }
      : null,
    stats: {
      friendsCount,
      achievementsCount: visibleAchievementIds.length,
      goingEventsCount,
      totalLikesReceived
    },
    recentActivity: ownActivity
  };
}

export async function getCommunityFriends(db: DbClient, viewerUserId: string): Promise<CommunityFriendsResponseDto> {
  const rows = await db.friendship.findMany({
    where: {
      OR: [{ requesterUserId: viewerUserId }, { addresseeUserId: viewerUserId }]
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  const otherUserIds = rows.map((row) => (row.requesterUserId === viewerUserId ? row.addresseeUserId : row.requesterUserId));
  const users = otherUserIds.length
    ? await db.user.findMany({
        where: { id: { in: otherUserIds } },
        select: {
          id: true,
          safeId: true,
          nickname: true,
          avatarUrl: true,
          role: true,
          pathStage: { select: { order: true, name: true } },
          identityProfile: { select: { identityStatement: true } },
          specialistProfile: { select: { bio: true } }
        }
      })
    : [];

  const cards = await buildUserCards({
    db,
    viewerUserId,
    users
  });
  const cardMap = new Map(cards.map((card) => [card.userId, card]));

  return {
    friends: rows
      .filter((row) => row.status === FriendshipStatus.ACCEPTED)
      .map((row) => cardMap.get(row.requesterUserId === viewerUserId ? row.addresseeUserId : row.requesterUserId))
      .filter(Boolean) as FeaturedCreatorCardDto[],
    incoming: rows
      .filter((row) => row.status === FriendshipStatus.PENDING && row.addresseeUserId === viewerUserId)
      .map((row) => cardMap.get(row.requesterUserId))
      .filter(Boolean) as FeaturedCreatorCardDto[],
    outgoing: rows
      .filter((row) => row.status === FriendshipStatus.PENDING && row.requesterUserId === viewerUserId)
      .map((row) => cardMap.get(row.addresseeUserId))
      .filter(Boolean) as FeaturedCreatorCardDto[]
  };
}

async function loadCreatedPostFeedItem(db: DbClient, viewerUserId: string, postId: string) {
  const feed = await getCommunityFeed(db, viewerUserId, "forYou", 12);
  return feed.items.find((item) => item.id === postId) ?? null;
}

async function createTypedCommunityPost(
  db: DbClient,
  viewerUserId: string,
  input: {
    kind: CommunityPostKind;
    title?: string | null;
    text: string;
    trackId?: string | null;
    demoId?: string | null;
    feedbackRequestId?: string | null;
    metadata?: Prisma.InputJsonValue | undefined;
  }
) {
  const created = await db.communityPost.create({
    data: {
      authorUserId: viewerUserId,
      kind: input.kind,
      title: input.title?.trim() || null,
      text: input.text.trim(),
      trackId: input.trackId ?? null,
      demoId: input.demoId ?? null,
      feedbackRequestId: input.feedbackRequestId ?? null,
      metadata: input.metadata
    }
  });

  return loadCreatedPostFeedItem(db, viewerUserId, created.id);
}

export async function createGeneralCommunityPost(db: DbClient, viewerUserId: string, text: string) {
  return createTypedCommunityPost(db, viewerUserId, {
    kind: CommunityPostKind.GENERAL,
    text
  });
}

export async function createProgressCommunityPost(
  db: DbClient,
  viewerUserId: string,
  input: { title?: string | null; text: string; trackId?: string | null; demoId?: string | null }
) {
  return createTypedCommunityPost(db, viewerUserId, {
    kind: CommunityPostKind.PROGRESS,
    title: input.title,
    text: input.text,
    trackId: input.trackId ?? null,
    demoId: input.demoId ?? null
  });
}

export async function createCreativeQuestionPost(
  db: DbClient,
  viewerUserId: string,
  input: { title: string; text: string; trackId?: string | null; demoId?: string | null }
) {
  return createTypedCommunityPost(db, viewerUserId, {
    kind: CommunityPostKind.CREATIVE_QUESTION,
    title: input.title,
    text: input.text,
    trackId: input.trackId ?? null,
    demoId: input.demoId ?? null
  });
}

export async function createCommunityFeedbackRequestPost(
  db: DbClient,
  viewerUserId: string,
  input: {
    feedbackRequestId: string;
    title: string;
    text: string;
    trackId: string;
    demoId?: string | null;
    supportNeedTypes: ArtistSupportNeedType[];
    helpfulActionPrompt?: string | null;
    focusSnapshot?: string | null;
  }
) {
  const created = await db.communityPost.create({
    data: {
      authorUserId: viewerUserId,
      kind: CommunityPostKind.FEEDBACK_REQUEST,
      title: input.title.trim(),
      text: input.text.trim(),
      trackId: input.trackId,
      demoId: input.demoId ?? null,
      feedbackRequestId: input.feedbackRequestId,
      metadata: {
        supportNeedTypes: input.supportNeedTypes,
        helpfulActionPrompt: input.helpfulActionPrompt ?? null,
        focusSnapshot: input.focusSnapshot ?? null
      }
    }
  });

  return created;
}

export async function createFriendRequest(db: DbClient, viewerUserId: string, targetUserId: string) {
  if (viewerUserId === targetUserId) {
    throw apiError(400, "Нельзя добавить себя в друзья.");
  }

  const targetUser = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true }
  });
  if (!targetUser) {
    throw apiError(404, "Пользователь не найден.");
  }

  const [sameDirection, reverseDirection] = await Promise.all([
    db.friendship.findUnique({
      where: {
        requesterUserId_addresseeUserId: {
          requesterUserId: viewerUserId,
          addresseeUserId: targetUserId
        }
      }
    }),
    db.friendship.findUnique({
      where: {
        requesterUserId_addresseeUserId: {
          requesterUserId: targetUserId,
          addresseeUserId: viewerUserId
        }
      }
    })
  ]);

  if (reverseDirection?.status === FriendshipStatus.PENDING) {
    await db.friendship.update({
      where: { id: reverseDirection.id },
      data: {
        status: FriendshipStatus.ACCEPTED,
        respondedAt: new Date()
      }
    });
  } else if (sameDirection?.status === FriendshipStatus.ACCEPTED || reverseDirection?.status === FriendshipStatus.ACCEPTED) {
    throw apiError(409, "Вы уже друзья.");
  } else if (sameDirection) {
    await db.friendship.update({
      where: { id: sameDirection.id },
      data: {
        status: FriendshipStatus.PENDING,
        respondedAt: null
      }
    });
  } else {
    await db.friendship.create({
      data: {
        requesterUserId: viewerUserId,
        addresseeUserId: targetUserId,
        status: FriendshipStatus.PENDING
      }
    });
  }

  const stateRows = await getFriendshipRows(db, viewerUserId, [targetUserId]);
  return resolveFriendshipState(viewerUserId, targetUserId, stateRows);
}

export async function createFriendRequestBySafeId(db: DbClient, viewerUserId: string, safeId: string) {
  const normalizedSafeId = safeId.trim();
  if (!normalizedSafeId) {
    throw apiError(400, "Укажи SAFE ID.");
  }

  const targetUser = await db.user.findUnique({
    where: { safeId: normalizedSafeId },
    select: { id: true }
  });
  if (!targetUser) {
    throw apiError(404, "Пользователь с таким SAFE ID не найден.");
  }

  return createFriendRequest(db, viewerUserId, targetUser.id);
}

export async function updateFriendship(
  db: DbClient,
  viewerUserId: string,
  friendshipId: string,
  action: "ACCEPT" | "DECLINE" | "CANCEL" | "REMOVE"
) {
  const friendship = await db.friendship.findFirst({
    where: {
      id: friendshipId,
      OR: [{ requesterUserId: viewerUserId }, { addresseeUserId: viewerUserId }]
    }
  });

  if (!friendship) {
    throw apiError(404, "Запрос в друзья не найден.");
  }

  const now = new Date();
  switch (action) {
    case "ACCEPT":
      if (friendship.addresseeUserId !== viewerUserId || friendship.status !== FriendshipStatus.PENDING) {
        throw apiError(409, "Нельзя принять этот запрос.");
      }
      await db.friendship.update({
        where: { id: friendship.id },
        data: { status: FriendshipStatus.ACCEPTED, respondedAt: now }
      });
      break;
    case "DECLINE":
      if (friendship.addresseeUserId !== viewerUserId || friendship.status !== FriendshipStatus.PENDING) {
        throw apiError(409, "Нельзя отклонить этот запрос.");
      }
      await db.friendship.update({
        where: { id: friendship.id },
        data: { status: FriendshipStatus.DECLINED, respondedAt: now }
      });
      break;
    case "CANCEL":
      if (friendship.requesterUserId !== viewerUserId || friendship.status !== FriendshipStatus.PENDING) {
        throw apiError(409, "Нельзя отменить этот запрос.");
      }
      await db.friendship.update({
        where: { id: friendship.id },
        data: { status: FriendshipStatus.CANCELLED, respondedAt: now }
      });
      break;
    case "REMOVE":
      if (friendship.status !== FriendshipStatus.ACCEPTED) {
        throw apiError(409, "Удалить можно только активную дружбу.");
      }
      await db.friendship.update({
        where: { id: friendship.id },
        data: { status: FriendshipStatus.CANCELLED, respondedAt: now }
      });
      break;
  }

  const targetUserId = friendship.requesterUserId === viewerUserId ? friendship.addresseeUserId : friendship.requesterUserId;
  const rows = await getFriendshipRows(db, viewerUserId, [targetUserId]);
  return resolveFriendshipState(viewerUserId, targetUserId, rows);
}

async function assertLikeTargetExists(db: DbClient, targetType: CommunityLikeTargetType, targetId: string) {
  if (targetType === CommunityLikeTargetType.POST) {
    const row = await db.communityPost.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!row) throw apiError(404, "Пост не найден.");
    return;
  }

  if (targetType === CommunityLikeTargetType.ACHIEVEMENT) {
    const row = await db.communityAchievement.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!row) throw apiError(404, "Достижение не найдено.");
    return;
  }

  const row = await db.communityEvent.findFirst({
    where: { id: targetId, status: CommunityEventStatus.PUBLISHED },
    select: { id: true }
  });
  if (!row) {
    throw apiError(404, "Ивент не найден.");
  }
}

export async function toggleCommunityLike(
  db: DbClient,
  viewerUserId: string,
  targetType: CommunityLikeTargetType,
  targetId: string
) {
  await assertLikeTargetExists(db, targetType, targetId);

  const existing = await db.communityLike.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: viewerUserId,
        targetType,
        targetId
      }
    }
  });

  if (existing) {
    await db.communityLike.delete({ where: { id: existing.id } });
  } else {
    await db.communityLike.create({
      data: {
        userId: viewerUserId,
        targetType,
        targetId
      }
    });
  }

  const count = await db.communityLike.count({
    where: {
      targetType,
      targetId
    }
  });

  return {
    targetType,
    targetId,
    count,
    viewerHasLiked: !existing
  };
}

export async function createCommunityFeedbackReply(
  db: PrismaClient,
  viewerUserId: string,
  threadId: string,
  input: {
    helpfulActionType: CommunityHelpfulActionType;
    comment?: string | null;
    sections: {
      whatWorks: string[];
      notReading: string[];
      sags: string[];
      wantToHearNext: string[];
    };
  }
) {
  const reply = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const thread = await tx.communityFeedbackThread.findUnique({
      where: { id: threadId },
      include: {
        feedbackRequest: {
          include: feedbackRequestInclude
        },
        track: {
          select: {
            id: true,
            title: true,
            projectId: true
          }
        },
        authorUser: {
          select: {
            nickname: true
          }
        }
      }
    });

    if (!thread) {
      throw apiError(404, "Тред фидбека не найден.");
    }
    if (thread.authorUserId === viewerUserId) {
      throw apiError(409, "Нельзя отвечать на собственный community-запрос.");
    }
    if (thread.status !== CommunityFeedbackThreadStatus.OPEN) {
      throw apiError(409, "Этот запрос больше не принимает ответы.");
    }

    const sections = {
      whatWorks: normalizeFeedbackLines(input.sections.whatWorks),
      notReading: normalizeFeedbackLines(input.sections.notReading),
      sags: normalizeFeedbackLines(input.sections.sags),
      wantToHearNext: normalizeFeedbackLines(input.sections.wantToHearNext)
    };
    const totalStructuredItems =
      sections.whatWorks.length + sections.notReading.length + sections.sags.length + sections.wantToHearNext.length;
    const normalizedComment = input.comment?.trim() || null;
    if (totalStructuredItems === 0 && !normalizedComment) {
      throw apiError(400, "Добавь хотя бы один тезис или короткий комментарий.");
    }

    const createdReply = await tx.communityFeedbackReply.create({
      data: {
        threadId: thread.id,
        authorUserId: viewerUserId,
        helpfulActionType: input.helpfulActionType,
        comment: normalizedComment,
        items: {
          create: [
            ...sections.whatWorks.map((body, index) => ({ category: "WHAT_WORKS" as const, body, sortIndex: index })),
            ...sections.notReading.map((body, index) => ({ category: "NOT_READING" as const, body, sortIndex: index })),
            ...sections.sags.map((body, index) => ({ category: "SAGS" as const, body, sortIndex: index })),
            ...sections.wantToHearNext.map((body, index) => ({
              category: "WANT_TO_HEAR_NEXT" as const,
              body,
              sortIndex: index
            }))
          ]
        }
      },
      include: {
        items: true,
        authorUser: {
          select: {
            id: true,
            safeId: true,
            nickname: true,
            avatarUrl: true,
            role: true,
            pathStage: { select: { order: true, name: true } }
          }
        }
      }
    });

    if (createdReply.items.length > 0) {
      const perCategoryCounts = new Map<FeedbackItemCategory, number>();
      for (const item of thread.feedbackRequest.items) {
        perCategoryCounts.set(item.category, (perCategoryCounts.get(item.category) ?? 0) + 1);
      }

      await tx.feedbackItem.createMany({
        data: createdReply.items.map((item: (typeof createdReply.items)[number]) => {
          const startIndex = perCategoryCounts.get(item.category) ?? 0;
          perCategoryCounts.set(item.category, startIndex + 1);

          return {
            requestId: thread.feedbackRequestId,
            authorUserId: viewerUserId,
            communityReplyId: createdReply.id,
            source: "COMMUNITY_REPLY",
            category: item.category,
            body: item.body,
            sortIndex: startIndex
          };
        })
      });

      await createArtistHelpedAchievement(tx, {
        userId: viewerUserId,
        communityReplyId: createdReply.id,
        trackId: thread.track.id,
        trackTitle: thread.track.title,
        receiverNickname: thread.authorUser.nickname
      });
    }

    const refreshedRequest = await tx.feedbackRequest.findUniqueOrThrow({
      where: { id: thread.feedbackRequestId },
      include: feedbackRequestInclude
    });

    const lifecycle = deriveFeedbackRequestLifecycle(
      {
        receivedAt: refreshedRequest.receivedAt,
        reviewedAt: refreshedRequest.reviewedAt
      },
      refreshedRequest.items,
      {
        hasReply: true
      }
    );

    await tx.feedbackRequest.update({
      where: { id: thread.feedbackRequestId },
      data: lifecycle
    });

    await tx.track.update({
      where: { id: thread.trackId },
      data: { updatedAt: new Date() }
    });

    if (thread.track.projectId) {
      await tx.project.update({
        where: { id: thread.track.projectId },
        data: { updatedAt: new Date() }
      });
    }

    return {
      reply: createdReply,
      threadTitle: thread.track.title,
      receiverNickname: thread.authorUser.nickname
    };
  });

  return reply;
}

export async function updateCommunityFeedbackThreadStatus(
  db: DbClient,
  viewerUserId: string,
  threadId: string,
  status: CommunityFeedbackThreadStatus
) {
  const thread = await db.communityFeedbackThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      authorUserId: true
    }
  });

  if (!thread) {
    throw apiError(404, "Тред фидбека не найден.");
  }
  if (thread.authorUserId !== viewerUserId) {
    throw apiError(403, "Нельзя менять статус чужого треда.");
  }

  return db.communityFeedbackThread.update({
    where: { id: threadId },
    data: { status }
  });
}

export async function updateCommunitySupportProfile(
  db: DbClient,
  viewerUserId: string,
  input: {
    currentFocusTitle?: string | null;
    currentFocusDetail?: string | null;
    seekingSupportDetail?: string | null;
    supportNeedTypes: ArtistSupportNeedType[];
  }
) {
  return db.artistIdentityProfile.upsert({
    where: { userId: viewerUserId },
    create: {
      userId: viewerUserId,
      currentFocusTitle: input.currentFocusTitle?.trim() || null,
      currentFocusDetail: input.currentFocusDetail?.trim() || null,
      seekingSupportDetail: input.seekingSupportDetail?.trim() || null,
      supportNeedTypes: input.supportNeedTypes
    },
    update: {
      currentFocusTitle: input.currentFocusTitle?.trim() || null,
      currentFocusDetail: input.currentFocusDetail?.trim() || null,
      seekingSupportDetail: input.seekingSupportDetail?.trim() || null,
      supportNeedTypes: input.supportNeedTypes
    }
  });
}
