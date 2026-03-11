import type { DailyTodoItemDto, RhythmDto } from "@/contracts/home";

export const DAILY_TODO_MAX_ITEMS = 5;
export const MICRO_STEP_RHYTHM_WEIGHT = 0.4;
export const TODO_ITEM_RHYTHM_WEIGHT = 0.12;
export const RHYTHM_MAX_SCORE = 7;

type DailyTodoItemLike = Partial<DailyTodoItemDto> & {
  id?: unknown;
  text?: unknown;
  isCompleted?: unknown;
  sortIndex?: unknown;
  completedAt?: unknown;
};

type DailyTodoPatch = {
  id: string;
  text?: string;
  isCompleted?: boolean;
  sortIndex?: number;
};

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function createSlotId(slotNumber: number) {
  return `slot-${slotNumber}`;
}

function createItemId() {
  return `todo-${crypto.randomUUID()}`;
}

function createPlaceholderItem(slotNumber: number): DailyTodoItemDto {
  return {
    id: createSlotId(slotNumber),
    text: "",
    isCompleted: false,
    sortIndex: slotNumber - 1,
    completedAt: null
  };
}

export function getHomeRhythmWindowStart(today: Date) {
  const start = toDateOnly(today);
  start.setUTCDate(start.getUTCDate() - (RHYTHM_MAX_SCORE - 1));
  return start;
}

export function deserializeDailyTodoItems(raw: unknown): DailyTodoItemDto[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      const candidate = item as DailyTodoItemLike;
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (!text) return null;

      const sortIndex = Number.isInteger(candidate.sortIndex) ? Number(candidate.sortIndex) : index;
      const isCompleted = candidate.isCompleted === true;

      return {
        id:
          typeof candidate.id === "string" && candidate.id.trim() && !candidate.id.startsWith("slot-")
            ? candidate.id.trim()
            : createItemId(),
        text,
        isCompleted,
        sortIndex,
        completedAt: isCompleted && isIsoDateString(candidate.completedAt) ? candidate.completedAt : null
      } satisfies DailyTodoItemDto;
    })
    .filter((item): item is DailyTodoItemDto => Boolean(item))
    .sort((left, right) => left.sortIndex - right.sortIndex)
    .slice(0, DAILY_TODO_MAX_ITEMS)
    .map((item, index) => ({
      ...item,
      sortIndex: index
    }));
}

export function padDailyTodoItems(items: DailyTodoItemDto[]) {
  const padded = [...items];
  while (padded.length < DAILY_TODO_MAX_ITEMS) {
    padded.push(createPlaceholderItem(padded.length + 1));
  }
  return padded;
}

export function serializeDailyTodo(date: Date, rawItems: unknown) {
  const items = deserializeDailyTodoItems(rawItems);
  const completedCount = items.filter((item) => item.isCompleted).length;

  return {
    date: toDateOnly(date).toISOString(),
    items: padDailyTodoItems(items),
    completedCount,
    totalCount: items.length,
    maxItems: DAILY_TODO_MAX_ITEMS,
    isEmpty: items.length === 0
  };
}

export function normalizeDailyTodoInput(items: DailyTodoItemLike[], now: Date) {
  return deserializeDailyTodoItems(
    items
      .map((item, index) => {
        const text = typeof item.text === "string" ? item.text.trim() : "";
        if (!text) return null;
        const isCompleted = item.isCompleted === true;
        const completedAt = isCompleted
          ? isIsoDateString(item.completedAt)
            ? item.completedAt
            : now.toISOString()
          : null;

        return {
          id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : createItemId(),
          text,
          isCompleted,
          sortIndex: Number.isInteger(item.sortIndex) ? Number(item.sortIndex) : index,
          completedAt
        };
      })
      .filter((item): item is DailyTodoItemDto => Boolean(item))
  );
}

export function patchDailyTodoItems(existingRawItems: unknown, patch: DailyTodoPatch, now: Date) {
  const items = deserializeDailyTodoItems(existingRawItems);
  const targetIndex = items.findIndex((item) => item.id === patch.id);
  if (targetIndex < 0) return items;

  const nextItems = [...items];
  const current = nextItems[targetIndex];
  const nextText = patch.text === undefined ? current.text : patch.text.trim();

  if (!nextText) {
    nextItems.splice(targetIndex, 1);
  } else {
    const nextIsCompleted = patch.isCompleted ?? current.isCompleted;
    nextItems[targetIndex] = {
      ...current,
      text: nextText,
      isCompleted: nextIsCompleted,
      completedAt: nextIsCompleted ? current.completedAt ?? now.toISOString() : null,
      sortIndex: Number.isInteger(patch.sortIndex) ? Number(patch.sortIndex) : current.sortIndex
    };
  }

  return nextItems
    .sort((left, right) => left.sortIndex - right.sortIndex)
    .slice(0, DAILY_TODO_MAX_ITEMS)
    .map((item, index) => ({
      ...item,
      sortIndex: index
    }));
}

export function computeDayRhythmScore(input: { microStepCompleted: boolean; completedTodoCount: number }) {
  const todoContribution = Math.max(0, Math.min(DAILY_TODO_MAX_ITEMS, input.completedTodoCount)) * TODO_ITEM_RHYTHM_WEIGHT;
  const total = (input.microStepCompleted ? MICRO_STEP_RHYTHM_WEIGHT : 0) + todoContribution;
  return Math.min(1, Number(total.toFixed(2)));
}

export function buildRhythmOverview(input: {
  today: Date;
  microSteps: Array<{ date: Date; isCompleted: boolean | null }>;
  dailyTodos: Array<{ date: Date; items: unknown }>;
}): RhythmDto {
  const today = toDateOnly(input.today);
  const start = getHomeRhythmWindowStart(today);
  const dayScores = new Map<string, number>();

  for (let offset = 0; offset < RHYTHM_MAX_SCORE; offset += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + offset);
    dayScores.set(current.toISOString().slice(0, 10), 0);
  }

  for (const key of dayScores.keys()) {
    const completedMicroStep = input.microSteps.some(
      (entry) => entry.isCompleted && entry.date.toISOString().slice(0, 10) === key
    );
    const todo = input.dailyTodos.find((entry) => entry.date.toISOString().slice(0, 10) === key);
    const completedTodoCount = deserializeDailyTodoItems(todo?.items ?? []).filter((item) => item.isCompleted).length;
    dayScores.set(
      key,
      computeDayRhythmScore({
        microStepCompleted: completedMicroStep,
        completedTodoCount
      })
    );
  }

  const score = Number(
    [...dayScores.values()]
      .reduce((total, dayScore) => total + dayScore, 0)
      .toFixed(1)
  );
  const filledSegments = Math.max(0, Math.min(RHYTHM_MAX_SCORE, Math.round(score)));

  if (score <= 1.4) {
    return {
      score,
      filledSegments,
      label: "Ритм не собран",
      message: "Задачи есть, но темп ещё не держится. Собери один микро-шаг и закрой хотя бы один пункт today to-do."
    };
  }

  if (score <= 3.4) {
    return {
      score,
      filledSegments,
      label: "Ритм появляется",
      message: "Движение уже есть. Укрепи его регулярностью: не бросай микро-шаг и закрывай today to-do небольшими подходами."
    };
  }

  if (score <= 5.4) {
    return {
      score,
      filledSegments,
      label: "Рабочий ритм",
      message: "Темп читается и держит движение проекта. Смотри, где to-do чаще зависает, и усиливай именно эти зоны."
    };
  }

  return {
    score,
    filledSegments,
    label: "Устойчивый ритм",
    message: "Система работает стабильно. Продолжай держать темп и не перегружай день лишними задачами."
  };
}
