"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Disc3, FolderOpen, Music, Search, SlidersHorizontal, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MultiTrackRecorder } from "@/components/audio/multi-track-recorder";
import { PlaybackIcon } from "@/components/songs/playback-icon";
import { SongAnalysisBadges } from "@/components/songs/song-analysis-badges";
import { SongProjectPickerStep, type ProjectSelectionMode } from "@/components/songs/song-project-picker-step";
import { useSongsPlayback, type SongsPlaybackItem } from "@/components/songs/songs-playback-provider";
import { WorkspaceBrowser } from "@/components/songs/workspace-browser";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { appendAudioAnalysisToFormData, detectAudioAnalysisMvp, type UploadAudioAnalysisMeta } from "@/lib/audio/upload-analysis-client";
import { buildProjectCoverStyle, projectDefaultCoverForKind } from "@/lib/project-cover-style";
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
  } | null;
  releaseDemo?: {
    id: string;
    createdAt: string;
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
  _count?: { demos: number };
};

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED" | "RELEASE";
type SongFlowStep = "lyrics" | "stage" | "file-upload" | "project-pick";

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
  const playback = useSongsPlayback();
  const { data: tracks, refetch: refetchTracks } = useQuery({
    queryKey: ["songs-tracks"],
    queryFn: () => fetcher<Track[]>("/api/songs")
  });
  const { data: folders, refetch: refetchFolders } = useQuery({
    queryKey: ["songs-folders"],
    queryFn: () => fetcher<Folder[]>("/api/folders")
  });
  const { data: projects, refetch: refetchProjects } = useQuery({
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
  const [showAddMenu, setShowAddMenu] = useState(false);

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
  const [savingDemo, setSavingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");

  const [recordedMix, setRecordedMix] = useState<{ blob: Blob; durationSec: number; filename: string } | null>(null);
  const [recordedMixAnalysis, setRecordedMixAnalysis] = useState<UploadAudioAnalysisMeta | null>(null);
  const [recorderResetKey, setRecorderResetKey] = useState(0);

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

  useEffect(() => {
    if (demoVersionType !== "DEMO" && demoMode === "record") {
      setDemoMode("upload");
    }
  }, [demoMode, demoVersionType]);

  useEffect(() => {
    const mappedStageId = findStageIdByVersionType(visibleStages, demoVersionType);
    if (mappedStageId !== null) {
      setDemoStageId(String(mappedStageId));
    }
  }, [demoVersionType, visibleStages]);

  useEffect(() => {
    if (demoStageId === "NONE") return;
    const currentStage = visibleStages.find((stage) => String(stage.id) === demoStageId);
    if (!currentStage) return;
    const stageName = normalizeStageName(currentStage.name);
    if (stageName.includes("идея") && demoVersionType !== "IDEA_TEXT") {
      setDemoVersionType("IDEA_TEXT");
      return;
    }
    if (!stageName.includes("идея") && demoVersionType === "IDEA_TEXT") {
      setDemoVersionType("DEMO");
    }
  }, [demoStageId, demoVersionType, visibleStages]);

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
  }, [showDemoComposer]);

  useEffect(() => {
    if (!showSongFlowModal) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSongFlowModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSongFlowModal]);

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
      setNewProjectTitle("");
      setShowCreateProject(false);
      setNewProjectReleaseKind("ALBUM");
      await refetchProjects();
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
    if (hasContent) {
      const confirmed = window.confirm(
        hasProjects
          ? "Папка не пустая. Удалить папку вместе со всеми проектами, треками и версиями внутри?"
          : "Папка не пустая. Удалить папку вместе со всеми треками внутри?"
      );
      if (!confirmed) {
        return;
      }
    }

    setDeletingFolderId(folder.id);
    setFolderActionError("");
    try {
      const response = await apiFetch(`/api/folders/${folder.id}${hasContent ? "?force=1" : ""}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить папку.");
      }
      await Promise.all([refetchFolders(), refetchTracks(), refetchProjects()]);
    } catch (error) {
      setFolderActionError(error instanceof Error ? error.message : "Не удалось удалить папку.");
    } finally {
      setDeletingFolderId("");
    }
  }

  async function assignProjectToFolder(project: Project) {
    const folderNames = (folders ?? []).map((folder) => folder.title);
    const promptText = folderNames.length
      ? `Название папки для проекта «${project.title}».\nОставь пусто, чтобы снять папку.\nСуществующие: ${folderNames.join(", ")}`
      : `Название папки для проекта «${project.title}».\nПапок пока нет — введи название новой.`;
    const input = window.prompt(promptText, project.folder?.title ?? "");
    if (input === null) return;

    const nextFolderTitle = input.trim();

    setProjectActionLoadingId(project.id);
    setProjectActionError("");
    setProjectMenuId("");
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

      const response = await apiFetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: nextFolderId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось обновить папку проекта.");
      }

      await Promise.all([refetchProjects(), refetchFolders(), refetchTracks()]);
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
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось убрать проект из папки.");
    } finally {
      setProjectActionLoadingId("");
    }
  }

  async function renameProject(project: Project) {
    const nextTitle = window.prompt("Новое название проекта", project.title)?.trim();
    if (!nextTitle || nextTitle === project.title) return;

    setProjectActionLoadingId(project.id);
    setProjectActionError("");
    setProjectMenuId("");
    try {
      const response = await apiFetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось переименовать проект.");
      }
      await refetchProjects();
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось переименовать проект.");
    } finally {
      setProjectActionLoadingId("");
    }
  }

  async function deleteProject(project: Project) {
    const hasTracks = (project._count?.tracks ?? 0) > 0;
    const confirmed = window.confirm(
      hasTracks
        ? "Проект не пустой. Удалить проект вместе со всеми песнями и версиями?"
        : "Удалить пустой проект?"
    );
    if (!confirmed) return;

    setProjectActionLoadingId(project.id);
    setProjectActionError("");
    setProjectMenuId("");
    try {
      const response = await apiFetch(`/api/projects/${project.id}${hasTracks ? "?force=1" : ""}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить проект.");
      }
      await Promise.all([refetchProjects(), refetchTracks(), refetchFolders()]);
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
    } catch (error) {
      setProjectActionError(error instanceof Error ? error.message : "Не удалось запустить проект.");
    } finally {
      setProjectCardPlayLoadingId("");
    }
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
        setDemoError("Для типа «Идея (текст)» добавь текст песни.");
        return;
      }

      const createdTrack = await apiFetchJson<Track>("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: demoNewTrackTitle.trim(),
          lyricsText: demoText.trim() || null,
          folderId: null,
          pathStageId: selectedPathStageId
        })
      });
      targetTrackId = createdTrack.id;

      if (demoVersionType === "IDEA_TEXT") {
        await Promise.all([refetchTracks(), refetchFolders(), refetchProjects()]);
        resetDemoComposer();
        setShowDemoComposer(false);
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

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-visible rounded-3xl border border-brand-border bg-gradient-to-br from-[#f2f7e9] via-[#edf3e3] to-[#e6eedb] p-4 md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(217,249,157,0.45),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.08),transparent_46%)]" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#8cae78]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-[#b5cba2]/35 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                <span className="-rotate-6 inline-flex h-5 w-5 items-center justify-center rounded-md border border-brand-border bg-white shadow-[0_1px_0_rgba(42,52,44,0.08)]">
                  <Music className="h-3 w-3 text-brand-ink" />
                </span>
                Songs
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-brand-ink md:text-3xl">SONGS Workspace</h1>
            </div>

            <div className="relative">
              <Button
                className="min-w-[132px] rounded-2xl px-5 shadow-sm"
                onClick={() => setShowAddMenu((prev) => !prev)}
              >
                + Add
              </Button>
              {showAddMenu && (
                <div className="absolute left-1/2 top-12 z-30 w-[calc(100vw-2rem)] max-w-[22rem] -translate-x-1/2 overflow-hidden rounded-2xl border border-brand-border bg-white/95 p-2 shadow-[0_18px_48px_rgba(40,55,38,0.16)] backdrop-blur sm:left-auto sm:right-0 sm:w-auto sm:min-w-[220px] sm:max-w-none sm:translate-x-0">
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                      onClick={() => {
                        setShowAddMenu(false);
                        openNewSongWizard();
                      }}
                    >
                      <span>Song</span>
                      <span className="text-xs text-brand-muted">Новая песня</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                      onClick={() => {
                        setShowAddMenu(false);
                        openCreateProjectPanel("SINGLE");
                      }}
                    >
                      <span>Single</span>
                      <span className="text-xs text-brand-muted">Прямо в версии</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                      onClick={() => {
                        setShowAddMenu(false);
                        openCreateProjectPanel("ALBUM");
                      }}
                    >
                      <span>Album</span>
                      <span className="text-xs text-brand-muted">Страница проекта</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                      onClick={() => {
                        setShowAddMenu(false);
                        setShowCreateFolder((prev) => !prev);
                        if (showCreateFolder) {
                          setNewFolderTitle("");
                        }
                      }}
                    >
                      <span>Folder</span>
                      <span className="text-xs text-brand-muted">{showCreateFolder ? "Скрыть" : "Новая"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border bg-white/70 p-3 shadow-sm backdrop-blur-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Найти трек, проект или идею..."
                  className="h-11 bg-white pl-9"
                />
              </label>

              <label className="relative block">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Select value={selectedStageId} onChange={(event) => setSelectedStageId(event.target.value)} className="h-11 bg-white pl-9">
                  <option value="ALL">Все статусы</option>
                  {visibleStages.map((stage) => (
                    <option key={stage.id} value={String(stage.id)}>
                      {stage.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs text-brand-muted">
                Поиск: <span className="ml-1 font-medium text-brand-ink">{query.trim() ? "активен" : "все"}</span>
              </span>
              <span className="inline-flex items-center rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs text-brand-muted">
                Статус:{" "}
                <span className="ml-1 font-medium text-brand-ink">
                  {selectedStageId === "ALL"
                    ? "все"
                    : visibleStages.find((stage) => String(stage.id) === selectedStageId)?.name ?? "фильтр"}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
            <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white/82 p-3 shadow-sm">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d9f99d] to-[#9ecf63]" />
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border bg-[#edf4e5] text-brand-ink">
                <FolderOpen className="h-4 w-4" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-brand-muted sm:text-xs sm:tracking-wider">Папки</p>
              <p className="text-xl font-semibold leading-none text-brand-ink sm:text-2xl">
                <span>{foldersCount}</span>
                <span className="ml-1 text-sm font-medium text-brand-muted sm:text-base">
                  {pluralizeRu(foldersCount, "папка", "папки", "папок")}
                </span>
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white/82 p-3 shadow-sm">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#dbeafe] to-[#93c5fd]" />
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border bg-[#eef4fb] text-brand-ink">
                <Disc3 className="h-4 w-4" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-brand-muted sm:text-xs sm:tracking-wider">Проекты</p>
              <div className="space-y-1">
                <p className="text-sm leading-none text-brand-ink sm:text-base">
                  <span className="font-semibold">{projectSinglesCount}</span>
                  <span className="ml-1 text-brand-muted">
                    {pluralizeRu(projectSinglesCount, "сингл", "сингла", "синглов")}
                  </span>
                </p>
                <p className="text-sm leading-none text-brand-ink sm:text-base">
                  <span className="font-semibold">{projectAlbumsCount}</span>
                  <span className="ml-1 text-brand-muted">
                    {pluralizeRu(projectAlbumsCount, "альбом", "альбома", "альбомов")}
                  </span>
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-white/82 p-3 shadow-sm">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#fde68a] to-[#f59e0b]" />
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border bg-[#fff6dd] text-brand-ink">
                <Music className="h-4 w-4" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-brand-muted sm:text-xs sm:tracking-wider">Треки</p>
              <p className="text-xl font-semibold leading-none text-brand-ink sm:text-2xl">
                <span>{tracksCount}</span>
                <span className="ml-1 text-sm font-medium text-brand-muted sm:text-base">
                  {pluralizeRu(tracksCount, "трек", "трека", "треков")}
                </span>
              </p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-red-300/80 bg-white/82 p-3 shadow-sm">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#fca5a5] to-[#ef4444]" />
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-[#fff1f1] text-[#8b2626]">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-brand-muted sm:text-xs sm:tracking-wider">Релизы</p>
              <div className="space-y-1">
                <p className="text-sm leading-none text-brand-ink sm:text-base">
                  <span className="font-semibold">{releaseSinglesCount}</span>
                  <span className="ml-1 text-brand-muted">
                    {pluralizeRu(releaseSinglesCount, "сингл", "сингла", "синглов")}
                  </span>
                </p>
                <p className="text-sm leading-none text-brand-ink sm:text-base">
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

      {showCreateFolder && (
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

      {showCreateProject && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Создать {newProjectReleaseKind === "SINGLE" ? "single" : "album"}</CardTitle>
            <CardDescription>
              {newProjectReleaseKind === "SINGLE"
                ? "Пустой single-проект. После добавления одного трека карточка будет открываться сразу в версии."
                : "Пустой album-проект с обложкой. Треки добавишь уже внутри проекта."}
            </CardDescription>
          </CardHeader>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              value={newProjectTitle}
              onChange={(event) => setNewProjectTitle(event.target.value)}
              placeholder={newProjectReleaseKind === "SINGLE" ? "Название single" : "Название альбома"}
            />
            <Button disabled={creatingProject || !newProjectTitle.trim()} onClick={createProject}>
              {creatingProject ? "Создаем..." : "Создать"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateProject(false);
                setNewProjectTitle("");
                setNewProjectReleaseKind("ALBUM");
              }}
            >
              Отмена
            </Button>
          </div>
        </Card>
      )}

      {(folderActionError || projectActionError || demoError) && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {folderActionError || projectActionError || demoError}
        </div>
      )}

      <WorkspaceBrowser parentFolderId={null} externalQuery={query} showCreateActions={false} onChanged={refetchWorkspaceSurface} />

      <Card className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-br from-[#fff6ef] via-[#fff3ef] to-[#f8ece8] p-0 shadow-[0_18px_46px_rgba(88,53,44,0.12)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(252,165,165,0.22),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(127,29,29,0.06),transparent_42%)]" />
        <div className="relative border-b border-brand-border px-4 py-4 md:px-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.45),transparent_38%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8b2626]">
                <Sparkles className="h-3.5 w-3.5" />
                Archive
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Release Archive</h2>
              <p className="mt-1 text-sm text-brand-muted">
                Архив релизов с финальной инфой (вручную или из нашей дистрибуции). Использует общий поиск сверху.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs text-brand-muted">
                Треков: <span className="ml-1 font-medium text-brand-ink">{releaseArchiveTracks.length}</span>
              </span>
              <span className="inline-flex items-center rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs text-brand-muted">
                Поиск: <span className="ml-1 font-medium text-brand-ink">{query.trim() ? "активен" : "все"}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="relative p-4 md:p-5">
          {releaseArchiveTracks.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

                return (
                  <Link key={track.id} href={`/songs/${track.id}`} className="group block">
                    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="relative aspect-square" style={coverStyle}>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/20" />
                        <div className="absolute left-3 top-3 rounded-lg bg-black/25 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                          {releaseKindLabelRu(releaseKind)}
                        </div>
                      </div>
                      <div className="bg-[#111214] px-3 py-3">
                        <p className="truncate text-[15px] font-semibold text-white">{archiveTitle}</p>
                        <p className="truncate text-sm text-white/75">{archiveArtist}</p>
                        <p className="truncate text-sm text-white/55">{archiveMetaLine}</p>
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
                      aria-label="Play project"
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
                    <div className="rounded-xl border border-brand-border bg-white px-2 py-1 text-sm text-brand-ink shadow-sm">Open</div>
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
                      <p className="truncate font-medium">{track.title}</p>
                      <p className="text-xs text-brand-muted">
                        {track.pathStage?.name ?? "Не выбран"} • Демо: {track._count?.demos ?? 0}
                      </p>
                      <SongAnalysisBadges
                        bpm={track.displayBpm}
                        keyRoot={track.displayKeyRoot}
                        keyMode={track.displayKeyMode}
                        className="mt-1"
                        compact
                      />
                      <p className="text-xs text-brand-muted">Обновлено: {formatDate(track.updatedAt)}</p>
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
                    <p className="truncate text-sm font-medium text-brand-ink">{track.title}</p>
                    <p className="text-xs text-brand-muted">
                      {track.pathStage?.name ?? "Без статуса"} • {formatDate(track.updatedAt)}
                    </p>
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

      {showSongFlowModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#1a211b]/45 p-4 pt-20 backdrop-blur-sm"
          onClick={closeSongFlowModal}
        >
          <Card
            className="max-h-[calc(100vh-6rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#f7fbf2]"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader>
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
                    <Button
                      type="button"
                      variant="secondary"
                      className="border-brand-border bg-white text-brand-ink hover:bg-white"
                      onClick={closeSongFlowModal}
                    >
                      Закрыть
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
                        {stage.name}
                      </option>
                    ))}
                  </Select>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSongFlowStageContinue}>
                      {(() => {
                        const selected = songFlowStageOptions.find((stage) => stage.id === songFlowDraft.selectedStageId);
                        return selected && isDemoSongStage(selected.name) ? "Открыть demo flow" : "Далее";
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
      )}

      {showDemoComposer && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#1a211b]/45 p-4 pt-20 backdrop-blur-sm"
          onClick={() => {
            resetDemoComposer();
            setShowDemoComposer(false);
          }}
        >
          <Card
            className="max-h-[calc(100vh-6rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-[#f7fbf2]"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <CardTitle>Новая песня</CardTitle>
              <CardDescription>Сразу запись, затем текст и версия.</CardDescription>
            </CardHeader>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={demoNewTrackTitle}
                  onChange={(event) => setDemoNewTrackTitle(event.target.value)}
                  placeholder="Название трека"
                />
                <Select value={demoStageId} onChange={(event) => setDemoStageId(event.target.value)}>
                  <option value="NONE">Статус не выбран</option>
                  {visibleStages.map((stage) => (
                    <option key={stage.id} value={String(stage.id)}>
                      {stage.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Select value={demoVersionType} onChange={(event) => setDemoVersionType(event.target.value as DemoVersionType)}>
                <option value="IDEA_TEXT">Идея (текст)</option>
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
                  }}
                  onReady={(payload) => {
                    setRecordedMix(payload);
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

              <div className="flex flex-wrap gap-2">
                <Button disabled={savingDemo} onClick={saveDemo}>
                  {savingDemo ? "Сохраняем..." : "Добавить демо"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetDemoComposer();
                    setShowDemoComposer(false);
                  }}
                >
                  Закрыть
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
