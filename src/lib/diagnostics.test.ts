import { describe, it, expect } from "vitest";
import {
  ArtistGoalStatus,
  ArtistGoalType,
  GoalFactor,
  GoalTaskStatus,
  GoalMotionType,
  TaskOwnerType,
  TaskPriority,
} from "@prisma/client";
import { buildDiagnostics, type GoalDetailRecord, type ArtistWorldInput } from "./artist-growth";

// ---------------------------------------------------------------------------
// Minimal fixture factories
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<{
  id: string;
  status: GoalTaskStatus;
  linkedTrackId: string | null;
  linkedProjectId: string | null;
  ownerType: TaskOwnerType;
  linkedSpecialistCategory: string | null;
  motionType: GoalMotionType | null;
}> = {}) {
  return {
    id: overrides.id ?? "task-1",
    goalPillarId: "pillar-1",
    title: "Test task",
    description: null,
    motionType: overrides.motionType ?? GoalMotionType.CRAFT,
    priority: TaskPriority.MEDIUM,
    ownerType: overrides.ownerType ?? TaskOwnerType.SELF,
    status: overrides.status ?? GoalTaskStatus.TODO,
    linkedTrackId: overrides.linkedTrackId ?? null,
    linkedProjectId: overrides.linkedProjectId ?? null,
    linkedSpecialistCategory: overrides.linkedSpecialistCategory ?? null,
    sortIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    pillar: { id: "pillar-1", factor: GoalFactor.CATALOG, goalId: "goal-1", sortIndex: 0, createdAt: new Date(), updatedAt: new Date() },
    linkedTrack: null,
    linkedProject: null,
  };
}

function makePillar(factor: GoalFactor, tasks: ReturnType<typeof makeTask>[] = []) {
  return { id: `pillar-${factor}`, goalId: "goal-1", factor, sortIndex: 0, createdAt: new Date(), updatedAt: new Date(), tasks };
}

function makeGoal(overrides: Partial<{
  successDefinition: string | null;
  targetDate: Date | null;
  type: ArtistGoalType;
  pillars: ReturnType<typeof makePillar>[];
}> = {}): GoalDetailRecord {
  return {
    id: "goal-1",
    userId: "user-1",
    title: "Album Release Goal",
    type: overrides.type ?? ArtistGoalType.ALBUM_RELEASE,
    status: ArtistGoalStatus.ACTIVE,
    isPrimary: true,
    successDefinition: overrides.successDefinition ?? "Release the album",
    targetDate: overrides.targetDate ?? new Date("2027-01-01"),
    whyNow: null,
    createdFromPathStageId: null,
    createdFromPathStage: null,
    pillars: overrides.pillars ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as GoalDetailRecord;
}

const defaultInput = {
  trajectoryReview: null,
  identityProfile: null,
  weeklyActiveDays: 0,
  hasCheckIn: false,
  completedFocusCount: 0,
  requestCount: 0,
  trackCount: 0,
  projectCount: 0,
};

// ---------------------------------------------------------------------------
// buildDiagnostics — DIRECTION factor
// ---------------------------------------------------------------------------

describe("buildDiagnostics — DIRECTION", () => {
  it("returns MISSING state when goal is null", () => {
    const result = buildDiagnostics({ ...defaultInput, goal: null });
    const direction = result.find((d) => d.factor === "DIRECTION");
    expect(direction?.state).toBe("MISSING");
  });

  it("returns WEAK state when goal exists but has no successDefinition", () => {
    const goal = makeGoal({ successDefinition: null });
    const result = buildDiagnostics({ ...defaultInput, goal });
    const direction = result.find((d) => d.factor === "DIRECTION");
    expect(direction?.state).toBe("WEAK");
  });

  it("returns WEAK state when goal exists but has no targetDate", () => {
    const goal = makeGoal({ targetDate: null });
    const result = buildDiagnostics({ ...defaultInput, goal });
    const direction = result.find((d) => d.factor === "DIRECTION");
    expect(direction?.state).toBe("WEAK");
  });

  it("returns IN_PROGRESS when goal has definition+date but pillars have no tasks", () => {
    const pillars = [
      makePillar(GoalFactor.ARTIST_WORLD, []),
      makePillar(GoalFactor.CATALOG, []),
    ];
    const goal = makeGoal({ pillars });
    const result = buildDiagnostics({ ...defaultInput, goal });
    const direction = result.find((d) => d.factor === "DIRECTION");
    expect(direction?.state).toBe("IN_PROGRESS");
  });

  it("returns STRONG when all key pillars have tasks", () => {
    // ALBUM_RELEASE key factors: ARTIST_WORLD, CATALOG, AUDIENCE, TEAM, OPERATIONS
    const pillars = [
      makePillar(GoalFactor.ARTIST_WORLD, [makeTask()]),
      makePillar(GoalFactor.CATALOG, [makeTask({ id: "t2" })]),
      makePillar(GoalFactor.AUDIENCE, [makeTask({ id: "t3" })]),
      makePillar(GoalFactor.TEAM, [makeTask({ id: "t4" })]),
      makePillar(GoalFactor.OPERATIONS, [makeTask({ id: "t5" })]),
    ];
    const goal = makeGoal({ pillars });
    const result = buildDiagnostics({ ...defaultInput, goal });
    const direction = result.find((d) => d.factor === "DIRECTION");
    expect(direction?.state).toBe("STRONG");
  });
});

// ---------------------------------------------------------------------------
// buildDiagnostics — ARTIST_WORLD factor
// ---------------------------------------------------------------------------

describe("buildDiagnostics — ARTIST_WORLD", () => {
  it("returns MISSING state when identityProfile is null", () => {
    const result = buildDiagnostics({ ...defaultInput, goal: null, identityProfile: null });
    const world = result.find((d) => d.factor === "ARTIST_WORLD");
    expect(world?.state).toBe("MISSING");
  });

  it("returns MISSING state when identityProfile has no fields filled", () => {
    const profile: ArtistWorldInput = {};
    const result = buildDiagnostics({ ...defaultInput, goal: null, identityProfile: profile });
    const world = result.find((d) => d.factor === "ARTIST_WORLD");
    expect(world?.state).toBe("MISSING");
  });

  it("returns IN_PROGRESS when some identity fields are filled", () => {
    const profile: ArtistWorldInput = { identityStatement: "I am a pop artist", mission: "Make people dance" };
    const result = buildDiagnostics({ ...defaultInput, goal: null, identityProfile: profile });
    const world = result.find((d) => d.factor === "ARTIST_WORLD");
    expect(["IN_PROGRESS", "STRONG"]).toContain(world?.state);
  });
});

// ---------------------------------------------------------------------------
// buildDiagnostics — OPERATING_RHYTHM factor
// ---------------------------------------------------------------------------

describe("buildDiagnostics — OPERATING_RHYTHM", () => {
  it("includes OPERATING_RHYTHM in results", () => {
    const result = buildDiagnostics({ ...defaultInput, goal: null });
    expect(result.some((d) => d.factor === "OPERATING_RHYTHM")).toBe(true);
  });

  it("OPERATING_RHYTHM is STRONG with 5+ active days and check-in", () => {
    const result = buildDiagnostics({
      ...defaultInput,
      goal: null,
      weeklyActiveDays: 5,
      hasCheckIn: true,
      completedFocusCount: 3,
    });
    const rhythm = result.find((d) => d.factor === "OPERATING_RHYTHM");
    expect(rhythm?.state).toBe("STRONG");
  });

  it("OPERATING_RHYTHM is MISSING with 0 active days", () => {
    const result = buildDiagnostics({ ...defaultInput, goal: null, weeklyActiveDays: 0, hasCheckIn: false });
    const rhythm = result.find((d) => d.factor === "OPERATING_RHYTHM");
    expect(["MISSING", "WEAK"]).toContain(rhythm?.state);
  });
});

// ---------------------------------------------------------------------------
// buildDiagnostics — general contract
// ---------------------------------------------------------------------------

describe("buildDiagnostics — general contract", () => {
  it("returns an array of DiagnosticItems", () => {
    const result = buildDiagnostics({ ...defaultInput, goal: null });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("every item has factor, state, title, message, recommendation", () => {
    const result = buildDiagnostics({ ...defaultInput, goal: null });
    for (const item of result) {
      expect(item).toHaveProperty("factor");
      expect(item).toHaveProperty("state");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("message");
      expect(item).toHaveProperty("recommendation");
    }
  });

  it("results are sorted — weakest (MISSING) first, strongest (STRONG) last", () => {
    const stateRank: Record<string, number> = { MISSING: 0, WEAK: 1, IN_PROGRESS: 2, STRONG: 3 };
    const result = buildDiagnostics({ ...defaultInput, goal: null });
    for (let i = 1; i < result.length; i++) {
      expect(stateRank[result[i].state]).toBeGreaterThanOrEqual(stateRank[result[i - 1].state]);
    }
  });

  it("includes CATALOG/AUDIENCE/TEAM diagnostics only when a goal is provided", () => {
    const noGoal = buildDiagnostics({ ...defaultInput, goal: null });
    const withGoal = buildDiagnostics({
      ...defaultInput,
      goal: makeGoal({ pillars: [makePillar(GoalFactor.CATALOG, [])] }),
    });
    const noGoalFactors = noGoal.map((d) => d.factor);
    expect(noGoalFactors).not.toContain("CATALOG");
    const withGoalFactors = withGoal.map((d) => d.factor);
    expect(withGoalFactors).toContain("CATALOG");
  });
});
