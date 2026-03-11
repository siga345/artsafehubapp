import { describe, expect, it, vi } from "vitest";

import {
  DAILY_TODO_MAX_ITEMS,
  buildRhythmOverview,
  computeDayRhythmScore,
  normalizeDailyTodoInput,
  patchDailyTodoItems,
  serializeDailyTodo
} from "@/lib/home-today";

describe("daily todo helpers", () => {
  it("pads empty todo state to five editable slots", () => {
    const serialized = serializeDailyTodo(new Date(Date.UTC(2026, 2, 11)), []);

    expect(serialized.items).toHaveLength(DAILY_TODO_MAX_ITEMS);
    expect(serialized.totalCount).toBe(0);
    expect(serialized.completedCount).toBe(0);
    expect(serialized.isEmpty).toBe(true);
    expect(serialized.items.every((item) => item.text === "")).toBe(true);
  });

  it("normalizes input, trims blanks and limits to five items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T10:00:00.000Z"));

    const normalized = normalizeDailyTodoInput(
      [
        { id: "slot-1", text: "  first  ", isCompleted: true },
        { id: "slot-2", text: "   " },
        { id: "slot-3", text: "second" },
        { id: "slot-4", text: "third" },
        { id: "slot-5", text: "fourth" },
        { id: "slot-6", text: "fifth" },
        { id: "slot-7", text: "sixth" }
      ],
      new Date()
    );

    expect(normalized).toHaveLength(DAILY_TODO_MAX_ITEMS);
    expect(normalized.map((item) => item.text)).toEqual(["first", "second", "third", "fourth", "fifth"]);
    expect(normalized[0].isCompleted).toBe(true);
    expect(normalized[0].completedAt).toBe("2026-03-11T10:00:00.000Z");

    vi.useRealTimers();
  });

  it("patches a single todo item completion", () => {
    const now = new Date("2026-03-11T12:00:00.000Z");
    const patched = patchDailyTodoItems(
      [
        { id: "todo-1", text: "Finish verse", isCompleted: false, sortIndex: 0, completedAt: null },
        { id: "todo-2", text: "Send demo", isCompleted: false, sortIndex: 1, completedAt: null }
      ],
      { id: "todo-2", isCompleted: true },
      now
    );

    expect(patched[1]).toMatchObject({
      id: "todo-2",
      isCompleted: true,
      completedAt: "2026-03-11T12:00:00.000Z"
    });
  });
});

describe("rhythm helpers", () => {
  it("calculates day rhythm weights correctly", () => {
    expect(computeDayRhythmScore({ microStepCompleted: true, completedTodoCount: 0 })).toBe(0.4);
    expect(computeDayRhythmScore({ microStepCompleted: false, completedTodoCount: 1 })).toBe(0.12);
    expect(computeDayRhythmScore({ microStepCompleted: false, completedTodoCount: 3 })).toBe(0.36);
    expect(computeDayRhythmScore({ microStepCompleted: false, completedTodoCount: 5 })).toBe(0.6);
    expect(computeDayRhythmScore({ microStepCompleted: true, completedTodoCount: 5 })).toBe(1);
  });

  it("builds a seven-day rhythm score and clamps it to seven", () => {
    const today = new Date(Date.UTC(2026, 2, 11));
    const microSteps = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - index);
      return { date, isCompleted: true };
    });
    const dailyTodos = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - index);
      return {
        date,
        items: Array.from({ length: 5 }, (_, todoIndex) => ({
          id: `todo-${index}-${todoIndex}`,
          text: `Task ${todoIndex}`,
          isCompleted: true,
          sortIndex: todoIndex,
          completedAt: date.toISOString()
        }))
      };
    });

    const rhythm = buildRhythmOverview({ today, microSteps, dailyTodos });

    expect(rhythm.score).toBe(7);
    expect(rhythm.filledSegments).toBe(7);
    expect(rhythm.label).toBe("Устойчивый ритм");
  });

  it("drops rhythm score when progress is removed", () => {
    const today = new Date(Date.UTC(2026, 2, 11));
    const fullRhythm = buildRhythmOverview({
      today,
      microSteps: [{ date: today, isCompleted: true }],
      dailyTodos: [
        {
          date: today,
          items: [{ id: "todo-1", text: "Task", isCompleted: true, sortIndex: 0, completedAt: today.toISOString() }]
        }
      ]
    });
    const reducedRhythm = buildRhythmOverview({
      today,
      microSteps: [{ date: today, isCompleted: false }],
      dailyTodos: [
        {
          date: today,
          items: [{ id: "todo-1", text: "Task", isCompleted: false, sortIndex: 0, completedAt: null }]
        }
      ]
    });

    expect(fullRhythm.score).toBeGreaterThan(reducedRhythm.score);
  });
});
