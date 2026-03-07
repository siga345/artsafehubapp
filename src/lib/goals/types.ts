import { NextStepStatus, Prisma, PrismaClient } from "@prisma/client";
import { feedbackRequestSummarySelect } from "@/lib/feedback";

export type DbClient = PrismaClient | Prisma.TransactionClient;

// ─── Shared utility functions ────────────────────────────────────────────────

export function trimOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function uniqueStrings(values?: string[] | null) {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

export function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

// ─── Prisma select / include definitions ─────────────────────────────────────

export const goalTaskLinkedTrackSelect = {
  id: true,
  title: true,
  lyricsText: true,
  workbenchState: true,
  trackIntent: {
    select: {
      summary: true,
      whyNow: true
    }
  },
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
  feedbackRequests: {
    orderBy: [{ updatedAt: "desc" }],
    select: feedbackRequestSummarySelect
  }
} satisfies Prisma.TrackSelect;

export const goalTaskInclude = {
  pillar: true,
  linkedTrack: {
    select: goalTaskLinkedTrackSelect
  },
  linkedProject: {
    select: {
      id: true,
      title: true
    }
  }
} satisfies Prisma.GoalTaskInclude;

export const dailyFocusInclude = {
  goalTask: {
    include: goalTaskInclude
  }
} satisfies Prisma.DailyFocusInclude;

type GoalWithPlanInclude = Prisma.ArtistGoalInclude;

export const goalDetailInclude = {
  createdFromPathStage: {
    select: {
      id: true,
      order: true,
      name: true
    }
  },
  pillars: {
    orderBy: [{ sortIndex: "asc" }],
    include: {
      tasks: {
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
        include: goalTaskInclude
      }
    }
  }
} satisfies GoalWithPlanInclude;

// ─── Derived record types ─────────────────────────────────────────────────────

export type GoalDetailRecord = Prisma.ArtistGoalGetPayload<{
  include: typeof goalDetailInclude;
}>;

export type GoalTaskRecord = GoalDetailRecord["pillars"][number]["tasks"][number];

export type GoalTaskWithPillar = {
  pillar: GoalDetailRecord["pillars"][number];
  task: GoalTaskRecord;
};

export type DailyFocusWithTaskRecord = Prisma.DailyFocusGetPayload<{
  include: typeof dailyFocusInclude;
}>;
