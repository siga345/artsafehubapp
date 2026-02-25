"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { MultiTrackRecorder } from "@/components/audio/multi-track-recorder";
import { PlaybackIcon } from "@/components/songs/playback-icon";
import { SongAnalysisBadges } from "@/components/songs/song-analysis-badges";
import { useSongsPlayback, type SongsPlaybackItem } from "@/components/songs/songs-playback-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import {
  appendAudioAnalysisToFormData,
  detectAudioAnalysisMvp,
  type UploadAudioAnalysisMeta
} from "@/lib/audio/upload-analysis-client";
import { buildProjectCoverStyle } from "@/lib/project-cover-style";
import { pickPreferredPlaybackDemo, playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";
import { saveNewSongFlowDraft, type NewSongFlowDraft } from "@/lib/songs/new-song-flow-draft";
import { getProjectOpenHref } from "@/lib/songs-project-navigation";
import {
  findIdeaStage,
  isDemoSongStage,
  isSelectableSongCreationStage,
  resolveVersionTypeByStage
} from "@/lib/songs-version-stage-map";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  FolderOpen,
  MoreHorizontal,
  Music2,
  Pencil,
  PlayCircle,
  PlusCircle,
  Sparkles,
  Wand2
} from "lucide-react";

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED" | "RELEASE";
type AddTrackQuickAction = "convert" | "import" | "record";
type ProjectSongFlowStep = "lyrics" | "stage" | "file-upload";
type PathStage = { id: number; name: string };

type ProjectTrack = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  primaryDemoId?: string | null;
  displayBpm?: number | null;
  displayKeyRoot?: string | null;
  displayKeyMode?: string | null;
  pathStage?: { id: number; name: string } | null;
  _count?: { demos: number };
  primaryDemo?: {
    id: string;
    audioUrl: string | null;
    duration: number;
    createdAt: string;
    versionType: DemoVersionType;
    textNote?: string | null;
  } | null;
  demos: Array<{
    id: string;
    audioUrl: string | null;
    duration: number;
    createdAt: string;
    sortIndex?: number;
    versionType: DemoVersionType;
    textNote?: string | null;
  }>;
};

type ProjectDetail = {
  id: string;
  title: string;
  artistLabel?: string | null;
  folderId: string | null;
  updatedAt: string;
  releaseKind: "SINGLE" | "ALBUM";
  singleTrackId?: string | null;
  coverType: "GRADIENT" | "IMAGE";
  coverImageUrl?: string | null;
  coverPresetKey?: string | null;
  coverColorA?: string | null;
  coverColorB?: string | null;
  folder?: { id: string; title: string } | null;
  tracks: ProjectTrack[];
  _count?: { tracks: number };
};

type CoverPreset = {
  key: string;
  label: string;
  colorA: string;
  colorB: string;
  releaseKind?: "SINGLE" | "ALBUM";
};

const COVER_PRESETS: CoverPreset[] = [
  { key: "untitled-pink", label: "Pink Fade", colorA: "#F6B4E6", colorB: "#E46AE8" },
  { key: "citrus-neon", label: "Citrus", colorA: "#FFE66D", colorB: "#FF7A18" },
  { key: "lime-grove", label: "Lime", colorA: "#D9F99D", colorB: "#65A30D" },
  { key: "sky-blue", label: "Sky", colorA: "#A8D8FF", colorB: "#5B7CFA" },
  { key: "ash-graphite", label: "Graphite", colorA: "#C9CED6", colorB: "#4A5563" },
  { key: "rose-night", label: "Rose Night", colorA: "#FF9AC3", colorB: "#7A2A5F" },
  { key: "sand-olive", label: "Sand", colorA: "#E9DFC8", colorB: "#88906A" },
  { key: "lava-red", label: "Lava", colorA: "#FF6B57", colorB: "#7F1D1D" },
  { key: "violet-ink", label: "Violet", colorA: "#BFA7FF", colorB: "#3D2C8D" },
  { key: "teal-glow", label: "Teal", colorA: "#78F2E8", colorB: "#0B7285" },
  { key: "mono-cream", label: "Cream", colorA: "#F5F1E8", colorB: "#D8D3C8" },
  { key: "lime-punch", label: "Lime", colorA: "#C8FF7A", colorB: "#2F9E44" },
  { key: "album-aurora", label: "Album Aurora", colorA: "#86EFAC", colorB: "#1D4ED8", releaseKind: "ALBUM" },
  { key: "album-sunset-grid", label: "Album Sunset", colorA: "#FDBA74", colorB: "#7C3AED", releaseKind: "ALBUM" }
];

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatProjectDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function formatTrackWhen(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Сейчас";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return formatProjectDate(value);
}

function formatPlaylistDuration(tracks: ProjectTrack[]) {
  const total = tracks.reduce((acc, track) => {
    const preferredDemo = pickPreferredPlaybackDemo(track);
    return acc + (preferredDemo?.duration ?? 0);
  }, 0);
  return formatClock(total);
}

function coverStyle(project: ProjectDetail): React.CSSProperties {
  return buildProjectCoverStyle({
    releaseKind: project.releaseKind,
    coverType: project.coverType,
    coverImageUrl: project.coverImageUrl,
    coverPresetKey: project.coverPresetKey,
    coverColorA: project.coverColorA,
    coverColorB: project.coverColorB
  });
}

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

async function getAudioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);

    audio.preload = "metadata";
    audio.src = objectUrl;
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      URL.revokeObjectURL(objectUrl);
      resolve(Math.max(0, duration));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
    };
  });
}

export default function SongProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: project, refetch } = useQuery({
    queryKey: ["song-project", params.id],
    queryFn: () => fetcher<ProjectDetail>(`/api/projects/${params.id}`)
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["songs-track-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/songs/stages")
  });

  const [menuTrackId, setMenuTrackId] = useState("");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [showAddTrackQuickActions, setShowAddTrackQuickActions] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [creatingTrack, setCreatingTrack] = useState(false);
  const [savingProjectMeta, setSavingProjectMeta] = useState(false);
  const [projectActionError, setProjectActionError] = useState("");
  const [trackMenuBusyId, setTrackMenuBusyId] = useState("");
  const [createTrackError, setCreateTrackError] = useState("");
  const [showProjectSongFlowModal, setShowProjectSongFlowModal] = useState(false);
  const [showEmptySingleTrackPrompt, setShowEmptySingleTrackPrompt] = useState(false);
  const [emptySingleTrackPromptHandledProjectId, setEmptySingleTrackPromptHandledProjectId] = useState<string | null>(null);
  const [projectSongFlowStep, setProjectSongFlowStep] = useState<ProjectSongFlowStep>("lyrics");
  const [projectSongFlowDraft, setProjectSongFlowDraft] = useState<NewSongFlowDraft>({
    title: "",
    lyricsText: "",
    lyricsWasSkipped: false,
    selectedStageId: null,
    branch: null,
    demoReadyFileMeta: null,
    sourceContext: "project-page",
    targetProject: null,
    createdAt: Date.now()
  });
  const [projectSongFlowFile, setProjectSongFlowFile] = useState<File | null>(null);
  const [projectSongFlowFileAnalysis, setProjectSongFlowFileAnalysis] = useState<UploadAudioAnalysisMeta | null>(null);
  const [projectSongFlowSaving, setProjectSongFlowSaving] = useState(false);
  const [projectSongFlowError, setProjectSongFlowError] = useState("");
  const [selectedCoverPresetKey, setSelectedCoverPresetKey] = useState(COVER_PRESETS[0].key);
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackVersionType, setNewTrackVersionType] = useState<DemoVersionType>("DEMO");
  const [newTrackMode, setNewTrackMode] = useState<"record" | "upload">("record");
  const [newTrackText, setNewTrackText] = useState("");
  const [newTrackComment, setNewTrackComment] = useState("");
  const [newTrackFile, setNewTrackFile] = useState<File | null>(null);
  const [newTrackFileAnalysis, setNewTrackFileAnalysis] = useState<UploadAudioAnalysisMeta | null>(null);
  const [newTrackRecordedMix, setNewTrackRecordedMix] = useState<{ blob: Blob; durationSec: number; filename: string } | null>(null);
  const [newTrackRecordedMixAnalysis, setNewTrackRecordedMixAnalysis] = useState<UploadAudioAnalysisMeta | null>(null);
  const [recorderResetKey, setRecorderResetKey] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const projectSongFlowFileInputRef = useRef<HTMLInputElement | null>(null);
  const playback = useSongsPlayback();

  const tracks = project?.tracks ?? [];
  const visibleStages = useMemo(() => stages.filter((stage) => !stage.name.toLowerCase().includes("промо")), [stages]);
  const projectSongFlowStageOptions = useMemo(
    () => visibleStages.filter((stage) => isSelectableSongCreationStage(stage)),
    [visibleStages]
  );
  const projectQueue = useMemo(() => {
    if (!project) return [] as Array<{ trackId: string; demoId: string; demo: ProjectTrack["demos"][number]; item: SongsPlaybackItem }>;
    const coverType: "image" | "gradient" = project.coverType === "IMAGE" ? "image" : "gradient";
    const items: Array<{ trackId: string; demoId: string; demo: ProjectTrack["demos"][number]; item: SongsPlaybackItem }> = [];

    for (const track of tracks) {
      const preferredDemo = pickPreferredPlaybackDemo(track);
      if (!preferredDemo) continue;
      items.push({
        trackId: track.id,
        demoId: preferredDemo.id,
        demo: preferredDemo,
        item: {
          demoId: preferredDemo.id,
          src: `/api/audio-clips/${preferredDemo.id}/stream`,
          title: track.title,
          subtitle: `${project.title} • ${track.pathStage?.name ?? "Без статуса"}`,
          linkHref: `/songs/${track.id}`,
          durationSec: preferredDemo.duration,
          trackId: track.id,
          projectId: project.id,
          versionType: preferredDemo.versionType,
          queueGroupType: "project",
          queueGroupId: project.id,
          cover: {
            type: coverType,
            imageUrl: project.coverImageUrl ?? null,
            colorA: project.coverColorA ?? null,
            colorB: project.coverColorB ?? null
          },
          meta: {
            projectTitle: project.title,
            pathStageName: track.pathStage?.name ?? undefined
          }
        }
      });
    }

    return items;
  }, [project, tracks]);

  useEffect(() => {
    function onWindowClick() {
      setMenuTrackId("");
      setShowProjectMenu(false);
    }
    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, []);

  useEffect(() => {
    if (newTrackVersionType !== "DEMO" && newTrackMode === "record") {
      setNewTrackMode("upload");
    }
  }, [newTrackMode, newTrackVersionType]);

  useEffect(() => {
    if (!showAddTrackModal) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAddTrackModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddTrackModal]);

  useEffect(() => {
    if (!showCoverPicker) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowCoverPicker(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCoverPicker]);

  useEffect(() => {
    if (!showProjectSongFlowModal) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeProjectSongFlowModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showProjectSongFlowModal]);

  useEffect(() => {
    if (!project) return;
    const trackCount = project._count?.tracks ?? project.tracks.length;
    const isEmptySingle = project.releaseKind === "SINGLE" && trackCount === 0;

    if (!isEmptySingle) {
      setShowEmptySingleTrackPrompt(false);
      if (emptySingleTrackPromptHandledProjectId === project.id) {
        setEmptySingleTrackPromptHandledProjectId(null);
      }
      return;
    }

    if (emptySingleTrackPromptHandledProjectId !== project.id) {
      setShowEmptySingleTrackPrompt(true);
    }
  }, [project, emptySingleTrackPromptHandledProjectId]);

  if (!project) {
    return <p className="text-sm text-brand-muted">Загрузка проекта...</p>;
  }

  const totalTracks = project._count?.tracks ?? tracks.length;
  const playlistDuration = formatPlaylistDuration(tracks);
  const projectPlayAccentStyle = playbackAccentButtonStyle({ colorA: project.coverColorA, colorB: project.coverColorB });
  const playableTracksCount = projectQueue.length;
  const lastUpdatedLabel = formatTrackWhen(project.updatedAt);
  const isSingleProject = project.releaseKind === "SINGLE";
  const singleTrack = tracks.length === 1 ? tracks[0] : null;
  const canAddTrackToProject = !isSingleProject || totalTracks < 1;

  function trackPlaybackItem(track: ProjectTrack) {
    const queueItem = projectQueue.find((item) => item.trackId === track.id);
    if (!queueItem) return null;
    return {
      demo: queueItem.demo,
      item: queueItem.item
    };
  }

  function createEmptyProjectSongFlowDraft(currentProject: ProjectDetail): NewSongFlowDraft {
    return {
      title: "",
      lyricsText: "",
      lyricsWasSkipped: false,
      selectedStageId: null,
      branch: null,
      demoReadyFileMeta: null,
      sourceContext: "project-page",
      targetProject: {
        id: currentProject.id,
        title: currentProject.title,
        folderId: currentProject.folderId
      },
      createdAt: Date.now()
    };
  }

  function resetProjectSongFlowModal() {
    const currentProject = project;
    if (!currentProject) return;
    setShowProjectSongFlowModal(false);
    setProjectSongFlowStep("lyrics");
    setProjectSongFlowDraft(createEmptyProjectSongFlowDraft(currentProject));
    setProjectSongFlowFile(null);
    setProjectSongFlowFileAnalysis(null);
    setProjectSongFlowSaving(false);
    setProjectSongFlowError("");
    if (projectSongFlowFileInputRef.current) {
      projectSongFlowFileInputRef.current.value = "";
    }
  }

  function openProjectSongFlowWizard() {
    const currentProject = project;
    if (!currentProject) return;
    if (currentProject.releaseKind === "SINGLE" && (currentProject._count?.tracks ?? currentProject.tracks.length) >= 1) {
      setProjectActionError("Single project can contain only one track. Switch to Album to add more.");
      return;
    }
    setShowAddTrackQuickActions(false);
    setShowProjectSongFlowModal(true);
    setProjectSongFlowStep("lyrics");
    setProjectSongFlowDraft(createEmptyProjectSongFlowDraft(currentProject));
    setProjectSongFlowFile(null);
    setProjectSongFlowFileAnalysis(null);
    setProjectSongFlowSaving(false);
    setProjectSongFlowError("");
    if (projectSongFlowFileInputRef.current) {
      projectSongFlowFileInputRef.current.value = "";
    }
  }

  function closeProjectSongFlowModal() {
    resetProjectSongFlowModal();
  }

  function dismissEmptySingleTrackPrompt() {
    if (project) {
      setEmptySingleTrackPromptHandledProjectId(project.id);
    }
    setShowEmptySingleTrackPrompt(false);
  }

  function handleEmptySingleTrackPromptAdd() {
    dismissEmptySingleTrackPrompt();
    openProjectSongFlowWizard();
  }

  async function saveProjectSongFlowTextOnly() {
    const currentProject = project;
    if (!currentProject) {
      throw new Error("Проект не загружен.");
    }
    const ideaStage = findIdeaStage(visibleStages);
    if (!ideaStage) {
      throw new Error("Не найден этап «Идея».");
    }
    if (!projectSongFlowDraft.title.trim()) {
      throw new Error("Укажи название песни.");
    }
    if (!projectSongFlowDraft.lyricsText.trim()) {
      throw new Error("Добавь текст песни для сохранения.");
    }

    const response = await apiFetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: projectSongFlowDraft.title.trim(),
        projectId: currentProject.id,
        folderId: currentProject.folderId ?? null,
        lyricsText: projectSongFlowDraft.lyricsText.trim(),
        pathStageId: ideaStage.id
      })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Не удалось сохранить песню с текстом.");
    }
  }

  async function saveProjectSongFlowNonDemo() {
    const currentProject = project;
    if (!currentProject) {
      throw new Error("Проект не загружен.");
    }
    if (!projectSongFlowDraft.title.trim()) {
      throw new Error("Укажи название песни.");
    }
    if (!projectSongFlowDraft.selectedStageId) {
      throw new Error("Выберите этап.");
    }
    if (!projectSongFlowFile) {
      throw new Error("Загрузите аудиофайл.");
    }

    const selectedStage = visibleStages.find((stage) => stage.id === projectSongFlowDraft.selectedStageId);
    if (!selectedStage) {
      throw new Error("Не найден выбранный этап.");
    }
    const versionType = resolveVersionTypeByStage(selectedStage);
    if (!versionType || versionType === "IDEA_TEXT" || versionType === "DEMO") {
      throw new Error("Для этого этапа доступен другой сценарий добавления.");
    }

    const createTrackResponse = await apiFetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: projectSongFlowDraft.title.trim(),
        projectId: currentProject.id,
        folderId: currentProject.folderId ?? null,
        lyricsText: projectSongFlowDraft.lyricsWasSkipped ? null : projectSongFlowDraft.lyricsText.trim() || null,
        pathStageId: selectedStage.id
      })
    });
    if (!createTrackResponse.ok) {
      const payload = (await createTrackResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Не удалось создать трек.");
    }
    const createdTrack = (await createTrackResponse.json()) as { id: string };

    const durationSec = await getAudioDurationSeconds(projectSongFlowFile);
    const analysis = await detectAudioAnalysisMvp(projectSongFlowFile);
    const formData = new FormData();
    formData.append("file", projectSongFlowFile, projectSongFlowFile.name);
    formData.append("trackId", createdTrack.id);
    formData.append("durationSec", String(durationSec));
    formData.append("versionType", versionType);
    formData.append("noteText", "");
    appendAudioAnalysisToFormData(formData, analysis);

    const uploadResponse = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
    if (!uploadResponse.ok) {
      const payload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Трек создан, но не удалось загрузить аудио.");
    }
  }

  async function confirmProjectSongFlowSaveTextOnly() {
    setProjectSongFlowSaving(true);
    setProjectSongFlowError("");
    try {
      await saveProjectSongFlowTextOnly();
      await refetch();
      resetProjectSongFlowModal();
    } catch (error) {
      setProjectSongFlowError(error instanceof Error ? error.message : "Не удалось сохранить песню.");
    } finally {
      setProjectSongFlowSaving(false);
    }
  }

  async function confirmProjectSongFlowNonDemo() {
    setProjectSongFlowSaving(true);
    setProjectSongFlowError("");
    try {
      await saveProjectSongFlowNonDemo();
      await refetch();
      resetProjectSongFlowModal();
    } catch (error) {
      setProjectSongFlowError(error instanceof Error ? error.message : "Не удалось сохранить песню.");
    } finally {
      setProjectSongFlowSaving(false);
    }
  }

  function handleProjectSongFlowContinueWithLyrics() {
    if (!projectSongFlowDraft.title.trim()) {
      setProjectSongFlowError("Укажи название песни.");
      return;
    }
    setProjectSongFlowDraft((prev) => ({ ...prev, lyricsWasSkipped: false, branch: null }));
    setProjectSongFlowStep("stage");
    setProjectSongFlowError("");
  }

  async function handleProjectSongFlowSaveTextOnly() {
    if (!projectSongFlowDraft.title.trim()) {
      setProjectSongFlowError("Укажи название песни.");
      return;
    }
    if (!projectSongFlowDraft.lyricsText.trim()) {
      setProjectSongFlowError("Добавь текст песни для сохранения.");
      return;
    }
    setProjectSongFlowDraft((prev) => ({ ...prev, branch: "TEXT_ONLY" }));
    await confirmProjectSongFlowSaveTextOnly();
  }

  function continueProjectSongFlowFromStage() {
    const currentProject = project;
    if (!currentProject) return;
    if (!projectSongFlowDraft.selectedStageId) {
      setProjectSongFlowError("Выберите этап трека.");
      return;
    }
    const selectedStage = projectSongFlowStageOptions.find((stage) => stage.id === projectSongFlowDraft.selectedStageId);
    if (!selectedStage) {
      setProjectSongFlowError("Выберите этап трека.");
      return;
    }

    setProjectSongFlowError("");
    if (isDemoSongStage(selectedStage.name)) {
      const draftToPersist: NewSongFlowDraft = {
        ...projectSongFlowDraft,
        branch: "DEMO_RECORD",
        selectedStageId: selectedStage.id,
        sourceContext: "project-page",
        targetProject: {
          id: currentProject.id,
          title: currentProject.title,
          folderId: currentProject.folderId
        },
        createdAt: Date.now()
      };
      saveNewSongFlowDraft(draftToPersist);
      setShowProjectSongFlowModal(false);
      router.push("/songs/new/demo");
      return;
    }

    setProjectSongFlowDraft((prev) => ({ ...prev, branch: "NON_DEMO_UPLOAD" }));
    setProjectSongFlowStep("file-upload");
  }

  function resetAddTrackForm() {
    setNewTrackTitle("");
    setNewTrackVersionType("DEMO");
    setNewTrackMode("record");
    setNewTrackText("");
    setNewTrackComment("");
    setNewTrackFile(null);
    setNewTrackFileAnalysis(null);
    setNewTrackRecordedMix(null);
    setNewTrackRecordedMixAnalysis(null);
    setCreateTrackError("");
    setRecorderResetKey((prev) => prev + 1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openAddTrackModal(action: AddTrackQuickAction = "record") {
    resetAddTrackForm();
    setShowAddTrackQuickActions(false);

    if (action === "convert") {
      setNewTrackMode("upload");
      setNewTrackVersionType("ARRANGEMENT");
    } else if (action === "import") {
      setNewTrackMode("upload");
      setNewTrackVersionType("DEMO");
    } else {
      setNewTrackMode("record");
      setNewTrackVersionType("DEMO");
    }

    setShowAddTrackModal(true);

    if (action === "import") {
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  }

  function closeAddTrackModal() {
    resetAddTrackForm();
    setShowAddTrackModal(false);
  }

  function openCoverPicker() {
    const currentProject = project;
    if (!currentProject) {
      setProjectActionError("Проект не загружен.");
      return;
    }

    const currentPreset =
      COVER_PRESETS.find((preset) => preset.key === currentProject.coverPresetKey) ??
      COVER_PRESETS.find(
        (preset) => preset.colorA === currentProject.coverColorA && preset.colorB === currentProject.coverColorB
      ) ??
      COVER_PRESETS[0];
    setSelectedCoverPresetKey(currentPreset.key);
    setProjectActionError("");
    setShowProjectMenu(false);
    setShowCoverPicker(true);
  }

  function playProjectQueue(startTrackId?: string, openPlayerWindow = false) {
    if (!projectQueue.length || !project) return;
    const startIndex = startTrackId ? projectQueue.findIndex((item) => item.trackId === startTrackId) : 0;
    const safeStartIndex = startIndex >= 0 ? startIndex : 0;
    playback.playQueue(
      projectQueue.map((item) => item.item),
      safeStartIndex,
      { type: "project", projectId: project.id, title: project.title }
    );
    if (openPlayerWindow) {
      playback.openPlayerWindow();
    }
  }

  function handleTrackPlayButton(track: ProjectTrack) {
    const queueItem = projectQueue.find((item) => item.trackId === track.id);
    if (!queueItem) return;
    if (playback.isActive(queueItem.demoId)) {
      playback.toggle(queueItem.item);
      return;
    }
    playProjectQueue(track.id, false);
  }

  function handleTrackRowTap(track: ProjectTrack) {
    const queueItem = projectQueue.find((item) => item.trackId === track.id);
    if (!queueItem) return;
    playProjectQueue(track.id, true);
  }

  async function saveTrackIntoProject() {
    setCreatingTrack(true);
    setCreateTrackError("");

    try {
      const currentProject = project;
      if (!currentProject) {
        setCreateTrackError("Проект не загружен.");
        return;
      }

      if (!newTrackTitle.trim()) {
        setCreateTrackError("Укажи название трека.");
        return;
      }

      if (newTrackVersionType === "IDEA_TEXT" && !newTrackText.trim()) {
        setCreateTrackError("Для идеи (текст) добавь текст.");
        return;
      }

      if (newTrackVersionType !== "IDEA_TEXT" && newTrackMode === "upload" && !newTrackFile) {
        setCreateTrackError("Выбери аудиофайл.");
        return;
      }

      if (newTrackVersionType !== "IDEA_TEXT" && newTrackMode === "record" && !newTrackRecordedMix) {
        setCreateTrackError("Сначала запиши и сведи аудио.");
        return;
      }

      const createdTrack = await apiFetchJson<{ id: string }>(`/api/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTrackTitle.trim(),
          projectId: currentProject.id,
          folderId: currentProject.folderId ?? null,
          lyricsText: newTrackText.trim() || null
        })
      });

      if (newTrackVersionType !== "IDEA_TEXT") {
        let fileToUpload: Blob | null = null;
        let filename = `track-${Date.now()}.webm`;
        let durationSec = 0;

        if (newTrackMode === "upload") {
          const uploadFile = newTrackFile;
          if (!uploadFile) {
            setCreateTrackError("Выбери аудиофайл.");
            return;
          }
          fileToUpload = uploadFile;
          filename = uploadFile.name;
          durationSec = await getAudioDurationSeconds(uploadFile);
        }

        if (newTrackMode === "record") {
          const recordedMix = newTrackRecordedMix;
          if (!recordedMix) {
            setCreateTrackError("Сначала запиши и сведи аудио.");
            return;
          }
          fileToUpload = recordedMix.blob;
          filename = recordedMix.filename;
          durationSec = recordedMix.durationSec;
        }

        if (!fileToUpload) {
          setCreateTrackError("Не удалось подготовить аудио.");
          return;
        }

        const analysis = await detectAudioAnalysisMvp(fileToUpload);
        const formData = new FormData();
        formData.append("file", fileToUpload, filename);
        formData.append("trackId", createdTrack.id);
        formData.append("durationSec", String(durationSec));
        formData.append("versionType", newTrackVersionType);
        formData.append("noteText", newTrackComment.trim());
        appendAudioAnalysisToFormData(formData, analysis);

        const uploadResponse = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
        if (!uploadResponse.ok) {
          const payload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Не удалось загрузить версию.");
        }
      }

      await refetch();
      closeAddTrackModal();
    } catch (error) {
      setCreateTrackError(error instanceof Error ? error.message : "Не удалось создать трек.");
    } finally {
      setCreatingTrack(false);
    }
  }

  async function renameProject() {
    const currentProject = project;
    if (!currentProject) {
      setProjectActionError("Проект не загружен.");
      return;
    }

    const nextTitle = window.prompt("Новое название проекта", currentProject.title)?.trim();
    if (!nextTitle || nextTitle === currentProject.title) return;

    setSavingProjectMeta(true);
    setProjectActionError("");
    setShowProjectMenu(false);
    try {
      const response = await apiFetch(`/api/projects/${currentProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось переименовать проект.");
      }
      await refetch();
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось переименовать проект.");
    } finally {
      setSavingProjectMeta(false);
    }
  }

  async function saveCoverPreset() {
    const currentProject = project;
    if (!currentProject) {
      setProjectActionError("Проект не загружен.");
      return;
    }

    const preset = COVER_PRESETS.find((item) => item.key === selectedCoverPresetKey);
    if (!preset) return;

    setSavingProjectMeta(true);
    setProjectActionError("");
    try {
      const response = await apiFetch(`/api/projects/${currentProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverType: "GRADIENT",
          coverPresetKey: preset.key,
          coverColorA: preset.colorA,
          coverColorB: preset.colorB,
          coverImageUrl: null
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось обновить обложку.");
      }
      await refetch();
      setShowCoverPicker(false);
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось обновить обложку.");
    } finally {
      setSavingProjectMeta(false);
    }
  }

  async function deleteProject() {
    const currentProject = project;
    if (!currentProject) {
      setProjectActionError("Проект не загружен.");
      return;
    }

    const hasTracks = (currentProject._count?.tracks ?? currentProject.tracks.length) > 0;
    const confirmed = window.confirm(
      hasTracks
        ? "Удалить проект вместе со всеми песнями и версиями?"
        : "Удалить пустой проект?"
    );
    if (!confirmed) return;

    setSavingProjectMeta(true);
    setProjectActionError("");
    setShowProjectMenu(false);
    try {
      const response = await apiFetch(`/api/projects/${currentProject.id}${hasTracks ? "?force=1" : ""}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить проект.");
      }
      router.push("/songs");
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось удалить проект.");
      setSavingProjectMeta(false);
    }
  }

  async function setProjectReleaseKind(nextKind: "SINGLE" | "ALBUM") {
    const currentProject = project;
    if (!currentProject || currentProject.releaseKind === nextKind) return;
    setSavingProjectMeta(true);
    setProjectActionError("");
    setShowProjectMenu(false);
    try {
      const response = await apiFetch(`/api/projects/${currentProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseKind: nextKind })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось изменить тип проекта.");
      }
      await refetch();
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось изменить тип проекта.");
    } finally {
      setSavingProjectMeta(false);
    }
  }

  async function deleteTrackFromProject(track: ProjectTrack) {
    const confirmed = window.confirm(`Удалить трек «${track.title}» вместе со всеми версиями?`);
    if (!confirmed) return;

    setTrackMenuBusyId(track.id);
    setProjectActionError("");
    setMenuTrackId("");
    try {
      const response = await apiFetch(`/api/songs/${track.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить трек.");
      }
      await refetch();
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось удалить трек.");
    } finally {
      setTrackMenuBusyId("");
    }
  }

  async function moveTrackInPlaylist(track: ProjectTrack, currentIndex: number) {
    const currentProject = project;
    if (!currentProject) {
      setProjectActionError("Проект не загружен.");
      return;
    }
    if (currentProject.releaseKind === "SINGLE") {
      setMenuTrackId("");
      return;
    }
    if (tracks.length < 2) {
      setMenuTrackId("");
      return;
    }

    const rawPosition = window
      .prompt(`Позиция для «${track.title}» (1-${tracks.length})`, String(currentIndex + 1))
      ?.trim();
    if (!rawPosition) return;

    const nextIndex = Number.parseInt(rawPosition, 10) - 1;
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= tracks.length) {
      setProjectActionError(`Введите номер позиции от 1 до ${tracks.length}.`);
      return;
    }
    if (nextIndex === currentIndex) {
      setMenuTrackId("");
      return;
    }

    const orderedTrackIds = tracks.map((item) => item.id);
    orderedTrackIds.splice(currentIndex, 1);
    orderedTrackIds.splice(nextIndex, 0, track.id);

    setTrackMenuBusyId(track.id);
    setProjectActionError("");
    setMenuTrackId("");
    try {
      const response = await apiFetch(`/api/projects/${currentProject.id}/tracks/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedTrackIds })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось переместить трек.");
      }
      await refetch();
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось переместить трек.");
    } finally {
      setTrackMenuBusyId("");
    }
  }

  return (
    <div className="pb-36">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6">
        <div className="relative min-h-[calc(100vh-9rem)] overflow-visible rounded-[30px] border border-brand-border bg-gradient-to-br from-[#edf4e4] via-[#e8f0de] to-[#e2ead7] px-4 py-5 text-brand-ink shadow-[0_20px_45px_rgba(61,84,46,0.14)] md:px-5">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute -right-12 top-8 h-44 w-44 rounded-full bg-[#e8f27a]/45 blur-3xl" />
            <div className="absolute left-[-2rem] top-24 h-40 w-40 rounded-full bg-white/35 blur-2xl" />
            <div className="absolute bottom-[-2rem] right-20 h-36 w-36 rounded-full bg-[#9fc7b3]/35 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_34%,rgba(90,123,75,0.07)_100%)]" />
          </div>

          <div className="relative mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href="/songs">
                <Button
                  variant="secondary"
                  className="h-10 rounded-xl border-brand-border bg-white/90 px-3 text-brand-ink shadow-sm hover:bg-white"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Назад
                </Button>
              </Link>
              <Badge className="hidden items-center gap-1.5 border-[#cbdab8] bg-white/75 text-[#4b6440] sm:inline-flex">
                <Sparkles className="h-3.5 w-3.5" />
                {isSingleProject ? "Single Page" : "Project Page"}
              </Badge>
            </div>

            <div className="relative flex items-center gap-2">
              <Button
                variant="secondary"
                className="h-10 w-10 rounded-xl border-brand-border bg-white/90 p-0 text-brand-ink shadow-sm hover:bg-white"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowProjectMenu((prev) => !prev);
                }}
                disabled={savingProjectMeta}
                aria-label="Меню проекта"
                title="Меню проекта"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {showProjectMenu && (
                <div
                  className="absolute right-0 top-11 z-20 min-w-[240px] rounded-2xl border border-brand-border bg-[#f7fbf2]/95 p-2 shadow-[0_20px_40px_rgba(61,84,46,0.14)] backdrop-blur"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                    onClick={renameProject}
                  >
                    <Pencil className="h-4 w-4 text-brand-muted" />
                    <span>Rename project</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                    onClick={openCoverPicker}
                  >
                    <Wand2 className="h-4 w-4 text-brand-muted" />
                    <span>Change cover art</span>
                  </button>
                  <div className="my-1 h-px bg-black/5" />
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                    onClick={() => void setProjectReleaseKind("SINGLE")}
                  >
                    Mark as Single
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                    onClick={() => void setProjectReleaseKind("ALBUM")}
                  >
                    Mark as Album
                  </button>
                  <div className="my-1 h-px bg-black/5" />
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-[#ffe7e1]"
                    onClick={deleteProject}
                  >
                    Delete project
                  </button>
                </div>
              )}
            </div>
          </div>

          {projectActionError && (
            <div className="relative mb-4 rounded-2xl border border-red-300/70 bg-[#fff2ef]/90 px-3 py-2 text-sm text-[#a4372a] shadow-sm">
              {projectActionError}
            </div>
          )}

          <section className="relative isolate mb-6 overflow-hidden rounded-[28px] border border-brand-border bg-white p-4 shadow-[0_14px_32px_rgba(61,84,46,0.1)] md:p-5">
            <div className="pointer-events-none absolute inset-0 z-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(213,234,164,0.24),transparent_42%),radial-gradient(circle_at_92%_8%,rgba(217,249,157,0.16),transparent_36%)]" />
              <div className="absolute right-6 top-4 h-24 w-24 rounded-full bg-[#d9f99d]/30 blur-2xl" />
            </div>

            <div className="relative z-10 grid gap-5 md:grid-cols-[minmax(0,340px)_1fr]">
              <div className="relative aspect-square overflow-visible rounded-3xl">
                <div className="group relative h-full w-full overflow-hidden rounded-3xl border border-black/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_18px_34px_rgba(61,84,46,0.16)]">
                  <div className="absolute inset-0" style={coverStyle(project)} />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.12),transparent_45%,rgba(0,0,0,0.14))]" />
                  <div className="pointer-events-none absolute -right-8 top-8 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
                  <button
                    type="button"
                    className="absolute inset-0 appearance-none rounded-3xl bg-transparent p-0"
                    onClick={openCoverPicker}
                    aria-label="Change project cover"
                  />
                </div>

              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-[#cbdab8] bg-[#f5faeb] text-[#4b6440]">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {isSingleProject ? "Single" : "Album"}
                    </Badge>
                    <Badge className="border-brand-border bg-white text-brand-muted">
                      <Clock3 className="mr-1 h-3.5 w-3.5" />
                      Обновлено: {lastUpdatedLabel}
                    </Badge>
                    {project.folder?.title && (
                      <Badge className="border-brand-border bg-white text-brand-muted">
                        <FolderOpen className="mr-1 h-3.5 w-3.5" />
                        {project.folder.title}
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">{project.title}</h1>
                    <p className="mt-1 text-sm text-brand-muted">
                      {project.artistLabel || "ART SAFE"} • {totalTracks} track{totalTracks === 1 ? "" : "s"} • {playlistDuration}
                    </p>
                    {isSingleProject && (
                      <p className="mt-1 text-xs text-brand-muted">
                        Single-mode: карточка откроет версии напрямую после появления одного трека.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-brand-border bg-white px-3 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Tracks</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-brand-ink">{totalTracks}</p>
                    <p className="text-xs text-brand-muted">в проекте</p>
                  </div>
                  <div className="rounded-2xl border border-brand-border bg-white px-3 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Playable</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-brand-ink">{playableTracksCount}</p>
                    <p className="text-xs text-brand-muted">с аудио-версией</p>
                  </div>
                  <div className="rounded-2xl border border-brand-border bg-white px-3 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Duration</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-brand-ink">{playlistDuration}</p>
                    <p className="text-xs text-brand-muted">общая длина</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-border bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-xl border hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                      style={projectPlayAccentStyle}
                      onClick={() => playProjectQueue(undefined, false)}
                      disabled={!projectQueue.length}
                    >
                      <span className="inline-flex items-center gap-2">
                        <PlayCircle className="h-4 w-4" />
                        <span>{isSingleProject ? "Play single" : "Play project"}</span>
                      </span>
                    </Button>
                    {isSingleProject && singleTrack && (
                      <Link
                        href={getProjectOpenHref({
                          id: project.id,
                          releaseKind: project.releaseKind,
                          singleTrackId: singleTrack.id
                        })}
                      >
                        <Button
                          variant="secondary"
                          className="rounded-xl border-brand-border bg-white text-brand-ink hover:bg-white"
                        >
                          <ArrowUpRight className="mr-2 h-4 w-4" />
                          Open Versions
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="secondary"
                      className="rounded-xl border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={openProjectSongFlowWizard}
                      disabled={!canAddTrackToProject}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      {isSingleProject ? "Add first track" : "Add tracks"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-brand-muted">
                    {isSingleProject
                      ? canAddTrackToProject
                        ? "Добавь один трек в single, после чего карточка будет открывать страницу версий."
                        : "Single уже содержит трек. Для второго трека переключи тип проекта на Album."
                      : "Быстрые действия по проекту и добавлению новых треков в PATH-флоу."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[28px] border border-brand-border bg-white/85 p-3 shadow-[0_14px_32px_rgba(61,84,46,0.08)] md:p-4">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-4 top-4 h-16 w-32 rounded-full bg-[#dff0c6]/50 blur-2xl" />
              <div className="absolute inset-x-0 top-0 h-14 bg-[linear-gradient(90deg,rgba(255,255,255,0.45),rgba(255,255,255,0))]" />
            </div>

            <div className="relative mb-3 rounded-2xl border border-brand-border bg-white/75 px-3 py-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">{isSingleProject ? "Single Track" : "Playlist"}</p>
                  <h2 className="text-lg font-semibold tracking-tight text-brand-ink">
                    {isSingleProject ? "Трек сингла" : "Треки проекта"}
                  </h2>
                  <p className="text-sm text-brand-muted">
                    {isSingleProject
                      ? "Открой версии единственного трека и работай с single-обложкой."
                      : "Открывай версии, управляй порядком и слушай проект как плейлист."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-brand-border bg-white/90 text-brand-muted">
                    <Music2 className="mr-1 h-3.5 w-3.5" />
                    {totalTracks} tracks
                  </Badge>
                  <Badge className="border-brand-border bg-white/90 text-brand-muted">
                    <PlayCircle className="mr-1 h-3.5 w-3.5" />
                    {playableTracksCount} playable
                  </Badge>
                </div>
              </div>
            </div>

            <div className="relative space-y-2">
              {tracks.map((track, index) => {
              const playbackPayload = trackPlaybackItem(track);
              const playbackDemo = playbackPayload?.demo ?? null;
              const isCurrent = playbackDemo ? playback.isActive(playbackDemo.id) : false;
              const isPrimaryPlayback = Boolean(playbackDemo && track.primaryDemo && playbackDemo.id === track.primaryDemo.id);
              const isTrackMenuBusy = trackMenuBusyId === track.id;

              return (
                <div
                  key={track.id}
                  className={`group relative flex items-center gap-3 rounded-2xl border px-3 py-3 shadow-sm transition ${
                    isCurrent
                      ? "border-[#9fc7b3] bg-[#e7f2eb] shadow-[0_10px_24px_rgba(77,126,101,0.14)]"
                      : "border-brand-border bg-white/80 hover:border-[#c5d8b3] hover:bg-white"
                  }`}
                  onClick={() => playbackDemo && handleTrackRowTap(track)}
                >
                  <div className="absolute inset-y-2 left-1 w-1 rounded-full bg-transparent transition group-hover:bg-[#dcebc5]" />
                  <div
                    className={`w-9 shrink-0 text-center text-sm font-medium ${
                      isCurrent ? "text-[#2e6855]" : "text-brand-muted"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <button
                    type="button"
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm shadow-sm ${
                      playbackDemo
                        ? "hover:brightness-95"
                        : "cursor-not-allowed border-brand-border bg-white/70 text-brand-muted/60"
                    }`}
                    style={playbackDemo ? projectPlayAccentStyle : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (playbackDemo) handleTrackPlayButton(track);
                    }}
                    disabled={!playbackDemo}
                    aria-label={playbackDemo ? "Play track" : "No playable version"}
                  >
                    {playbackDemo ? (
                      <PlaybackIcon
                        type={playback.isPlayingDemo(playbackDemo.id) ? "pause" : "play"}
                        className="h-4 w-4"
                      />
                    ) : null}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-brand-ink">{track.title}</p>
                      {isPrimaryPlayback && (
                        <span className="shrink-0 rounded-full border border-[#a4cbb8] bg-[#e8f3ec] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#2e6855]">
                          primary
                        </span>
                      )}
                      {track.pathStage?.name && (
                        <Badge className="h-5 border-brand-border bg-white/90 px-2 py-0 text-[10px] uppercase tracking-[0.08em] text-brand-muted">
                          {track.pathStage.name}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-brand-muted">
                      {playbackDemo
                        ? `${formatTrackWhen(playbackDemo.createdAt)} • ${formatClock(playbackDemo.duration)}`
                        : "Нет аудио-версий (пока только текст/черновик)"}
                    </p>
                    <SongAnalysisBadges
                      bpm={track.displayBpm}
                      keyRoot={track.displayKeyRoot}
                      keyMode={track.displayKeyMode}
                      className="mt-1"
                      compact
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden sm:block">
                      <Badge className="border-brand-border bg-white/90 text-brand-muted">
                        {track._count?.demos ?? 0} верс.
                      </Badge>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        className="grid h-9 w-9 place-items-center rounded-xl border border-brand-border bg-white text-brand-ink shadow-sm hover:bg-white disabled:cursor-wait disabled:opacity-60"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMenuTrackId((prev) => (prev === track.id ? "" : track.id));
                        }}
                        aria-label="Track actions"
                        disabled={isTrackMenuBusy}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuTrackId === track.id && (
                        <div
                          className="absolute bottom-11 right-0 z-40 min-w-[190px] rounded-2xl border border-brand-border bg-[#f7fbf2]/95 p-2 shadow-[0_20px_40px_rgba(61,84,46,0.14)] backdrop-blur"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Link
                            href={`/songs/${track.id}`}
                            className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-brand-ink hover:bg-black/5"
                            onClick={() => setMenuTrackId("")}
                          >
                            <span>Версии</span>
                            <ArrowUpRight className="h-4 w-4 text-brand-muted" />
                          </Link>
                          <Link
                            href={`/songs/${track.id}?edit=1&showLyrics=1`}
                            className="block rounded-xl px-3 py-2 text-sm text-brand-ink hover:bg-black/5"
                            onClick={() => setMenuTrackId("")}
                          >
                            Текст песни
                          </Link>
                          {playbackDemo ? (
                            <a
                              href={`/api/audio-clips/${playbackDemo.id}/stream`}
                              download
                              className="block rounded-xl px-3 py-2 text-sm text-brand-ink hover:bg-black/5"
                              onClick={() => setMenuTrackId("")}
                            >
                              Export audio
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="block w-full cursor-not-allowed rounded-xl px-3 py-2 text-left text-sm text-brand-muted/60"
                            >
                              Export audio
                            </button>
                          )}
                          <button
                            type="button"
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5 disabled:cursor-not-allowed disabled:text-brand-muted/60"
                            onClick={() => void moveTrackInPlaylist(track, index)}
                            disabled={isSingleProject}
                          >
                            Move
                          </button>
                          <div className="my-1 h-px bg-black/5" />
                          <button
                            type="button"
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-[#ffe7e1]"
                            onClick={() => void deleteTrackFromProject(track)}
                          >
                            Delete track
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!tracks.length && (
              <div className="rounded-2xl border border-dashed border-brand-border bg-white/75 px-4 py-8 text-center shadow-sm">
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-brand-border bg-white text-brand-muted">
                  <Music2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-brand-ink">В проекте пока нет треков</p>
                <p className="mt-1 text-xs text-brand-muted">
                  {isSingleProject
                    ? "Добавь первый трек, чтобы single начал открываться сразу в версии."
                    : "Добавь первый трек через PATH flow или быстрый импорт."}
                </p>
              </div>
            )}
            </div>
          </section>
        </div>
      </div>

      {showCoverPicker && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-10 backdrop-blur-sm md:pt-14"
          onClick={() => setShowCoverPicker(false)}
        >
          <div
            className="w-full max-w-4xl rounded-[28px] border border-brand-border bg-[#f7fbf2] p-4 text-brand-ink shadow-[0_24px_60px_rgba(61,84,46,0.22)] md:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Cover</p>
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Обложка проекта</h2>
                <p className="text-sm text-brand-muted">Быстрый выбор обложки из пресетов проекта.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                  onClick={() => setShowCoverPicker(false)}
                >
                  Закрыть
                </Button>
                <Button disabled={savingProjectMeta} onClick={saveCoverPreset}>
                  {savingProjectMeta ? "Сохраняем..." : "Готово"}
                </Button>
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-brand-border bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:p-4">
              {(() => {
                const selectedPreset = COVER_PRESETS.find((preset) => preset.key === selectedCoverPresetKey) ?? COVER_PRESETS[0];
                return (
                  <div className="mx-auto w-full max-w-xl">
                    <div
                      className="aspect-[1.15] rounded-3xl border border-black/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35),0_14px_35px_rgba(61,84,46,0.18)]"
                      style={buildProjectCoverStyle({
                        releaseKind: selectedPreset.releaseKind ?? project.releaseKind,
                        coverType: "GRADIENT",
                        coverPresetKey: selectedPreset.key,
                        coverColorA: selectedPreset.colorA,
                        coverColorB: selectedPreset.colorB
                      })}
                    />
                    <p className="mt-3 text-center text-sm font-medium text-brand-ink">{selectedPreset.label}</p>
                  </div>
                );
              })()}
            </div>

            <div className="grid max-h-[42vh] grid-cols-2 gap-3 overflow-y-auto rounded-2xl border border-brand-border bg-white/55 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {COVER_PRESETS.map((preset) => {
                const selected = preset.key === selectedCoverPresetKey;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    aria-pressed={selected}
                    className={`group rounded-2xl border p-2 text-left transition ${
                      selected
                        ? "border-[#9fba7d] bg-[#eef7df] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]"
                        : "border-brand-border bg-white/80 hover:border-[#ccdaba] hover:bg-white"
                    }`}
                    onClick={() => setSelectedCoverPresetKey(preset.key)}
                  >
                    <div
                      className="mb-2 aspect-square rounded-xl border border-black/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]"
                      style={buildProjectCoverStyle({
                        releaseKind: preset.releaseKind ?? project.releaseKind,
                        coverType: "GRADIENT",
                        coverPresetKey: preset.key,
                        coverColorA: preset.colorA,
                        coverColorB: preset.colorB
                      })}
                    />
                    <p className={`truncate text-xs ${selected ? "font-medium text-brand-ink" : "text-brand-muted group-hover:text-brand-ink"}`}>
                      {preset.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showEmptySingleTrackPrompt && isSingleProject && !tracks.length && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={dismissEmptySingleTrackPrompt}
        >
          <div
            className="w-full max-w-md rounded-[24px] border border-brand-border bg-[#f7fbf2] p-5 text-brand-ink shadow-[0_24px_60px_rgba(61,84,46,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Single</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">У сингла пока нет трека</h2>
            <p className="mt-2 text-sm text-brand-muted">
              Добавьте песню, чтобы single открывался сразу в версии трека.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                className="border-brand-border bg-white text-brand-ink hover:bg-white"
                onClick={dismissEmptySingleTrackPrompt}
              >
                Позже
              </Button>
              <Button type="button" onClick={handleEmptySingleTrackPromptAdd}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {showProjectSongFlowModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-16 backdrop-blur-sm"
          onClick={closeProjectSongFlowModal}
        >
          <div
            className="w-full max-w-3xl rounded-[28px] border border-brand-border bg-[#f7fbf2] p-4 text-brand-ink shadow-[0_24px_60px_rgba(61,84,46,0.22)] md:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Add Track</p>
                <h2 className="text-2xl font-semibold tracking-tight">Новый трек в проект</h2>
                <p className="text-sm text-brand-muted">
                  {projectSongFlowStep === "lyrics" && "Шаг 1 из 3: название и текст песни."}
                  {projectSongFlowStep === "stage" && "Шаг 2 из 3: выбери этап трека."}
                  {projectSongFlowStep === "file-upload" && "Шаг 3 из 3: загрузи файл для выбранного этапа."}
                </p>
              </div>
              <Button
                variant="secondary"
                className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                onClick={closeProjectSongFlowModal}
              >
                Закрыть
              </Button>
            </div>

            <div className="mb-4 rounded-xl border border-brand-border bg-white/80 px-3 py-2 text-sm text-brand-muted">
              Проект: <span className="font-medium text-brand-ink">{project.title}</span>
            </div>

            {projectSongFlowError && (
              <div className="mb-4 rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">
                {projectSongFlowError}
              </div>
            )}

            <div className="space-y-4">
              {projectSongFlowStep === "lyrics" && (
                <div className="space-y-3">
                  <Input
                    value={projectSongFlowDraft.title}
                    onChange={(event) =>
                      setProjectSongFlowDraft((prev) => ({
                        ...prev,
                        title: event.target.value
                      }))
                    }
                    placeholder="Название песни"
                    className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                  />

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-brand-ink">Текст песни</p>
                    <Textarea
                      value={projectSongFlowDraft.lyricsText}
                      onChange={(event) =>
                        setProjectSongFlowDraft((prev) => ({
                          ...prev,
                          lyricsText: event.target.value
                        }))
                      }
                      placeholder="Черновик текста, заметки, хук..."
                      rows={8}
                      className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleProjectSongFlowContinueWithLyrics} disabled={projectSongFlowSaving}>
                      Далее
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={() => void handleProjectSongFlowSaveTextOnly()}
                      disabled={projectSongFlowSaving}
                    >
                      {projectSongFlowSaving ? "Сохраняем..." : "Сохранить только текст"}
                    </Button>
                  </div>
                </div>
              )}

              {projectSongFlowStep === "stage" && (
                <div className="space-y-3">
                  <Select
                    value={projectSongFlowDraft.selectedStageId ? String(projectSongFlowDraft.selectedStageId) : "NONE"}
                    onChange={(event) => {
                      setProjectSongFlowDraft((prev) => ({
                        ...prev,
                        selectedStageId: event.target.value === "NONE" ? null : Number(event.target.value)
                      }));
                    }}
                    className="border-brand-border bg-white/90 text-brand-ink focus:ring-brand-border"
                  >
                    <option value="NONE">Выберите этап</option>
                    {projectSongFlowStageOptions.map((stage) => (
                      <option key={stage.id} value={String(stage.id)}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={continueProjectSongFlowFromStage} disabled={projectSongFlowSaving}>
                      {(() => {
                        const selected = projectSongFlowStageOptions.find((stage) => stage.id === projectSongFlowDraft.selectedStageId);
                        return selected && isDemoSongStage(selected.name) ? "Открыть demo flow" : "Далее";
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={() => {
                        setProjectSongFlowStep("lyrics");
                        setProjectSongFlowError("");
                      }}
                      disabled={projectSongFlowSaving}
                    >
                      Назад
                    </Button>
                  </div>
                </div>
              )}

              {projectSongFlowStep === "file-upload" && (
                <div className="space-y-3">
                  <p className="text-sm text-brand-muted">
                    Загрузи файл для выбранного этапа. Трек будет сохранён прямо в текущий проект.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={() => projectSongFlowFileInputRef.current?.click()}
                      disabled={projectSongFlowSaving}
                    >
                      Загрузить файл
                    </Button>
                    <Button type="button" onClick={() => void confirmProjectSongFlowNonDemo()} disabled={projectSongFlowSaving}>
                      {projectSongFlowSaving ? "Сохраняем..." : "Сохранить в проект"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={() => {
                        setProjectSongFlowStep("stage");
                        setProjectSongFlowError("");
                      }}
                      disabled={projectSongFlowSaving}
                    >
                      Назад
                    </Button>
                  </div>
                  <input
                    ref={projectSongFlowFileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0] ?? null;
                      setProjectSongFlowFile(file);
                      setProjectSongFlowError("");
                      setProjectSongFlowFileAnalysis(file ? await detectAudioAnalysisMvp(file) : null);
                    }}
                  />
                  {projectSongFlowFile ? (
                    <div className="rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-xs text-brand-muted">
                      <p>Файл: {projectSongFlowFile.name}</p>
                      <SongAnalysisBadges
                        bpm={projectSongFlowFileAnalysis?.bpm}
                        keyRoot={projectSongFlowFileAnalysis?.keyRoot}
                        keyMode={projectSongFlowFileAnalysis?.keyMode}
                        className="mt-1"
                        compact
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-brand-border bg-white/70 px-3 py-3 text-sm text-brand-muted">
                      Аудиофайл пока не выбран.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddTrackModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-16 backdrop-blur-sm"
          onClick={closeAddTrackModal}
        >
          <div
            className="w-full max-w-3xl rounded-[28px] border border-brand-border bg-[#f7fbf2] p-4 text-brand-ink shadow-[0_24px_60px_rgba(61,84,46,0.22)] md:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Add Track</p>
                <h2 className="text-2xl font-semibold tracking-tight">Новый трек в проект</h2>
                <p className="text-sm text-brand-muted">Запиши или загрузи первую версию сразу в этот проект.</p>
              </div>
              <Button
                variant="secondary"
                className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                onClick={closeAddTrackModal}
              >
                Закрыть
              </Button>
            </div>

            {createTrackError && (
              <div className="mb-4 rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">
                {createTrackError}
              </div>
            )}

            <div className="space-y-4">
              <Input
                value={newTrackTitle}
                onChange={(event) => setNewTrackTitle(event.target.value)}
                placeholder="Название трека"
                className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
              />

              <Select
                value={newTrackVersionType}
                onChange={(event) => setNewTrackVersionType(event.target.value as DemoVersionType)}
                className="border-brand-border bg-white/90 text-brand-ink focus:ring-brand-border"
              >
                <option value="DEMO">Демо</option>
                <option value="ARRANGEMENT">Продакшн</option>
                <option value="NO_MIX">Запись без сведения</option>
                <option value="MIXED">С сведением</option>
                <option value="MASTERED">С мастерингом</option>
                <option value="RELEASE">Релиз</option>
                <option value="IDEA_TEXT">Идея (текст)</option>
              </Select>

              {newTrackVersionType !== "IDEA_TEXT" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={newTrackMode === "record" ? "primary" : "secondary"}
                    className={newTrackMode === "record" ? "" : "border-brand-border bg-white/85 text-brand-ink hover:bg-white"}
                    onClick={() => setNewTrackMode("record")}
                  >
                    Записать
                  </Button>
                  <Button
                    variant={newTrackMode === "upload" ? "primary" : "secondary"}
                    className={newTrackMode === "upload" ? "" : "border-brand-border bg-white/85 text-brand-ink hover:bg-white"}
                    onClick={() => {
                      setNewTrackMode("upload");
                      fileInputRef.current?.click();
                    }}
                  >
                    Загрузить файл
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0] ?? null;
                  setNewTrackFile(file);
                  setNewTrackFileAnalysis(file ? await detectAudioAnalysisMvp(file) : null);
                }}
              />

              {newTrackVersionType !== "IDEA_TEXT" && newTrackMode === "upload" && newTrackFile && (
                <div className="rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-xs text-brand-muted">
                  <p>Файл: {newTrackFile.name}</p>
                  <SongAnalysisBadges
                    bpm={newTrackFileAnalysis?.bpm}
                    keyRoot={newTrackFileAnalysis?.keyRoot}
                    keyMode={newTrackFileAnalysis?.keyMode}
                    className="mt-1"
                    compact
                  />
                </div>
              )}

              {newTrackVersionType !== "IDEA_TEXT" && newTrackMode === "record" && (
                <div className="rounded-2xl border border-brand-border bg-white/70 p-3">
                  <MultiTrackRecorder
                    resetKey={recorderResetKey}
                    onError={setCreateTrackError}
                    onReset={() => {
                      setNewTrackRecordedMix(null);
                      setNewTrackRecordedMixAnalysis(null);
                    }}
                    onReady={(payload) => {
                      setNewTrackRecordedMix(payload);
                      void detectAudioAnalysisMvp(payload.blob)
                        .then(setNewTrackRecordedMixAnalysis)
                        .catch(() => setNewTrackRecordedMixAnalysis(null));
                    }}
                  />
                </div>
              )}
              {newTrackVersionType !== "IDEA_TEXT" && newTrackMode === "record" && newTrackRecordedMix && (
                <div className="rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-xs text-brand-muted">
                  <p>Сведённый микс: {newTrackRecordedMix.filename}</p>
                  <SongAnalysisBadges
                    bpm={newTrackRecordedMixAnalysis?.bpm}
                    keyRoot={newTrackRecordedMixAnalysis?.keyRoot}
                    keyMode={newTrackRecordedMixAnalysis?.keyMode}
                    className="mt-1"
                    compact
                  />
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Текст / заметки</p>
                <Textarea
                  value={newTrackText}
                  onChange={(event) => setNewTrackText(event.target.value)}
                  placeholder="Черновик текста, хук, заметки..."
                  rows={4}
                  className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                />
              </div>

              {newTrackVersionType !== "IDEA_TEXT" && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-brand-ink">Комментарий к версии</p>
                  <Textarea
                    value={newTrackComment}
                    onChange={(event) => setNewTrackComment(event.target.value)}
                    placeholder="Что это за версия, что проверить, что доделать..."
                    rows={3}
                    className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button disabled={creatingTrack} onClick={saveTrackIntoProject}>
                  {creatingTrack ? "Сохраняем..." : "Добавить трек"}
                </Button>
                <Button
                  variant="secondary"
                  className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                  onClick={closeAddTrackModal}
                >
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
