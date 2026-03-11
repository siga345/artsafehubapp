import { NextStepOrigin, NextStepStatus, Prisma, RecommendationSource, TrackWorkbenchState } from "@prisma/client";

import { buildTrackFeedbackSummary, feedbackRequestSummarySelect } from "@/lib/feedback";
import { canonicalizeSongStage } from "@/lib/song-stages";
import { buildTrackIdentityBridge, type ArtistWorldIdentitySource } from "@/lib/id-integration";

export const trackListInclude = {
  folder: true,
  project: true,
  primaryDemo: {
    select: {
      id: true,
      audioUrl: true,
      duration: true,
      versionType: true,
      createdAt: true,
      releaseDate: true
    }
  },
  pathStage: true,
  trackIntent: true,
  goalTasks: {
    include: {
      pillar: {
        select: {
          factor: true,
          goal: {
            select: {
              id: true,
              title: true,
              isPrimary: true
            }
          }
        }
      }
    }
  },
  nextSteps: {
    where: { status: NextStepStatus.ACTIVE },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1
  },
  dailyWrapUps: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, createdAt: true, updatedAt: true }
  },
  distributionRequest: {
    select: {
      id: true,
      artistName: true,
      releaseTitle: true,
      releaseDate: true,
      status: true,
      masterDemo: {
        select: {
          id: true,
          createdAt: true,
          duration: true,
          versionType: true
        }
      }
    }
  },
  feedbackRequests: {
    orderBy: [{ updatedAt: "desc" }],
    select: feedbackRequestSummarySelect
  },
  demos: {
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      audioUrl: true,
      duration: true,
      versionType: true,
      createdAt: true,
      releaseDate: true,
      versionReflection: {
        select: {
          createdAt: true,
          updatedAt: true
        }
      }
    }
  },
  _count: { select: { demos: true } }
} satisfies Prisma.TrackInclude;

export const trackDetailInclude = {
  folder: true,
  project: true,
  primaryDemo: true,
  pathStage: true,
  trackIntent: true,
  goalTasks: {
    include: {
      pillar: {
        select: {
          factor: true,
          goal: {
            select: {
              id: true,
              title: true,
              isPrimary: true
            }
          }
        }
      }
    }
  },
  nextSteps: {
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  },
  dailyWrapUps: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      nextStep: true
    }
  },
  feedbackRequests: {
    orderBy: [{ updatedAt: "desc" }],
    select: feedbackRequestSummarySelect
  },
  demos: {
    orderBy: { createdAt: "desc" },
    include: {
      versionReflection: true
    }
  }
} satisfies Prisma.TrackInclude;

export const dayLoopTrackInclude = {
  project: {
    select: {
      id: true,
      title: true,
      artistLabel: true,
      releaseKind: true,
      coverType: true,
      coverImageUrl: true,
      coverPresetKey: true,
      coverColorA: true,
      coverColorB: true
    }
  },
  pathStage: true,
  trackIntent: true,
  nextSteps: {
    where: { status: NextStepStatus.ACTIVE },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1
  }
} satisfies Prisma.TrackInclude;

type TrackListRecord = Prisma.TrackGetPayload<{ include: typeof trackListInclude }>;
type TrackDetailRecord = Prisma.TrackGetPayload<{ include: typeof trackDetailInclude }>;
type DayLoopTrackRecord = Prisma.TrackGetPayload<{ include: typeof dayLoopTrackInclude }>;
type DailyTrackFocusRecord = Prisma.DailyTrackFocusGetPayload<{
  include: {
    track: { include: typeof dayLoopTrackInclude };
    nextStep: true;
  };
}>;
type DailyWrapUpRecord = Prisma.DailyWrapUpGetPayload<{
  include: {
    nextStep: true;
  };
}>;

type TrackSerializationOptions = {
  identityProfile?: ArtistWorldIdentitySource | null;
  primaryGoalId?: string | null;
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function serializeProject(project: DayLoopTrackRecord["project"] | TrackListRecord["project"] | TrackDetailRecord["project"] | null | undefined) {
  if (!project) return null;
  return {
    id: project.id,
    title: project.title,
    artistLabel: project.artistLabel ?? null,
    releaseKind: project.releaseKind ?? null,
    coverType: project.coverType ?? null,
    coverImageUrl: project.coverImageUrl ?? null,
    coverPresetKey: project.coverPresetKey ?? null,
    coverColorA: project.coverColorA ?? null,
    coverColorB: project.coverColorB ?? null
  };
}

export function getWorkbenchStateLabel(state: TrackWorkbenchState) {
  switch (state) {
    case "STUCK":
      return "Застрял";
    case "NEEDS_FEEDBACK":
      return "Нужен фидбек";
    case "DEFERRED":
      return "Отложен";
    case "READY_FOR_NEXT_STEP":
      return "Готов к следующему шагу";
    default:
      return "В работе";
  }
}

export function serializeActiveNextStep(
  nextStep:
    | {
        id: string;
        text: string;
        reason: string | null;
        status: NextStepStatus;
        recommendationSource?: RecommendationSource;
        origin?: NextStepOrigin;
        createdAt?: Date;
        updatedAt?: Date;
      }
    | null
    | undefined
) {
  if (!nextStep) return null;
  return {
    id: nextStep.id,
    text: nextStep.text,
    reason: nextStep.reason ?? null,
    status: nextStep.status,
    source: nextStep.recommendationSource ?? "MANUAL",
    origin: nextStep.origin ?? "SONG_DETAIL",
    createdAt: toIso(nextStep.createdAt),
    updatedAt: toIso(nextStep.updatedAt)
  };
}

export function serializeVersionReflection(
  reflection: {
    whyMade: string | null;
    whatChanged: string | null;
    whatNotWorking: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null,
  legacyNote?: string | null
) {
  return {
    whyMade: reflection?.whyMade ?? null,
    whatChanged: reflection?.whatChanged ?? null,
    whatNotWorking: reflection?.whatNotWorking ?? null,
    legacyNote: legacyNote ?? null,
    createdAt: toIso(reflection?.createdAt),
    updatedAt: toIso(reflection?.updatedAt)
  };
}

export function serializeDayLoopTrack(track: DayLoopTrackRecord) {
  const activeNextStep = track.nextSteps[0] ?? null;
  return {
    id: track.id,
    title: track.title,
    workbenchState: track.workbenchState,
    workbenchStateLabel: getWorkbenchStateLabel(track.workbenchState),
    pathStage: track.pathStage ? canonicalizeSongStage(track.pathStage) : null,
    intentSummary: track.trackIntent?.summary ?? null,
    project: serializeProject(track.project),
    activeNextStep: serializeActiveNextStep(activeNextStep)
  };
}

export function serializeDailyTrackFocus(
  focus: DailyTrackFocusRecord | null
) {
  if (!focus) return null;
  const nextStep = focus.nextStep?.status === "ACTIVE" ? focus.nextStep : focus.track.nextSteps[0] ?? null;
  return {
    id: focus.id,
    focusNote: focus.focusNote ?? null,
    track: serializeDayLoopTrack(focus.track),
    nextStep: serializeActiveNextStep(nextStep)
  };
}

export function serializeDailyWrapUp(
  wrapUp: DailyWrapUpRecord | null
) {
  if (!wrapUp) return null;
  return {
    id: wrapUp.id,
    trackId: wrapUp.trackId,
    endState: wrapUp.endState,
    endStateLabel: getWorkbenchStateLabel(wrapUp.endState),
    whatChanged: wrapUp.whatChanged,
    whatNotWorking: wrapUp.whatNotWorking ?? null,
    nextStep: serializeActiveNextStep(wrapUp.nextStep),
    createdAt: toIso(wrapUp.createdAt),
    updatedAt: toIso(wrapUp.updatedAt)
  };
}

function buildTrackIdentityBridgePayload(
  track: Pick<TrackListRecord | TrackDetailRecord, "title" | "lyricsText" | "trackIntent" | "goalTasks">,
  options?: TrackSerializationOptions
) {
  return buildTrackIdentityBridge({
    profile: options?.identityProfile ?? null,
    primaryGoalId: options?.primaryGoalId ?? null,
    track: {
      title: track.title,
      lyricsText: track.lyricsText,
      trackIntent: track.trackIntent
        ? {
            summary: track.trackIntent.summary,
            whyNow: track.trackIntent.whyNow
          }
        : null,
      linkedGoals: track.goalTasks.map((task) => ({
        goalId: task.pillar.goal.id,
        goalTitle: task.pillar.goal.title,
        isPrimary: task.pillar.goal.isPrimary,
        pillarFactor: task.pillar.factor,
        taskId: task.id,
        taskTitle: task.title
      }))
    }
  });
}

export function serializeTrackListItem(track: TrackListRecord, options?: TrackSerializationOptions) {
  const canonicalPathStage = track.pathStage ? canonicalizeSongStage(track.pathStage) : null;
  const isReleaseStage = canonicalPathStage?.order === 7;
  const activeNextStep = track.nextSteps[0] ?? null;
  const releaseDemo = track.demos.find((demo) => demo.versionType === "RELEASE") ?? null;
  const latestDemo = track.demos[0] ?? null;
  const latestVersionReflectionAt =
    track.demos
      .map((demo) => demo.versionReflection?.updatedAt ?? demo.versionReflection?.createdAt ?? null)
      .find(Boolean) ?? null;
  const serializedDistributionRequest = track.distributionRequest
    ? {
        id: track.distributionRequest.id,
        artistName: track.distributionRequest.artistName,
        releaseTitle: track.distributionRequest.releaseTitle,
        releaseDate: track.distributionRequest.releaseDate.toISOString().slice(0, 10),
        status: track.distributionRequest.status,
        masterDemo: track.distributionRequest.masterDemo
          ? {
              id: track.distributionRequest.masterDemo.id,
              createdAt: track.distributionRequest.masterDemo.createdAt.toISOString(),
              duration: track.distributionRequest.masterDemo.duration,
              versionType: track.distributionRequest.masterDemo.versionType
            }
          : null
      }
    : null;
  const serializedReleaseDemo = releaseDemo
    ? {
        id: releaseDemo.id,
        createdAt: releaseDemo.createdAt.toISOString(),
        audioUrl: releaseDemo.audioUrl ?? null,
        duration: releaseDemo.duration,
        versionType: releaseDemo.versionType,
        releaseDate: releaseDemo.releaseDate ? releaseDemo.releaseDate.toISOString().slice(0, 10) : null
      }
    : null;
  const releaseArchiveMeta =
    serializedDistributionRequest || serializedReleaseDemo || isReleaseStage
      ? {
          source: serializedDistributionRequest
            ? "distribution_request"
            : serializedReleaseDemo
              ? "release_demo"
              : "legacy_stage",
          title: serializedDistributionRequest?.releaseTitle ?? track.title,
          artistName: serializedDistributionRequest?.artistName ?? track.project?.artistLabel ?? null,
          releaseDate: serializedDistributionRequest?.releaseDate ?? serializedReleaseDemo?.releaseDate ?? null,
          releaseKind: track.project?.releaseKind ?? null,
          coverType: track.project?.coverType ?? null,
          coverImageUrl: track.project?.coverImageUrl ?? null,
          coverPresetKey: track.project?.coverPresetKey ?? null,
          coverColorA: track.project?.coverColorA ?? null,
          coverColorB: track.project?.coverColorB ?? null,
          isArchivedSingle: track.project?.releaseKind === "SINGLE"
        }
      : null;
  const identityBridge = buildTrackIdentityBridgePayload(track, options);
  const feedbackSummary = buildTrackFeedbackSummary(track.feedbackRequests);

  return {
    id: track.id,
    title: track.title,
    lyricsText: track.lyricsText ?? null,
    updatedAt: track.updatedAt.toISOString(),
    folderId: track.folderId,
    folder: track.folder,
    projectId: track.projectId,
    project: serializeProject(track.project),
    primaryDemo: track.primaryDemo
      ? {
          ...track.primaryDemo,
          audioUrl: track.primaryDemo.audioUrl ?? null,
          createdAt: track.primaryDemo.createdAt.toISOString(),
          releaseDate: track.primaryDemo.releaseDate ? track.primaryDemo.releaseDate.toISOString().slice(0, 10) : null
        }
      : null,
    distributionRequest: serializedDistributionRequest,
    releaseDemo: serializedReleaseDemo,
    releaseArchiveMeta,
    latestDemo: latestDemo
      ? {
          id: latestDemo.id,
          audioUrl: latestDemo.audioUrl ?? null,
          duration: latestDemo.duration,
          versionType: latestDemo.versionType,
          createdAt: latestDemo.createdAt.toISOString(),
          releaseDate: latestDemo.releaseDate ? latestDemo.releaseDate.toISOString().slice(0, 10) : null
        }
      : null,
    displayBpm: track.displayBpm ?? null,
    displayBpmConfidence: track.displayBpmConfidence ?? null,
    displayKeyRoot: track.displayKeyRoot ?? null,
    displayKeyMode: track.displayKeyMode ?? null,
    displayKeyConfidence: track.displayKeyConfidence ?? null,
    pathStageId: track.pathStageId,
    pathStage: canonicalPathStage,
    workbenchState: track.workbenchState,
    workbenchStateLabel: getWorkbenchStateLabel(track.workbenchState),
    trackIntent: track.trackIntent
      ? {
          summary: track.trackIntent.summary,
          whyNow: track.trackIntent.whyNow ?? null,
          createdAt: track.trackIntent.createdAt.toISOString(),
          updatedAt: track.trackIntent.updatedAt.toISOString()
        }
      : null,
    activeNextStep: serializeActiveNextStep(activeNextStep),
    latestWrapUpAt: toIso(track.dailyWrapUps[0]?.updatedAt ?? track.dailyWrapUps[0]?.createdAt ?? null),
    latestVersionReflectionAt: toIso(latestVersionReflectionAt),
    feedbackSummary,
    identityBridge,
    _count: track._count
  };
}

export function serializeTrackDetail(track: TrackDetailRecord, options?: TrackSerializationOptions) {
  const identityBridge = buildTrackIdentityBridgePayload(track, options);
  const feedbackSummary = buildTrackFeedbackSummary(track.feedbackRequests);
  return {
    id: track.id,
    title: track.title,
    lyricsText: track.lyricsText ?? null,
    folderId: track.folderId,
    folder: track.folder,
    projectId: track.projectId,
    project: serializeProject(track.project),
    primaryDemoId: track.primaryDemoId,
    primaryDemo: track.primaryDemo
      ? {
          ...track.primaryDemo,
          audioUrl: track.primaryDemo.audioUrl ?? null,
          createdAt: track.primaryDemo.createdAt.toISOString(),
          releaseDate: track.primaryDemo.releaseDate ? track.primaryDemo.releaseDate.toISOString().slice(0, 10) : null
        }
      : null,
    pathStageId: track.pathStageId,
    pathStage: track.pathStage ? canonicalizeSongStage(track.pathStage) : null,
    workbenchState: track.workbenchState,
    workbenchStateLabel: getWorkbenchStateLabel(track.workbenchState),
    trackIntent: track.trackIntent
      ? {
          summary: track.trackIntent.summary,
          whyNow: track.trackIntent.whyNow ?? null,
          createdAt: track.trackIntent.createdAt.toISOString(),
          updatedAt: track.trackIntent.updatedAt.toISOString()
        }
      : null,
    identityBridge,
    activeNextStep: serializeActiveNextStep(track.nextSteps.find((step) => step.status === "ACTIVE") ?? null),
    nextSteps: track.nextSteps.map((step) => ({
      id: step.id,
      text: step.text,
      reason: step.reason ?? null,
      status: step.status,
      source: step.recommendationSource,
      origin: step.origin,
      completedAt: toIso(step.completedAt),
      canceledAt: toIso(step.canceledAt),
      createdAt: toIso(step.createdAt),
      updatedAt: toIso(step.updatedAt)
    })),
    latestWrapUp: serializeDailyWrapUp(track.dailyWrapUps[0] ?? null),
    feedbackSummary,
    displayBpm: track.displayBpm ?? null,
    displayBpmConfidence: track.displayBpmConfidence ?? null,
    displayKeyRoot: track.displayKeyRoot ?? null,
    displayKeyMode: track.displayKeyMode ?? null,
    displayKeyConfidence: track.displayKeyConfidence ?? null,
    demos: track.demos.map((demo) => ({
      ...demo,
      audioUrl: demo.audioUrl ?? null,
      textNote: demo.textNote ?? null,
      createdAt: demo.createdAt.toISOString(),
      releaseDate: demo.releaseDate ? demo.releaseDate.toISOString().slice(0, 10) : null,
      detectedAt: toIso(demo.detectedAt),
      versionReflection: serializeVersionReflection(demo.versionReflection, demo.textNote)
    }))
  };
}
