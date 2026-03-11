"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Compass,
  Flag,
  Layers3,
  Loader2,
  MapPinned,
  Plus,
  Sparkles,
  Star,
  Target
} from "lucide-react";

import { RecommendationCard as SharedRecommendationCard } from "@/components/recommendations/recommendation-card";
import { TodayCoreLoop, type TodayCoreLoopData } from "@/components/home/today-core-loop";
import { usePathOverlay } from "@/components/home/path-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { RhythmDto } from "@/contracts/home";
import type { RecommendationCard as RecommendationCardData } from "@/contracts/recommendations";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";
import { hasArtistWorldTextCore, hasArtistWorldVisualContent } from "@/lib/artist-growth";
import type { GoalIdentityBridge, IdentityBridgeStatus, IdentitySupportChip, SoftWarning, TodayContextBridge } from "@/lib/id-integration";

type GoalMotionType = "CRAFT" | "CREATIVE";
type ExecutionTemplate = "SINGLE_RELEASE" | "ARTIST_PROFILE_REFRESH" | "TEAM_SEARCH" | "CUSTOM_PROJECT" | null;

type GoalTrajectoryReview = {
  overallState: "HEALTHY" | "OFF_BALANCE" | "AT_RISK";
  balanceState: "BALANCED" | "CRAFT_HEAVY" | "CREATIVE_HEAVY";
  focusState: "CENTERED" | "SCATTERED";
  deliveryState: "DELIVERING" | "AT_RISK" | "NO_FINISHING";
  craftFocusCount: number;
  creativeFocusCount: number;
  craftShare: number;
  creativeShare: number;
  summary: string;
  recommendation: RecommendationCardData;
};

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
    workbenchStateLabel: string;
    activeNextStep: { text: string } | null;
    feedbackSummary: { unresolvedItemsCount: number };
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
};

type ZoneSummary = {
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
  topOpenTasks?: GoalTask[];
  tasks?: GoalTask[];
};

type GapSummary = {
  state: "MISSING" | "WEAK" | "IN_PROGRESS" | "STRONG";
  title: string;
  message: string;
  recommendation: RecommendationCardData;
};

type ExecutionProjectSummary = {
  id: string;
  title: string;
  projectLabel: string;
  executionTemplate: ExecutionTemplate;
  type: string;
  typeLabel: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  isPrimary: boolean;
  whyNow: string | null;
  targetDate: string | null;
  successDefinition: string | null;
  progress: {
    completedTasks: number;
    totalTasks: number;
  };
  trajectoryReview: GoalTrajectoryReview | null;
  identityBridge: GoalIdentityBridge;
  gapSummary: GapSummary;
  recommendations: RecommendationCardData[];
  zones: Array<
    ZoneSummary & {
      doneCount?: number;
      totalCount?: number;
    }
  >;
};

type GoalDetail = ExecutionProjectSummary & {
  balance: {
    craftTaskCount: number;
    creativeTaskCount: number;
  };
  zones: Array<ZoneSummary & { tasks: GoalTask[]; topOpenTasks: GoalTask[] }>;
  pillars: Array<ZoneSummary & { tasks: GoalTask[] }>;
};

type RecommendedStart = {
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
  task: GoalTask;
  contextBridge: TodayContextBridge | null;
  selectionReason: {
    reasonTitle: string;
    reasonBody: string;
  };
  recommendation: RecommendationCardData;
} | null;

type HomeOverview = {
  stage: {
    order: number;
    name: string;
    description: string;
  };
  checkIn: {
    mood: "NORMAL" | "TOUGH" | "FLYING";
    note: string | null;
  } | null;
  rhythm: RhythmDto;
  dayLoop: TodayCoreLoopData;
  commandCenter: {
    activeProjects: ExecutionProjectSummary[];
    featuredProject: ExecutionProjectSummary | null;
    gapHighlights: Array<{
      key: string;
      projectId: string;
      projectTitle: string;
      projectLabel: string;
      state: GapSummary["state"];
      title: string;
      message: string;
      recommendation: RecommendationCardData;
    }>;
    recommendations: RecommendationCardData[];
    recommendedStart: RecommendedStart;
  } | null;
};

type IdProfile = {
  nickname: string;
  artistWorld: {
    identityStatement: string | null;
    mission: string | null;
    visualBoards: Array<{
      id: string;
      slug: string;
      name: string;
      sourceUrl?: string | null;
    }>;
  };
};

type TrackOption = {
  id: string;
  title: string;
};

type ProjectOption = {
  id: string;
  title: string;
};

type CreateProjectState = {
  executionTemplate: Exclude<ExecutionTemplate, null>;
  title: string;
  whyNow: string;
  targetDate: string;
  successDefinition: string;
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

const executionTemplateOptions: Array<{ value: Exclude<ExecutionTemplate, null>; label: string; description: string }> = [
  { value: "SINGLE_RELEASE", label: "Релиз сингла", description: "Музыка, образ, промо, команда и организация вокруг одного релиза." },
  { value: "ARTIST_PROFILE_REFRESH", label: "Обновить карточки артиста", description: "Образ, площадки и материалы под новое впечатление об артисте." },
  { value: "TEAM_SEARCH", label: "Поиск команды", description: "Запрос, роли, материалы и поиск нужного человека." },
  { value: "CUSTOM_PROJECT", label: "Свободный проект", description: "Гибкий проект с базовой структурой без пустого workspace." }
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

function getGapTone(state: GapSummary["state"]) {
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

function getMotionTypeTone(type: GoalMotionType) {
  return type === "CRAFT"
    ? "border-[#cbd7f5] bg-[#eef3ff] text-[#28427a]"
    : "border-[#f1caa0] bg-[#fff3e5] text-[#8a4d12]";
}

function getTaskStatusLabel(status: GoalTask["status"]) {
  switch (status) {
    case "TODO":
      return "К работе";
    case "IN_PROGRESS":
      return "В работе";
    case "BLOCKED":
      return "Стоп";
    default:
      return "Готово";
  }
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

function formatDateLabel(value?: string | null) {
  if (!value) return "Без срока";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Без срока";
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function resolveTaskHref(task: Pick<GoalTask, "linkedTrackId" | "linkedProjectId" | "linkedSpecialistCategory">) {
  if (task.linkedTrackId) return `/songs/${task.linkedTrackId}`;
  if (task.linkedProjectId) return `/songs/projects/${task.linkedProjectId}`;
  if (task.linkedSpecialistCategory) return `/find?service=${task.linkedSpecialistCategory}`;
  return null;
}

function getRecommendationGroupLabel(recommendation: RecommendationCardData) {
  const href = recommendation.primaryAction?.href ?? "";
  if (href.startsWith("/learn")) return "Материал";
  if (href.startsWith("/find")) return "Человек";
  if (href.startsWith("/songs")) return "Трек";
  if (href.startsWith("/id")) return "Профиль";
  return "Подсказка";
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

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

export function ExecutionCenterPage() {
  const toast = useToast();
  const { openPathOverlay } = usePathOverlay();
  const [createProjectState, setCreateProjectState] = useState<CreateProjectState>({
    executionTemplate: "SINGLE_RELEASE",
    title: "",
    whyNow: "",
    targetDate: "",
    successDefinition: ""
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [goalBusy, setGoalBusy] = useState(false);
  const [taskBusyId, setTaskBusyId] = useState("");
  const [addTaskOpenByZone, setAddTaskOpenByZone] = useState<Record<string, boolean>>({});
  const [addTaskFormByZone, setAddTaskFormByZone] = useState<Record<string, AddTaskState>>({});
  const [taskLinkOpenById, setTaskLinkOpenById] = useState<Record<string, boolean>>({});
  const [taskLinkDraftById, setTaskLinkDraftById] = useState<Record<string, TaskLinkState>>({});
  const [actionError, setActionError] = useState("");

  const { data, refetch: refetchOverview, isLoading } = useQuery({
    queryKey: ["home-overview", "execution-center"],
    queryFn: () => fetcher<HomeOverview>("/api/home/overview")
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

  const activeProjects = data?.commandCenter?.activeProjects ?? [];
  const featuredProject = data?.commandCenter?.featuredProject ?? null;
  const firstActiveProjectId = activeProjects[0]?.id ?? null;

  useEffect(() => {
    setSelectedProjectId((current) => current ?? featuredProject?.id ?? firstActiveProjectId);
  }, [featuredProject?.id, firstActiveProjectId]);

  const { data: projectDetail, refetch: refetchProjectDetail } = useQuery({
    queryKey: ["execution-project-detail", selectedProjectId],
    queryFn: () => fetcher<GoalDetail>(`/api/goals/${selectedProjectId}`),
    enabled: Boolean(selectedProjectId)
  });

  async function refreshAll() {
    await Promise.all([refetchOverview(), selectedProjectId ? refetchProjectDetail() : Promise.resolve()]);
  }

  async function createProject() {
    setActionError("");
    if (!createProjectState.title.trim()) {
      setActionError("У проекта должно быть название.");
      return;
    }

    setGoalBusy(true);
    try {
      const response = await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executionTemplate: createProjectState.executionTemplate,
          title: createProjectState.title,
          whyNow: createProjectState.whyNow,
          targetDate: createProjectState.targetDate || null,
          successDefinition: createProjectState.successDefinition || null
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось создать проект."));
      }

      setCreateProjectState({
        executionTemplate: "SINGLE_RELEASE",
        title: "",
        whyNow: "",
        targetDate: "",
        successDefinition: ""
      });
      await refetchOverview();
      toast.success("Проект создан.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось создать проект.");
    } finally {
      setGoalBusy(false);
    }
  }

  async function makeProjectFeatured(projectId: string) {
    setTaskBusyId(projectId);
    setActionError("");
    try {
      const response = await apiFetch(`/api/goals/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true, status: "ACTIVE" })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось сделать проект главным."));
      }
      setSelectedProjectId(projectId);
      await refreshAll();
      toast.success("Главный проект обновлён.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить проект.");
    } finally {
      setTaskBusyId("");
    }
  }

  async function markTaskForRecommendedStart(taskId: string) {
    setTaskBusyId(taskId);
    setActionError("");
    try {
      const response = await apiFetch("/api/home/today-focus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить Recommended Start."));
      }
      await refreshAll();
      toast.success("Recommended Start обновлён.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить Recommended Start.");
    } finally {
      setTaskBusyId("");
    }
  }

  async function toggleRecommendedStart(isCompleted: boolean) {
    setTaskBusyId("recommended-start");
    setActionError("");
    try {
      const response = await apiFetch("/api/home/today-focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить Recommended Start."));
      }
      await refreshAll();
      toast.success(isCompleted ? "Recommended Start отмечен." : "Recommended Start снова открыт.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Не удалось обновить Recommended Start.");
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
    const form = addTaskFormByZone[pillarId] ?? buildDefaultAddTaskState();
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
      setAddTaskFormByZone((current) => ({ ...current, [pillarId]: buildDefaultAddTaskState() }));
      setAddTaskOpenByZone((current) => ({ ...current, [pillarId]: false }));
      await refreshAll();
      toast.success("Задача добавлена в зону.");
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
        <p className="text-sm text-brand-muted">Собираю execution-layer...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="space-y-3 p-6">
        <CardTitle>Today недоступен</CardTitle>
        <CardDescription>Не удалось получить данные для execution-layer.</CardDescription>
      </Card>
    );
  }

  const artistName = idProfile?.nickname?.trim() || "Артист";
  const artistIdentity =
    idProfile?.artistWorld.identityStatement?.trim() ||
    idProfile?.artistWorld.mission?.trim() ||
    "Собери свой мир артиста, чтобы проекты были связаны с образом, а не висели отдельными списками.";
  const artistWorldFilled = Boolean(
    idProfile &&
      hasArtistWorldTextCore(idProfile.artistWorld) &&
      hasArtistWorldVisualContent(idProfile.artistWorld)
  );
  const recommendedStart = data.commandCenter?.recommendedStart ?? null;
  const displayedProjects = activeProjects.slice(0, 3);
  const extraProjectsCount = Math.max(0, activeProjects.length - displayedProjects.length);

  return (
    <div className="space-y-6 pb-8">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="relative overflow-hidden border-brand-border bg-[#102629] text-white shadow-[0_24px_70px_rgba(16,38,41,0.26)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,rgba(95,235,190,0.08),rgba(16,38,41,0.98)),radial-gradient(circle_at_top_right,rgba(124,172,255,0.16),transparent_30%)]" />
          <div className="relative p-6 md:p-8">
            <Badge className="border-white/15 bg-white/10 text-white">Execution Layer</Badge>
            <CardTitle className="mt-4 text-3xl text-white md:text-4xl">{artistName}</CardTitle>
            <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">{artistIdentity}</p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={openPathOverlay}
                className="rounded-2xl border border-white/12 bg-white/8 p-4 text-left transition hover:bg-white/12"
              >
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Путь</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {data.stage.order}. {data.stage.name}
                </p>
                <p className="mt-1 text-sm text-white/70">{data.stage.description}</p>
              </button>
              <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Ритм</p>
                <p className="mt-2 text-lg font-semibold text-white">{data.rhythm.score.toFixed(1)} / 7</p>
                <p className="mt-1 text-sm text-white/70">{data.rhythm.message}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/60">Проекты</p>
                <p className="mt-2 text-lg font-semibold text-white">{activeProjects.length || 0}</p>
                <p className="mt-1 text-sm text-white/70">
                  {featuredProject ? `Главный сейчас: ${featuredProject.projectLabel}` : "Пока без активных execution-проектов"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <CardHeader className="mb-0">
            <Badge className="w-fit border-brand-border bg-white text-brand-muted">
              <MapPinned className="mr-1 h-3.5 w-3.5" />
              Path Snapshot
            </Badge>
            <CardTitle className="text-xl">{featuredProject ? "Главный проект периода" : "Сначала собери первый проект"}</CardTitle>
            <CardDescription>
              {featuredProject
                ? `${featuredProject.projectLabel} • ${formatDateLabel(featuredProject.targetDate)}`
                : "Execution-layer строится вокруг проектов, а не вокруг пустого списка задач."}
            </CardDescription>
          </CardHeader>

          {featuredProject ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{featuredProject.title}</p>
                    <p className="mt-1 text-sm text-brand-muted">{featuredProject.gapSummary.message}</p>
                  </div>
                  <Badge className={getGapTone(featuredProject.gapSummary.state)}>{featuredProject.gapSummary.state}</Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Опора на мир артиста</p>
                  <Badge className={getBridgeBadgeTone(featuredProject.identityBridge.status)}>
                    {getBridgeStatusLabel(featuredProject.identityBridge.status)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-brand-ink">{featuredProject.identityBridge.summary}</p>
                {featuredProject.identityBridge.supports.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">{renderSupportChips(featuredProject.identityBridge.supports.slice(0, 5))}</div>
                ) : null}
                {renderFirstWarning(featuredProject.identityBridge.warnings)}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted">
              Создай первый проект из шаблона, и система сразу соберёт зоны, задачи, пробелы и рекомендации.
            </div>
          )}
        </Card>
      </section>

      {!activeProjects.length ? (
        <Card className="space-y-4" id="project-onboarding">
          <CardHeader className="mb-0">
            <Badge className="w-fit border-brand-border bg-white text-brand-muted">
              <Flag className="mr-1 h-3.5 w-3.5" />
              Первый проект
            </Badge>
            <CardTitle className="text-xl">Создай execution-проект, а не пустой workspace</CardTitle>
            <CardDescription>Выбери шаблон, задай название, и система сама соберёт базовую структуру движения.</CardDescription>
          </CardHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Шаблон проекта</label>
              <Select
                value={createProjectState.executionTemplate}
                onChange={(event) =>
                  setCreateProjectState((current) => ({
                    ...current,
                    executionTemplate: event.target.value as CreateProjectState["executionTemplate"]
                  }))
                }
              >
                {executionTemplateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-brand-muted">
                {executionTemplateOptions.find((option) => option.value === createProjectState.executionTemplate)?.description}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Срок (опционально)</label>
              <Input
                type="date"
                value={createProjectState.targetDate}
                onChange={(event) => setCreateProjectState((current) => ({ ...current, targetDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Название проекта</label>
            <Input
              value={createProjectState.title}
              onChange={(event) => setCreateProjectState((current) => ({ ...current, title: event.target.value }))}
              placeholder="Например: Релиз сингла «Север»"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Почему сейчас</label>
            <Textarea
              value={createProjectState.whyNow}
              onChange={(event) => setCreateProjectState((current) => ({ ...current, whyNow: event.target.value }))}
              placeholder="Что в твоём текущем этапе делает этот проект важным"
              className="min-h-[92px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Что должно получиться (опционально)</label>
            <Textarea
              value={createProjectState.successDefinition}
              onChange={(event) => setCreateProjectState((current) => ({ ...current, successDefinition: event.target.value }))}
              placeholder="Как ты поймёшь, что проект реально двигается"
              className="min-h-[92px]"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={goalBusy} onClick={() => void createProject()}>
              {goalBusy ? "Создаю..." : "Создать проект"}
            </Button>
            {!artistWorldFilled ? (
              <Link href="/id">
                <Button variant="secondary">Заполнить SAFE ID</Button>
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      {actionError ? <InlineActionMessage variant="error" message={actionError} /> : null}

      {activeProjects.length ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Active Projects</p>
              <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Через что ты сейчас двигаешься</h2>
            </div>
            {extraProjectsCount > 0 ? (
              <Badge className="border-brand-border bg-white text-brand-ink">Ещё проектов: {extraProjectsCount}</Badge>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {displayedProjects.map((project) => (
              <Card key={project.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge className="border-brand-border bg-white text-brand-muted">{project.projectLabel}</Badge>
                    <p className="mt-3 text-lg font-semibold text-brand-ink">{project.title}</p>
                    <p className="mt-1 text-sm text-brand-muted">{formatDateLabel(project.targetDate)}</p>
                  </div>
                  {project.isPrimary ? (
                    <Badge className="border-emerald-300/60 bg-emerald-50 text-emerald-900">
                      <Star className="mr-1 h-3.5 w-3.5" />
                      Главный
                    </Badge>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-brand-muted">
                    <span>Прогресс</span>
                    <span>
                      {project.progress.completedTasks}/{project.progress.totalTasks}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9ece6]">
                    <div
                      className="h-full bg-[#2A342C]"
                      style={{
                        width: `${project.progress.totalTasks > 0 ? Math.max(6, (project.progress.completedTasks / project.progress.totalTasks) * 100) : 6}%`
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm font-medium text-brand-ink">{project.gapSummary.title}</p>
                  <p className="mt-1 text-sm text-brand-muted">{project.gapSummary.message}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {project.zones.slice(0, 2).map((zone) => (
                    <div key={zone.id} className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">{zone.title}</p>
                      <p className="mt-1 text-sm text-brand-ink">
                        {(zone.doneCount ?? zone.progress?.doneCount ?? 0)}/{(zone.totalCount ?? zone.progress?.totalCount ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      document.getElementById("execution-project-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Открыть проект
                  </Button>
                  {!project.isPrimary ? (
                    <Button variant="secondary" disabled={taskBusyId === project.id} onClick={() => void makeProjectFeatured(project.id)}>
                      Сделать главным
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {data.commandCenter?.gapHighlights?.length ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">What Is Missing</p>
            <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Что сейчас упускается</h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {data.commandCenter.gapHighlights.map((gap) => (
              <Card key={gap.key} className={`space-y-4 ${getGapTone(gap.state)}`}>
                <div className="flex items-center justify-between gap-3">
                  <Badge className="border-current/20 bg-white/55 text-current">{gap.projectLabel}</Badge>
                  <span className="text-xs uppercase tracking-[0.14em]">{gap.state}</span>
                </div>
                <div>
                  <p className="text-lg font-semibold">{gap.title}</p>
                  <p className="mt-2 text-sm">{gap.message}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedProjectId(gap.projectId);
                      document.getElementById("execution-project-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Открыть проект
                  </Button>
                  {gap.recommendation.primaryAction?.href ? (
                    <Link href={gap.recommendation.primaryAction.href}>
                      <Button variant="ghost">{gap.recommendation.primaryAction.label}</Button>
                    </Link>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {data.commandCenter?.recommendations?.length ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Recommendations</p>
            <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Что может усилить движение</h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {data.commandCenter.recommendations.map((recommendation) => (
              <SharedRecommendationCard
                key={recommendation.key}
                recommendation={recommendation}
                meta={<Badge className="border-brand-border bg-white text-brand-muted">{getRecommendationGroupLabel(recommendation)}</Badge>}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Recommended Start</p>
          <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">С чего проще начать, если нужен вход</h2>
        </div>

        {recommendedStart ? (
          <Card className="space-y-4">
            <CardHeader className="mb-0">
              <Badge className="border-brand-border bg-white text-brand-muted">
                <Target className="mr-1 h-3.5 w-3.5" />
                Recommended Start
              </Badge>
              <CardTitle className="text-xl">{recommendedStart.task.title}</CardTitle>
              <CardDescription>
                {recommendedStart.pillar.title} {"->"} {recommendedStart.goal.title}
              </CardDescription>
            </CardHeader>

            <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Почему это может помочь сейчас</p>
              <p className="mt-2 text-sm font-medium text-brand-ink">{recommendedStart.selectionReason.reasonTitle}</p>
              <p className="mt-1 text-sm text-brand-muted">{recommendedStart.selectionReason.reasonBody}</p>
            </div>

            {recommendedStart.contextBridge ? (
              <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Как это связано с твоим миром артиста</p>
                <p className="mt-2 text-sm text-brand-ink">{recommendedStart.contextBridge.summary}</p>
                {recommendedStart.contextBridge.supports.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">{renderSupportChips(recommendedStart.contextBridge.supports.slice(0, 5))}</div>
                ) : null}
                {renderFirstWarning(recommendedStart.contextBridge.warnings)}
              </div>
            ) : null}

            <SharedRecommendationCard recommendation={recommendedStart.recommendation} />

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={taskBusyId === "recommended-start"}
                onClick={() => void toggleRecommendedStart(!recommendedStart.isCompleted)}
              >
                {recommendedStart.isCompleted ? "Вернуть в работу" : "Отметить сделанным"}
              </Button>
              {resolveTaskHref(recommendedStart.task) ? (
                <Link href={resolveTaskHref(recommendedStart.task) ?? "/today"}>
                  <Button variant="secondary">Открыть связанный объект</Button>
                </Link>
              ) : null}
              <Badge className="border-brand-border bg-white text-brand-ink">
                {recommendedStart.source === "MANUAL" ? "Выбрано вручную" : "Подсказано системой"}
              </Badge>
            </div>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted">
            Recommended Start здесь необязателен. Если входная точка не нужна, просто двигай проекты через зоны и приоритеты.
          </Card>
        )}
      </section>

      {projectDetail ? (
        <section id="execution-project-detail" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Project Detail</p>
              <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">{projectDetail.title}</h2>
              <p className="mt-1 text-sm text-brand-muted">
                {projectDetail.projectLabel} • {formatDateLabel(projectDetail.targetDate)}
              </p>
            </div>
            <Badge className="border-brand-border bg-white text-brand-ink">
              {projectDetail.progress.completedTasks}/{projectDetail.progress.totalTasks} задач завершено
            </Badge>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="space-y-4">
              <CardHeader className="mb-0">
                <Badge className="w-fit border-brand-border bg-white text-brand-muted">
                  <Compass className="mr-1 h-3.5 w-3.5" />
                  Каркас проекта
                </Badge>
                <CardTitle className="text-xl">{projectDetail.gapSummary.title}</CardTitle>
                <CardDescription>{projectDetail.gapSummary.message}</CardDescription>
              </CardHeader>

              <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Почему сейчас</p>
                <p className="mt-2 text-sm text-brand-ink">{projectDetail.whyNow || "Контекст ещё не зафиксирован."}</p>
              </div>

              <div className="rounded-2xl border border-brand-border bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Что должно получиться</p>
                <p className="mt-2 text-sm text-brand-ink">{projectDetail.successDefinition || "Результат ещё не сформулирован."}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {projectDetail.zones.map((zone) => (
                  <div key={zone.id} className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-brand-ink">{zone.title}</p>
                      <Badge className={getMotionTypeTone(zone.defaultMotionType)}>{zone.defaultMotionTypeLabel}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-brand-muted">
                      {zone.progress.doneCount}/{zone.progress.totalCount}
                    </p>
                    <p className="mt-2 text-xs text-brand-muted">
                      Craft {zone.balance.craftTaskCount} • Creative {zone.balance.creativeTaskCount}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <CardHeader className="mb-0">
                <Badge className="w-fit border-brand-border bg-white text-brand-muted">
                  <Layers3 className="mr-1 h-3.5 w-3.5" />
                  Зоны и задачи
                </Badge>
                <CardTitle className="text-xl">Развернутый план проекта</CardTitle>
                <CardDescription>Внутри каждой зоны можно донастроить структуру и связать задачи с экосистемой.</CardDescription>
              </CardHeader>

              <div className="space-y-4">
                {projectDetail.zones.map((zone) => {
                  const addTaskState = addTaskFormByZone[zone.id] ?? buildDefaultAddTaskState();
                  return (
                    <div key={zone.id} className="rounded-3xl border border-brand-border bg-white/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-brand-ink">{zone.title}</p>
                          <p className="mt-1 text-sm text-brand-muted">{zone.purpose}</p>
                        </div>
                        <Badge className="border-brand-border bg-white text-brand-ink">
                          {zone.progress.doneCount}/{zone.progress.totalCount}
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-3">
                        {(zone.tasks ?? []).map((task) => {
                          const taskLinkState = taskLinkDraftById[task.id] ?? buildTaskLinkState(task);
                          return (
                            <div key={task.id} className="rounded-2xl border border-brand-border bg-[#fbfcfa] p-4">
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
                                {task.linkedProject ? <Badge className="border-brand-border bg-[#f6f1ff] text-brand-ink">Проект: {task.linkedProject.title}</Badge> : null}
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                {task.status !== "IN_PROGRESS" ? (
                                  <Button variant="secondary" className="text-xs" disabled={taskBusyId === task.id} onClick={() => void updateTaskStatus(task.id, "IN_PROGRESS")}>
                                    В работу
                                  </Button>
                                ) : null}
                                {task.status !== "DONE" ? (
                                  <Button variant="secondary" className="text-xs" disabled={taskBusyId === task.id} onClick={() => void updateTaskStatus(task.id, "DONE")}>
                                    Готово
                                  </Button>
                                ) : null}
                                {task.status !== "BLOCKED" ? (
                                  <Button variant="ghost" className="text-xs" disabled={taskBusyId === task.id} onClick={() => void updateTaskStatus(task.id, "BLOCKED")}>
                                    Стоп
                                  </Button>
                                ) : null}
                                {task.status !== "DONE" ? (
                                  <Button variant="ghost" className="text-xs" disabled={taskBusyId === task.id} onClick={() => void markTaskForRecommendedStart(task.id)}>
                                    На старт
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  className="text-xs"
                                  onClick={() => {
                                    setTaskLinkOpenById((current) => ({ ...current, [task.id]: !current[task.id] }));
                                    setTaskLinkDraftById((current) => ({ ...current, [task.id]: current[task.id] ?? buildTaskLinkState(task) }));
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
                                          [task.id]: { ...taskLinkState, motionType: event.target.value as GoalMotionType }
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
                                          [task.id]: { ...taskLinkState, linkedTrackId: event.target.value }
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
                                    <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Проект Songs</label>
                                    <Select
                                      value={taskLinkState.linkedProjectId}
                                      onChange={(event) =>
                                        setTaskLinkDraftById((current) => ({
                                          ...current,
                                          [task.id]: { ...taskLinkState, linkedProjectId: event.target.value }
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
                                    <Button className="text-xs" disabled={taskBusyId === `link-${task.id}`} onClick={() => void saveTaskLinks(task.id)}>
                                      Сохранить связи
                                    </Button>
                                    <Button variant="secondary" className="text-xs" onClick={() => setTaskLinkOpenById((current) => ({ ...current, [task.id]: false }))}>
                                      Скрыть
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 rounded-2xl border border-dashed border-brand-border bg-[#f7fbf2] p-4">
                        {addTaskOpenByZone[zone.id] ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Новая задача</label>
                                <Input
                                  value={addTaskState.title}
                                  onChange={(event) =>
                                    setAddTaskFormByZone((current) => ({
                                      ...current,
                                      [zone.id]: { ...addTaskState, title: event.target.value }
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
                                    setAddTaskFormByZone((current) => ({
                                      ...current,
                                      [zone.id]: { ...addTaskState, description: event.target.value }
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
                                    setAddTaskFormByZone((current) => ({
                                      ...current,
                                      [zone.id]: { ...addTaskState, motionType: event.target.value as GoalMotionType }
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
                                    setAddTaskFormByZone((current) => ({
                                      ...current,
                                      [zone.id]: { ...addTaskState, priority: event.target.value as GoalTask["priority"] }
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
                                    setAddTaskFormByZone((current) => ({
                                      ...current,
                                      [zone.id]: { ...addTaskState, ownerType: event.target.value as GoalTask["ownerType"] }
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
                                    setAddTaskFormByZone((current) => ({
                                      ...current,
                                      [zone.id]: { ...addTaskState, linkedTrackId: event.target.value }
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
                                <label className="text-xs font-medium uppercase tracking-[0.12em] text-brand-muted">Проект Songs</label>
                                <Select
                                  value={addTaskState.linkedProjectId}
                                  onChange={(event) =>
                                    setAddTaskFormByZone((current) => ({
                                      ...current,
                                      [zone.id]: { ...addTaskState, linkedProjectId: event.target.value }
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
                              <Button disabled={taskBusyId === `add-${zone.id}`} onClick={() => void addTask(projectDetail.id, zone.id)}>
                                Добавить в зону
                              </Button>
                              <Button variant="secondary" onClick={() => setAddTaskOpenByZone((current) => ({ ...current, [zone.id]: false }))}>
                                Скрыть
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setAddTaskOpenByZone((current) => ({ ...current, [zone.id]: true }));
                              setAddTaskFormByZone((current) => ({
                                ...current,
                                [zone.id]: current[zone.id] ?? { ...buildDefaultAddTaskState(), motionType: zone.defaultMotionType }
                              }));
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Добавить задачу
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Track Loop</p>
          <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Песенный цикл дня</h2>
        </div>
        <TodayCoreLoop checkIn={data.checkIn} dayLoop={data.dayLoop} onRefresh={refreshAll} />
      </section>
    </div>
  );
}
