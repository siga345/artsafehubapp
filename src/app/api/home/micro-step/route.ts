import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { microStepPromptsByStage } from "@/lib/micro-step-prompts";
import { canonicalPathStageByOrder, getCanonicalPathStageName } from "@/lib/path-stages";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getWeekStart(dateOnly: Date) {
  const dayOfWeek = dateOnly.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(dateOnly);
  weekStartDate.setUTCDate(dateOnly.getUTCDate() + mondayOffset);
  return weekStartDate;
}

const stagePrompts: Record<string, readonly string[]> = microStepPromptsByStage;

const DAILY_STEPS_PER_STAGE = 5;
const defaultStageName = canonicalPathStageByOrder[1]?.name ?? "Искра";

const stageOrderByName = Object.entries(canonicalPathStageByOrder).reduce<Record<string, number>>(
  (acc, [order, label]) => {
    acc[label.name] = Number(order);
    return acc;
  },
  {}
);

function normalizeCursor(cursor: number, poolSize: number) {
  if (poolSize <= 0) return 0;
  const normalized = cursor % poolSize;
  return normalized >= 0 ? normalized : normalized + poolSize;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  if (items.length <= 1) return [...items];
  const random = createSeededRandom(seed);
  const copy = [...items];
  for (let current = copy.length - 1; current > 0; current -= 1) {
    const swapIndex = Math.floor(random() * (current + 1));
    [copy[current], copy[swapIndex]] = [copy[swapIndex], copy[current]];
  }
  return copy;
}

function getStagePromptPool(stageName: string) {
  const prompts = stagePrompts[stageName] ?? stagePrompts[defaultStageName] ?? [];
  const seen = new Set<string>();
  const uniquePrompts: string[] = [];
  for (const prompt of prompts) {
    if (seen.has(prompt)) continue;
    seen.add(prompt);
    uniquePrompts.push(prompt);
  }
  return uniquePrompts;
}

function pickStageDailySteps(stageName: string, userId: string, dayKey: string, count: number, forbidden: Set<string>) {
  const prompts = getStagePromptPool(stageName);
  if (prompts.length === 0 || count <= 0) return [];
  const seedBase = hashString(`${stageName}:${userId}:${dayKey}:fresh`);
  const freshSteps = shuffleWithSeed(
    prompts.filter((step) => !forbidden.has(step)),
    seedBase
  );
  const picked = freshSteps.slice(0, count);

  if (picked.length < count) {
    const fallbackSteps = shuffleWithSeed(
      prompts.filter((step) => !picked.includes(step)),
      seedBase + 173
    );
    for (const step of fallbackSteps) {
      picked.push(step);
      if (picked.length === count) break;
    }
  }

  if (picked.length < count) {
    const rollover = shuffleWithSeed(prompts, seedBase + 911);
    let cursor = 0;
    while (picked.length < count && rollover.length > 0) {
      picked.push(rollover[cursor % rollover.length]);
      cursor += 1;
    }
  }

  return picked;
}

function buildDailyStepPool(stageOrder: number, userId: string, dayKey: string, usedStepsThisWeek: Set<string>) {
  const maxOrder = Object.keys(canonicalPathStageByOrder).length;
  const normalizedStageOrder = Math.max(1, Math.min(stageOrder, maxOrder));
  const stageStepsByOrder: Record<number, string[]> = {};
  const blocked = new Set(usedStepsThisWeek);
  for (let order = 1; order <= normalizedStageOrder; order += 1) {
    const stageName = canonicalPathStageByOrder[order]?.name ?? defaultStageName;
    const stageSteps = pickStageDailySteps(stageName, userId, `${dayKey}:${order}`, DAILY_STEPS_PER_STAGE, blocked);
    stageStepsByOrder[order] = stageSteps;
    for (const step of stageSteps) {
      blocked.add(step);
    }
  }

  const currentStageSteps = stageStepsByOrder[normalizedStageOrder] ?? [];
  const fallbackStep =
    currentStageSteps[0] ??
    stagePrompts[canonicalPathStageByOrder[normalizedStageOrder]?.name ?? defaultStageName]?.[0] ??
    stagePrompts[defaultStageName]?.[0] ??
    "Сделай один маленький шаг сегодня.";
  const firstStep = currentStageSteps[0] ?? fallbackStep;

  const restSteps: string[] = [];
  restSteps.push(...currentStageSteps.slice(1));
  for (let order = normalizedStageOrder - 1; order >= 1; order -= 1) {
    restSteps.push(...(stageStepsByOrder[order] ?? []));
  }

  const shuffledRest = shuffleWithSeed(restSteps, hashString(`rest:${userId}:${dayKey}:${normalizedStageOrder}`));
  return [firstStep, ...shuffledRest];
}

async function getUsedStepsForWeek(userId: string, today: Date, excludeId?: string) {
  const weekStartDate = getWeekStart(today);
  const microStepsForWeek = await prisma.dailyMicroStep.findMany({
    where: {
      userId,
      date: {
        gte: weekStartDate,
        lte: today
      }
    },
    select: {
      id: true,
      text: true,
      stepPool: true
    }
  });

  const used = new Set<string>();
  for (const stepEntry of microStepsForWeek) {
    if (excludeId && stepEntry.id === excludeId) continue;
    const safePool = Array.isArray(stepEntry.stepPool) ? stepEntry.stepPool : [];
    const steps = safePool.length > 0 ? safePool : [stepEntry.text];
    for (const step of steps) {
      const normalizedStep = step.trim();
      if (!normalizedStep) continue;
      used.add(normalizedStep);
    }
  }
  return used;
}

function normalizeMicroStepState(microStep: {
  text: string;
  stepPool?: string[] | null;
  stepCursor?: number | null;
  completedStepIndexes?: number[] | null;
  isCompleted?: boolean | null;
}) {
  const fallbackText = typeof microStep.text === "string" && microStep.text.trim() ? microStep.text : "Сделай один маленький шаг сегодня.";
  const safePool = Array.isArray(microStep.stepPool)
    ? microStep.stepPool.filter((step): step is string => typeof step === "string" && step.trim().length > 0)
    : [];
  const stepPool = safePool.length > 0 ? safePool : [fallbackText];
  const rawCursor = typeof microStep.stepCursor === "number" ? microStep.stepCursor : 0;
  const stepCursor = normalizeCursor(rawCursor, stepPool.length);
  const rawCompleted = Array.isArray(microStep.completedStepIndexes) ? microStep.completedStepIndexes : [];
  const completed = new Set(
    rawCompleted.filter((index) => Number.isInteger(index) && index >= 0 && index < stepPool.length)
  );
  if (microStep.isCompleted && stepPool.length > 0) {
    completed.add(stepCursor);
  }

  return {
    stepPool,
    stepCursor,
    completedStepIndexes: [...completed].sort((left, right) => left - right),
    currentText: stepPool[stepCursor] ?? microStep.text
  };
}

export const POST = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());

  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { pathStage: true }
  });

  const stageName =
    getCanonicalPathStageName({
      order: currentUser?.pathStage?.order,
      name: currentUser?.pathStage?.name
    }) ?? defaultStageName;
  const stageOrder = stageOrderByName[stageName] ?? 1;
  const expectedStepCount = DAILY_STEPS_PER_STAGE * stageOrder;
  const dayKey = today.toISOString().slice(0, 10);
  const existing = await prisma.dailyMicroStep.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });

  if (!existing) {
    const usedStepsThisWeek = await getUsedStepsForWeek(user.id, today);
    const stepPool = buildDailyStepPool(stageOrder, user.id, dayKey, usedStepsThisWeek);
    const initialText = stepPool[0] ?? stagePrompts[defaultStageName]?.[0] ?? "Сделай один маленький шаг сегодня.";
    const microStep = await prisma.dailyMicroStep.create({
      data: {
        userId: user.id,
        date: today,
        pathStageId: currentUser?.pathStageId ?? null,
        text: initialText,
        stepPool,
        stepCursor: 0,
        completedStepIndexes: [],
        isCompleted: false,
        completedAt: null
      }
    });

    return NextResponse.json(microStep, { status: 201 });
  }

  const normalized = normalizeMicroStepState(existing);
  const shouldRegeneratePool =
    normalized.stepPool.length === 0 ||
    normalized.stepPool.length !== expectedStepCount ||
    existing.pathStageId !== (currentUser?.pathStageId ?? null);

  if (shouldRegeneratePool) {
    const usedStepsThisWeek = await getUsedStepsForWeek(user.id, today, existing.id);
    const regeneratedPool = buildDailyStepPool(stageOrder, user.id, dayKey, usedStepsThisWeek);
    const initialText =
      regeneratedPool[0] ?? stagePrompts[stageName]?.[0] ?? stagePrompts[defaultStageName]?.[0] ?? existing.text;

    const regenerated = await prisma.dailyMicroStep.update({
      where: { id: existing.id },
      data: {
        pathStageId: currentUser?.pathStageId ?? null,
        text: initialText,
        stepPool: regeneratedPool,
        stepCursor: 0,
        completedStepIndexes: [],
        isCompleted: false,
        completedAt: null
      }
    });

    return NextResponse.json(regenerated, { status: 201 });
  }

  const nextCursor = normalizeCursor(normalized.stepCursor + 1, normalized.stepPool.length);
  const nextText = normalized.stepPool[nextCursor] ?? normalized.currentText;
  const isNextCompleted = normalized.completedStepIndexes.includes(nextCursor);

  const microStep = await prisma.dailyMicroStep.update({
    where: { id: existing.id },
    data: {
      text: nextText,
      stepPool: normalized.stepPool,
      stepCursor: nextCursor,
      completedStepIndexes: normalized.completedStepIndexes,
      isCompleted: isNextCompleted,
      completedAt: isNextCompleted ? existing.completedAt : null,
      pathStageId: currentUser?.pathStageId ?? null
    }
  });

  return NextResponse.json(microStep, { status: 201 });
});

export const PATCH = withApiHandler(async () => {
  const user = await requireUser();
  const today = toDateOnly(new Date());

  const microStep = await prisma.dailyMicroStep.findUnique({
    where: { userId_date: { userId: user.id, date: today } }
  });

  if (!microStep) {
    throw apiError(404, "Micro-step for today not found");
  }

  const normalized = normalizeMicroStepState(microStep);
  const alreadyCompleted = normalized.completedStepIndexes.includes(normalized.stepCursor);
  const nextCompletedIndexes = alreadyCompleted
    ? normalized.completedStepIndexes
    : [...normalized.completedStepIndexes, normalized.stepCursor].sort((left, right) => left - right);

  const updated = await prisma.dailyMicroStep.update({
    where: { id: microStep.id },
    data: {
      text: normalized.currentText,
      stepPool: normalized.stepPool,
      stepCursor: normalized.stepCursor,
      completedStepIndexes: nextCompletedIndexes,
      isCompleted: true,
      completedAt: microStep.completedAt ?? new Date()
    }
  });

  return NextResponse.json(updated);
});
