"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Disc3, FolderOpen, Music, Plus, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiTrackRecorder } from "@/components/audio/multi-track-recorder";
import { LearnContextCard, type LearnContextCardAction } from "@/components/learn/learn-context-card";
import { PlaybackIcon } from "@/components/songs/playback-icon";
import { SongAnalysisBadges } from "@/components/songs/song-analysis-badges";
import { SongProjectPickerStep, type ProjectSelectionMode } from "@/components/songs/song-project-picker-step";
import { useSongsPlayback, type SongsPlaybackItem } from "@/components/songs/songs-playback-provider";
import { WorkspaceBrowser } from "@/components/songs/workspace-browser";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Modal } from "@/components/ui/modal";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { appendAudioAnalysisToFormData, detectAudioAnalysisMvp, type UploadAudioAnalysisMeta } from "@/lib/audio/upload-analysis-client";
import { buildProjectCoverStyle, projectDefaultCoverForKind } from "@/lib/project-cover-style";
import { fetchLearnContext, postLearnProgress } from "@/lib/learn/client";
import type { LearnContextBlock } from "@/lib/learn/types";
import { pickPreferredPlaybackDemo, playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";
import { getProjectOpenHref, type ProjectReleaseKind } from "@/lib/songs-project-navigation";
import {
  clearNewSongFlowDraft,
  saveNewSongFlowDraft,
  type NewSongFlowDraft
} from "@/lib/songs/new-song-flow-draft";
import {
  findIdeaStage,
  isDemoSongStage,
  isSelectableSongCreationStage,
  resolveVersionTypeByStage
} from "@/lib/songs-version-stage-map";
import type { IdentityBridgeStatus, TrackIdentityBridge } from "@/lib/id-integration";

type Folder = {
  id: string;
  title: string;
  _count?: { projects?: number; tracks?: number };
};

type Project = {
  id: string;
  title: string;
  artistLabel?: string | null;
  folderId: string | null;
  updatedAt: string;
  releaseKind?: "SINGLE" | "ALBUM";
  singleTrackId?: string | null;
  coverType: "GRADIENT" | "IMAGE";
  coverImageUrl?: string | null;
  coverPresetKey?: string | null;
  coverColorA?: string | null;
  coverColorB?: string | null;
  folder?: { id: string; title: string } | null;
  _count?: { tracks: number };
};

type ProjectTrackForPlayback = {
  id: string;
  title: string;
  pathStage?: { id: number; name: string } | null;
  primaryDemo?: {
    id: string;
    audioUrl: string | null;
    duration: number;
    versionType: DemoVersionType;
    createdAt: string;
  } | null;
  demos: Array<{
    id: string;
    audioUrl: string | null;
    duration: number;
    versionType: DemoVersionType;
    createdAt: string;
  }>;
};

type ProjectDetailForPlayback = Project & {
  tracks: ProjectTrackForPlayback[];
};

type PathStage = {
  id: number;
  name: string;
};

type Track = {
  id: string;
  title: string;
  lyricsText?: string | null;
  updatedAt: string;
  folderId: string | null;
  projectId?: string | null;
  project?:
    | {
        id: string;
        title: string;
        artistLabel?: string | null;
        releaseKind?: "SINGLE" | "ALBUM";
        coverType?: "GRADIENT" | "IMAGE";
        coverImageUrl?: string | null;
        coverPresetKey?: string | null;
        coverColorA?: string | null;
        coverColorB?: string | null;
      }
    | null;
  distributionRequest?: {
    id: string;
    artistName: string;
    releaseTitle: string;
    releaseDate: string;
    status?: string;
    masterDemo?: {
      id: string;
      createdAt: string;
      duration?: number;
      versionType?: DemoVersionType;
    } | null;
  } | null;
  releaseDemo?: {
    id: string;
    createdAt: string;
    audioUrl?: string | null;
    duration?: number;
    versionType?: DemoVersionType;
    releaseDate?: string | null;
  } | null;
  releaseArchiveMeta?: {
    source: "distribution_request" | "release_demo" | "legacy_stage";
    title: string;
    artistName?: string | null;
    releaseDate?: string | null;
    releaseKind?: "SINGLE" | "ALBUM" | null;
    coverType?: "GRADIENT" | "IMAGE" | null;
    coverImageUrl?: string | null;
    coverPresetKey?: string | null;
    coverColorA?: string | null;
    coverColorB?: string | null;
    isArchivedSingle?: boolean;
  } | null;
  displayBpm?: number | null;
  displayKeyRoot?: string | null;
  displayKeyMode?: string | null;
  pathStageId: number | null;
  pathStage?: { id: number; name: string } | null;
  workbenchState: "IN_PROGRESS" | "STUCK" | "NEEDS_FEEDBACK" | "DEFERRED" | "READY_FOR_NEXT_STEP";
  workbenchStateLabel: string;
  trackIntent?: {
    summary: string;
    whyNow?: string | null;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  activeNextStep?: {
    id: string;
    text: string;
    reason?: string | null;
    status: "ACTIVE" | "DONE" | "CANCELED";
    source: "MANUAL" | "SYSTEM" | "AI";
    origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  latestDemo?: {
    id: string;
    audioUrl?: string | null;
    duration?: number;
    versionType?: DemoVersionType;
    createdAt: string;
    releaseDate?: string | null;
  } | null;
  latestWrapUpAt?: string | null;
  latestVersionReflectionAt?: string | null;
  identityBridge: TrackIdentityBridge;
  _count?: { demos: number };
};

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED" | "RELEASE";
type SongFlowStep = "lyrics" | "stage" | "file-upload" | "project-pick";
type SongsZone = "workspace" | "archive" | "quick-add";

function normalizeStageName(name: string) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isPromoStage(name: string) {
  return normalizeStageName(name).includes("промо");
}

function findStageIdByVersionType(stages: PathStage[] | undefined, versionType: DemoVersionType): number | null {
  if (!stages?.length) return null;
  const checks: Record<DemoVersionType, (stageName: string) => boolean> = {
    IDEA_TEXT: (name) => name.includes("искра") || name.includes("идея"),
    DEMO: (name) => name.includes("формирован") || name.includes("становлен") || name.includes("демо"),
    ARRANGEMENT: (name) =>
      name.includes("выход в свет") || name.includes("первые успех") || name.includes("продакшн") || name.includes("аранж"),
    NO_MIX: (name) => name.includes("прорыв") || name.includes("закреплен") || name.includes("запис"),
    MIXED: (name) => name.includes("признан") || name.includes("аудитор") || name.includes("свед"),
    MASTERED: (name) => name.includes("широкая известность") || name.includes("медийн") || name.includes("мастер"),
    RELEASE: (name) =>
      name.includes("релиз") ||
      name.includes("дистр") ||
      name.includes("наслед") ||
      name.includes("культурн") ||
      name.includes("влияни")
  };
  const match = stages.find((stage) => checks[versionType](normalizeStageName(stage.name)));
  return match?.id ?? null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatReleaseArchiveDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function releaseKindLabelRu(value: "SINGLE" | "ALBUM" | null | undefined) {
  if (value === "ALBUM") return "Альбом";
  if (value === "SINGLE") return "Сингл";
  return "Релиз";
}

function formatStageOptionLabel(stage: PathStage) {
  return resolveVersionTypeByStage(stage) === "NO_MIX" ? "Запись без сведения" : stage.name;
}

function getWorkbenchTone(workbenchState: Track["workbenchState"]) {
  switch (workbenchState) {
    case "STUCK":
      return "border-amber-300/70 bg-amber-50 text-amber-900";
    case "NEEDS_FEEDBACK":
      return "border-sky-300/70 bg-sky-50 text-sky-900";
    case "DEFERRED":
      return "border-stone-300/70 bg-stone-100 text-stone-700";
    case "READY_FOR_NEXT_STEP":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
    default:
      return "border-lime-300/70 bg-lime-50 text-lime-900";
  }
}

function getIdentityBridgeTone(status: IdentityBridgeStatus) {
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

function getIdentityBridgeLabel(status: IdentityBridgeStatus) {
  switch (status) {
    case "STRONG":
      return "ID strong";
    case "PARTIAL":
      return "ID partial";
    case "WEAK":
      return "ID weak";
    default:
      return "ID missing";
  }
}

function getTrackIdentityPreview(track: Track) {
  return (
    track.identityBridge.supports.find((item) => item.kind === "theme")?.value ||
    track.identityBridge.supports[0]?.value ||
    track.identityBridge.warnings[0]?.title ||
    "Связь с миром артиста пока не собрана."
  );
}

function formatTrackActivity(track: Track) {
  const value = track.latestDemo?.createdAt ?? track.latestVersionReflectionAt ?? track.latestWrapUpAt ?? track.updatedAt;
  return formatDate(value);
}

function pluralizeRu(count: number, one: string, few: string, many: string) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
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

export default function SongsPage() {
  const router = useRouter();
  const toast = useToast();
  const playback = useSongsPlayback();
  const { data: tracks, refetch: refetchTracks, isLoading: tracksLoading } = useQuery({
    queryKey: ["songs-tracks"],
    queryFn: () => fetcher<Track[]>("/api/songs")
  });
  const { data: folders, refetch: refetchFolders, isLoading: foldersLoading } = useQuery({
    queryKey: ["songs-folders"],
    queryFn: () => fetcher<Folder[]>("/api/folders")
  });
  const { data: projects, refetch: refetchProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ["songs-projects"],
    queryFn: () => fetcher<Project[]>("/api/projects")
  });
  const { data: stages } = useQuery({
    queryKey: ["songs-track-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/songs/stages")
  });

  const [query, setQuery] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("ALL");

  const [folderAssignTrackId, setFolderAssignTrackId] = useState("");
  const [folderAssignFolderId, setFolderAssignFolderId] = useState("NONE");
  const [folderAssignNewTitle, setFolderAssignNewTitle] = useState("");
  const [assigningFolder, setAssigningFolder] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectReleaseKind, setNewProjectReleaseKind] = useState<ProjectReleaseKind>("ALBUM");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState("");
  const [folderActionError, setFolderActionError] = useState("");
  const [projectActionError, setProjectActionError] = useState("");
  const [projectMenuId, setProjectMenuId] = useState("");
  const [projectActionLoadingId, setProjectActionLoadingId] = useState("");
  const [projectCardPlayLoadingId, setProjectCardPlayLoadingId] = useState("");
  const [showLegacyLibrary, setShowLegacyLibrary] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showMobileQuickAddMenu, setShowMobileQuickAddMenu] = useState(false);
  const [activeZone, setActiveZone] = useState<SongsZone>("workspace");
  const [deleteFolderPrompt, setDeleteFolderPrompt] = useState<{
    id: string;
    title: string;
    hasContent: boolean;
    hasProjects: boolean;
  } | null>(null);
  const [assignProjectFolderPrompt, setAssignProjectFolderPrompt] = useState<{
    id: string;
    title: string;
    value: string;
  } | null>(null);
  const [renameProjectPrompt, setRenameProjectPrompt] = useState<{
    id: string;
    initialTitle: string;
    value: string;
  } | null>(null);
  const [deleteProjectPrompt, setDeleteProjectPrompt] = useState<{
    id: string;
    title: string;
    hasTracks: boolean;
  } | null>(null);

  const [showSongFlowModal, setShowSongFlowModal] = useState(false);
  const [songFlowStep, setSongFlowStep] = useState<SongFlowStep>("lyrics");
  const [songFlowDraft, setSongFlowDraft] = useState<NewSongFlowDraft>({
    title: "",
    lyricsText: "",
    lyricsWasSkipped: false,
    selectedStageId: null,
    branch: null,
    demoReadyFileMeta: null,
    sourceContext: "songs-page",
    createdAt: Date.now()
  });
  const [songFlowFile, setSongFlowFile] = useState<File | null>(null);
  const [songFlowFileAnalysis, setSongFlowFileAnalysis] = useState<UploadAudioAnalysisMeta | null>(null);
  const [songFlowSelectionMode, setSongFlowSelectionMode] = useState<ProjectSelectionMode>("existing");
  const [songFlowSelectedProjectId, setSongFlowSelectedProjectId] = useState("");
  const [songFlowNewProjectTitle, setSongFlowNewProjectTitle] = useState("");
  const [songFlowNewProjectReleaseKind, setSongFlowNewProjectReleaseKind] = useState<ProjectReleaseKind>("SINGLE");
  const [songFlowSaving, setSongFlowSaving] = useState(false);
  const [songFlowError, setSongFlowError] = useState("");

  const [showDemoComposer, setShowDemoComposer] = useState(false);
  const [demoMode, setDemoMode] = useState<"record" | "upload">("upload");
  const [demoNewTrackTitle, setDemoNewTrackTitle] = useState("");
  const [demoStageId, setDemoStageId] = useState("NONE");
  const [demoText, setDemoText] = useState("");
  const [demoVersionComment, setDemoVersionComment] = useState("");
  const [editingDemoVersionComment, setEditingDemoVersionComment] = useState(false);
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const [demoFileAnalysis, setDemoFileAnalysis] = useState<UploadAudioAnalysisMeta | null>(null);
  const [demoVersionType, setDemoVersionType] = useState<DemoVersionType>("IDEA_TEXT");
  const [demoProjectSelectionMode, setDemoProjectSelectionMode] = useState<ProjectSelectionMode>("existing");
  const [demoSelectedProjectId, setDemoSelectedProjectId] = useState("");
  const [demoNewProjectTitle, setDemoNewProjectTitle] = useState("");
  const [demoNewProjectReleaseKind, setDemoNewProjectReleaseKind] = useState<ProjectReleaseKind>("SINGLE");
  const [savingDemo, setSavingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");

  const [recordedMix, setRecordedMix] = useState<{ blob: Blob; durationSec: number; filename: string } | null>(null);
  const [recordedMixAnalysis, setRecordedMixAnalysis] = useState<UploadAudioAnalysisMeta | null>(null);
  const [recorderResetKey, setRecorderResetKey] = useState(0);
  const isCreationOverlayOpen = showSongFlowModal || showDemoComposer || showCreateProject;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const songFlowFileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredTracks = useMemo(() => {
    const list = tracks ?? [];
    return list.filter((track) => {
      const matchesQuery = !query || track.title.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = selectedStageId === "ALL" || String(track.pathStageId ?? "NONE") === selectedStageId;
      return matchesQuery && matchesStatus;
    });
  }, [query, selectedStageId, tracks]);

  const visibleStages = useMemo(() => (stages ?? []).filter((stage) => !isPromoStage(stage.name)), [stages]);
  const songFlowStageOptions = useMemo(() => visibleStages.filter((stage) => isSelectableSongCreationStage(stage)), [visibleStages]);

  const tracksWithoutFolder = useMemo(() => filteredTracks.filter((track) => !track.folderId), [filteredTracks]);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = projects ?? [];
    if (!needle) return list;
    return list.filter((project) => {
      const haystack = [project.title, project.artistLabel ?? "", project.folder?.title ?? ""].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [projects, query]);

  const foldersWithProjects = useMemo(() => {
    const byId = new Map<string, Project[]>();
    filteredProjects.forEach((project) => {
      if (!project.folderId) return;
      const list = byId.get(project.folderId) ?? [];
      list.push(project);
      byId.set(project.folderId, list);
    });

    return (folders ?? []).map((folder) => ({
      folder,
      projects: byId.get(folder.id) ?? []
    }));
  }, [filteredProjects, folders]);

  const releaseSinglesCount = useMemo(() => {
    const singleProjectIds = new Set<string>();
    (tracks ?? []).forEach((track) => {
      if (!track.releaseArchiveMeta) return;
      if (track.releaseArchiveMeta.releaseKind !== "SINGLE" || !track.project?.id) return;
      singleProjectIds.add(track.project.id);
    });
    return singleProjectIds.size;
  }, [tracks]);

  const releaseAlbumsCount = useMemo(() => {
    const albumProjectIds = new Set<string>();
    (tracks ?? []).forEach((track) => {
      if (!track.releaseArchiveMeta) return;
      if (track.releaseArchiveMeta.releaseKind !== "ALBUM" || !track.project?.id) return;
      albumProjectIds.add(track.project.id);
    });
    return albumProjectIds.size;
  }, [tracks]);

  const projectSinglesCount = useMemo(
    () => (projects ?? []).filter((project) => project.releaseKind === "SINGLE").length,
    [projects]
  );

  const projectAlbumsCount = useMemo(
    () => (projects ?? []).filter((project) => (project.releaseKind ?? "ALBUM") === "ALBUM").length,
    [projects]
  );
  const foldersCount = folders?.length ?? 0;
  const tracksCount = tracks?.length ?? 0;
  const songsDataLoading = tracksLoading || foldersLoading || projectsLoading;
  const releaseArchiveTracks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...(tracks ?? [])]
      .filter((track) => track.releaseArchiveMeta)
      .filter((track) => {
        if (!needle) return true;
        const haystack = [
          track.releaseArchiveMeta?.title ?? "",
          track.releaseArchiveMeta?.artistName ?? "",
          track.title,
          track.project?.title ?? "",
          track.pathStage?.name ?? ""
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [query, tracks]);

  const recentTracks = useMemo(() => {
    return [...(filteredTracks ?? [])]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }, [filteredTracks]);
  const workshopTracks = useMemo(() => {
    return [...(filteredTracks ?? [])]
      .filter((track) => track.workbenchState !== "DEFERRED" || track.activeNextStep)
      .sort((left, right) => {
        const leftHasActive = left.activeNextStep ? 1 : 0;
        const rightHasActive = right.activeNextStep ? 1 : 0;
        if (leftHasActive !== rightHasActive) return rightHasActive - leftHasActive;
        const leftDeferred = left.workbenchState === "DEFERRED" ? 1 : 0;
        const rightDeferred = right.workbenchState === "DEFERRED" ? 1 : 0;
        if (leftDeferred !== rightDeferred) return leftDeferred - rightDeferred;
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .slice(0, 8);
  }, [filteredTracks]);
  const learnAnchorTrack = workshopTracks[0] ?? recentTracks[0] ?? null;
  const { data: songsLearnBlock, refetch: refetchSongsLearn } = useQuery<LearnContextBlock>({
    queryKey: ["songs-learn-context", learnAnchorTrack?.id ?? "stage-only"],
    queryFn: () =>
      fetchLearnContext({
        surface: "SONGS",
        trackId: learnAnchorTrack?.id ?? null
      })
  });

  useEffect(() => {
    if (demoVersionType !== "DEMO" && demoMode === "record") {
      setDemoMode("upload");
    }
  }, [demoMode, demoVersionType]);

  useEffect(() => {
    const mappedStageId = findStageIdByVersionType(visibleStages, demoVersionType);
    setDemoStageId(mappedStageId === null ? "NONE" : String(mappedStageId));
  }, [demoVersionType, visibleStages]);

  useEffect(() => {
    if (!showDemoComposer) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        resetDemoComposer();
        setShowDemoComposer(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // resetDemoComposer is intentionally omitted to keep a stable Escape listener while modal is open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDemoComposer]);

  useEffect(() => {
    if (!showSongFlowModal) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowSongFlowModal(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSongFlowModal]);

  useEffect(() => {
    if (!showCreateProject) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCreateProjectPanel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [newProjectReleaseKind, showCreateProject]);

  useEffect(() => {
    if (!showMobileQuickAddMenu) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowMobileQuickAddMenu(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showMobileQuickAddMenu]);

  useEffect(() => {
    if (!isCreationOverlayOpen || !showMobileQuickAddMenu) return;
    setShowMobileQuickAddMenu(false);
  }, [isCreationOverlayOpen, showMobileQuickAddMenu]);

  async function handleSongsLearnAction(materialSlug: string, action: LearnContextCardAction) {
    try {
      if (action.kind === "APPLY_TO_TRACK") {
        await postLearnProgress(materialSlug, {
          action: "APPLY",
          surface: "SONGS",
          targetType: "TRACK",
          targetId: action.targetId,
          recommendationContext: action.recommendationContext
        });
        toast.success("Материал привязан к треку.");
      } else if (action.kind === "APPLY_TO_GOAL") {
        await postLearnProgress(materialSlug, {
          action: "APPLY",
          surface: "SONGS",
          targetType: "GOAL",
          targetId: action.targetId,
          recommendationContext: action.recommendationContext
        });
        toast.success("Материал привязан к цели.");
      } else if (action.kind === "NOT_RELEVANT") {
        await postLearnProgress(materialSlug, {
          action: "NOT_RELEVANT",
          surface: "SONGS",
          recommendationContext: action.recommendationContext
        });
        toast.info("Материал скрыт из контекстной выдачи.");
      } else {
        await postLearnProgress(materialSlug, {
          action: "LATER",
          surface: "SONGS",
          recommendationContext: action.recommendationContext
        });
        toast.info("Материал отложен на потом.");
      }
      await refetchSongsLearn();
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Не удалось обновить Learn-материал.");
    }
  }

  function resetDemoComposer() {
    setRecordedMix(null);
    setRecordedMixAnalysis(null);
    setRecorderResetKey((prev) => prev + 1);
    setDemoMode("upload");
    setDemoNewTrackTitle("");
    setDemoStageId("NONE");
    setDemoText("");
    setDemoVersionComment("");
    setEditingDemoVersionComment(false);
    setDemoFile(null);
    setDemoFileAnalysis(null);
    setDemoVersionType("IDEA_TEXT");
    setDemoProjectSelectionMode((projects?.length ?? 0) > 0 ? "existing" : "new");
    setDemoSelectedProjectId("");
    setDemoNewProjectTitle("");
    setDemoNewProjectReleaseKind("SINGLE");
    setDemoError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openNewSongRecorder() {
    resetDemoComposer();
    setShowDemoComposer(true);
    setDemoVersionType("DEMO");
    setDemoMode("record");
  }

  function createEmptySongFlowDraft(): NewSongFlowDraft {
    return {
      title: "",
      lyricsText: "",
      lyricsWasSkipped: false,
      selectedStageId: null,
      branch: null,
      demoReadyFileMeta: null,
      sourceContext: "songs-page",
      targetProject: null,
      createdAt: Date.now()
    };
  }

  function resetSongFlowModalState(options?: { preserveStoredDraft?: boolean }) {
    if (!options?.preserveStoredDraft) {
      clearNewSongFlowDraft();
    }
    setShowSongFlowModal(false);
    setSongFlowStep("lyrics");
    setSongFlowDraft(createEmptySongFlowDraft());
    setSongFlowFile(null);
    setSongFlowFileAnalysis(null);
    setSongFlowSelectionMode((projects?.length ?? 0) > 0 ? "existing" : "new");
    setSongFlowSelectedProjectId("");
    setSongFlowNewProjectTitle("");
    setSongFlowNewProjectReleaseKind("SINGLE");
    setSongFlowSaving(false);
    setSongFlowError("");
    if (songFlowFileInputRef.current) {
      songFlowFileInputRef.current.value = "";
    }
  }

  function openNewSongWizard() {
    resetSongFlowModalState();
    setShowSongFlowModal(true);
  }

  function closeSongFlowModal() {
    resetSongFlowModalState();
  }

  function prepareSongFlowProjectStep(branch: NewSongFlowDraft["branch"]) {
    setSongFlowDraft((prev) => ({ ...prev, branch }));
    setSongFlowStep("project-pick");
    setSongFlowSelectionMode((projects?.length ?? 0) > 0 ? "existing" : "new");
    setSongFlowSelectedProjectId("");
    setSongFlowNewProjectTitle((prev) => prev || songFlowDraft.title || "");
    setSongFlowNewProjectReleaseKind((prev) => prev || "SINGLE");
    setSongFlowError("");
  }

  async function createSongFlowProjectId() {
    if (songFlowSelectionMode === "existing") {
      if (!songFlowSelectedProjectId || songFlowSelectedProjectId === "NONE") {
        throw new Error("Выберите проект.");
      }
      return songFlowSelectedProjectId;
    }

    if (!songFlowNewProjectTitle.trim()) {
      throw new Error("Введите название нового проекта.");
    }

    const defaults = projectDefaultCoverForKind(songFlowNewProjectReleaseKind);
    const response = await apiFetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: songFlowNewProjectTitle.trim(),
        releaseKind: songFlowNewProjectReleaseKind,
        coverType: "GRADIENT",
        coverPresetKey: defaults.coverPresetKey,
        coverColorA: defaults.coverColorA,
        coverColorB: defaults.coverColorB
      })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Не удалось создать проект.");
    }
    const created = (await response.json()) as { id: string };
    return created.id;
  }

  async function uploadSongFlowAudio(
    trackId: string,
    file: Blob,
    filename: string,
    durationSec: number,
    versionType: DemoVersionType,
    analysis: UploadAudioAnalysisMeta | null = null
  ) {
    const formData = new FormData();
    formData.append("file", file, filename);
    formData.append("durationSec", String(durationSec));
    formData.append("trackId", trackId);
    formData.append("noteText", "");
    formData.append("versionType", versionType);
    appendAudioAnalysisToFormData(formData, analysis);

    const response = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Трек создан, но не удалось загрузить аудио.");
    }
  }

  async function saveSongFlowTextOnly() {
    const ideaStage = findIdeaStage(visibleStages);
    if (!ideaStage) {
      throw new Error("Не найден этап «Идея».");
    }
    if (!songFlowDraft.title.trim()) {
      throw new Error("Укажи название песни.");
    }
    if (!songFlowDraft.lyricsText.trim()) {
      throw new Error("Добавь текст песни или выбери другой сценарий.");
    }

    const projectId = await createSongFlowProjectId();
    const response = await apiFetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: songFlowDraft.title.trim(),
        lyricsText: songFlowDraft.lyricsText.trim(),
        projectId,
        pathStageId: ideaStage.id
      })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Не удалось сохранить песню с текстом.");
    }
  }

  async function saveSongFlowNonDemo() {
    if (!songFlowDraft.title.trim()) {
      throw new Error("Укажи название песни.");
    }
    if (!songFlowDraft.selectedStageId) {
      throw new Error("Выберите этап.");
    }
    const selectedStage = visibleStages.find((stage) => stage.id === songFlowDraft.selectedStageId);
    if (!selectedStage) {
      throw new Error("Не найден выбранный этап.");
    }
    const versionType = resolveVersionTypeByStage(selectedStage);
    if (!versionType || versionType === "IDEA_TEXT" || versionType === "DEMO") {
      throw new Error("Для этого этапа нельзя использовать non-demo загрузку в текущем потоке.");
    }
    if (!songFlowFile) {
      throw new Error("Сначала загрузите аудиофайл.");
    }

    const projectId = await createSongFlowProjectId();
    const createTrackResponse = await apiFetch("/api/songs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: songFlowDraft.title.trim(),
        lyricsText: songFlowDraft.lyricsWasSkipped ? null : songFlowDraft.lyricsText.trim() || null,
        projectId,
        pathStageId: selectedStage.id
      })
    });
    if (!createTrackResponse.ok) {
      const payload = (await createTrackResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Не удалось создать трек.");
    }
    const createdTrack = (await createTrackResponse.json()) as { id: string };
    const durationSec = await getAudioDurationSeconds(songFlowFile);
    const analysis = await detectAudioAnalysisMvp(songFlowFile);
    await uploadSongFlowAudio(createdTrack.id, songFlowFile, songFlowFile.name, durationSec, versionType, analysis);
  }

  async function confirmSongFlowProjectStep() {
    setSongFlowSaving(true);
    setSongFlowError("");
    try {
      if (songFlowDraft.branch === "TEXT_ONLY") {
        await saveSongFlowTextOnly();
      } else if (songFlowDraft.branch === "NON_DEMO_UPLOAD") {
        await saveSongFlowNonDemo();
      } else {
        throw new Error("Неподдерживаемый сценарий сохранения.");
      }

      await refetchWorkspaceSurface();
      resetSongFlowModalState();
      toast.success("Новая песня добавлена.");
    } catch (error) {
      setSongFlowError(error instanceof Error ? error.message : "Не удалось сохранить песню.");
    } finally {
      setSongFlowSaving(false);
    }
  }

  function handleSongFlowContinueWithLyrics() {
    if (!songFlowDraft.title.trim()) {
      setSongFlowError("Укажи название песни.");
      return;
    }
    setSongFlowDraft((prev) => ({ ...prev, lyricsWasSkipped: false, branch: null }));
    setSongFlowStep("stage");
    setSongFlowError("");
  }

  function handleSongFlowSaveTextOnlyStart() {
    if (!songFlowDraft.title.trim()) {
      setSongFlowError("Укажи название песни.");
      return;
    }
    if (!songFlowDraft.lyricsText.trim()) {
      setSongFlowError("Добавь текст песни для сохранения.");
      return;
    }
    prepareSongFlowProjectStep("TEXT_ONLY");
  }

  function handleSongFlowStageContinue() {
    if (!songFlowDraft.selectedStageId) {
      setSongFlowError("Выберите этап трека.");
      return;
    }
    const selectedStage = songFlowStageOptions.find((stage) => stage.id === songFlowDraft.selectedStageId);
    if (!selectedStage) {
      setSongFlowError("Выберите этап трека.");
      return;
    }

    setSongFlowError("");
    if (isDemoSongStage(selectedStage.name)) {
      const draftToPersist: NewSongFlowDraft = {
        ...songFlowDraft,
        branch: "DEMO_RECORD",
        selectedStageId: selectedStage.id,
        sourceContext: "songs-page",
        targetProject: null,
        createdAt: Date.now()
      };
      saveNewSongFlowDraft(draftToPersist);
      resetSongFlowModalState({ preserveStoredDraft: true });
      router.push("/songs/new/demo");
      return;
    }

    setSongFlowDraft((prev) => ({ ...prev, branch: "NON_DEMO_UPLOAD" }));
    setSongFlowStep("file-upload");
  }

  function handleSongFlowFileContinue() {
    if (!songFlowFile) {
      setSongFlowError("Загрузите аудиофайл.");
      return;
    }
    prepareSongFlowProjectStep("NON_DEMO_UPLOAD");
  }

  async function assignTrackToFolder(trackId: string) {
    setAssigningFolder(true);
    setFolderActionError("");
    try {
      let targetFolderId = folderAssignFolderId;

      if (folderAssignNewTitle.trim()) {
        const newFolder = await apiFetchJson<Folder>("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: folderAssignNewTitle.trim() })
        });
        targetFolderId = newFolder.id;
      }

      if (targetFolderId === "NONE") {
        return;
      }

      const response = await apiFetch(`/api/songs/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: targetFolderId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось переместить трек в папку.");
      }

      setFolderAssignTrackId("");
      setFolderAssignFolderId("NONE");
      setFolderAssignNewTitle("");

      await Promise.all([refetchTracks(), refetchFolders(), refetchProjects()]);
    } catch (error) {
      setFolderActionError(error instanceof Error ? error.message : "Не удалось переместить трек в папку.");
    } finally {
      setAssigningFolder(false);
    }
  }

  async function createFolder() {
    if (!newFolderTitle.trim()) return;

    setCreatingFolder(true);
    setFolderActionError("");
    try {
      const response = await apiFetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newFolderTitle.trim() })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось создать папку.");
      }
      setNewFolderTitle("");
      setShowCreateFolder(false);
      await refetchFolders();
      toast.success("Папка создана.");
    } catch (error) {
      setFolderActionError(error instanceof Error ? error.message : "Не удалось создать папку.");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function createProject() {
    if (!newProjectTitle.trim()) return;

    setCreatingProject(true);
    setProjectActionError("");
    try {
      const defaults = projectDefaultCoverForKind(newProjectReleaseKind);
      const response = await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProjectTitle.trim(),
          releaseKind: newProjectReleaseKind,
          coverType: "GRADIENT",
          coverPresetKey: defaults.coverPresetKey,
          coverColorA: defaults.coverColorA,
          coverColorB: defaults.coverColorB
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось создать проект.");
      }
      closeCreateProjectPanel();
      await refetchProjects();
      toast.success("Проект создан.");
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось создать проект.");
    } finally {
      setCreatingProject(false);
    }
  }

  async function deleteFolder(folder: Folder) {
    const hasProjects = (folder._count?.projects ?? 0) > 0;
    const hasLegacyTracks = (folder._count?.tracks ?? 0) > 0;
    const hasContent = hasProjects || hasLegacyTracks;
    setDeleteFolderPrompt({
      id: folder.id,
      title: folder.title,
      hasContent,
      hasProjects
    });
  }

  async function submitDeleteFolder() {
    if (!deleteFolderPrompt) return;
    setDeletingFolderId(deleteFolderPrompt.id);
    setFolderActionError("");
    try {
      const response = await apiFetch(
        `/api/folders/${deleteFolderPrompt.id}${deleteFolderPrompt.hasContent ? "?force=1" : ""}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить папку.");
      }
      await Promise.all([refetchFolders(), refetchTracks(), refetchProjects()]);
      toast.success("Папка удалена.");
      setDeleteFolderPrompt(null);
    } catch (error) {
      setFolderActionError(error instanceof Error ? error.message : "Не удалось удалить папку.");
    } finally {
      setDeletingFolderId("");
    }
  }

  async function assignProjectToFolder(project: Project) {
    setAssignProjectFolderPrompt({
      id: project.id,
      title: project.title,
      value: project.folder?.title ?? ""
    });
    setProjectMenuId("");
  }

  async function submitAssignProjectToFolder() {
    if (!assignProjectFolderPrompt) return;
    const nextFolderTitle = assignProjectFolderPrompt.value.trim();
    setProjectActionLoadingId(assignProjectFolderPrompt.id);
    setProjectActionError("");
    try {
      let nextFolderId: string | null = null;

      if (nextFolderTitle) {
        const existingFolder = (folders ?? []).find((folder) => folder.title === nextFolderTitle);
        if (existingFolder) {
          nextFolderId = existingFolder.id;
        } else {
          const createdFolder = await apiFetchJson<Folder>("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: nextFolderTitle })
          });
          nextFolderId = createdFolder.id;
        }
      }

      const response = await apiFetch(`/api/projects/${assignProjectFolderPrompt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: nextFolderId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось обновить папку проекта.");
      }

      await Promise.all([refetchProjects(), refetchFolders(), refetchTracks()]);
      toast.success(nextFolderTitle ? "Проект перемещён в папку." : "Папка проекта очищена.");
      setAssignProjectFolderPrompt(null);
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось обновить папку проекта.");
    } finally {
      setProjectActionLoadingId("");
    }
  }

  async function removeProjectFromFolder(project: Project) {
    if (!project.folderId) return;

    setProjectActionLoadingId(project.id);
    setProjectActionError("");
    setProjectMenuId("");
    try {
      const response = await apiFetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: null })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось убрать проект из папки.");
      }
      await Promise.all([refetchProjects(), refetchFolders(), refetchTracks()]);
      toast.success("Проект убран из папки.");
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось убрать проект из папки.");
    } finally {
      setProjectActionLoadingId("");
    }
  }

  async function renameProject(project: Project) {
    setRenameProjectPrompt({
      id: project.id,
      initialTitle: project.title,
      value: project.title
    });
    setProjectMenuId("");
  }

  async function submitProjectRename() {
    if (!renameProjectPrompt) return;
    const nextTitle = renameProjectPrompt.value.trim();
    if (!nextTitle || nextTitle === renameProjectPrompt.initialTitle) {
      setRenameProjectPrompt(null);
      return;
    }

    setProjectActionLoadingId(renameProjectPrompt.id);
    setProjectActionError("");
    try {
      const response = await apiFetch(`/api/projects/${renameProjectPrompt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось переименовать проект.");
      }
      await refetchProjects();
      toast.success("Название проекта обновлено.");
      setRenameProjectPrompt(null);
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось переименовать проект.");
    } finally {
      setProjectActionLoadingId("");
    }
  }

  async function deleteProject(project: Project) {
    const hasTracks = (project._count?.tracks ?? 0) > 0;
    setDeleteProjectPrompt({
      id: project.id,
      title: project.title,
      hasTracks
    });
    setProjectMenuId("");
  }

  async function submitDeleteProject() {
    if (!deleteProjectPrompt) return;
    setProjectActionLoadingId(deleteProjectPrompt.id);
    setProjectActionError("");
    try {
      const response = await apiFetch(
        `/api/projects/${deleteProjectPrompt.id}${deleteProjectPrompt.hasTracks ? "?force=1" : ""}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить проект.");
      }
      await Promise.all([refetchProjects(), refetchTracks(), refetchFolders()]);
      toast.success("Проект удалён.");
      setDeleteProjectPrompt(null);
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось удалить проект.");
    } finally {
      setProjectActionLoadingId("");
    }
  }

  async function playProjectFromCard(projectId: string) {
    setProjectCardPlayLoadingId(projectId);
    setProjectActionError("");
    try {
      const detail = await apiFetchJson<ProjectDetailForPlayback>(`/api/projects/${projectId}`);
      const coverType: "image" | "gradient" = detail.coverType === "IMAGE" ? "image" : "gradient";
      const queue: SongsPlaybackItem[] = [];
      for (const track of detail.tracks ?? []) {
        const preferredDemo = pickPreferredPlaybackDemo(track);
        if (!preferredDemo) continue;
        queue.push({
          demoId: preferredDemo.id,
          src: `/api/audio-clips/${preferredDemo.id}/stream`,
          title: track.title,
          subtitle: `${detail.title} • ${track.pathStage?.name ?? "Без статуса"}`,
          linkHref: `/songs/${track.id}`,
          durationSec: preferredDemo.duration,
          trackId: track.id,
          projectId: detail.id,
          versionType: preferredDemo.versionType,
          queueGroupType: "project",
          queueGroupId: detail.id,
          cover: {
            type: coverType,
            imageUrl: detail.coverImageUrl ?? null,
            colorA: detail.coverColorA ?? null,
            colorB: detail.coverColorB ?? null
          },
          meta: {
            projectTitle: detail.title,
            pathStageName: track.pathStage?.name ?? undefined
          }
        });
      }

      if (!queue.length) {
        setProjectActionError("В проекте пока нет аудио-версий для воспроизведения.");
        return;
      }

      playback.playQueue(queue, 0, { type: "project", projectId: detail.id, title: detail.title });
      toast.success(`Запущен плейлист проекта «${detail.title}».`);
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось запустить проект.");
    } finally {
      setProjectCardPlayLoadingId("");
    }
  }

  function playReleaseArchiveTrack(track: Track) {
    const releaseDemo = track.releaseDemo ?? track.distributionRequest?.masterDemo ?? null;
    if (!releaseDemo?.id) {
      setProjectActionError("У этого релиза пока нет релизной аудио-версии для воспроизведения.");
      return;
    }

    const releaseKind = track.releaseArchiveMeta?.releaseKind ?? track.project?.releaseKind ?? "SINGLE";
    const archiveTitle = track.releaseArchiveMeta?.title || track.title;
    const archiveArtist = track.releaseArchiveMeta?.artistName || track.project?.artistLabel || "ART SAFE";
    const coverType = (track.releaseArchiveMeta?.coverType ?? track.project?.coverType) === "IMAGE" ? "image" : "gradient";

    const item: SongsPlaybackItem = {
      demoId: releaseDemo.id,
      src: `/api/audio-clips/${releaseDemo.id}/stream`,
      title: archiveTitle,
      subtitle: `${archiveArtist} • ${releaseKind === "ALBUM" ? "Альбом" : "Сингл"}`,
      linkHref: `/songs/${track.id}`,
      durationSec: releaseDemo.duration ?? 0,
      trackId: track.id,
      projectId: track.project?.id ?? null,
      versionType: releaseDemo.versionType ?? "RELEASE",
      queueGroupType: "track",
      queueGroupId: track.id,
      cover: {
        type: coverType,
        imageUrl: track.releaseArchiveMeta?.coverImageUrl ?? track.project?.coverImageUrl ?? null,
        colorA: track.releaseArchiveMeta?.coverColorA ?? track.project?.coverColorA ?? null,
        colorB: track.releaseArchiveMeta?.coverColorB ?? track.project?.coverColorB ?? null
      },
      meta: {
        projectTitle: track.project?.title ?? undefined,
        pathStageName: track.pathStage?.name ?? "Релиз"
      }
    };

    playback.toggle(item);
  }

  async function saveDemo() {
    setSavingDemo(true);
    setDemoError("");

    try {
      let targetTrackId = "";
      const selectedPathStageId = demoStageId === "NONE" ? null : Number(demoStageId);

      if (!demoNewTrackTitle.trim()) {
        setDemoError("Укажи название трека.");
        return;
      }
      if (demoVersionType === "IDEA_TEXT" && !demoText.trim()) {
        setDemoError("Для типа «Идея» добавь текст песни.");
        return;
      }
      let projectId = "";
      if (demoProjectSelectionMode === "existing") {
        if (!demoSelectedProjectId || demoSelectedProjectId === "NONE") {
          setDemoError("Выберите проект.");
          return;
        }
        projectId = demoSelectedProjectId;
      } else {
        if (!demoNewProjectTitle.trim()) {
          setDemoError("Введите название нового проекта.");
          return;
        }

        const defaults = projectDefaultCoverForKind(demoNewProjectReleaseKind);
        const projectResponse = await apiFetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: demoNewProjectTitle.trim(),
            releaseKind: demoNewProjectReleaseKind,
            coverType: "GRADIENT",
            coverPresetKey: defaults.coverPresetKey,
            coverColorA: defaults.coverColorA,
            coverColorB: defaults.coverColorB
          })
        });
        if (!projectResponse.ok) {
          const payload = (await projectResponse.json().catch(() => null)) as { error?: string } | null;
          setDemoError(payload?.error || "Не удалось создать проект.");
          return;
        }
        const createdProject = (await projectResponse.json()) as { id: string };
        projectId = createdProject.id;
      }

      const createdTrack = await apiFetchJson<Track>("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: demoNewTrackTitle.trim(),
          lyricsText: demoText.trim() || null,
          projectId,
          pathStageId: selectedPathStageId
        })
      });
      targetTrackId = createdTrack.id;

      if (demoVersionType === "IDEA_TEXT") {
        await Promise.all([refetchTracks(), refetchFolders(), refetchProjects()]);
        resetDemoComposer();
        setShowDemoComposer(false);
        toast.success("Песня сохранена.");
        return;
      }

      let fileToUpload: Blob | null = null;
      let filename = `demo-${Date.now()}.webm`;
      let durationSec = 0;

      if (demoMode === "upload") {
        if (!demoFile) {
          setDemoError("Выбери аудиофайл.");
          return;
        }
        fileToUpload = demoFile;
        filename = demoFile.name;
        durationSec = await getAudioDurationSeconds(demoFile);
      }

      if (demoMode === "record") {
        if (!recordedMix) {
          setDemoError("Сначала сведи дорожки в микс.");
          return;
        }
        fileToUpload = recordedMix.blob;
        filename = recordedMix.filename;
        durationSec = recordedMix.durationSec;
      }

      if (!fileToUpload) {
        setDemoError("Не удалось подготовить аудио.");
        return;
      }

      const analysis = await detectAudioAnalysisMvp(fileToUpload);
      const formData = new FormData();
      formData.append("file", fileToUpload, filename);
      formData.append("durationSec", String(durationSec));
      formData.append("trackId", targetTrackId);
      formData.append("noteText", demoVersionComment.trim());
      formData.append("versionType", demoVersionType);
      appendAudioAnalysisToFormData(formData, analysis);

      const uploadResponse = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
      if (!uploadResponse.ok) {
        const payload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось добавить файл к треку.");
      }

      await Promise.all([refetchTracks(), refetchFolders(), refetchProjects()]);
      resetDemoComposer();
      setShowDemoComposer(false);
      toast.success("Песня сохранена.");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Не удалось сохранить новую песню.");
    } finally {
      setSavingDemo(false);
    }
  }

  async function refetchWorkspaceSurface() {
    await Promise.all([refetchFolders(), refetchProjects(), refetchTracks()]);
  }

  function openCreateProjectPanel(kind: ProjectReleaseKind) {
    setNewProjectReleaseKind(kind);
    setShowCreateProject(true);
  }

  function closeCreateProjectPanel() {
    setShowCreateProject(false);
    setNewProjectTitle("");
    setNewProjectReleaseKind("ALBUM");
    setProjectActionError("");
  }

  const demoSourceReady =
    demoVersionType === "IDEA_TEXT" || (demoMode === "upload" ? Boolean(demoFile) : Boolean(recordedMix));

  return (
    <div className="space-y-4 pb-10 md:space-y-6 md:pb-12">
      <section className="relative overflow-hidden rounded-[22px] border border-brand-border bg-gradient-to-br from-[#f2f7e9] via-[#edf3e3] to-[#e6eedb] p-3 md:rounded-3xl md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(217,249,157,0.45),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.08),transparent_46%)]" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#8cae78]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-[#b5cba2]/35 blur-3xl" />
        <div className="relative space-y-3 md:space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted md:mb-2 md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                <span className="-rotate-6 inline-flex h-4 w-4 items-center justify-center rounded-md border border-brand-border bg-white shadow-[0_1px_0_rgba(42,52,44,0.08)] md:h-5 md:w-5">
                  <Music className="h-3 w-3 text-brand-ink" />
                </span>
                Песни
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-brand-ink md:text-3xl">Панель песен</h1>
            </div>

            <div className="relative">
              <Button
                className="h-10 min-w-[112px] rounded-2xl px-4 text-sm shadow-sm md:h-11 md:min-w-[132px] md:px-5"
                onClick={() => setShowSearchPanel((prev) => !prev)}
                aria-expanded={showSearchPanel}
              >
                Поиск
              </Button>
            </div>
          </div>

          {showSearchPanel && (
            <div className="rounded-xl border border-brand-border bg-white/70 p-2.5 shadow-sm backdrop-blur-sm md:rounded-2xl md:p-3">
              <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:gap-3">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Найти трек, проект или идею..."
                    className="h-10 bg-white pl-9 md:h-11"
                  />
                </label>

                <label className="relative block">
                  <Select
                    value={selectedStageId}
                    onChange={(event) => setSelectedStageId(event.target.value)}
                    className="h-10 bg-white md:h-11"
                  >
                    <option value="ALL">Все статусы</option>
                    {visibleStages.map((stage) => (
                      <option key={stage.id} value={String(stage.id)}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-0.5 md:mt-3 md:flex-wrap md:overflow-visible md:pb-0">
                <span className="inline-flex shrink-0 snap-start items-center rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] text-brand-muted md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                  Поиск: <span className="ml-1 font-medium text-brand-ink">{query.trim() ? "активен" : "все"}</span>
                </span>
                <span className="inline-flex shrink-0 snap-start items-center rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] text-brand-muted md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                  Статус:{" "}
                  <span className="ml-1 font-medium text-brand-ink">
                    {selectedStageId === "ALL"
                      ? "все"
                      : visibleStages.find((stage) => String(stage.id) === selectedStageId)?.name ?? "фильтр"}
                  </span>
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5 md:gap-3">
            <div className="group relative min-w-0 overflow-hidden rounded-xl border border-brand-border bg-white/82 p-2 shadow-sm sm:rounded-2xl sm:p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d9f99d] to-[#9ecf63]" />
              <div className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-border bg-[#edf4e5] text-brand-ink sm:mb-2 sm:h-8 sm:w-8 sm:rounded-xl">
                <FolderOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <p className="text-[9px] uppercase tracking-[0.1em] text-brand-muted sm:text-xs sm:tracking-wider">Папки</p>
              <p className="text-base font-semibold leading-none text-brand-ink sm:text-xl md:text-2xl">
                <span>{foldersCount}</span>
                <span className="ml-1 text-xs font-medium text-brand-muted sm:text-sm md:text-base">
                  {pluralizeRu(foldersCount, "папка", "папки", "папок")}
                </span>
              </p>
            </div>

            <div className="group relative min-w-0 overflow-hidden rounded-xl border border-brand-border bg-white/82 p-2 shadow-sm sm:rounded-2xl sm:p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dbeafe] to-[#93c5fd]" />
              <div className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-border bg-[#eef4fb] text-brand-ink sm:mb-2 sm:h-8 sm:w-8 sm:rounded-xl">
                <Disc3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <p className="text-[9px] uppercase tracking-[0.1em] text-brand-muted sm:text-xs sm:tracking-wider">Проекты</p>
              <div className="space-y-1">
                <p className="text-xs leading-none text-brand-ink sm:text-sm md:text-base">
                  <span className="font-semibold">{projectSinglesCount}</span>
                  <span className="ml-1 text-brand-muted">
                    {pluralizeRu(projectSinglesCount, "сингл", "сингла", "синглов")}
                  </span>
                </p>
                <p className="text-xs leading-none text-brand-ink sm:text-sm md:text-base">
                  <span className="font-semibold">{projectAlbumsCount}</span>
                  <span className="ml-1 text-brand-muted">
                    {pluralizeRu(projectAlbumsCount, "альбом", "альбома", "альбомов")}
                  </span>
                </p>
              </div>
            </div>

            <div className="group relative min-w-0 overflow-hidden rounded-xl border border-brand-border bg-white/82 p-2 shadow-sm sm:rounded-2xl sm:p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#fde68a] to-[#f59e0b]" />
              <div className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-border bg-[#fff6dd] text-brand-ink sm:mb-2 sm:h-8 sm:w-8 sm:rounded-xl">
                <Music className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <p className="text-[9px] uppercase tracking-[0.1em] text-brand-muted sm:text-xs sm:tracking-wider">Треки</p>
              <p className="text-base font-semibold leading-none text-brand-ink sm:text-xl md:text-2xl">
                <span>{tracksCount}</span>
                <span className="ml-1 text-xs font-medium text-brand-muted sm:text-sm md:text-base">
                  {pluralizeRu(tracksCount, "трек", "трека", "треков")}
                </span>
              </p>
            </div>

            <div className="group relative min-w-0 overflow-hidden rounded-xl border border-red-300/80 bg-white/82 p-2 shadow-sm sm:rounded-2xl sm:p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#fca5a5] to-[#ef4444]" />
              <div className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-[#fff1f1] text-[#8b2626] sm:mb-2 sm:h-8 sm:w-8 sm:rounded-xl">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <p className="text-[9px] uppercase tracking-[0.1em] text-brand-muted sm:text-xs sm:tracking-wider">Релизы</p>
              <div className="space-y-1">
                <p className="text-xs leading-none text-brand-ink sm:text-sm md:text-base">
                  <span className="font-semibold">{releaseSinglesCount}</span>
                  <span className="ml-1 text-brand-muted">
                    {pluralizeRu(releaseSinglesCount, "сингл", "сингла", "синглов")}
                  </span>
                </p>
                <p className="text-xs leading-none text-brand-ink sm:text-sm md:text-base">
                  <span className="font-semibold">{releaseAlbumsCount}</span>
                  <span className="ml-1 text-brand-muted">
                    {pluralizeRu(releaseAlbumsCount, "альбом", "альбома", "альбомов")}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeZone === "workspace" ? "primary" : "secondary"}
          className="h-10 rounded-xl px-4"
          onClick={() => setActiveZone("workspace")}
        >
          Рабочая зона
        </Button>
        <Button
          variant={activeZone === "archive" ? "primary" : "secondary"}
          className="h-10 rounded-xl px-4"
          onClick={() => setActiveZone("archive")}
        >
          Архив
        </Button>
      </div>

      {activeZone === "quick-add" && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Быстрое добавление</CardTitle>
            <CardDescription>Быстрые действия для нового контента.</CardDescription>
          </CardHeader>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button className="h-11 rounded-xl" onClick={openNewSongWizard}>
              Новая песня
            </Button>
            <Button className="h-11 rounded-xl" onClick={openNewSongRecorder}>
              Новая демо-запись
            </Button>
            <Button className="h-11 rounded-xl" onClick={() => openCreateProjectPanel("SINGLE")}>
              Новый сингл
            </Button>
            <Button className="h-11 rounded-xl" onClick={() => openCreateProjectPanel("ALBUM")}>
              Новый альбом
            </Button>
          </div>
        </Card>
      )}

      {activeZone === "quick-add" && showCreateFolder && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Создать папку</CardTitle>
            <CardDescription>Организуй треки по проектам, релизам или эпохам.</CardDescription>
          </CardHeader>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              value={newFolderTitle}
              onChange={(event) => setNewFolderTitle(event.target.value)}
              placeholder="Название папки"
            />
            <Button disabled={creatingFolder || !newFolderTitle.trim()} onClick={createFolder}>
              {creatingFolder ? "Создаем..." : "Создать"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateFolder(false);
                setNewFolderTitle("");
              }}
            >
              Отмена
            </Button>
          </div>
        </Card>
      )}

      {(folderActionError || projectActionError || demoError) && (
        <InlineActionMessage message={folderActionError || projectActionError || demoError} />
      )}

      {activeZone === "workspace" && songsDataLoading ? (
        <Card className="rounded-2xl p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-10 rounded-xl bg-white/70" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="h-32 rounded-2xl bg-white/70" />
              <div className="h-32 rounded-2xl bg-white/70" />
              <div className="h-32 rounded-2xl bg-white/70" />
              <div className="h-32 rounded-2xl bg-white/70" />
            </div>
          </div>
        </Card>
      ) : null}

	      {activeZone === "workspace" ? (
	        <div className="space-y-4">
            <LearnContextCard
              block={songsLearnBlock ?? null}
              targetLabelOverride={learnAnchorTrack?.title ?? null}
              onAction={handleSongsLearnAction}
            />

	          <Card className="relative overflow-hidden rounded-[22px] border border-brand-border bg-gradient-to-br from-[#f7fbf2] via-[#f1f6ea] to-[#e8f0df] p-0 shadow-[0_18px_46px_rgba(61,84,46,0.12)] md:rounded-3xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(217,249,157,0.28),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.06),transparent_42%)]" />
            <div className="relative border-b border-brand-border px-4 py-4 md:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                    <Sparkles className="h-3.5 w-3.5 text-brand-ink" />
                    Активная мастерская
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Треки, которые реально двигаются</h2>
                  <p className="mt-1 text-sm text-brand-muted">
                    Статус работы, intent и один следующий шаг вместо абстрактного списка файлов.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-xl border border-brand-border bg-white/85 px-3 py-1 text-xs text-brand-muted">
                  В работе: <span className="ml-1 font-medium text-brand-ink">{workshopTracks.length}</span>
                </span>
              </div>
            </div>
            <div className="relative p-4 md:p-5">
              {workshopTracks.length ? (
                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {workshopTracks.map((track) => (
                    <Link key={track.id} href={`/songs/${track.id}`} className="group block">
                      <div className="h-full rounded-[22px] border border-brand-border bg-white/88 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-brand-ink">{track.title}</p>
                            <p className="mt-1 text-xs text-brand-muted">
                              {track.project?.title ?? "Без проекта"}
                              {track.pathStage?.name ? ` • ${track.pathStage.name}` : ""}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getWorkbenchTone(track.workbenchState)}`}>
                            {track.workbenchStateLabel}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge className={getIdentityBridgeTone(track.identityBridge.status)}>
                            {getIdentityBridgeLabel(track.identityBridge.status)}
                          </Badge>
                          <span className="rounded-full border border-brand-border bg-white px-2.5 py-1 text-[11px] text-brand-muted">
                            {getTrackIdentityPreview(track)}
                          </span>
                        </div>

                        <div className="mt-3 space-y-3">
                          <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Intent</p>
                            <p className="mt-1 text-sm text-brand-ink">
                              {track.trackIntent?.summary?.trim() || "Intent еще не описан. Открой трек и зафиксируй, зачем он нужен сейчас."}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-brand-border bg-white px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Следующий шаг</p>
                            <p className="mt-1 text-sm font-medium text-brand-ink">
                              {track.activeNextStep?.text ?? "Шаг не назначен"}
                            </p>
                            {track.activeNextStep?.reason ? (
                              <p className="mt-1 text-sm text-brand-muted">{track.activeNextStep.reason}</p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs text-brand-muted">
                            <span className="rounded-full border border-brand-border bg-white px-2.5 py-1">
                              Последняя версия: {track.latestDemo ? formatDate(track.latestDemo.createdAt) : "нет"}
                            </span>
                            <span className="rounded-full border border-brand-border bg-white px-2.5 py-1">
                              Активность: {formatTrackActivity(track)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-border bg-white/75 px-4 py-8 text-sm text-brand-muted">
                  По текущим фильтрам нет активной мастерской. Создай трек или сними фильтры сверху.
                </div>
              )}
            </div>
          </Card>

          <WorkspaceBrowser parentFolderId={null} externalQuery={query} showCreateActions={false} onChanged={refetchWorkspaceSurface} />
        </div>
      ) : null}

      {activeZone === "archive" ? (
      <Card className="relative overflow-hidden rounded-[22px] border border-brand-border bg-gradient-to-br from-[#fff6ef] via-[#fff3ef] to-[#f8ece8] p-0 shadow-[0_18px_46px_rgba(88,53,44,0.12)] md:rounded-3xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(252,165,165,0.22),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(127,29,29,0.06),transparent_42%)]" />
        <div className="relative border-b border-brand-border px-3 py-3 md:px-5 md:py-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.45),transparent_38%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b2626] md:mb-2 md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Архив
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-brand-ink md:text-xl">Архив релизов</h2>
              <p className="mt-1 text-xs text-brand-muted md:text-sm">
                Архив релизов с финальной инфой (вручную или из нашей дистрибуции). Использует общий поиск сверху.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] text-brand-muted md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                Треков: <span className="ml-1 font-medium text-brand-ink">{releaseArchiveTracks.length}</span>
              </span>
              <span className="inline-flex items-center rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] text-brand-muted md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                Поиск: <span className="ml-1 font-medium text-brand-ink">{query.trim() ? "активен" : "все"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="relative p-3 md:p-5">
          {songsDataLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`archive-skeleton-${index}`} className="overflow-hidden rounded-2xl border border-brand-border bg-white/80 p-2">
                  <div className="aspect-square animate-pulse rounded-xl bg-[#e6eedb]" />
                  <div className="mt-2 h-4 animate-pulse rounded bg-[#e6eedb]" />
                  <div className="mt-1 h-3 animate-pulse rounded bg-[#edf3e3]" />
                </div>
              ))}
            </div>
          ) : releaseArchiveTracks.length ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {releaseArchiveTracks.map((track) => {
                const meta = track.releaseArchiveMeta;
                if (!meta) return null;
                const releaseKind = meta.releaseKind ?? track.project?.releaseKind ?? "SINGLE";
                const coverStyle = buildProjectCoverStyle({
                  releaseKind: releaseKind === "ALBUM" ? "ALBUM" : "SINGLE",
                  coverType: meta.coverType === "IMAGE" ? "IMAGE" : "GRADIENT",
                  coverImageUrl: meta.coverImageUrl ?? track.project?.coverImageUrl ?? null,
                  coverPresetKey: meta.coverPresetKey ?? track.project?.coverPresetKey ?? null,
                  coverColorA: meta.coverColorA ?? track.project?.coverColorA ?? null,
                  coverColorB: meta.coverColorB ?? track.project?.coverColorB ?? null
                });
                const archiveTitle = meta.title || track.title;
                const archiveArtist = meta.artistName || track.project?.artistLabel || "Артист не указан";
                const archiveDateLabel = meta.releaseDate ? formatReleaseArchiveDate(meta.releaseDate) : null;
                const archiveMetaLine = archiveDateLabel
                  ? `${archiveDateLabel} • ${releaseKindLabelRu(releaseKind)}`
                  : `Дата не указана • ${releaseKindLabelRu(releaseKind)}`;
                const archivePlaybackDemo = track.releaseDemo ?? track.distributionRequest?.masterDemo ?? null;
                const canPlayReleaseDemo = Boolean(archivePlaybackDemo?.id);
                const isActiveReleaseDemo = canPlayReleaseDemo ? playback.isActive(archivePlaybackDemo!.id) : false;
                const isPlayingReleaseDemo = canPlayReleaseDemo ? playback.isPlayingDemo(archivePlaybackDemo!.id) : false;

                return (
                  <Link key={track.id} href={`/songs/${track.id}`} className="group block">
                    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="relative aspect-square" style={coverStyle}>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/20 transition group-hover:from-black/10 group-hover:to-black/35" />
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-200 group-hover:opacity-100">
                          {canPlayReleaseDemo && (
                            <button
                              type="button"
                              className="pointer-events-auto absolute bottom-3 right-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white shadow-lg backdrop-blur hover:bg-black/60"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                playReleaseArchiveTrack(track);
                              }}
                              aria-label={isPlayingReleaseDemo ? "Пауза релизной версии" : "Играть релизную версию"}
                            >
                              <PlaybackIcon type={isPlayingReleaseDemo && isActiveReleaseDemo ? "pause" : "play"} className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bg-[#111214] px-3 py-3">
                        <p className="truncate text-[15px] font-semibold text-white">{archiveTitle}</p>
                        <p className="truncate text-sm text-white/75">{archiveArtist}</p>
                        <p className="truncate text-sm text-white/55">{archiveMetaLine}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getIdentityBridgeTone(track.identityBridge.status)}`}>
                            {getIdentityBridgeLabel(track.identityBridge.status)}
                          </span>
                          <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] text-white/75">
                            {getTrackIdentityPreview(track)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-brand-border bg-white/75 p-4 text-sm text-brand-muted shadow-sm">
              По текущему поиску релизных треков пока нет.
            </div>
          )}
        </div>
      </Card>
      ) : null}

      {false && <Card className="overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-[#f4f8ee] via-[#eff4e8] to-[#e8efde] p-0 shadow-sm">
        <div className="border-b border-brand-border px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">Projects</p>
              <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Проекты с обложками</h2>
              <p className="text-sm text-brand-muted">
                Новый проектный слой в стиле untitled. Песни и версии внутри проекта открываются отдельно.
              </p>
            </div>
            <p className="text-sm text-brand-muted">Найдено: {filteredProjects.length}</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const colorA = project.coverColorA || "#D9F99D";
            const colorB = project.coverColorB || "#65A30D";
            const playButtonAccentStyle = playbackAccentButtonStyle({ colorA, colorB });
            const coverStyle = buildProjectCoverStyle({
              releaseKind: project.releaseKind ?? "ALBUM",
              coverType: project.coverType,
              coverImageUrl: project.coverImageUrl,
              coverPresetKey: project.coverPresetKey,
              coverColorA: colorA,
              coverColorB: colorB
            });

            return (
              <div
                key={project.id}
                className="rounded-3xl border border-brand-border bg-white/85 p-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-end">
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded-xl border border-brand-border bg-white/80 px-2 py-1 text-xs text-brand-ink hover:bg-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        setProjectMenuId((prev) => (prev === project.id ? "" : project.id));
                      }}
                    >
                      {projectActionLoadingId === project.id ? "..." : "•••"}
                    </button>
                    {projectMenuId === project.id && (
                      <div className="absolute right-0 top-10 z-10 min-w-[180px] rounded-2xl border border-brand-border bg-[#f7fbf2] p-2 shadow-[0_20px_40px_rgba(45,60,40,0.16)]">
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={() => renameProject(project)}
                        >
                          Переименовать
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                          onClick={() => assignProjectToFolder(project)}
                        >
                          {project.folderId ? "Сменить папку" : "В папку"}
                        </button>
                        {project.folderId && (
                          <button
                            type="button"
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                            onClick={() => removeProjectFromFolder(project)}
                          >
                            Убрать из папки
                          </button>
                        )}
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-black/5"
                          onClick={() => deleteProject(project)}
                        >
                          Удалить проект
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <Link
                  href={getProjectOpenHref({
                    id: project.id,
                    releaseKind: project.releaseKind ?? "ALBUM",
                    singleTrackId: project.singleTrackId ?? null
                  })}
                  className="group block"
                >
                  <div className="relative mb-3 aspect-square overflow-hidden rounded-2xl" style={coverStyle}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
                    <button
                      type="button"
                      className="absolute bottom-2 left-2 z-[1] grid h-11 w-11 place-items-center rounded-full border text-lg backdrop-blur hover:brightness-95"
                      style={playButtonAccentStyle}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void playProjectFromCard(project.id);
                      }}
                      aria-label="Проиграть проект"
                    >
                      {projectCardPlayLoadingId === project.id ? "…" : <PlaybackIcon type="play" className="h-4 w-4" />}
                    </button>
                    <div className="absolute bottom-2 right-2 rounded-xl bg-black/35 px-2 py-1 text-xs text-white backdrop-blur">
                      {project._count?.tracks ?? 0} трек.
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-brand-ink">{project.title}</p>
                      <p className="truncate text-sm text-brand-muted">
                        {project.artistLabel || project.folder?.title || "Без папки"} • {formatDate(project.updatedAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border bg-white px-2 py-1 text-sm text-brand-ink shadow-sm">Открыть</div>
                  </div>
                </Link>
              </div>
            );
          })}

          {!filteredProjects.length && (
            <div className="rounded-3xl border border-dashed border-brand-border bg-white/70 p-5 text-sm text-brand-muted sm:col-span-2 xl:col-span-3">
              Проекты пока не найдены. Нажми `Новая песня` и система создаст проект автоматически.
            </div>
          )}
        </div>
      </Card>}

      {showLegacyLibrary && <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Папки и проекты</CardTitle>
              <CardDescription>Папки используются как контейнеры проектов.</CardDescription>
            </CardHeader>
            <div className="space-y-4">
              {foldersWithProjects.map(({ folder, projects: folderProjects }) => (
                <div key={folder.id} className="rounded-2xl border border-brand-border bg-white/85 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-brand-ink">{folder.title}</p>
                      <p className="text-xs text-brand-muted">
                        В папке: {folder._count?.projects ?? 0} проект. • По поиску: {folderProjects.length}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={deletingFolderId === folder.id}
                      onClick={() => deleteFolder(folder)}
                    >
                      {deletingFolderId === folder.id ? "Удаляем..." : "Удалить"}
                    </Button>
                  </div>
                  {folderProjects.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {folderProjects.map((project) => (
                        <Link
                          key={project.id}
                          href={getProjectOpenHref({
                            id: project.id,
                            releaseKind: project.releaseKind ?? "ALBUM",
                            singleTrackId: project.singleTrackId ?? null
                          })}
                        >
                          <div className="rounded-xl border border-brand-border bg-white p-3 transition hover:-translate-y-0.5 hover:border-[#2A342C]">
                            <p className="font-medium text-brand-ink">{project.title}</p>
                            <p className="text-xs text-brand-muted">
                              {project.artistLabel || "ART SAFE"} • Треков: {project._count?.tracks ?? 0}
                            </p>
                            <p className="mt-1 text-xs text-brand-muted">Обновлено: {formatDate(project.updatedAt)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-brand-muted">В этой папке нет проектов по текущему поиску.</p>
                  )}
                </div>
              ))}
              {!foldersWithProjects.length && <p className="text-sm text-brand-muted">Папок пока нет.</p>}
            </div>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Треки без папки</CardTitle>
              <CardDescription>Черновики и быстрые идеи до финальной структуры.</CardDescription>
            </CardHeader>
            <div className="space-y-3">
              {tracksWithoutFolder.map((track) => (
                <div key={track.id} className="rounded-xl border border-brand-border bg-white/85 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link href={`/songs/${track.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-brand-ink">{track.title}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getWorkbenchTone(track.workbenchState)}`}>
                          {track.workbenchStateLabel}
                        </span>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getIdentityBridgeTone(track.identityBridge.status)}`}>
                          {getIdentityBridgeLabel(track.identityBridge.status)}
                        </span>
                      </div>
                      <p className="text-xs text-brand-muted">
                        {track.pathStage?.name ?? "Не выбран"} • Последняя версия: {track.latestDemo ? formatDate(track.latestDemo.createdAt) : "нет"}
                      </p>
                      {track.trackIntent?.summary ? <p className="mt-1 text-sm text-brand-muted">{track.trackIntent.summary}</p> : null}
                      <p className="mt-1 text-sm text-brand-ink">{getTrackIdentityPreview(track)}</p>
                      <p className="mt-1 text-sm text-brand-ink">
                        {track.activeNextStep?.text ?? "Следующий шаг не назначен"}
                      </p>
                      <SongAnalysisBadges
                        bpm={track.displayBpm}
                        keyRoot={track.displayKeyRoot}
                        keyMode={track.displayKeyMode}
                        className="mt-1"
                        compact
                      />
                      <p className="text-xs text-brand-muted">Обновлено: {formatTrackActivity(track)}</p>
                    </Link>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFolderAssignTrackId(track.id);
                        setFolderAssignFolderId("NONE");
                        setFolderAssignNewTitle("");
                      }}
                    >
                      В папку
                    </Button>
                  </div>

                  {folderAssignTrackId === track.id && (
                    <div className="mt-3 grid gap-2 md:grid-cols-4">
                      <Select value={folderAssignFolderId} onChange={(event) => setFolderAssignFolderId(event.target.value)}>
                        <option value="NONE">Выбери папку</option>
                        {folders?.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.title}
                          </option>
                        ))}
                      </Select>
                      <Input
                        value={folderAssignNewTitle}
                        onChange={(event) => setFolderAssignNewTitle(event.target.value)}
                        placeholder="или создать новую папку"
                      />
                      <Button
                        disabled={assigningFolder || (folderAssignFolderId === "NONE" && !folderAssignNewTitle.trim())}
                        onClick={() => assignTrackToFolder(track.id)}
                      >
                        {assigningFolder ? "Сохраняем..." : "Сохранить"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setFolderAssignTrackId("");
                          setFolderAssignFolderId("NONE");
                          setFolderAssignNewTitle("");
                        }}
                      >
                        Отмена
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {!tracksWithoutFolder.length && <p className="text-sm text-brand-muted">Сейчас нет треков без папки.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Недавняя активность</CardTitle>
              <CardDescription>Последние изменения по отфильтрованным трекам.</CardDescription>
            </CardHeader>
            <div className="space-y-2">
              {recentTracks.map((track) => (
                <Link key={track.id} href={`/songs/${track.id}`}>
                  <div className="rounded-xl border border-brand-border bg-white px-3 py-2 transition hover:border-[#2A342C]">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-brand-ink">{track.title}</p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getWorkbenchTone(track.workbenchState)}`}>
                        {track.workbenchStateLabel}
                      </span>
                    </div>
                    <p className="text-xs text-brand-muted">
                      {track.pathStage?.name ?? "Без статуса"} • {formatTrackActivity(track)}
                    </p>
                    {track.activeNextStep?.text ? <p className="mt-1 text-sm text-brand-ink">{track.activeNextStep.text}</p> : null}
                    <SongAnalysisBadges
                      bpm={track.displayBpm}
                      keyRoot={track.displayKeyRoot}
                      keyMode={track.displayKeyMode}
                      className="mt-1"
                      compact
                    />
                  </div>
                </Link>
              ))}
              {!recentTracks.length && <p className="text-sm text-brand-muted">По текущему фильтру активности пока нет.</p>}
            </div>
          </Card>
        </div>
      </div>}

      {showMobileQuickAddMenu && !isCreationOverlayOpen && (
        <OverlayPortal>
          <div className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] md:hidden" onClick={() => setShowMobileQuickAddMenu(false)}>
            <div
              className="absolute bottom-40 right-4 w-[calc(100vw-2rem)] max-w-[340px] rounded-3xl border border-brand-border bg-[#0f1814]/92 p-3 shadow-[0_20px_42px_rgba(15,22,18,0.48)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid justify-items-center gap-2">
                <Button
                  className="h-12 w-[90%] rounded-2xl border border-[#3b4f45] bg-gradient-to-r from-[#1a2a22] to-[#223329] text-base text-white hover:brightness-110"
                  onClick={() => {
                    setShowMobileQuickAddMenu(false);
                    openNewSongWizard();
                  }}
                >
                  Новая песня
                </Button>
                <Button
                  className="h-12 w-[90%] rounded-2xl border border-[#3b4f45] bg-gradient-to-r from-[#1a2a22] to-[#223329] text-base text-white hover:brightness-110"
                  onClick={() => {
                    setShowMobileQuickAddMenu(false);
                    openNewSongRecorder();
                  }}
                >
                  Новая демо-запись
                </Button>
                <Button
                  className="h-12 w-[90%] rounded-2xl border border-[#3b4f45] bg-gradient-to-r from-[#1a2a22] to-[#223329] text-base text-white hover:brightness-110"
                  onClick={() => {
                    setShowMobileQuickAddMenu(false);
                    openCreateProjectPanel("SINGLE");
                  }}
                >
                  Новый сингл
                </Button>
                <Button
                  className="h-12 w-[90%] rounded-2xl border border-[#3b4f45] bg-gradient-to-r from-[#1a2a22] to-[#223329] text-base text-white hover:brightness-110"
                  onClick={() => {
                    setShowMobileQuickAddMenu(false);
                    openCreateProjectPanel("ALBUM");
                  }}
                >
                  Новый альбом
                </Button>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}

      {!isCreationOverlayOpen && (
        <div className="fixed bottom-24 right-4 z-[60] md:hidden">
          <Button
            aria-label="Открыть быстрые действия"
            aria-expanded={showMobileQuickAddMenu}
            className="h-14 w-14 rounded-full p-0 shadow-[0_12px_28px_rgba(55,74,61,0.28)]"
            onClick={() => setShowMobileQuickAddMenu((prev) => !prev)}
          >
            <Plus
              className={`h-7 w-7 transition-transform duration-200 ${showMobileQuickAddMenu ? "rotate-45" : ""}`}
              strokeWidth={2.4}
              aria-hidden="true"
            />
          </Button>
        </div>
      )}

      <Modal
        open={Boolean(deleteFolderPrompt)}
        onClose={() => setDeleteFolderPrompt(null)}
        title="Удалить папку?"
        description={
          deleteFolderPrompt
            ? deleteFolderPrompt.hasContent
              ? deleteFolderPrompt.hasProjects
                ? `Папка «${deleteFolderPrompt.title}» будет удалена вместе с проектами, треками и версиями.`
                : `Папка «${deleteFolderPrompt.title}» будет удалена вместе с треками.`
              : `Папка «${deleteFolderPrompt.title}» пустая и будет удалена.`
            : undefined
        }
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setDeleteFolderPrompt(null),
            disabled: Boolean(deletingFolderId)
          },
          {
            label: deletingFolderId ? "Удаляем..." : "Удалить",
            onClick: () => void submitDeleteFolder(),
            disabled: Boolean(deletingFolderId)
          }
        ]}
      />

      <Modal
        open={Boolean(assignProjectFolderPrompt)}
        onClose={() => setAssignProjectFolderPrompt(null)}
        title="Папка проекта"
        description={assignProjectFolderPrompt ? `Выбери или введи название папки для проекта «${assignProjectFolderPrompt.title}».` : undefined}
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setAssignProjectFolderPrompt(null),
            disabled: Boolean(projectActionLoadingId)
          },
          {
            label: projectActionLoadingId === assignProjectFolderPrompt?.id ? "Сохраняем..." : "Сохранить",
            onClick: () => void submitAssignProjectToFolder(),
            disabled: Boolean(projectActionLoadingId)
          }
        ]}
      >
        <Input
          value={assignProjectFolderPrompt?.value ?? ""}
          onChange={(event) =>
            setAssignProjectFolderPrompt((prev) => (prev ? { ...prev, value: event.target.value } : prev))
          }
          placeholder="Оставь пустым, чтобы снять папку"
          className="bg-white"
        />
        <p className="mt-2 text-xs text-brand-muted">Существующие: {(folders ?? []).map((folder) => folder.title).join(", ") || "папок пока нет"}</p>
      </Modal>

      <Modal
        open={Boolean(renameProjectPrompt)}
        onClose={() => setRenameProjectPrompt(null)}
        title="Переименовать проект"
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setRenameProjectPrompt(null),
            disabled: Boolean(projectActionLoadingId)
          },
          {
            label: projectActionLoadingId === renameProjectPrompt?.id ? "Сохраняем..." : "Сохранить",
            onClick: () => void submitProjectRename(),
            disabled: Boolean(projectActionLoadingId) || !renameProjectPrompt?.value.trim()
          }
        ]}
      >
        <Input
          value={renameProjectPrompt?.value ?? ""}
          onChange={(event) =>
            setRenameProjectPrompt((prev) => (prev ? { ...prev, value: event.target.value } : prev))
          }
          placeholder="Новое название проекта"
          className="bg-white"
        />
      </Modal>

      <Modal
        open={Boolean(deleteProjectPrompt)}
        onClose={() => setDeleteProjectPrompt(null)}
        title="Удалить проект?"
        description={
          deleteProjectPrompt
            ? deleteProjectPrompt.hasTracks
              ? `Проект «${deleteProjectPrompt.title}» будет удалён вместе со всеми песнями и версиями.`
              : `Пустой проект «${deleteProjectPrompt.title}» будет удалён.`
            : undefined
        }
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setDeleteProjectPrompt(null),
            disabled: Boolean(projectActionLoadingId)
          },
          {
            label: projectActionLoadingId === deleteProjectPrompt?.id ? "Удаляем..." : "Удалить",
            onClick: () => void submitDeleteProject(),
            disabled: Boolean(projectActionLoadingId)
          }
        ]}
      />

      {showCreateProject && (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-[#1a211b]/45 p-4 pt-20 backdrop-blur-sm"
            onClick={closeCreateProjectPanel}
          >
            <Card
              className="relative max-h-[calc(100vh-6rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#f7fbf2]"
              onClick={(event) => event.stopPropagation()}
            >
            <Button
              type="button"
              variant="ghost"
              className="absolute right-4 top-4 h-9 w-9 rounded-full border border-brand-border bg-white/90 p-0 text-brand-ink hover:bg-white"
              onClick={closeCreateProjectPanel}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader className="pr-12">
              <CardTitle>Создать {newProjectReleaseKind === "SINGLE" ? "сингл" : "альбом"}</CardTitle>
              <CardDescription>
                {newProjectReleaseKind === "SINGLE"
                  ? "Пустой проект-сингл. После добавления трека карточка откроет его версию сразу."
                  : "Пустой проект-альбом с обложкой. Треки добавишь уже внутри проекта."}
              </CardDescription>
            </CardHeader>
            <div className="space-y-3">
              {projectActionError && <InlineActionMessage message={projectActionError} />}
              <Input
                value={newProjectTitle}
                onChange={(event) => setNewProjectTitle(event.target.value)}
                placeholder={newProjectReleaseKind === "SINGLE" ? "Название сингла" : "Название альбома"}
                className="border-brand-border bg-white/90"
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={creatingProject || !newProjectTitle.trim()} onClick={createProject}>
                  {creatingProject ? "Создаем..." : "Создать"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-brand-border bg-white text-brand-ink hover:bg-white"
                  onClick={closeCreateProjectPanel}
                >
                  Закрыть
                </Button>
              </div>
            </div>
            </Card>
          </div>
        </OverlayPortal>
      )}

      {showSongFlowModal && (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-[#1a211b]/45 backdrop-blur-sm"
            onClick={closeSongFlowModal}
          >
            <div className="flex min-h-screen min-h-[100dvh] items-start justify-center px-3 pb-5 pt-4 md:items-center md:p-6">
              <Card
                className="relative max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#f7fbf2] md:max-h-[calc(100vh-3rem)] md:max-h-[calc(100dvh-3rem)]"
                onClick={(event) => event.stopPropagation()}
              >
            <Button
              type="button"
              variant="ghost"
              className="absolute right-4 top-4 h-9 w-9 rounded-full border border-brand-border bg-white/90 p-0 text-brand-ink hover:bg-white"
              onClick={closeSongFlowModal}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader className="pr-12">
              <CardTitle>Новая песня</CardTitle>
              <CardDescription>
                {songFlowStep === "lyrics" && "Шаг 1 из 4: название и текст песни."}
                {songFlowStep === "stage" && "Шаг 2 из 4: выбери этап трека."}
                {songFlowStep === "file-upload" && "Шаг 3 из 4: загрузи файл для выбранного этапа."}
                {songFlowStep === "project-pick" && "Шаг 4 из 4: выбери проект для сохранения."}
              </CardDescription>
            </CardHeader>

            <div className="space-y-4">
              {songFlowError && (
                <div className="rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">
                  {songFlowError}
                </div>
              )}

              {songFlowStep === "lyrics" && (
                <div className="space-y-3">
                  <Input
                    value={songFlowDraft.title}
                    onChange={(event) => {
                      const nextTitle = event.target.value;
                      setSongFlowDraft((prev) => ({ ...prev, title: nextTitle }));
                      if (!songFlowNewProjectTitle.trim()) {
                        setSongFlowNewProjectTitle(nextTitle);
                      }
                    }}
                    placeholder="Название песни"
                    className="border-brand-border bg-white/90"
                  />

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-brand-ink">Текст песни</p>
                    <Textarea
                      value={songFlowDraft.lyricsText}
                      onChange={(event) => setSongFlowDraft((prev) => ({ ...prev, lyricsText: event.target.value }))}
                      placeholder="Черновик текста, заметки, хук..."
                      rows={8}
                      className="border-brand-border bg-white/90"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSongFlowContinueWithLyrics}>
                      Далее
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={handleSongFlowSaveTextOnlyStart}
                    >
                      Сохранить только текст
                    </Button>
                  </div>
                </div>
              )}

              {songFlowStep === "stage" && (
                <div className="space-y-3">
                  <Select
                    value={songFlowDraft.selectedStageId ? String(songFlowDraft.selectedStageId) : "NONE"}
                    onChange={(event) => {
                      const next = event.target.value === "NONE" ? null : Number(event.target.value);
                      setSongFlowDraft((prev) => ({ ...prev, selectedStageId: next }));
                    }}
                    className="border-brand-border bg-white/90"
                  >
                    <option value="NONE">Выберите этап</option>
                    {songFlowStageOptions.map((stage) => (
                      <option key={stage.id} value={String(stage.id)}>
                        {formatStageOptionLabel(stage)}
                      </option>
                    ))}
                  </Select>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSongFlowStageContinue}>
                      {(() => {
                        const selected = songFlowStageOptions.find((stage) => stage.id === songFlowDraft.selectedStageId);
                        return selected && isDemoSongStage(selected.name) ? "Открыть демо-поток" : "Далее";
                      })()}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={() => {
                        setSongFlowStep("lyrics");
                        setSongFlowError("");
                      }}
                    >
                      Назад
                    </Button>
                  </div>
                </div>
              )}

              {songFlowStep === "file-upload" && (
                <div className="space-y-3">
                  <p className="text-sm text-brand-muted">
                    Для выбранного этапа нужен аудиофайл. После загрузки выберешь проект для сохранения.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={() => songFlowFileInputRef.current?.click()}
                    >
                      Загрузить файл
                    </Button>
                    <Button type="button" onClick={handleSongFlowFileContinue}>
                      Далее
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={() => {
                        setSongFlowStep("stage");
                        setSongFlowError("");
                      }}
                    >
                      Назад
                    </Button>
                  </div>
                  <input
                    ref={songFlowFileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSongFlowFile(file);
                      setSongFlowError("");
                      setSongFlowFileAnalysis(file ? await detectAudioAnalysisMvp(file) : null);
                    }}
                  />
                  {songFlowFile ? (
                    <div className="rounded-xl border border-brand-border bg-white/85 px-3 py-2 text-sm text-brand-ink">
                      <p>Файл: {songFlowFile.name}</p>
                      <SongAnalysisBadges
                        bpm={songFlowFileAnalysis?.bpm}
                        keyRoot={songFlowFileAnalysis?.keyRoot}
                        keyMode={songFlowFileAnalysis?.keyMode}
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

              {songFlowStep === "project-pick" && (
                <SongProjectPickerStep
                  projects={projects ?? []}
                  selectionMode={songFlowSelectionMode}
                  selectedProjectId={songFlowSelectedProjectId}
                  newProjectTitle={songFlowNewProjectTitle}
                  newProjectReleaseKind={songFlowNewProjectReleaseKind}
                  onSelectionModeChange={setSongFlowSelectionMode}
                  onSelectedProjectIdChange={setSongFlowSelectedProjectId}
                  onNewProjectTitleChange={setSongFlowNewProjectTitle}
                  onNewProjectReleaseKindChange={setSongFlowNewProjectReleaseKind}
                  singleTrackTitle={songFlowDraft.title}
                  onConfirm={() => void confirmSongFlowProjectStep()}
                  confirmLabel={songFlowDraft.branch === "TEXT_ONLY" ? "Сохранить только текст" : "Сохранить песню"}
                  busy={songFlowSaving}
                  error={songFlowError}
                  allowNewProjectKindChoice
                  modeLabel={
                    songFlowDraft.branch === "TEXT_ONLY"
                      ? "Сохраним песню как этап «Идея» без аудио."
                      : "Сохраним трек и загрузим аудио как версию выбранного этапа."
                  }
                  onBack={() => {
                    setSongFlowError("");
                    setSongFlowStep(songFlowDraft.branch === "TEXT_ONLY" ? "lyrics" : "file-upload");
                  }}
                />
              )}
            </div>
              </Card>
            </div>
          </div>
        </OverlayPortal>
      )}

      {showDemoComposer && (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-[#1a211b]/45 backdrop-blur-sm"
            onClick={() => {
              resetDemoComposer();
              setShowDemoComposer(false);
            }}
          >
            <div className="flex min-h-screen min-h-[100dvh] items-start justify-center px-3 pb-5 pt-4 md:items-center md:p-6">
              <Card
                className="relative max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-[#f7fbf2] md:max-h-[calc(100vh-3rem)] md:max-h-[calc(100dvh-3rem)]"
                onClick={(event) => event.stopPropagation()}
              >
            <Button
              type="button"
              variant="ghost"
              className="absolute right-4 top-4 h-9 w-9 rounded-full border border-brand-border bg-white/90 p-0 text-brand-ink hover:bg-white"
              onClick={() => {
                resetDemoComposer();
                setShowDemoComposer(false);
              }}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader className="pr-12">
              <CardTitle>Новая песня</CardTitle>
              <CardDescription>Сразу запись, затем текст и версия.</CardDescription>
            </CardHeader>
            <div className="space-y-3">
              <Input
                value={demoNewTrackTitle}
                onChange={(event) => setDemoNewTrackTitle(event.target.value)}
                placeholder="Название трека"
              />

              <Select value={demoVersionType} onChange={(event) => setDemoVersionType(event.target.value as DemoVersionType)}>
                <option value="IDEA_TEXT">Идея</option>
                <option value="DEMO">Демо</option>
                <option value="ARRANGEMENT">Продакшн</option>
                <option value="NO_MIX">Запись без сведения</option>
                <option value="MIXED">С сведением</option>
                <option value="MASTERED">С мастерингом</option>
                <option value="RELEASE">Релиз</option>
              </Select>

              {demoVersionType !== "IDEA_TEXT" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={demoMode === "upload" ? "primary" : "secondary"}
                    onClick={() => {
                      setDemoMode("upload");
                      fileInputRef.current?.click();
                    }}
                  >
                    Загрузить файл
                  </Button>
                  {demoVersionType === "DEMO" && (
                    <Button variant={demoMode === "record" ? "primary" : "secondary"} onClick={() => setDemoMode("record")}>
                      Записать аудио
                    </Button>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0] ?? null;
                    setDemoFile(file);
                    setDemoError("");
                    setDemoFileAnalysis(file ? await detectAudioAnalysisMvp(file) : null);
                  }}
                />
              {demoMode === "upload" && demoFile && (
                <div className="rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-xs text-brand-muted">
                  <p>Файл: {demoFile.name}</p>
                  <SongAnalysisBadges
                    bpm={demoFileAnalysis?.bpm}
                    keyRoot={demoFileAnalysis?.keyRoot}
                    keyMode={demoFileAnalysis?.keyMode}
                    className="mt-1"
                    compact
                  />
                </div>
              )}

              {demoVersionType === "DEMO" && demoMode === "record" && (
                <MultiTrackRecorder
                  resetKey={recorderResetKey}
                  onError={setDemoError}
                  onReset={() => {
                    setRecordedMix(null);
                    setRecordedMixAnalysis(null);
                    setDemoError("");
                  }}
                  onReady={(payload) => {
                    setRecordedMix(payload);
                    setDemoError("");
                    void detectAudioAnalysisMvp(payload.blob).then(setRecordedMixAnalysis).catch(() => setRecordedMixAnalysis(null));
                  }}
                />
              )}
              {demoVersionType === "DEMO" && demoMode === "record" && recordedMix && (
                <div className="rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-xs text-brand-muted">
                  <p>Сведённый микс: {recordedMix.filename}</p>
                  <SongAnalysisBadges
                    bpm={recordedMixAnalysis?.bpm}
                    keyRoot={recordedMixAnalysis?.keyRoot}
                    keyMode={recordedMixAnalysis?.keyMode}
                    className="mt-1"
                    compact
                  />
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm font-medium">Текст песни</p>
                <Textarea
                  value={demoText}
                  onChange={(event) => setDemoText(event.target.value)}
                  placeholder="Черновик текста, заметки, хук..."
                  rows={5}
                />
              </div>

              {demoVersionType !== "IDEA_TEXT" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Комментарий к версии</p>
                  {editingDemoVersionComment ? (
                    <div className="space-y-2">
                      <Textarea
                        value={demoVersionComment}
                        onChange={(event) => setDemoVersionComment(event.target.value)}
                        placeholder="Комментарий к версии"
                        rows={4}
                      />
                      <Button variant="secondary" onClick={() => setEditingDemoVersionComment(false)}>
                        Готово
                      </Button>
                    </div>
                  ) : demoVersionComment.trim() ? (
                    <button
                      type="button"
                      className="w-full rounded-md border border-brand-border bg-white px-3 py-2 text-left text-sm"
                      onClick={() => setEditingDemoVersionComment(true)}
                    >
                      {demoVersionComment}
                    </button>
                  ) : (
                    <Button variant="secondary" onClick={() => setEditingDemoVersionComment(true)}>
                      Добавить комментарий
                    </Button>
                  )}
                </div>
              )}

              {demoSourceReady ? (
                <div className="rounded-xl border border-brand-border bg-white/70 p-3">
                  <SongProjectPickerStep
                    projects={projects ?? []}
                    selectionMode={demoProjectSelectionMode}
                    selectedProjectId={demoSelectedProjectId}
                    newProjectTitle={demoNewProjectTitle}
                    newProjectReleaseKind={demoNewProjectReleaseKind}
                    onSelectionModeChange={(mode) => {
                      setDemoProjectSelectionMode(mode);
                      setDemoError("");
                    }}
                    onSelectedProjectIdChange={(projectId) => {
                      setDemoSelectedProjectId(projectId);
                      setDemoError("");
                    }}
                    onNewProjectTitleChange={(title) => {
                      setDemoNewProjectTitle(title);
                      setDemoError("");
                    }}
                    onNewProjectReleaseKindChange={(kind) => {
                      setDemoNewProjectReleaseKind(kind);
                      setDemoError("");
                    }}
                    onConfirm={() => void saveDemo()}
                    confirmLabel={
                      demoVersionType === "IDEA_TEXT"
                        ? "Сохранить песню"
                        : "Сохранить демо"
                    }
                    busy={savingDemo}
                    error={demoError}
                    allowNewProjectKindChoice
                    singleTrackTitle={demoNewTrackTitle}
                    modeLabel={
                      demoVersionType === "IDEA_TEXT"
                        ? "Выберите проект, куда сохранить песню с текстом."
                        : "Демо готово. Выберите проект, куда сохранить версию."
                    }
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-brand-border bg-white/70 px-3 py-2 text-sm text-brand-muted">
                  Подготовьте демо (файл или запись), затем выберите проект для сохранения.
                </div>
              )}
            </div>
              </Card>
            </div>
          </div>
        </OverlayPortal>
      )}
    </div>
  );
}
