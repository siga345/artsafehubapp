import {
  FeedbackItemCategory,
  FeedbackRecipientMode,
  FeedbackRequestStatus,
  FeedbackRequestType,
  FeedbackResolutionStatus,
  Prisma
} from "@prisma/client";

export const feedbackRequestTypeLabelRu: Record<FeedbackRequestType, string> = {
  TEXT: "По тексту",
  DEMO: "По демо",
  ARRANGEMENT: "По аранжировке",
  GENERAL_IMPRESSION: "По общему впечатлению"
};

export const feedbackRequestStatusLabelRu: Record<FeedbackRequestStatus, string> = {
  PENDING: "Ожидает фидбек",
  RECEIVED: "Фидбек получен",
  REVIEWED: "Фидбек разобран"
};

export const feedbackItemCategoryLabelRu: Record<FeedbackItemCategory, string> = {
  WHAT_WORKS: "Что работает",
  NOT_READING: "Что не считывается",
  SAGS: "Где проседает",
  WANT_TO_HEAR_NEXT: "Что хочется услышать дальше"
};

export const feedbackResolutionStatusLabelRu: Record<FeedbackResolutionStatus, string> = {
  ACCEPTED: "Принять",
  REJECTED: "Отклонить",
  NEXT_VERSION: "Проверить в следующей версии"
};

const feedbackCategoryOrder: FeedbackItemCategory[] = [
  FeedbackItemCategory.WHAT_WORKS,
  FeedbackItemCategory.NOT_READING,
  FeedbackItemCategory.SAGS,
  FeedbackItemCategory.WANT_TO_HEAR_NEXT
];

export const feedbackRequestSummarySelect = {
  status: true,
  updatedAt: true,
  receivedAt: true,
  reviewedAt: true,
  items: {
    select: {
      id: true,
      resolution: {
        select: {
          status: true,
          targetDemoId: true
        }
      }
    }
  }
} satisfies Prisma.FeedbackRequestSelect;

export const feedbackRequestInclude = {
  user: {
    select: {
      id: true,
      safeId: true,
      nickname: true
    }
  },
  track: {
    select: {
      id: true,
      title: true
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
  recipientUser: {
    select: {
      id: true,
      safeId: true,
      nickname: true
    }
  },
  items: {
    orderBy: [{ category: "asc" }, { sortIndex: "asc" }, { createdAt: "asc" }],
    include: {
      authorUser: {
        select: {
          id: true,
          safeId: true,
          nickname: true
        }
      },
      resolution: {
        include: {
          targetDemo: {
            select: {
              id: true,
              versionType: true,
              createdAt: true,
              releaseDate: true
            }
          }
        }
      }
    }
  },
  communityThread: {
    include: {
      communityPost: {
        select: {
          id: true,
          kind: true,
          title: true,
          metadata: true
        }
      },
      _count: {
        select: {
          replies: true
        }
      }
    }
  }
} satisfies Prisma.FeedbackRequestInclude;

type FeedbackRequestRecord = Prisma.FeedbackRequestGetPayload<{ include: typeof feedbackRequestInclude }>;
type FeedbackRequestSummaryRecord = Prisma.FeedbackRequestGetPayload<{ select: typeof feedbackRequestSummarySelect }>;

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function sortFeedbackItems(items: FeedbackRequestRecord["items"]) {
  return [...items].sort((left, right) => {
    if (left.category !== right.category) {
      return feedbackCategoryOrder.indexOf(left.category) - feedbackCategoryOrder.indexOf(right.category);
    }
    if (left.sortIndex !== right.sortIndex) {
      return left.sortIndex - right.sortIndex;
    }
    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export function normalizeFeedbackLines(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean);
}

export function computeFeedbackRequestStatus(
  items: Array<{ resolution?: { id?: string | null } | null }>,
  options?: {
    hasReply?: boolean;
  }
): FeedbackRequestStatus {
  if (items.length === 0) {
    return options?.hasReply ? FeedbackRequestStatus.RECEIVED : FeedbackRequestStatus.PENDING;
  }

  const resolvedItemsCount = items.filter((item) => Boolean(item.resolution)).length;
  if (resolvedItemsCount === items.length) {
    return FeedbackRequestStatus.REVIEWED;
  }

  return FeedbackRequestStatus.RECEIVED;
}

export function deriveFeedbackRequestLifecycle(
  request: {
    receivedAt: Date | null;
    reviewedAt: Date | null;
  },
  items: Array<{ resolution?: { id?: string | null } | null }>,
  options?: {
    hasReply?: boolean;
    now?: Date;
  }
) {
  const now = options?.now ?? new Date();
  const hasReply = options?.hasReply ?? (Boolean(request.receivedAt) || items.length > 0);
  const status = computeFeedbackRequestStatus(items, { hasReply });

  return {
    status,
    receivedAt: hasReply ? request.receivedAt ?? now : null,
    reviewedAt: status === FeedbackRequestStatus.REVIEWED ? request.reviewedAt ?? now : null
  };
}

export function buildTrackFeedbackSummary(requests: FeedbackRequestSummaryRecord[]) {
  const ordered = [...requests].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const latest = ordered[0] ?? null;

  const unresolvedItemsCount = ordered.reduce((sum, request) => {
    return sum + request.items.filter((item) => !item.resolution).length;
  }, 0);

  const nextVersionItemsCount = ordered.reduce((sum, request) => {
    return (
      sum +
      request.items.filter(
        (item) => item.resolution?.status === FeedbackResolutionStatus.NEXT_VERSION && !item.resolution.targetDemoId
      ).length
    );
  }, 0);

  const latestStatus = latest?.status ?? null;

  return {
    latestStatus,
    latestStatusLabel: latestStatus ? feedbackRequestStatusLabelRu[latestStatus] : null,
    openRequestCount: ordered.filter((request) => request.status !== FeedbackRequestStatus.REVIEWED).length,
    pendingRequestCount: ordered.filter((request) => request.status === FeedbackRequestStatus.PENDING).length,
    unresolvedItemsCount,
    nextVersionItemsCount,
    latestReceivedAt: toIso(ordered.find((request) => request.receivedAt)?.receivedAt),
    latestReviewedAt: toIso(ordered.find((request) => request.reviewedAt)?.reviewedAt)
  };
}

function serializeFeedbackDemoRef(
  demo:
    | FeedbackRequestRecord["demo"]
    | NonNullable<NonNullable<FeedbackRequestRecord["items"][number]["resolution"]>["targetDemo"]>
    | null
    | undefined
) {
  if (!demo) return null;
  return {
    id: demo.id,
    versionType: demo.versionType,
    createdAt: demo.createdAt.toISOString(),
    releaseDate: demo.releaseDate ? demo.releaseDate.toISOString().slice(0, 10) : null
  };
}

export function serializeFeedbackResolution(
  resolution: FeedbackRequestRecord["items"][number]["resolution"] | null | undefined
) {
  if (!resolution) return null;
  return {
    id: resolution.id,
    status: resolution.status,
    statusLabel: feedbackResolutionStatusLabelRu[resolution.status],
    note: resolution.note ?? null,
    resolvedAt: resolution.resolvedAt.toISOString(),
    createdAt: resolution.createdAt.toISOString(),
    updatedAt: resolution.updatedAt.toISOString(),
    targetDemo: serializeFeedbackDemoRef(resolution.targetDemo)
  };
}

export function serializeFeedbackRequest(request: FeedbackRequestRecord) {
  const items = sortFeedbackItems(request.items);
  const resolvedItems = items.filter((item) => item.resolution).length;
  const nextVersionItems = items.filter(
    (item) => item.resolution?.status === FeedbackResolutionStatus.NEXT_VERSION && !item.resolution.targetDemoId
  ).length;

  return {
    id: request.id,
    trackId: request.trackId,
    demoId: request.demoId ?? null,
    type: request.type,
    typeLabel: feedbackRequestTypeLabelRu[request.type],
    status: request.status,
    statusLabel: feedbackRequestStatusLabelRu[request.status],
    recipient: {
      mode: request.recipientMode,
      label: request.recipientLabel,
      safeId: request.recipientMode === FeedbackRecipientMode.INTERNAL_USER ? request.recipientUser?.safeId ?? null : null,
      nickname:
        request.recipientMode === FeedbackRecipientMode.INTERNAL_USER ? request.recipientUser?.nickname ?? null : null,
      channel: request.recipientChannel ?? null,
      contact: request.recipientContact ?? null
    },
    requestMessage: request.requestMessage ?? null,
    lyricsSnapshot: request.lyricsSnapshot ?? null,
    sentAt: request.sentAt.toISOString(),
    receivedAt: toIso(request.receivedAt),
    reviewedAt: toIso(request.reviewedAt),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    demoRef: serializeFeedbackDemoRef(request.demo),
    community: request.communityThread
      ? {
          postId: request.communityThread.communityPostId,
          threadId: request.communityThread.id,
          postKind: "FEEDBACK_REQUEST" as const,
          title: request.communityThread.communityPost.title ?? null,
          helpfulActionPrompt:
            request.communityThread.communityPost.metadata &&
            typeof request.communityThread.communityPost.metadata === "object" &&
            !Array.isArray(request.communityThread.communityPost.metadata)
              ? ((request.communityThread.communityPost.metadata as Record<string, unknown>).helpfulActionPrompt as string | null) ??
                null
              : null,
          supportNeedTypes:
            request.communityThread.communityPost.metadata &&
            typeof request.communityThread.communityPost.metadata === "object" &&
            !Array.isArray(request.communityThread.communityPost.metadata) &&
            Array.isArray((request.communityThread.communityPost.metadata as Record<string, unknown>).supportNeedTypes)
              ? ((request.communityThread.communityPost.metadata as Record<string, unknown>).supportNeedTypes as string[]).filter(
                  (value): value is "FEEDBACK" | "ACCOUNTABILITY" | "CREATIVE_DIRECTION" | "COLLABORATION" =>
                    ["FEEDBACK", "ACCOUNTABILITY", "CREATIVE_DIRECTION", "COLLABORATION"].includes(value)
                )
              : [],
          status: request.communityThread.status,
          replyCount: request.communityThread._count.replies
        }
      : null,
    items: items.map((item) => ({
      id: item.id,
      category: item.category,
      categoryLabel: feedbackItemCategoryLabelRu[item.category],
      body: item.body,
      source: item.source,
      author: item.authorUser
        ? {
            userId: item.authorUser.id,
            safeId: item.authorUser.safeId,
            nickname: item.authorUser.nickname
          }
        : null,
      sortIndex: item.sortIndex,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolution: serializeFeedbackResolution(item.resolution)
    })),
    counts: {
      totalItems: items.length,
      resolvedItems,
      nextVersionItems
    }
  };
}

export function serializeIncomingFeedbackRequest(request: FeedbackRequestRecord) {
  return {
    ...serializeFeedbackRequest(request),
    requester: {
      userId: request.user.id,
      safeId: request.user.safeId,
      nickname: request.user.nickname
    },
    track: {
      id: request.trackId,
      title: request.track.title
    }
  };
}
