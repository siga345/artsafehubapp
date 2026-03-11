export type DailyTodoItemDto = {
  id: string;
  text: string;
  isCompleted: boolean;
  sortIndex: number;
  completedAt: string | null;
};

export type DailyTodoDto = {
  date: string;
  items: DailyTodoItemDto[];
  completedCount: number;
  totalCount: number;
  maxItems: number;
  isEmpty: boolean;
};

export type RhythmDto = {
  score: number;
  filledSegments: number;
  label: string;
  message: string;
};
