"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Flag,
  Layers3,
  Loader2,
  MapPinned,
  Plus,
  Sparkles,
  Target
} from "lucide-react";

import { RecommendationCard as SharedRecommendationCard } from "@/components/recommendations/recommendation-card";
import type { RhythmDto } from "@/contracts/home";
import type { RecommendationCard as RecommendationCardData } from "@/contracts/recommendations";
import { usePathOverlay } from "@/components/home/path-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TodayCoreLoop, type TodayCoreLoopData } from "@/components/home/today-core-loop";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";
import { hasArtistWorldTextCore, hasArtistWorldVisualContent } from "@/lib/artist-growth";
import type { GoalIdentityBridge, IdentityBridgeStatus, IdentitySupportChip, SoftWarning, TodayContextBridge } from "@/lib/id-integration";

type GoalMotionType = "CRAFT" | "CREATIVE";
type GoalTrajectoryReview = {
  windowStart: string;
  windowEnd: string;
  overallState: "HEALTHY" | "OFF_BALANCE" | "AT_RISK";
  balanceState: "BALANCED" | "CRAFT_HEAVY" | "CREATIVE_HEAVY";
  focusState: "CENTERED" | "SCATTERED";
  deliveryState: "DELIVERING" | "AT_RISK" | "NO_FINISHING";
  weeklyFocusCount: number;
  completedThisWeek: number;
  focusCompletionRate: number;
  openInProgressCount: number;
  craftFocusCount: number;
  creativeFocusCount: number;
  craftShare: number;
  creativeShare: number;
  dominantMotionType: GoalMotionType | null;
  confidence: "high" | "low";
  summary: string;
  recommendation: RecommendationCardData;
};

type GoalBalanceSummary = {
  craftFocusCount: number;
  creativeFocusCount: number;
  craftShare: number;
  creativeShare: number;
  dominantMotionType: GoalMotionType | null;
  confidence: "high" | "low";
};

type TrackFeedbackSummary = {
  latestStatus: string | null;
  latestStatusLabel: string | null;
  openRequestCount: number;
  pendingRequestCount: number;
  unresolvedItemsCount: number;
  nextVersionItemsCount: number;
  latestReceivedAt: string | null;
  latestReviewedAt: string | null;
};

type ActiveNextStep = {
  id: string;
  text: string;
  reason: string | null;
  status: string;
  source: "MANUAL" | "SYSTEM" | "AI";
  origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
  createdAt: string | null;
  updatedAt: string | null;
} | null;

type GoalTask = {
  id: string;
  pillarId: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  motionType: GoalMotionType;
  motionTypeLabel: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  ownerType: "SELF" | "TEAM" | "EXTERNAL";
  dueDate: string | null;
  linkedTrackId: string | null;
  linkedProjectId: string | null;
  linkedTrack: {
    id: string;
    title: string;
    workbenchState: string;
    workbenchStateLabel: string;
    activeNextStep: ActiveNextStep;
    feedbackSummary: TrackFeedbackSummary;
  } | null;
  linkedProject: { id: string; title: string } | null;
  linkedSpecialistCategory:
    | "PRODUCER"
    | "AUDIO_ENGINEER"
    | "RECORDING_STUDIO"
    | "PROMO_CREW"
    | "COVER_ARTIST"
    | "COVER_PHOTOGRAPHER"
    | "VIDEOGRAPHER"
    | "CLIP_PRODUCTION_TEAM"
    | "DESIGNER"
    | null;
  startedAt: string | null;
  completedAt: string | null;
};

type GoalDetail = {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  whyNow: string | null;
  successDefinition: string | null;
  targetDate: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  isPrimary: boolean;
  progress: {
    completedTasks: number;
    totalTasks: number;
  };
  trajectoryReview: GoalTrajectoryReview | null;
  balanceSummary: GoalBalanceSummary | null;
  identityBridge: GoalIdentityBridge;
  balance: {
    craftTaskCount: number;
    creativeTaskCount: number;
  };
  pillars: Array<{
    id: string;
    factor: string;
    factorLabel: string;
    defaultMotionType: GoalMotionType;
    defaultMotionTypeLabel: string;
    title: string;
    purpose: string;
    balance: {
      craftTaskCount: number;
      creativeTaskCount: number;
    };
    progress: {
      doneCount: number;
      totalCount: number;
    };
    tasks: GoalTask[];
  }>;
};

type GoalListResponse = {
  items: GoalDetail[];
};

type HomeOverview = {
  today: string;
  stage: {
    id: number;
    order: number;
    name: string;
    iconKey: string;
    description: string;
  };
  checkIn: {
    mood: "NORMAL" | "TOUGH" | "FLYING";
    note: string | null;
  } | null;
  rhythm: RhythmDto;
  dayLoop: TodayCoreLoopData;
  commandCenter: {
    position: {
      biggestRisk: DiagnosticItem | null;
    };
    primaryGoal: {
      id: string;
      title: string;
      type: string;
      typeLabel: string;
      status: string;
      targetDate: string | null;
      successDefinition: string | null;
      progress: {
        completedTasks: number;
        totalTasks: number;
      };
      trajectoryReview: GoalTrajectoryReview | null;
      balanceSummary: GoalBalanceSummary | null;
      identityBridge: GoalIdentityBridge;
      pillars: Array<{
        id: string;
        factor: string;
        title: string;
        factorLabel: string;
        defaultMotionType: GoalMotionType;
        defaultMotionTypeLabel: string;
        balance: {
          craftTaskCount: number;
          creativeTaskCount: number;
        };
        doneCount: number;
        totalCount: number;
      }>;
    } | null;
    todayFocus: {
      id: string;
      source: "AUTO" | "MANUAL";
      isCompleted: boolean;
      completedAt: string | null;
      goal: {
        id: string;
        title: string;
        type: string;
        typeLabel: string;
      };
      pillar: {
        id: string;
        factor: string;
        factorLabel: string;
        title: string;
      };
      task: {
        id: string;
        title: string;
        description: string | null;
        status: GoalTask["status"];
        priority: GoalTask["priority"];
        ownerType: GoalTask["ownerType"];
        linkedTrackId: string | null;
        linkedProjectId: string | null;
        linkedTrack: GoalTask["linkedTrack"];
        linkedProject: GoalTask["linkedProject"];
        linkedSpecialistCategory: GoalTask["linkedSpecialistCategory"];
        motionType: GoalMotionType;
        motionTypeLabel: string;
        startedAt: string | null;
        completedAt: string | null;
      };
      contextBridge: TodayContextBridge | null;
      cycleContext: {
        balanceState: GoalTrajectoryReview["balanceState"];
        focusState: GoalTrajectoryReview["focusState"];
        deliveryState: GoalTrajectoryReview["deliveryState"];
      } | null;
      selectionReason: {
        cycleNeed: string;
        reasonTitle: string;
        reasonBody: string;
      };
      recommendation: RecommendationCardData;
    } | null;
    diagnostics: DiagnosticItem[];
  } | null;
};

type DiagnosticItem = {
  factor: string;
  state: "MISSING" | "WEAK" | "IN_PROGRESS" | "STRONG";
  title: string;
  message: string;
  recommendation: RecommendationCardData;
};

type IdProfile = {
  nickname: string;
  avatarUrl: string | null;
  artistWorld: {
    artistName: string | null;
    artistAge: number | null;
    artistCity: string | null;
    favoriteArtists: string[];
    lifeValues: string | null;
    teamPreference: string | null;
    identityStatement: string | null;
    mission: string | null;
    philosophy: string | null;
    coreThemes: string[];
    aestheticKeywords: string[];
    visualDirection: string | null;
    audienceCore: string | null;
    differentiator: string | null;
    fashionSignals: string[];
    visualBoards: Array<{
      id: string;
      slug: string;
      name: string;
      images: Array<{ id: string; imageUrl: string }>;
    }>;
  };
};

type CreateGoalState = {
  type: string;
  title: string;
  whyNow: string;
  successDefinition: string;
  targetDate: string;
};

type AddTaskState = {
  title: string;
  description: string;
  motionType: GoalMotionType;
  priority: GoalTask["priority"];
  ownerType: GoalTask["ownerType"];
  linkedTrackId: string;
  linkedProjectId: string;
};

type TaskLinkState = {
  motionType: GoalMotionType;
  linkedTrackId: string;
  linkedProjectId: string;
};

type TrackOption = {
  id: string;
  title: string;
};

type ProjectOption = {
  id: string;
  title: string;
};

const goalTypeOptions = [
  { value: "ALBUM_RELEASE", label: "Альбом" },
  { value: "MINI_TOUR", label: "Мини-тур" },
  { value: "FESTIVAL_RUN", label: "Фестивали" },
  { value: "SOLO_SHOW", label: "Сольный концерт" },
  { value: "MERCH_DROP", label: "Мерч-дроп" },
  { value: "CUSTOM_CAREER", label: "Карьерная цель" }
];

const priorityOptions: Array<{ value: GoalTask["priority"]; label: string }> = [
  { value: "HIGH", label: "Высокий" },
  { value: "MEDIUM", label: "Средний" },
  { value: "LOW", label: "Низкий" }
];

const ownerOptions: Array<{ value: GoalTask["ownerType"]; label: string }> = [
  { value: "SELF", label: "Сам артист" },
  { value: "TEAM", label: "Команда" },
  { value: "EXTERNAL", label: "Внешний исполнитель" }
];

const motionTypeOptions: Array<{ value: GoalMotionType; label: string }> = [
  { value: "CRAFT", label: "Craft" },
  { value: "CREATIVE", label: "Creative" }
];

function getDiagnosticTone(state: DiagnosticItem["state"]) {
  switch (state) {
    case "MISSING":
      return "border-red-300/60 bg-[#fff2ef] text-[#9b3426]";
    case "WEAK":
      return "border-amber-300/60 bg-[#fff7e8] text-[#8b5c16]";
    case "IN_PROGRESS":
      return "border-sky-300/60 bg-[#eef7ff] text-[#255a8b]";
    default:
      return "border-emerald-300/60 bg-[#edf8f0] text-[#2c6a40]";
  }
}

function getTaskStatusLabel(status: GoalTask["status"]) {
  switch (status) {
    case "TODO":
      return "К работе";
    case "IN_PROGRESS":
      return "В работе";
    case "BLOCKED":
      return "Блок";
    default:
      return "Готово";
  }
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Без даты";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Без даты";
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function resolveTaskHref(task: {
  linkedTrackId?: string | null;
  linkedProjectId?: string | null;
  linkedSpecialistCategory?: string | null;
}) {
  if (task.linkedTrackId) return `/songs/${task.linkedTrackId}`;
  if (task.linkedProjectId) return `/songs/projects/${task.linkedProjectId}`;
  if (task.linkedSpecialistCategory) return `/find?service=${task.linkedSpecialistCategory}`;
  return null;
}

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

function buildDefaultAddTaskState(): AddTaskState {
  return {
    title: "",
    description: "",
    motionType: "CRAFT",
    priority: "MEDIUM",
    ownerType: "SELF",
    linkedTrackId: "",
    linkedProjectId: ""
  };
}

function buildTaskLinkState(task: GoalTask): TaskLinkState {
  return {
    motionType: task.motionType,
    linkedTrackId: task.linkedTrackId ?? "",
    linkedProjectId: task.linkedProjectId ?? ""
  };
}

function getMotionTypeTone(type: GoalMotionType) {
  return type === "CRAFT"
    ? "border-[#cbd7f5] bg-[#eef3ff] text-[#28427a]"
    : "border-[#f1caa0] bg-[#fff3e5] text-[#8a4d12]";
}

function getTrajectoryTone(state: GoalTrajectoryReview["overallState"] | GoalTrajectoryReview["balanceState"] | GoalTrajectoryReview["focusState"] | GoalTrajectoryReview["deliveryState"]) {
  switch (state) {
    case "AT_RISK":
    case "SCATTERED":
    case "NO_FINISHING":
      return "border-red-300/60 bg-[#fff2ef] text-[#9b3426]";
    case "OFF_BALANCE":
    case "CRAFT_HEAVY":
    case "CREATIVE_HEAVY":
      return "border-amber-300/60 bg-[#fff7e8] text-[#8b5c16]";
    default:
      return "border-emerald-300/60 bg-[#edf8f0] text-[#2c6a40]";
  }
}

function getTrajectoryStateLabel(state: GoalTrajectoryReview["overallState"] | GoalTrajectoryReview["balanceState"] | GoalTrajectoryReview["focusState"] | GoalTrajectoryReview["deliveryState"]) {
  switch (state) {
    case "HEALTHY":
      return "Healthy";
    case "OFF_BALANCE":
      return "Off balance";
    case "AT_RISK":
      return "At risk";
    case "BALANCED":
      return "Balanced";
    case "CRAFT_HEAVY":
      return "Craft heavy";
    case "CREATIVE_HEAVY":
      return "Creative heavy";
    case "CENTERED":
      return "Centered";
    case "SCATTERED":
      return "Scattered";
    case "DELIVERING":
      return "Delivering";
    default:
      return "No finishing";
  }
}

function formatShare(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getBridgeStatusLabel(status: IdentityBridgeStatus) {
  switch (status) {
    case "STRONG":
      return "Сильная связь";
    case "PARTIAL":
      return "Частичная связь";
    case "WEAK":
      return "Слабая связь";
    default:
      return "Нет опоры";
  }
}

function getBridgeBadgeTone(status: IdentityBridgeStatus) {
  switch (status) {
    case "STRONG":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
    case "PARTIAL":
      return "border-sky-300/70 bg-sky-50 text-sky-900";
    case "WEAK":
      return "border-amber-300/70 bg-amber-50 text-amber-900";
    default:
      return "border-stone-300/70 bg-stone-100 text-stone-700";
  }
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";
}

function renderSupportChips(items: IdentitySupportChip[], tone = "border-brand-border bg-white text-brand-ink") {
  return items.map((item) => (
    <Badge key={item.id} className={tone}>
      {item.value}
    </Badge>
  ));
}

function renderFirstWarning(warnings: SoftWarning[] | undefined) {
  if (!warnings?.length) return null;
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="font-medium">{warnings[0].title}</p>
      <p className="mt-1 text-amber-800">{warnings[0].message}</p>
    </div>
  );
}

export function CommandCenterPage() {
  const toast = useToast();
  const { openPathOverlay } = usePathOverlay();
  const [goalForm, setGoalForm] = useState<CreateGoalState>({
    type: "ALBUM_RELEASE",
    title: "",
    whyNow: "",
    successDefinition: "",
    targetDate: ""
  });
  const [goalBusy, setGoalBusy] = useState(false);
  const [taskBusyId, setTaskBusyId] = useState("");
  const [addTaskOpenByPillar, setAddTaskOpenByPillar] = useState<Record<string, boolean>>({});
  const [addTaskFormByPillar, setAddTaskFormByPillar] = useState<Record<string, AddTaskState>>({});
  const [taskLinkOpenById, setTaskLinkOpenById] = useState<Record<string, boolean>>({});
  const [taskLinkDraftById, setTaskLinkDraftById] = useState<Record<string, TaskLinkState>>({});
  const [actionError, setActionError] = useState("");

  const {
    data,
    refetch: refetchOverview,
    isLoading
  } = useQuery({
    queryKey: ["home-overview", "command-center"],
    queryFn: () => fetcher<HomeOverview>("/api/home/overview")
  });

  const { data: goalsList, refetch: refetchGoals } = useQuery({
    queryKey: ["artist-goals"],
    queryFn: () => fetcher<GoalListResponse>("/api/goals")
  });

  const { data: idProfile } = useQuery({
    queryKey: ["id-profile", "artist-world"],
    queryFn: () => fetcher<IdProfile>("/api/id")
  });

  const { data: trackOptions = [] } = useQuery({
    queryKey: ["goal-task-track-options"],
    queryFn: () => fetcher<TrackOption[]>("/api/songs")
  });

  const { data: projectOptions = [] } = useQuery({
    queryKey: ["goal-task-project-options"],
    queryFn: () => fetcher<ProjectOption[]>("/api/projects")
  });

  const fallbackPrimaryGoal = (goalsList?.items ?? []).find((goal) => goal.isPrimary && goal.status === "ACTIVE") ?? null;
  const primaryGoalId = data?.commandCenter?.primaryGoal?.id ?? fallbackPrimaryGoal?.id ?? null;

  const { data: goalDetail, refetch: refetchGoalDetail } = useQuery({
    queryKey: ["artist-goal-detail", primaryGoalId],
    queryFn: () => fetcher<GoalDetail>(`/api/goals/${primaryGoalId}`),
    enabled: Boolean(primaryGoalId)
  });

  async function refreshAll() {
    await Promise.all([refetchOverview(), refetchGoals(), primaryGoalId ? refetchGoalDetail() : Promise.resolve()]);
  }

  async function createGoal() {
    setActionError("");
    if (!goalForm.title.trim() || !goalForm.successDefinition.trim() || !goalForm.targetDate.trim()) {
      setActionError("Для главной цели задай название, критерий успеха и дату.");
      return;
    }

    setGoalBusy(true);
    try {
      const response = await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: goalForm.type,
          title: goalForm.title,
          whyNow: goalForm.whyNow,
          successDefinition: goalForm.successDefinition,
          targetDate: goalForm.targetDate,
          isPrimary: true
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось создать цель."));
      }

      setGoalForm({
        type: "ALBUM_RELEASE",
        title: "",
        whyNow: "",
        successDefinition: "",
        targetDate: ""
      });
      await Promise.all([refetchGoals(), refetchOverview()]);
      toast.success("Главная цель создана.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось создать цель.");
    } finally {
      setGoalBusy(false);
    }
  }

  async function makeGoalPrimary(goalId: string) {
    setTaskBusyId(goalId);
    setActionError("");
    try {
      const response = await apiFetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true, status: "ACTIVE" })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось сделать цель главной."));
      }
      await Promise.all([refetchGoals(), refetchOverview()]);
      toast.success("Главная цель обновлена.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить цель.");
    } finally {
      setTaskBusyId("");
    }
  }

  async function markTaskForToday(taskId: string) {
    setTaskBusyId(taskId);
    setActionError("");
    try {
      const response = await apiFetch("/api/home/today-focus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось закрепить задачу на сегодня."));
      }
      await refreshAll();
      toast.success("Фокус на сегодня обновлён.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось закрепить задачу на сегодня.");
    } finally {
      setTaskBusyId("");
    }
  }

  async function toggleTodayFocus(isCompleted: boolean) {
    setTaskBusyId("today-focus");
    setActionError("");
    try {
      const response = await apiFetch("/api/home/today-focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить фокус дня."));
      }
      await refreshAll();
      toast.success(isCompleted ? "Фокус дня завершён." : "Фокус дня снова открыт.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить фокус дня.");
    } finally {
      setTaskBusyId("");
    }
  }

  async function updateTaskStatus(taskId: string, status: GoalTask["status"]) {
    setTaskBusyId(taskId);
    setActionError("");
    try {
      const response = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить статус задачи."));
      }
      await refreshAll();
      toast.success("Статус задачи обновлён.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить статус задачи.");
    } finally {
      setTaskBusyId("");
    }
  }

  async function addTask(goalId: string, pillarId: string) {
    const form = addTaskFormByPillar[pillarId] ?? buildDefaultAddTaskState();
    if (!form.title.trim()) {
      setActionError("Новая задача должна иметь название.");
      return;
    }

    setTaskBusyId(`add-${pillarId}`);
    setActionError("");
    try {
      const response = await apiFetch(`/api/goals/${goalId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillarId,
          title: form.title,
          description: form.description,
          motionType: form.motionType,
          priority: form.priority,
          ownerType: form.ownerType,
          linkedTrackId: form.linkedTrackId || null,
          linkedProjectId: form.linkedProjectId || null
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось добавить задачу."));
      }
      setAddTaskFormByPillar((current) => ({
        ...current,
        [pillarId]: buildDefaultAddTaskState()
      }));
      setAddTaskOpenByPillar((current) => ({ ...current, [pillarId]: false }));
      await refreshAll();
      toast.success("Задача добавлена в план.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось добавить задачу.");
    } finally {
      setTaskBusyId("");
    }
  }

  async function saveTaskLinks(taskId: string) {
    const draft = taskLinkDraftById[taskId];
    if (!draft) return;

    setTaskBusyId(`link-${taskId}`);
    setActionError("");
    try {
      const response = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motionType: draft.motionType,
          linkedTrackId: draft.linkedTrackId || null,
          linkedProjectId: draft.linkedProjectId || null
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить связи задачи."));
      }
      setTaskLinkOpenById((current) => ({ ...current, [taskId]: false }));
      await refreshAll();
      toast.success("Связи задачи обновлены.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить связи задачи.");
    } finally {
      setTaskBusyId("");
    }
  }

  if (isLoading) {
    return (
      <Card className="flex items-center gap-3 p-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand-muted" />
        <p className="text-sm text-brand-muted">Собираю command center...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="space-y-3 p-6">
        <CardTitle>Home overview недоступен</CardTitle>
        <CardDescription>Не удалось получить базовые данные для экрана Today.</CardDescription>
      </Card>
    );
  }

  const biggestRisk = data?.commandCenter?.position.biggestRisk ?? null;
  const primaryGoal = data?.commandCenter?.primaryGoal ?? (fallbackPrimaryGoal
    ? {
        id: fallbackPrimaryGoal.id,
        title: fallbackPrimaryGoal.title,
        type: fallbackPrimaryGoal.type,
        typeLabel: fallbackPrimaryGoal.typeLabel,
        status: fallbackPrimaryGoal.status,
        targetDate: fallbackPrimaryGoal.targetDate,
        successDefinition: fallbackPrimaryGoal.successDefinition,
        progress: fallbackPrimaryGoal.progress,
        trajectoryReview: fallbackPrimaryGoal.trajectoryReview,
        balanceSummary: fallbackPrimaryGoal.balanceSummary,
        identityBridge: fallbackPrimaryGoal.identityBridge,
        pillars: fallbackPrimaryGoal.pillars.map((pillar) => ({
          id: pillar.id,
          factor: pillar.factor,
          title: pillar.title,
          factorLabel: pillar.factorLabel,
          defaultMotionType: pillar.defaultMotionType,
          defaultMotionTypeLabel: pillar.defaultMotionTypeLabel,
          balance: pillar.balance,
          doneCount: pillar.progress.doneCount,
          totalCount: pillar.progress.totalCount
        }))
      }
    : null);
  const todayFocus = data?.commandCenter?.todayFocus ?? null;
  const diagnostics = data?.commandCenter?.diagnostics ?? [];
  const secondaryGoals = (goalsList?.items ?? []).filter((goal) => !goal.isPrimary);
  const artistName = idProfile?.nickname?.trim() || "Артист";
  const artistIdentity =
    idProfile?.artistWorld.identityStatement?.trim() ||
    idProfile?.artistWorld.mission?.trim() ||
    "Собери свой мир артиста, чтобы путь и цель были связаны с образом.";
  const focusGoalSubtitle = primaryGoal
    ? `${primaryGoal.typeLabel} • дедлайн ${formatDateLabel(primaryGoal.targetDate)}`
    : "Сначала нужна одна главная цель, чтобы система могла собрать осмысленный фокус дня.";
  const artistWorldFilled = Boolean(
    idProfile &&
      hasArtistWorldTextCore(idProfile.artistWorld) &&
      hasArtistWorldVisualContent(idProfile.artistWorld)
  );

  return (
    <div className="space-y-6 pb-8">
      <section className="space-y-4">
        <Card className="relative overflow-hidden border-brand-border bg-[#102629] text-white shadow-[0_24px_70px_rgba(16,38,41,0.26)]">
          {idProfile?.avatarUrl ? (
            <Image src={idProfile.avatarUrl} alt={artistName} fill className="object-cover" sizes="100vw" priority />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(16,38,41,0.18)_0%,rgba(16,38,41,0.36)_30%,rgba(16,38,41,0.76)_68%,rgba(16,38,41,0.96)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(115,221,255,0.24),transparent_34%),radial-gradient(circle_at_bottom,rgba(244,248,160,0.16),transparent_42%)]" />

          <div className="relative flex min-h-[520px] flex-col justify-end p-5 md:min-h-[620px] md:p-8">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <p className="text-5xl font-semibold tracking-tight text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.28)] md:text-7xl">
                {artistName}
              </p>

              <button
                type="button"
                onClick={openPathOverlay}
                className="mt-4 rounded-full border border-white/18 bg-white/10 px-5 py-2.5 text-sm font-medium text-white/92 backdrop-blur-md transition-colors hover:bg-white/20"
              >
                PATH этап: {data.stage.order}. {data.stage.name}
              </button>

              <p className="mt-3 max-w-xl text-sm text-white/76 md:text-base">{artistIdentity}</p>
            </div>
          </div>
        </Card>

        {primaryGoal ? (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="space-y-4">
              <CardHeader className="mb-0">
                <Badge className="w-fit border-brand-border bg-white text-brand-muted">
                  <Flag className="mr-1 h-3.5 w-3.5" />
                  Фокус-цель
                </Badge>
                <CardTitle className="text-xl">{primaryGoal.title}</CardTitle>
                <CardDescription>{focusGoalSubtitle}</CardDescription>
              </CardHeader>

              <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Критерий успеха</p>
                <p className="mt-2 text-sm text-brand-ink">{primaryGoal.successDefinition || "Не задан"}</p>
              </div>

              {primaryGoal.trajectoryReview ? (
                <div className="rounded-2xl border border-brand-border bg-[#f8f7f2] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Trajectory Review</p>
                    <Badge className={getTrajectoryTone(primaryGoal.trajectoryReview.overallState)}>
                      {getTrajectoryStateLabel(primaryGoal.trajectoryReview.overallState)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className={`rounded-2xl border px-3 py-3 ${getTrajectoryTone(primaryGoal.trajectoryReview.balanceState)}`}>
                      <p className="text-xs uppercase tracking-[0.12em]">Balance</p>
                      <p className="mt-1 text-sm font-medium">{getTrajectoryStateLabel(primaryGoal.trajectoryReview.balanceState)}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 ${getTrajectoryTone(primaryGoal.trajectoryReview.focusState)}`}>
                      <p className="text-xs uppercase tracking-[0.12em]">Focus</p>
                      <p className="mt-1 text-sm font-medium">{getTrajectoryStateLabel(primaryGoal.trajectoryReview.focusState)}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 ${getTrajectoryTone(primaryGoal.trajectoryReview.deliveryState)}`}>
                      <p className="text-xs uppercase tracking-[0.12em]">Delivery</p>
                      <p className="mt-1 text-sm font-medium">{getTrajectoryStateLabel(primaryGoal.trajectoryReview.deliveryState)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-brand-muted">
                      <span>Craft</span>
                      <span>Creative</span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#e9ece6]">
                      <div
                        className="h-full bg-[#4567a8]"
                        style={{ width: `${Math.max(8, primaryGoal.trajectoryReview.craftShare * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-brand-muted">
                      <span>{primaryGoal.trajectoryReview.craftFocusCount} focus • {formatShare(primaryGoal.trajectoryReview.craftShare)}</span>
                      <span>{primaryGoal.trajectoryReview.creativeFocusCount} focus • {formatShare(primaryGoal.trajectoryReview.creativeShare)}</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-brand-ink">{primaryGoal.trajectoryReview.summary}</p>
                  <SharedRecommendationCard
                    className="mt-4 bg-white/80"
                    recommendation={primaryGoal.trajectoryReview.recommendation}
                  />
                </div>
              ) : null}

	              <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Опирается на SAFE ID</p>
                  <Badge className={getBridgeBadgeTone(primaryGoal.identityBridge.status)}>
                    {getBridgeStatusLabel(primaryGoal.identityBridge.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-brand-ink">{primaryGoal.identityBridge.summary}</p>
                {primaryGoal.identityBridge.supports.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {renderSupportChips(primaryGoal.identityBridge.supports.slice(0, 5))}
                  </div>
                ) : null}
	                {primaryGoal.identityBridge.status === "WEAK" || primaryGoal.identityBridge.status === "MISSING"
	                  ? <div className="mt-3">{renderFirstWarning(primaryGoal.identityBridge.warnings)}</div>
	                  : null}
	              </div>

	              <div className="grid gap-3 sm:grid-cols-2">
                {primaryGoal.pillars.map((pillar) => (
                  <div key={pillar.id} className="rounded-2xl border border-brand-border bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">{pillar.factorLabel}</p>
                      <Badge className={getMotionTypeTone(pillar.defaultMotionType)}>{pillar.defaultMotionTypeLabel}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-brand-ink">{pillar.title}</p>
                    <p className="mt-1 text-xs text-brand-muted">
                      {pillar.doneCount}/{pillar.totalCount} задач завершено
                    </p>
                    <p className="mt-2 text-xs text-brand-muted">
                      Craft {pillar.balance.craftTaskCount} • Creative {pillar.balance.creativeTaskCount}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <CardHeader className="mb-0">
                <Badge className="w-fit border-brand-border bg-white text-brand-muted">
                  <MapPinned className="mr-1 h-3.5 w-3.5" />
                  PATH
                </Badge>
                <CardTitle className="text-xl">
                  {data.stage.order}. {data.stage.name}
                </CardTitle>
                <CardDescription>{data.stage.description}</CardDescription>
              </CardHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Ритм недели</p>
                  <p className="mt-2 text-sm font-medium text-brand-ink">{data.rhythm.score.toFixed(1)} / 7</p>
                  <p className="mt-1 text-sm text-brand-muted">{data.rhythm.message}</p>
                </div>
                <button
                  type="button"
                  onClick={openPathOverlay}
                  className="rounded-2xl border border-brand-border bg-white/80 p-4 text-left transition hover:bg-[#f7fbf2]"
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Подробный PATH</p>
                  <p className="mt-2 text-sm font-medium text-brand-ink">Открыть экран пути</p>
                  <p className="mt-1 text-sm text-brand-muted">Детальный экран с этапом, ритмом и микро-шагом.</p>
                </button>
              </div>

              {biggestRisk ? (
                <div className={`rounded-2xl border p-4 ${getDiagnosticTone(biggestRisk.state)}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Главный риск сейчас
                  </div>
                  <p className="mt-2 text-base font-semibold">{biggestRisk.title}</p>
                  <p className="mt-1 text-sm">{biggestRisk.message}</p>
                  <SharedRecommendationCard
                    className="mt-3 border-white/60 bg-white/70"
                    recommendation={biggestRisk.recommendation}
                    hideFutureAiSlot
                  />
                </div>
              ) : null}
            </Card>
          </div>
        ) : (
          <Card id="goal-onboarding" className="space-y-4">
            <CardHeader className="mb-0">
              <Badge className="w-fit border-brand-border bg-white text-brand-muted">
                <Flag className="mr-1 h-3.5 w-3.5" />
                Фокус-цель
              </Badge>
              <CardTitle className="text-xl">Сейчас у тебя нет зафиксированного направления</CardTitle>
              <CardDescription>Поставь одну карьерную цель, и система сразу разложит её на блоки, задачи и фокус на сегодня.</CardDescription>
            </CardHeader>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Тип цели</label>
                <Select value={goalForm.type} onChange={(event) => setGoalForm((current) => ({ ...current, type: event.target.value }))}>
                  {goalTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Дедлайн</label>
                <Input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(event) => setGoalForm((current) => ({ ...current, targetDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Название цели</label>
              <Input
                value={goalForm.title}
                onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: Альбом осенью 2026"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Почему сейчас</label>
              <Textarea
                value={goalForm.whyNow}
                onChange={(event) => setGoalForm((current) => ({ ...current, whyNow: event.target.value }))}
                placeholder="Почему этот период стоит посвятить именно этой цели"
                className="min-h-[92px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Критерий успеха</label>
              <Textarea
                value={goalForm.successDefinition}
                onChange={(event) => setGoalForm((current) => ({ ...current, successDefinition: event.target.value }))}
                placeholder="Что именно должно случиться, чтобы цель считалась достигнутой"
                className="min-h-[92px]"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled={goalBusy} onClick={() => void createGoal()}>
                {goalBusy ? "Создаю..." : "Поставить главную цель"}
              </Button>
              {!artistWorldFilled ? (
                <Link href="/id">
                  <Button variant="secondary">Заполнить мир артиста</Button>
                </Link>
              ) : null}
            </div>
          </Card>
        )}
      </section>

      {actionError ? <InlineActionMessage variant="error" message={actionError} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-4">
          <CardHeader className="mb-0">
            <div className="flex items-center gap-2">
              <Badge className="border-brand-border bg-white text-brand-muted">
                <Target className="mr-1 h-3.5 w-3.5" />
                Что делать сегодня
              </Badge>
            </div>
            <CardTitle className="text-xl">
              {todayFocus ? todayFocus.task.title : "Фокус дня появится после выбора главной цели"}
            </CardTitle>
            <CardDescription>
              {todayFocus ? `${todayFocus.pillar.title} -> ${todayFocus.goal.title}` : "Сначала нужен primary goal."}
            </CardDescription>
          </CardHeader>

          {todayFocus ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Сегодня</p>
                <p className="mt-2 text-lg font-semibold text-brand-ink">{todayFocus.task.title}</p>
                {todayFocus.task.description ? <p className="mt-2 text-sm text-brand-muted">{todayFocus.task.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={getMotionTypeTone(todayFocus.task.motionType)}>{todayFocus.task.motionTypeLabel}</Badge>
                  {todayFocus.task.linkedTrack?.workbenchStateLabel ? (
                    <Badge className="border-brand-border bg-[#eef7ff] text-brand-ink">{todayFocus.task.linkedTrack.workbenchStateLabel}</Badge>
                  ) : null}
                  {todayFocus.task.linkedTrack?.feedbackSummary.unresolvedItemsCount ? (
                    <Badge className="border-brand-border bg-[#fff3e5] text-brand-ink">
                      {todayFocus.task.linkedTrack.feedbackSummary.unresolvedItemsCount} unresolved feedback
                    </Badge>
                  ) : null}
                  {todayFocus.task.linkedTrack?.activeNextStep?.text ? (
                    <Badge className="border-brand-border bg-[#edf8f0] text-brand-ink">
                      Next: {todayFocus.task.linkedTrack.activeNextStep.text}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Задача</p>
                  <p className="mt-2 text-sm font-medium text-brand-ink">{todayFocus.task.title}</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Блок</p>
                  <p className="mt-2 text-sm font-medium text-brand-ink">{todayFocus.pillar.title}</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Цель</p>
                  <p className="mt-2 text-sm font-medium text-brand-ink">{todayFocus.goal.title}</p>
                </div>
              </div>

              {todayFocus.contextBridge ? (
	                <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Почему это поддерживает твой мир артиста</p>
                  <p className="mt-2 text-sm text-brand-ink">{todayFocus.contextBridge.summary}</p>
                  {todayFocus.contextBridge.supports.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {renderSupportChips(todayFocus.contextBridge.supports.slice(0, 5))}
                    </div>
                  ) : null}
                  {todayFocus.contextBridge.linkedTrack || todayFocus.contextBridge.linkedProject ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {todayFocus.contextBridge.linkedTrack ? (
                        <Badge className="border-brand-border bg-white text-brand-ink">
                          Трек: {todayFocus.contextBridge.linkedTrack.title}
                        </Badge>
                      ) : null}
                      {todayFocus.contextBridge.linkedProject ? (
                        <Badge className="border-brand-border bg-white text-brand-ink">
                          Проект: {todayFocus.contextBridge.linkedProject.title}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
	                  {renderFirstWarning(todayFocus.contextBridge.warnings)}
	                </div>
	              ) : null}

              <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Почему система выбрала именно это</p>
                <p className="mt-2 text-sm font-medium text-brand-ink">{todayFocus.selectionReason.reasonTitle}</p>
                <p className="mt-1 text-sm text-brand-muted">{todayFocus.selectionReason.reasonBody}</p>
                {todayFocus.cycleContext ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className={getTrajectoryTone(todayFocus.cycleContext.balanceState)}>Balance: {getTrajectoryStateLabel(todayFocus.cycleContext.balanceState)}</Badge>
                    <Badge className={getTrajectoryTone(todayFocus.cycleContext.focusState)}>Focus: {getTrajectoryStateLabel(todayFocus.cycleContext.focusState)}</Badge>
                    <Badge className={getTrajectoryTone(todayFocus.cycleContext.deliveryState)}>Delivery: {getTrajectoryStateLabel(todayFocus.cycleContext.deliveryState)}</Badge>
                  </div>
                ) : null}
              </div>

              <SharedRecommendationCard recommendation={todayFocus.recommendation} />

	              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={taskBusyId === "today-focus"}
                  onClick={() => void toggleTodayFocus(!todayFocus.isCompleted)}
                >
                  {todayFocus.isCompleted ? "Вернуть в работу" : "Отметить выполненным"}
                </Button>
                {resolveTaskHref(todayFocus.task) ? (
                  <Link href={resolveTaskHref(todayFocus.task) ?? "/today"}>
                    <Button variant="secondary">
                      {todayFocus.task.linkedSpecialistCategory ? "Открыть Find" : "Открыть связанный объект"}
                    </Button>
                  </Link>
                ) : null}
                <Badge className="border-brand-border bg-white text-brand-ink">
                  {todayFocus.source === "MANUAL" ? "Закреплено вручную" : "Подобрано системой"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted">
              Как только появится главная цель и хотя бы один плановый блок, здесь появится одно конкретное действие на день.
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <CardHeader className="mb-0">
            <div className="flex items-center gap-2">
              <Badge className="border-brand-border bg-white text-brand-muted">
                <Layers3 className="mr-1 h-3.5 w-3.5" />
                Что тормозит рост
              </Badge>
            </div>
            <CardTitle className="text-xl">Диагностика системы</CardTitle>
            <CardDescription>Слабые места показываются как объяснимые факторы, а не как абстрактный score.</CardDescription>
          </CardHeader>

          <div className="space-y-3">
            {diagnostics.map((item) => (
              <div key={item.factor} className={`rounded-2xl border p-4 ${getDiagnosticTone(item.state)}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <span className="text-xs uppercase tracking-[0.14em]">{item.state}</span>
                </div>
                <p className="mt-2 text-sm">{item.message}</p>
                <SharedRecommendationCard
                  className="mt-3 border-white/60 bg-white/70"
                  recommendation={item.recommendation}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {goalDetail ? (
        <section id="goal-plan" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">План цели</p>
              <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Декомпозиция главной цели</h2>
            </div>
            <Badge className="border-brand-border bg-white text-brand-ink">
              {goalDetail.progress.completedTasks}/{goalDetail.progress.totalTasks} задач завершено
            </Badge>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {goalDetail.pillars.map((pillar) => {
              const addTaskState = addTaskFormByPillar[pillar.id] ?? buildDefaultAddTaskState();
              return (
                <Card key={pillar.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">{pillar.factorLabel}</p>
                      <h3 className="mt-1 text-lg font-semibold text-brand-ink">{pillar.title}</h3>
                      <p className="mt-1 text-sm text-brand-muted">{pillar.purpose}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className={getMotionTypeTone(pillar.defaultMotionType)}>{pillar.defaultMotionTypeLabel}</Badge>
                        <Badge className="border-brand-border bg-white text-brand-ink">
                          Craft {pillar.balance.craftTaskCount} • Creative {pillar.balance.creativeTaskCount}
                        </Badge>
                      </div>
                    </div>
                    <Badge className="border-brand-border bg-white text-brand-ink">
                      {pillar.progress.doneCount}/{pillar.progress.totalCount}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {pillar.tasks.map((task) => {
                      const taskLinkState = taskLinkDraftById[task.id] ?? buildTaskLinkState(task);
                      return (
                        <div key={task.id} className="rounded-2xl border border-brand-border bg-white/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-brand-ink">{task.title}</p>
                              {task.description ? <p className="mt-1 text-sm text-brand-muted">{task.description}</p> : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={getMotionTypeTone(task.motionType)}>{task.motionTypeLabel}</Badge>
                              <Badge className="border-brand-border bg-white text-brand-ink">{getTaskStatusLabel(task.status)}</Badge>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className="border-brand-border bg-white text-brand-ink">{task.priority}</Badge>
                            <Badge className="border-brand-border bg-white text-brand-ink">{task.ownerType}</Badge>
                            {task.dueDate ? <Badge className="border-brand-border bg-white text-brand-ink">{formatDateLabel(task.dueDate)}</Badge> : null}
                            {task.linkedTrack ? <Badge className="border-brand-border bg-[#eef7ff] text-brand-ink">Трек: {task.linkedTrack.title}</Badge> : null}
                            {task.linkedTrack?.workbenchStateLabel ? <Badge className="border-brand-border bg-[#eef7ff] text-brand-ink">{task.linkedTrack.workbenchStateLabel}</Badge> : null}
                            {task.linkedTrack?.feedbackSummary.unresolvedItemsCount ? (
                              <Badge className="border-brand-border bg-[#fff3e5] text-brand-ink">
                                {task.linkedTrack.feedbackSummary.unresolvedItemsCount} unresolved
                              </Badge>
                            ) : null}
                            {task.linkedProject ? <Badge className="border-brand-border bg-[#f6f1ff] text-brand-ink">Проект: {task.linkedProject.title}</Badge> : null}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {task.status !== "IN_PROGRESS" ? (
                              <Button
                                variant="secondary"
                                className="text-xs"
                                disabled={taskBusyId === task.id}
                                onClick={() => void updateTaskStatus(task.id, "IN_PROGRESS")}
                              >
                                В работу
                              </Button>
                            ) : null}
                            {task.status !== "DONE" ? (
                              <Button
                                variant="secondary"
                                className="text-xs"
                                disabled={taskBusyId === task.id}
                                onClick={() => void updateTaskStatus(task.id, "DONE")}
                              >
                                Готово
                              </Button>
                            ) : null}
                            {task.status !== "BLOCKED" ? (
                              <Button
                                variant="ghost"
                                className="text-xs"
                                disabled={taskBusyId === task.id}
                                onClick={() => void updateTaskStatus(task.id, "BLOCKED")}
                              >
                                Блок
                              </Button>
                            ) : null}
                            {task.status !== "DONE" ? (
                              <Button
                                variant="ghost"
                                className="text-xs"
                                disabled={taskBusyId === task.id}
                                onClick={() => void markTaskForToday(task.id)}
                              >
                                На сегодня
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              className="text-xs"
                              onClick={() => {
                                setTaskLinkOpenById((current) => ({ ...current, [task.id]: !current[task.id] }));
                                setTaskLinkDraftById((current) => ({
                                  ...current,
                                  [task.id]: current[task.id] ?? buildTaskLinkState(task)
                                }));
                              }}
                            >
                              Связать
                            </Button>
                            {resolveTaskHref(task) ? (
                              <Link href={resolveTaskHref(task) ?? "/today"}>
                                <Button variant="ghost" className="text-xs">
                                  Открыть связанный объект
                                </Button>
                              </Link>
                            ) : null}
                          </div>

                          {taskLinkOpenById[task.id] ? (
                            <div className="mt-4 grid gap-3 rounded-2xl border border-brand-border bg-[#f7fbf2] p-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Тип задачи</label>
                                <Select
                                  value={taskLinkState.motionType}
                                  onChange={(event) =>
                                    setTaskLinkDraftById((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...taskLinkState,
                                        motionType: event.target.value as GoalMotionType
                                      }
                                    }))
                                  }
                                >
                                  {motionTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Трек</label>
                                <Select
                                  value={taskLinkState.linkedTrackId}
                                  onChange={(event) =>
                                    setTaskLinkDraftById((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...taskLinkState,
                                        linkedTrackId: event.target.value
                                      }
                                    }))
                                  }
                                >
                                  <option value="">Без трека</option>
                                  {trackOptions.map((trackOption) => (
                                    <option key={trackOption.id} value={trackOption.id}>
                                      {trackOption.title}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Проект</label>
                                <Select
                                  value={taskLinkState.linkedProjectId}
                                  onChange={(event) =>
                                    setTaskLinkDraftById((current) => ({
                                      ...current,
                                      [task.id]: {
                                        ...taskLinkState,
                                        linkedProjectId: event.target.value
                                      }
                                    }))
                                  }
                                >
                                  <option value="">Без проекта</option>
                                  {projectOptions.map((projectOption) => (
                                    <option key={projectOption.id} value={projectOption.id}>
                                      {projectOption.title}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                              <div className="flex flex-wrap gap-3 md:col-span-2">
                                <Button
                                  className="text-xs"
                                  disabled={taskBusyId === `link-${task.id}`}
                                  onClick={() => void saveTaskLinks(task.id)}
                                >
                                  Сохранить связи
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="text-xs"
                                  onClick={() => setTaskLinkOpenById((current) => ({ ...current, [task.id]: false }))}
                                >
                                  Скрыть
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-dashed border-brand-border bg-[#f7fbf2] p-4">
                    {addTaskOpenByPillar[pillar.id] ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Новая задача</label>
                            <Input
                              value={addTaskState.title}
                              onChange={(event) =>
                                setAddTaskFormByPillar((current) => ({
                                  ...current,
                                  [pillar.id]: {
                                    ...addTaskState,
                                    title: event.target.value
                                  }
                                }))
                              }
                              placeholder="Что именно нужно сделать"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Описание</label>
                            <Textarea
                              value={addTaskState.description}
                              onChange={(event) =>
                                setAddTaskFormByPillar((current) => ({
                                  ...current,
                                  [pillar.id]: {
                                    ...addTaskState,
                                    description: event.target.value
                                  }
                                }))
                              }
                              className="min-h-[96px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Тип задачи</label>
                            <Select
                              value={addTaskState.motionType}
                              onChange={(event) =>
                                setAddTaskFormByPillar((current) => ({
                                  ...current,
                                  [pillar.id]: {
                                    ...addTaskState,
                                    motionType: event.target.value as GoalMotionType
                                  }
                                }))
                              }
                            >
                              {motionTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Приоритет</label>
                            <Select
                              value={addTaskState.priority}
                              onChange={(event) =>
                                setAddTaskFormByPillar((current) => ({
                                  ...current,
                                  [pillar.id]: {
                                    ...addTaskState,
                                    priority: event.target.value as GoalTask["priority"]
                                  }
                                }))
                              }
                            >
                              {priorityOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Исполнитель</label>
                            <Select
                              value={addTaskState.ownerType}
                              onChange={(event) =>
                                setAddTaskFormByPillar((current) => ({
                                  ...current,
                                  [pillar.id]: {
                                    ...addTaskState,
                                    ownerType: event.target.value as GoalTask["ownerType"]
                                  }
                                }))
                              }
                            >
                              {ownerOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Трек</label>
                            <Select
                              value={addTaskState.linkedTrackId}
                              onChange={(event) =>
                                setAddTaskFormByPillar((current) => ({
                                  ...current,
                                  [pillar.id]: {
                                    ...addTaskState,
                                    linkedTrackId: event.target.value
                                  }
                                }))
                              }
                            >
                              <option value="">Без трека</option>
                              {trackOptions.map((trackOption) => (
                                <option key={trackOption.id} value={trackOption.id}>
                                  {trackOption.title}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Проект</label>
                            <Select
                              value={addTaskState.linkedProjectId}
                              onChange={(event) =>
                                setAddTaskFormByPillar((current) => ({
                                  ...current,
                                  [pillar.id]: {
                                    ...addTaskState,
                                    linkedProjectId: event.target.value
                                  }
                                }))
                              }
                            >
                              <option value="">Без проекта</option>
                              {projectOptions.map((projectOption) => (
                                <option key={projectOption.id} value={projectOption.id}>
                                  {projectOption.title}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button disabled={taskBusyId === `add-${pillar.id}`} onClick={() => void addTask(goalDetail.id, pillar.id)}>
                            Добавить в план
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setAddTaskOpenByPillar((current) => ({ ...current, [pillar.id]: false }))}
                          >
                            Скрыть
                          </Button>
                        </div>
                      </div>
                    ) : (
                        <Button
                        variant="secondary"
                        onClick={() => {
                          setAddTaskOpenByPillar((current) => ({ ...current, [pillar.id]: true }));
                          setAddTaskFormByPillar((current) => ({
                            ...current,
                            [pillar.id]:
                              current[pillar.id] ?? {
                                ...buildDefaultAddTaskState(),
                                motionType: pillar.defaultMotionType
                              }
                          }));
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Добавить задачу
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {secondaryGoals.length > 0 ? (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Другие цели</p>
            <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">В запасе и в следующем цикле</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {secondaryGoals.map((goal) => (
              <Card key={goal.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-brand-ink">{goal.title}</p>
                    <p className="mt-1 text-sm text-brand-muted">
                      {goal.typeLabel} • {goal.status.toLowerCase()} • {formatDateLabel(goal.targetDate)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className="border-brand-border bg-white text-brand-ink">
                      {goal.progress.completedTasks}/{goal.progress.totalTasks}
                    </Badge>
                    {goal.trajectoryReview ? (
                      <Badge className={getTrajectoryTone(goal.trajectoryReview.overallState)}>
                        {getTrajectoryStateLabel(goal.trajectoryReview.overallState)}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <Button
                  variant="secondary"
                  disabled={taskBusyId === goal.id}
                  onClick={() => void makeGoalPrimary(goal.id)}
                >
                  Сделать главной
                </Button>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <TodayCoreLoop checkIn={data.checkIn} dayLoop={data.dayLoop} onRefresh={refreshAll} />

        <Card className="space-y-4">
          <CardHeader className="mb-0">
            <div className="flex items-center gap-2">
              <Badge className="border-brand-border bg-white text-brand-muted">
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                Support
              </Badge>
            </div>
            <CardTitle className="text-xl">Опорные действия</CardTitle>
            <CardDescription>Вторичные действия не должны перебивать главную цель, но обязаны её поддерживать.</CardDescription>
          </CardHeader>

          <div className="space-y-3">
            <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
              <p className="text-sm font-medium text-brand-ink">SAFE ID / Мир артиста</p>
              <p className="mt-1 text-sm text-brand-muted">
                {artistWorldFilled
                  ? "Мир артиста уже заполнен частично или полностью. Его можно усилить через SAFE ID."
                  : "Мир артиста почти пустой. Это один из первых блоков, который стоит закрыть."}
              </p>
              <Link href="/id" className="mt-3 inline-flex text-sm font-medium underline underline-offset-4">
                Открыть SAFE ID
              </Link>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
              <p className="text-sm font-medium text-brand-ink">Songs и Find остаются сервисными слоями</p>
              <p className="mt-1 text-sm text-brand-muted">
                Музыкальные файлы и специалисты подключаются только тогда, когда помогают конкретной цели и задаче.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href="/songs">
                  <Button variant="secondary">Открыть Songs</Button>
                </Link>
                <Link href="/find">
                  <Button variant="secondary">Открыть Find</Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {todayFocus?.isCompleted ? (
        <div className="rounded-2xl border border-emerald-300/60 bg-[#edf8f0] p-4 text-[#2c6a40]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Фокус дня закрыт
          </div>
          <p className="mt-2 text-sm">Сегодняшнее действие уже отмечено выполненным. При необходимости можно открыть его снова.</p>
        </div>
      ) : null}
    </div>
  );
}
