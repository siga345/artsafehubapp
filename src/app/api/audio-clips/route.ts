import { NextResponse } from "next/server";
import { DemoVersionType as PrismaDemoVersionType, FeedbackResolutionStatus, RecommendationSource, TrackDecisionType } from "@prisma/client";

import { apiError, withApiHandler } from "@/lib/api";
import { createTrackDecision } from "@/lib/recommendation-logging";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import {
  assertValidAudioUpload,
  normalizeUploadFilename,
  storageProvider
} from "@/lib/storage";
import { serializeVersionReflection } from "@/lib/track-workbench";
import { promoteUserToFormationStageIfOnSpark } from "@/lib/user-path-stage";
import {
  createDemoCompletedAchievement,
  createDemoUploadedAchievement,
  createPathStageReachedAchievement,
  createReleaseReadyAchievement,
  createTrackReturnedAchievement
} from "@/lib/community/achievements";

function parseOptionalFiniteNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const next = String(value).trim();
  return next ? next : null;
}

function parseDateOnlyInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isMissingReleaseDemoEnumValueError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("demoversiontype") &&
    message.includes("release") &&
    (message.includes("invalid input value for enum") || message.includes("value not found in enum"))
  );
}

function isMissingDemoReleaseDateFieldError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("releasedate") &&
    (message.includes("model `demo`") || message.includes("prisma.demo.create")) &&
    (message.includes("unknown argument") || message.includes("unknown field"))
  );
}

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const clips = await prisma.demo.findMany({
    where: { track: { userId: user.id } },
    include: {
      versionReflection: true,
      track: {
        select: {
          id: true,
          title: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(
    clips.map((clip) => ({
      ...clip,
      createdAt: clip.createdAt.toISOString(),
      releaseDate: clip.releaseDate ? clip.releaseDate.toISOString().slice(0, 10) : null,
      detectedAt: clip.detectedAt?.toISOString() ?? null,
      versionReflection: serializeVersionReflection(clip.versionReflection, clip.textNote)
    }))
  );
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    throw apiError(400, "File is required");
  }

  try {
    assertValidAudioUpload({ mimeType: file.type, sizeBytes: file.size });
  } catch (error) {
    throw apiError(400, error instanceof Error ? error.message : "Invalid audio upload");
  }

  const durationSec = Number(formData.get("durationSec") ?? 0);
  if (!Number.isFinite(durationSec) || durationSec < 0) {
    throw apiError(400, "durationSec must be a positive number");
  }

  const trackId = formData.get("trackId") ? String(formData.get("trackId")) : null;
  if (!trackId) {
    throw apiError(400, "trackId is required");
  }

  const versionTypeRaw = String(formData.get("versionType") ?? "DEMO");
  const allowedVersionTypes = new Set<string>([
    "IDEA_TEXT",
    "DEMO",
    "ARRANGEMENT",
    "NO_MIX",
    "MIXED",
    "MASTERED",
    "RELEASE"
  ]);
  if (!allowedVersionTypes.has(versionTypeRaw)) {
    throw apiError(400, "Invalid versionType");
  }
  const versionType = versionTypeRaw as unknown as PrismaDemoVersionType;

  const track = await prisma.track.findFirst({ where: { id: trackId, userId: user.id } });
  if (!track) {
    throw apiError(403, "Cannot attach demo to this track");
  }

  const feedbackItemIds = Array.from(
    new Set(
      formData
        .getAll("feedbackItemIds")
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  );

  if (feedbackItemIds.length > 0) {
    const feedbackItems = await prisma.feedbackItem.findMany({
      where: {
        id: { in: feedbackItemIds },
        request: {
          trackId,
          userId: user.id
        },
        resolution: {
          is: {
            status: FeedbackResolutionStatus.NEXT_VERSION,
            targetDemoId: null
          }
        }
      },
      select: { id: true }
    });

    if (feedbackItems.length !== feedbackItemIds.length) {
      throw apiError(400, "Можно привязать только пункты фидбека со статусом «Проверить в следующей версии».");
    }
  }

  let releaseDate: Date | null = null;
  if (versionTypeRaw === "RELEASE") {
    const releaseDateRaw = parseOptionalString(formData.get("releaseDate"));
    if (!releaseDateRaw) {
      throw apiError(400, "Для релизной версии укажи дату релиза.");
    }
    const parsedReleaseDate = parseDateOnlyInput(releaseDateRaw);
    if (!parsedReleaseDate) {
      throw apiError(400, "Дата релиза должна быть в формате ГГГГ-ММ-ДД.");
    }
    releaseDate = parsedReleaseDate;

    const existingRelease = await prisma.demo.findFirst({
      where: { trackId, versionType: PrismaDemoVersionType.RELEASE },
      select: { id: true }
    });
    if (existingRelease) {
      throw apiError(409, "Для этого трека уже добавлена релизная версия.");
    }
  }

  const analysisBpm = parseOptionalFiniteNumber(formData.get("analysisBpm"));
  const analysisBpmConfidence = parseOptionalFiniteNumber(formData.get("analysisBpmConfidence"));
  const analysisKeyRoot = parseOptionalString(formData.get("analysisKeyRoot"));
  const analysisKeyModeRaw = parseOptionalString(formData.get("analysisKeyMode"));
  const analysisKeyMode = analysisKeyModeRaw === "major" || analysisKeyModeRaw === "minor" ? analysisKeyModeRaw : null;
  const analysisKeyConfidence = parseOptionalFiniteNumber(formData.get("analysisKeyConfidence"));
  const analysisSource = parseOptionalString(formData.get("analysisSource")) ?? "AUTO";
  const analysisVersion = parseOptionalString(formData.get("analysisVersion")) ?? "mvp-1";
  const hasAnyAnalysis = Boolean(analysisBpm !== null || (analysisKeyRoot && analysisKeyMode));
  const legacyNoteText = parseOptionalString(formData.get("noteText"));
  const reflectionWhyMade = parseOptionalString(formData.get("reflectionWhyMade"));
  const reflectionWhatChanged = parseOptionalString(formData.get("reflectionWhatChanged"));
  const reflectionWhatNotWorking = parseOptionalString(formData.get("reflectionWhatNotWorking"));
  const hasStructuredReflection = Boolean(reflectionWhyMade || reflectionWhatChanged || reflectionWhatNotWorking);

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = normalizeUploadFilename(file.name);
  const stored = await storageProvider.saveFile({ buffer, filename });

  let clip;
  try {
    clip = await prisma.$transaction(async (tx) => {
      if (versionTypeRaw === "RELEASE") {
        const existingRelease = await tx.demo.findFirst({
          where: { trackId, versionType: PrismaDemoVersionType.RELEASE },
          select: { id: true }
        });
        if (existingRelease) {
          throw apiError(409, "Для этого трека уже добавлена релизная версия.");
        }
      }

      await tx.demo.updateMany({
        where: { trackId, versionType },
        data: { sortIndex: { increment: 1 } }
      });

      const existingNonIdeaDemoCount =
        versionTypeRaw === "IDEA_TEXT"
          ? 0
          : await tx.demo.count({
              where: {
                trackId,
                versionType: {
                  not: PrismaDemoVersionType.IDEA_TEXT
                }
              }
            });

      const createdClip = await tx.demo.create({
        data: {
          trackId,
          audioUrl: stored.storageKey,
          duration: Math.max(0, Math.round(durationSec)),
          textNote: legacyNoteText,
          versionType,
          ...(versionTypeRaw === "RELEASE" ? { releaseDate } : {}),
          sortIndex: 0,
          detectedBpm: analysisBpm,
          detectedBpmConfidence: analysisBpmConfidence,
          detectedKeyRoot: analysisKeyRoot,
          detectedKeyMode: analysisKeyMode,
          detectedKeyConfidence: analysisKeyConfidence,
          detectedAnalysisSource: hasAnyAnalysis ? analysisSource : null,
          detectedAnalysisVersion: hasAnyAnalysis ? analysisVersion : null,
          detectedAt: hasAnyAnalysis ? new Date() : null,
          ...(hasStructuredReflection
            ? {
                versionReflection: {
                  create: {
                    whyMade: reflectionWhyMade,
                    whatChanged: reflectionWhatChanged,
                    whatNotWorking: reflectionWhatNotWorking
                  }
                }
              }
            : {})
        } as any,
        include: {
          versionReflection: true,
          track: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      if (feedbackItemIds.length > 0) {
        await tx.feedbackResolution.updateMany({
          where: {
            feedbackItemId: { in: feedbackItemIds },
            userId: user.id,
            status: FeedbackResolutionStatus.NEXT_VERSION,
            targetDemoId: null
          },
          data: {
            targetDemoId: createdClip.id,
            updatedAt: new Date()
          }
        });
      }

      if (hasStructuredReflection && createdClip.versionReflection) {
        await createTrackDecision(tx, {
          userId: user.id,
          trackId,
          demoId: createdClip.id,
          type: TrackDecisionType.REFLECTION_CAPTURED,
          source: RecommendationSource.MANUAL,
          summary: reflectionWhyMade || "Reflection captured",
          reason: reflectionWhatNotWorking || reflectionWhatChanged || null
        });
      }

      const trackUpdateData: Record<string, unknown> = { updatedAt: new Date() };
      if (versionTypeRaw === "RELEASE") {
        const releaseStage = await tx.pathStage.findFirst({
          where: { order: 7 },
          select: { id: true }
        });
        if (releaseStage) {
          trackUpdateData.pathStageId = releaseStage.id;
        }
      }
      if (hasAnyAnalysis) {
        trackUpdateData.displayAnalysisUpdatedAt = new Date();
        trackUpdateData.displayAnalysisSource = analysisSource;
        if (analysisBpm !== null) {
          trackUpdateData.displayBpm = analysisBpm;
          trackUpdateData.displayBpmConfidence = analysisBpmConfidence;
        }
        if (analysisKeyRoot && analysisKeyMode) {
          trackUpdateData.displayKeyRoot = analysisKeyRoot;
          trackUpdateData.displayKeyMode = analysisKeyMode;
          trackUpdateData.displayKeyConfidence = analysisKeyConfidence;
        }
      }

      await tx.track.update({
        where: { id: trackId },
        data: trackUpdateData as any
      });

      if (track.projectId) {
        await tx.project.update({
          where: { id: track.projectId },
          data: { updatedAt: new Date() }
        });
      }

      await createDemoUploadedAchievement(tx, {
        userId: user.id,
        demoId: createdClip.id,
        trackId,
        trackTitle: track.title,
        versionType: versionTypeRaw
      });

      if (versionTypeRaw !== "IDEA_TEXT" && existingNonIdeaDemoCount === 0) {
        await createDemoCompletedAchievement(tx, {
          userId: user.id,
          trackId,
          demoId: createdClip.id,
          trackTitle: track.title,
          versionType: versionTypeRaw
        });
      }

      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      if (track.workbenchState === "DEFERRED" || Date.now() - track.updatedAt.getTime() >= fourteenDaysMs) {
        await createTrackReturnedAchievement(tx, {
          userId: user.id,
          trackId,
          trackTitle: track.title,
          triggerLabel: versionTypeRaw === "IDEA_TEXT" ? "обновил текст" : "добавил новую версию"
        });
      }

      if (versionTypeRaw === "RELEASE") {
        await createReleaseReadyAchievement(tx, {
          userId: user.id,
          trackId,
          title: track.title,
          sourceDemoId: createdClip.id
        });

        const formationStage = await tx.pathStage.findFirst({
          where: { order: 2 },
          select: { id: true, name: true }
        });
        const wasPromoted = await promoteUserToFormationStageIfOnSpark(tx, user.id);
        if (wasPromoted && formationStage) {
          await createPathStageReachedAchievement(tx, {
            userId: user.id,
            pathStageId: formationStage.id,
            pathStageName: formationStage.name
          });
        }
      }

      return createdClip;
    });
  } catch (error) {
    if (versionTypeRaw === "RELEASE" && isMissingDemoReleaseDateFieldError(error)) {
      throw apiError(
        409,
        "Поле даты релиза ещё недоступно в Prisma Client/БД. Выполни `npx prisma migrate dev` и `npx prisma generate`."
      );
    }
    if (versionTypeRaw === "RELEASE" && isMissingReleaseDemoEnumValueError(error)) {
      throw apiError(
        409,
        "Статус «Релиз» недоступен: в базе не применена миграция enum DemoVersionType. Выполни `npx prisma migrate dev`."
      );
    }
    throw error;
  }

  return NextResponse.json(
    {
      ...clip,
      createdAt: clip.createdAt.toISOString(),
      releaseDate: clip.releaseDate ? clip.releaseDate.toISOString().slice(0, 10) : null,
      detectedAt: clip.detectedAt?.toISOString() ?? null,
      versionReflection: serializeVersionReflection(clip.versionReflection, clip.textNote)
    },
    { status: 201 }
  );
});
