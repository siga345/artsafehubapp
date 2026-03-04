import { CommunityAchievementType, type Prisma, type PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

type AchievementInput = {
  userId: string;
  type: CommunityAchievementType;
  title: string;
  body: string;
  dedupeKey: string;
  metadata?: Record<string, unknown> | null;
  sourceTrackId?: string | null;
  sourceDemoId?: string | null;
  sourceRequestId?: string | null;
  sourcePathStageId?: number | null;
};

function formatAchievementWindow(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}_${month}_${day}`;
}

export async function upsertCommunityAchievement(db: DbClient, input: AchievementInput) {
  await db.communityAchievement.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      sourceTrackId: input.sourceTrackId ?? null,
      sourceDemoId: input.sourceDemoId ?? null,
      sourceRequestId: input.sourceRequestId ?? null,
      sourcePathStageId: input.sourcePathStageId ?? null
    },
    update: {
      title: input.title,
      body: input.body,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      sourceTrackId: input.sourceTrackId ?? null,
      sourceDemoId: input.sourceDemoId ?? null,
      sourceRequestId: input.sourceRequestId ?? null,
      sourcePathStageId: input.sourcePathStageId ?? null
    }
  });
}

export async function createTrackCreatedAchievement(
  db: DbClient,
  input: { userId: string; trackId: string; trackTitle: string }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.TRACK_CREATED,
    title: "Новый трек в работе",
    body: `Добавлен трек «${input.trackTitle}».`,
    dedupeKey: `track_created:${input.trackId}`,
    sourceTrackId: input.trackId,
    metadata: {
      trackTitle: input.trackTitle
    }
  });
}

export async function createDemoUploadedAchievement(
  db: DbClient,
  input: {
    userId: string;
    demoId: string;
    trackId: string;
    trackTitle: string;
    versionType: string;
  }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.DEMO_UPLOADED,
    title: "Новая версия загружена",
    body: `Обновлена версия трека «${input.trackTitle}».`,
    dedupeKey: `demo_uploaded:${input.demoId}`,
    sourceTrackId: input.trackId,
    sourceDemoId: input.demoId,
    metadata: {
      trackTitle: input.trackTitle,
      versionType: input.versionType
    }
  });
}

export async function createRequestSubmittedAchievement(
  db: DbClient,
  input: {
    userId: string;
    requestId: string;
    trackId?: string | null;
    specialistNickname: string;
  }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.REQUEST_SUBMITTED,
    title: "Отправлена новая заявка",
    body: `Заявка отправлена креатору ${input.specialistNickname}.`,
    dedupeKey: `request_submitted:${input.requestId}`,
    sourceTrackId: input.trackId ?? null,
    sourceRequestId: input.requestId,
    metadata: {
      specialistNickname: input.specialistNickname
    }
  });
}

export async function createReleaseReadyAchievement(
  db: DbClient,
  input: {
    userId: string;
    trackId: string;
    title: string;
    sourceRequestId?: string | null;
    sourceDemoId?: string | null;
  }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.RELEASE_READY,
    title: "Релизный этап зафиксирован",
    body: `Трек «${input.title}» перешёл в релизный контур.`,
    dedupeKey: `release_ready:${input.trackId}`,
    sourceTrackId: input.trackId,
    sourceRequestId: input.sourceRequestId ?? null,
    sourceDemoId: input.sourceDemoId ?? null,
    metadata: {
      trackTitle: input.title
    }
  });
}

export async function createPathStageReachedAchievement(
  db: DbClient,
  input: {
    userId: string;
    pathStageId: number;
    pathStageName: string;
  }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.PATH_STAGE_REACHED,
    title: "Новый этап пути",
    body: `Достигнута стадия «${input.pathStageName}».`,
    dedupeKey: `path_stage:${input.userId}:${input.pathStageId}`,
    sourcePathStageId: input.pathStageId,
    metadata: {
      pathStageName: input.pathStageName
    }
  });
}

export async function createTrackReturnedAchievement(
  db: DbClient,
  input: { userId: string; trackId: string; trackTitle: string; triggerLabel: string; happenedAt?: Date }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.TRACK_RETURNED,
    title: "Вернулся к треку",
    body: `Снова сдвинул трек «${input.trackTitle}»: ${input.triggerLabel}.`,
    dedupeKey: `track_returned:${input.trackId}:${formatAchievementWindow(input.happenedAt)}`,
    sourceTrackId: input.trackId,
    metadata: {
      trackTitle: input.trackTitle,
      triggerLabel: input.triggerLabel
    }
  });
}

export async function createDemoCompletedAchievement(
  db: DbClient,
  input: { userId: string; trackId: string; demoId: string; trackTitle: string; versionType: string }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.DEMO_COMPLETED,
    title: "Довёл демо",
    body: `Для трека «${input.trackTitle}» появилась собранная версия.`,
    dedupeKey: `demo_completed:${input.trackId}`,
    sourceTrackId: input.trackId,
    sourceDemoId: input.demoId,
    metadata: {
      trackTitle: input.trackTitle,
      versionType: input.versionType
    }
  });
}

export async function createFeedbackRequestedAchievement(
  db: DbClient,
  input: {
    userId: string;
    feedbackRequestId: string;
    trackId: string;
    trackTitle: string;
    communityTitle: string;
  }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.FEEDBACK_REQUESTED,
    title: "Попросил фидбек",
    body: `Опубликован запрос в community по треку «${input.trackTitle}».`,
    dedupeKey: `feedback_requested:${input.feedbackRequestId}`,
    sourceTrackId: input.trackId,
    metadata: {
      trackTitle: input.trackTitle,
      communityTitle: input.communityTitle
    }
  });
}

export async function createArtistHelpedAchievement(
  db: DbClient,
  input: {
    userId: string;
    communityReplyId: string;
    trackId: string;
    trackTitle: string;
    receiverNickname: string;
  }
) {
  return upsertCommunityAchievement(db, {
    userId: input.userId,
    type: CommunityAchievementType.ARTIST_HELPED,
    title: "Помог другому артисту",
    body: `Оставил полезный фидбек по треку «${input.trackTitle}» для ${input.receiverNickname}.`,
    dedupeKey: `artist_helped:${input.communityReplyId}`,
    sourceTrackId: input.trackId,
    metadata: {
      trackTitle: input.trackTitle,
      receiverNickname: input.receiverNickname
    }
  });
}
