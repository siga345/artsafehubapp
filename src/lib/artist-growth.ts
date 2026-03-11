/**
 * Barrel re-export for backward compatibility.
 * All logic has been decomposed into:
 *   - @/lib/goals/types       (shared Prisma includes & derived types)
 *   - @/lib/goals/templates   (goal blueprint & template generation)
 *   - @/lib/goals/trajectory  (trajectory review & cycle-need logic)
 *   - @/lib/goals/diagnostics (diagnostic items & buildDiagnostics)
 *   - @/lib/goals/daily-focus (ensureTodayFocus, serialization)
 *   - @/lib/artist-world      (Artist World types & normalization)
 *
 * This file keeps createGoalWithTemplate / unsetOtherPrimaryGoals which
 * tie together templates + DB writes, and re-exports everything else.
 */

import { ArtistGoalStatus, ExecutionTemplate, Prisma, PrismaClient } from "@prisma/client";
import { trimOrNull, goalDetailInclude } from "./goals/types";
import { getGoalBlueprint, computeDueDate } from "./goals/templates";
import type { ArtistWorldInput } from "./artist-world";
import type { ArtistGoalType } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

// ─── Re-exports ──────────────────────────────────────────────────────────────

export type {
  GoalDetailRecord,
  GoalTaskRecord,
  GoalTaskWithPillar,
  DailyFocusWithTaskRecord
} from "./goals/types";

export {
  trimOrNull,
  capitalize,
  uniqueStrings,
  roundToTwo,
  goalTaskLinkedTrackSelect,
  goalTaskInclude,
  dailyFocusInclude,
  goalDetailInclude
} from "./goals/types";

export type { GoalTemplateInput } from "./goals/templates";
export {
  artistGoalTypeLabels,
  executionTemplateLabels,
  goalFactorLabels,
  goalMotionTypeLabels,
  goalFactorDefaultMotionTypes,
  goalFactorsByType,
  getGoalTypeForExecutionTemplate,
  computeDueDate,
  getGoalBlueprint
} from "./goals/templates";

export type {
  GoalBalanceState,
  GoalFocusState,
  GoalDeliveryState,
  GoalTrajectoryOverallState,
  GoalReviewConfidence,
  TodayFocusCycleNeed,
  GoalTrajectoryReview
} from "./goals/trajectory";

export {
  computeGoalMotionBalance,
  computeGoalTrajectoryReview,
  getGoalTrajectoryReview,
  computeTodayFocusCycleNeed,
  pickTodayTaskV2,
  todayToDateOnly,
  getWeekStart,
  buildSystemRecommendation
} from "./goals/trajectory";

export type {
  DiagnosticState,
  DiagnosticFactorKey,
  DiagnosticItem
} from "./goals/diagnostics";

export { buildDiagnostics } from "./goals/diagnostics";

export {
  buildGoalProgress,
  serializeGoalDetail,
  ensureTodayFocus,
  serializeTodayFocus,
  serializePrimaryGoalSummary,
  getGoalDetailForUser,
  getPrimaryGoalDetail,
  getIdentityProfile
} from "./goals/daily-focus";

export type {
  ArtistWorldBlockId,
  ArtistWorldProjectInput,
  ArtistWorldReferenceInput,
  ArtistWorldVisualBoardSlug,
  ArtistWorldVisualBoardInput,
  ArtistWorldInput
} from "./artist-world";

export {
  artistWorldBlockIds,
  artistWorldVisualBoardDefinitions,
  defaultArtistWorldBlockOrder,
  artistWorldThemePresetOptions,
  artistWorldBackgroundModeOptions,
  ensureArtistWorldVisualBoards,
  countArtistWorldTextCoreAnswers,
  hasArtistWorldTextCore,
  hasArtistWorldVisualContent,
  normalizeArtistWorldPayload,
  serializeArtistWorld,
  splitTextareaList
} from "./artist-world";

// ─── Goal creation (ties templates + DB writes) ──────────────────────────────

export async function unsetOtherPrimaryGoals(db: DbClient, userId: string, currentGoalId?: string) {
  await db.artistGoal.updateMany({
    where: {
      userId,
      status: ArtistGoalStatus.ACTIVE,
      isPrimary: true,
      ...(currentGoalId ? { id: { not: currentGoalId } } : {})
    },
    data: {
      isPrimary: false
    }
  });
}

export async function createGoalWithTemplate(
  db: DbClient,
  userId: string,
  input: {
    type: ArtistGoalType;
    executionTemplate?: ExecutionTemplate | null;
    title: string;
    whyNow?: string | null;
    successDefinition?: string | null;
    targetDate?: Date | null;
    isPrimary?: boolean;
    createdFromPathStageId?: number | null;
    stageOrder: number;
    identityProfile?: ArtistWorldInput | null;
  }
) {
  if (input.isPrimary) {
    await unsetOtherPrimaryGoals(db, userId);
  }

  const goal = await db.artistGoal.create({
    data: {
      userId,
      type: input.type,
      executionTemplate: input.executionTemplate ?? null,
      title: input.title.trim(),
      whyNow: trimOrNull(input.whyNow),
      successDefinition: trimOrNull(input.successDefinition),
      targetDate: input.targetDate ?? null,
      status: ArtistGoalStatus.ACTIVE,
      isPrimary: Boolean(input.isPrimary),
      createdFromPathStageId: input.createdFromPathStageId ?? null
    }
  });

  const blueprint = getGoalBlueprint({
    goalType: input.type,
    executionTemplate: input.executionTemplate ?? null,
    stageOrder: input.stageOrder,
    title: input.title.trim(),
    mission: input.identityProfile?.mission ?? null,
    identityStatement: input.identityProfile?.identityStatement ?? null,
    audienceCore: input.identityProfile?.audienceCore ?? null
  });

  for (const pillar of blueprint) {
    const createdPillar = await db.goalPillar.create({
      data: {
        goalId: goal.id,
        factor: pillar.factor,
        defaultMotionType: pillar.defaultMotionType,
        title: pillar.title,
        purpose: pillar.purpose,
        sortIndex: pillar.sortIndex
      }
    });

    if (pillar.tasks.length === 0) continue;

    await db.goalTask.createMany({
      data: pillar.tasks.map((task, taskIndex) => ({
        pillarId: createdPillar.id,
        title: task.title,
        description: task.description,
        motionType: task.motionType ?? pillar.defaultMotionType,
        priority: task.priority,
        ownerType: task.ownerType,
        linkedSpecialistCategory: task.linkedSpecialistCategory ?? null,
        sortIndex: task.sortIndex ?? taskIndex,
        dueDate: computeDueDate(input.targetDate, taskIndex + 1)
      }))
    });
  }

  return db.artistGoal.findUniqueOrThrow({
    where: { id: goal.id },
    include: goalDetailInclude
  });
}
