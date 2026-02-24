"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AudioWaveformPlayer } from "@/components/audio/audio-waveform-player";
import { MultiTrackRecorder } from "@/components/audio/multi-track-recorder";
import { PlaybackIcon } from "@/components/songs/playback-icon";
import { useSongsPlayback } from "@/components/songs/songs-playback-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { isPlayableDemo, pickPreferredPlaybackDemo, playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";

type PathStage = {
  id: number;
  name: string;
};

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED";
type AddVersionQuickAction = "convert" | "import" | "record";

type Demo = {
  id: string;
  audioUrl: string | null;
  textNote: string | null;
  duration: number;
  createdAt: string;
  versionType: DemoVersionType;
  sortIndex?: number;
};

type FolderRef = {
  id: string;
  title: string;
};

type ProjectRef = {
  id: string;
  title: string;
  artistLabel: string | null;
  coverType: "GRADIENT" | "IMAGE";
  coverImageUrl: string | null;
  coverColorA: string | null;
  coverColorB: string | null;
  folderId: string | null;
  folder?: FolderRef | null;
};

type ProjectTrackOrderPayload = {
  id: string;
  tracks: Array<{
    id: string;
    title: string;
  }>;
};

type Track = {
  id: string;
  title: string;
  lyricsText: string | null;
  folderId: string | null;
  folder?: FolderRef | null;
  projectId?: string | null;
  project?: ProjectRef | null;
  primaryDemoId?: string | null;
  primaryDemo?: Demo | null;
  pathStageId: number | null;
  pathStage?: PathStage | null;
  demos: Demo[];
};

type SongPathStepType = DemoVersionType | "RELEASE";

type SongPathStepView = {
  versionType: SongPathStepType;
  label: string;
  stageName: string | null;
  demos: Demo[];
};

const versionTypeLabels: Record<DemoVersionType, string> = {
  IDEA_TEXT: "Идея (текст)",
  DEMO: "Демо",
  ARRANGEMENT: "Продакшн",
  NO_MIX: "Запись без сведения",
  MIXED: "С сведением",
  MASTERED: "С мастерингом"
};

const pathVersionOrder: DemoVersionType[] = ["IDEA_TEXT", "DEMO", "ARRANGEMENT", "NO_MIX", "MIXED", "MASTERED"];

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
    MASTERED: (name) => name.includes("широкая известность") || name.includes("медийн") || name.includes("мастер")
  };
  const match = stages.find((stage) => checks[versionType](normalizeStageName(stage.name)));
  return match?.id ?? null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function formatDuration(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function fileNameFromPath(path: string) {
  const tail = path.split("/").pop() || path;
  return decodeURIComponent(tail);
}

function formatWhen(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "сейчас";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function pathStageBadgePalette(stepType: SongPathStepType) {
  switch (stepType) {
    case "IDEA_TEXT":
      return { border: "border-[#cfd6c7]", bg: "bg-white", text: "text-[#2d372d]" };
    case "DEMO":
      return { border: "border-[#c3c9d4]", bg: "bg-[#edf1f6]", text: "text-[#3e4a60]" };
    case "ARRANGEMENT":
      return { border: "border-[#e5cf7a]", bg: "bg-[#fbf4cf]", text: "text-[#6f5810]" };
    case "NO_MIX":
      return { border: "border-[#abd7af]", bg: "bg-[#e7f8ea]", text: "text-[#24663c]" };
    case "MIXED":
      return { border: "border-[#efbf94]", bg: "bg-[#fff0df]", text: "text-[#8a4e17]" };
    case "MASTERED":
      return { border: "border-[#a9c7f4]", bg: "bg-[#e6f0ff]", text: "text-[#2453a6]" };
    case "RELEASE":
      return { border: "border-[#ee9a9a]", bg: "bg-[#ffe7e7]", text: "text-[#9a1f1f]" };
    default:
      return { border: "border-brand-border", bg: "bg-white", text: "text-brand-ink" };
  }
}

function versionBadgeClass(versionType: DemoVersionType) {
  const palette = pathStageBadgePalette(versionType);
  return `${palette.border} ${palette.bg} ${palette.text}`;
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

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

export default function SongDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: track, refetch } = useQuery({
    queryKey: ["song-track", params.id],
    queryFn: () => fetcher<Track>(`/api/songs/${params.id}`)
  });
  const { data: stages } = useQuery({
    queryKey: ["song-track-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/songs/stages")
  });
  const visibleStages = useMemo(() => (stages ?? []).filter((stage) => !isPromoStage(stage.name)), [stages]);

  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState(false);
  const [pageError, setPageError] = useState("");
  const [showTrackActionsMenu, setShowTrackActionsMenu] = useState(false);
  const [showEditTrackModal, setShowEditTrackModal] = useState(false);
  const [showAddVersionModal, setShowAddVersionModal] = useState(false);
  const [showAddVersionQuickActions, setShowAddVersionQuickActions] = useState(false);

  const [newVersionType, setNewVersionType] = useState<DemoVersionType>("DEMO");
  const [newVersionMode, setNewVersionMode] = useState<"upload" | "record">("upload");
  const [newVersionText, setNewVersionText] = useState("");
  const [newVersionComment, setNewVersionComment] = useState("");
  const [editingNewVersionComment, setEditingNewVersionComment] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsText, setLyricsText] = useState("");
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [recordedMix, setRecordedMix] = useState<{ blob: Blob; durationSec: number; filename: string } | null>(null);
  const [recorderResetKey, setRecorderResetKey] = useState(0);

  const [updatingDemoId, setUpdatingDemoId] = useState("");
  const [demoNotes, setDemoNotes] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState("");
  const [savingPrimaryDemoId, setSavingPrimaryDemoId] = useState("");
  const [reorderingStepVersionType, setReorderingStepVersionType] = useState<DemoVersionType | "">("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const playback = useSongsPlayback();

  useEffect(() => {
    if (newVersionType !== "DEMO" && newVersionMode === "record") {
      setNewVersionMode("upload");
    }
  }, [newVersionMode, newVersionType]);

  useEffect(() => {
    if (stageId === "") return;
    const selected = visibleStages.find((stage) => String(stage.id) === stageId);
    if (!selected) return;
    const stageName = normalizeStageName(selected.name);
    if ((stageName.includes("идея") || stageName.includes("искра")) && newVersionType !== "IDEA_TEXT") {
      setNewVersionType("IDEA_TEXT");
      return;
    }
    if (!stageName.includes("идея") && !stageName.includes("искра") && newVersionType === "IDEA_TEXT") {
      setNewVersionType("DEMO");
    }
  }, [stageId, newVersionType, visibleStages]);

  useEffect(() => {
    setLyricsText(track?.lyricsText ?? "");
  }, [track?.lyricsText]);

  useEffect(() => {
    const shouldShowLyrics = searchParams.get("showLyrics") === "1";
    const shouldOpenEdit = searchParams.get("edit") === "1";

    if (shouldOpenEdit || shouldShowLyrics) {
      setShowEditTrackModal(true);
    }
    if (shouldShowLyrics) {
      setShowLyrics(true);
    }
  }, [searchParams]);

  useEffect(() => {
    function onWindowClick() {
      setShowTrackActionsMenu(false);
    }
    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, []);

  useEffect(() => {
    if (!showEditTrackModal && !showAddVersionModal) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowEditTrackModal(false);
        setShowAddVersionModal(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddVersionModal, showEditTrackModal]);
  const trackDemos = track?.demos ?? [];
  const parentProject = track?.project ?? null;
  const backHref = parentProject ? `/songs/projects/${parentProject.id}` : "/songs";
  const latestVersion = trackDemos[0] ?? null;
  const projectPlayAccentStyle = playbackAccentButtonStyle({
    colorA: parentProject?.coverColorA ?? null,
    colorB: parentProject?.coverColorB ?? null
  });
  const demoNumberById = useMemo(
    () =>
      Object.fromEntries(trackDemos.map((demo, index) => [demo.id, trackDemos.length - index])),
    [trackDemos]
  );
  const stageNameByVersionType = useMemo(() => {
    return Object.fromEntries(
      pathVersionOrder.map((versionType) => {
        const stageIdForType = findStageIdByVersionType(visibleStages, versionType);
        const stage = visibleStages.find((item) => item.id === stageIdForType);
        return [versionType, stage?.name ?? null];
      })
    ) as Record<DemoVersionType, string | null>;
  }, [visibleStages]);
  const versionsByPathStep = useMemo(
    () =>
      pathVersionOrder.map((versionType) => ({
        versionType,
        label: versionTypeLabels[versionType],
        stageName: stageNameByVersionType[versionType],
        demos: trackDemos
          .filter((demo) => demo.versionType === versionType)
          .sort((a, b) => {
            const aSort = typeof a.sortIndex === "number" ? a.sortIndex : Number.MAX_SAFE_INTEGER;
            const bSort = typeof b.sortIndex === "number" ? b.sortIndex : Number.MAX_SAFE_INTEGER;
            if (aSort !== bSort) return aSort - bSort;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
      })),
    [stageNameByVersionType, trackDemos]
  );
  const songPathSteps = useMemo<SongPathStepView[]>(() => {
    const releaseStage =
      visibleStages.find((stage) => normalizeStageName(stage.name).includes("релиз"))?.name ?? "Релиз / дистрибуция";
    return [
      ...versionsByPathStep,
      {
        versionType: "RELEASE",
        label: "Релиз",
        stageName: releaseStage,
        demos: []
      }
    ];
  }, [versionsByPathStep, visibleStages]);
  const songPlaybackQueue = useMemo(() => {
    if (!track) return [] as NonNullable<ReturnType<typeof demoPlaybackItem>>[];
    const items: NonNullable<ReturnType<typeof demoPlaybackItem>>[] = [];
    for (const demo of versionsByPathStep.flatMap((step) => step.demos)) {
      const item = demoPlaybackItem(demo);
      if (item) items.push(item);
    }
    return items;
  }, [parentProject, track, versionsByPathStep]);

  if (!track) {
    return <p className="text-sm text-brand-muted">Загрузка трека...</p>;
  }

  const currentTitle = title || track.title;
  const currentStage = stageId === "" ? track.pathStageId : stageId === "NONE" ? null : Number(stageId);
  const currentTrackId = track.id;
  const currentTrackStageId = track.pathStageId;
  const exportDemo = pickPreferredPlaybackDemo(track);

  function resetNewVersionForm() {
    setNewVersionType("DEMO");
    setNewVersionMode("upload");
    setNewVersionText("");
    setNewVersionComment("");
    setEditingNewVersionComment(false);
    setNewVersionFile(null);
    setVersionError("");
    setRecordedMix(null);
    setRecorderResetKey((prev) => prev + 1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openAddVersionModal(action: AddVersionQuickAction = "import") {
    resetNewVersionForm();
    setShowAddVersionQuickActions(false);

    if (action === "convert") {
      setNewVersionType("ARRANGEMENT");
      setNewVersionMode("upload");
    } else if (action === "record") {
      setNewVersionType("DEMO");
      setNewVersionMode("record");
    } else {
      setNewVersionType("DEMO");
      setNewVersionMode("upload");
    }

    setShowAddVersionModal(true);

    if (action === "import") {
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  }

  async function createVersion() {
    setCreatingVersion(true);
    setVersionError("");
    try {
      const mappedStageId = findStageIdByVersionType(visibleStages, newVersionType);
      if (mappedStageId !== null && mappedStageId !== currentTrackStageId) {
        setSyncingStatus(true);
        const statusResponse = await apiFetch(`/api/songs/${currentTrackId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathStageId: mappedStageId })
        });
        if (!statusResponse.ok) {
          const payload = (await statusResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Не удалось обновить статус трека.");
        }
        setSyncingStatus(false);
      }

      if (newVersionType === "IDEA_TEXT") {
        if (!newVersionText.trim()) {
          setVersionError("Для типа «Идея (текст)» добавь текст песни.");
          return;
        }
        const response = await apiFetch(`/api/songs/${currentTrackId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lyricsText: newVersionText.trim() })
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Не удалось сохранить текст песни.");
        }
        await refetch();
        resetNewVersionForm();
        setShowAddVersionModal(false);
        return;
      }

      let fileToUpload: Blob | null = null;
      let filename = `demo-${Date.now()}.webm`;
      let durationSec = 0;

      if (newVersionMode === "upload") {
        if (!newVersionFile) {
          setVersionError("Выбери аудиофайл.");
          return;
        }
        fileToUpload = newVersionFile;
        filename = newVersionFile.name;
        durationSec = await getAudioDurationSeconds(newVersionFile);
      }

      if (newVersionMode === "record") {
        if (!recordedMix) {
          setVersionError("Сначала сведи дорожки в микс.");
          return;
        }
        fileToUpload = recordedMix.blob;
        filename = recordedMix.filename;
        durationSec = recordedMix.durationSec;
      }

      if (!fileToUpload) {
        setVersionError("Не удалось подготовить аудио.");
        return;
      }

      const formData = new FormData();
      formData.append("file", fileToUpload, filename);
      formData.append("durationSec", String(durationSec));
      formData.append("trackId", currentTrackId);
      formData.append("noteText", newVersionComment.trim());
      formData.append("versionType", newVersionType);

      const uploadResponse = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
      if (!uploadResponse.ok) {
        const payload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось добавить файл к треку.");
      }
      await refetch();
      resetNewVersionForm();
      setShowAddVersionModal(false);
    } catch (error) {
      setVersionError(error instanceof Error ? error.message : "Не удалось добавить версию.");
    } finally {
      setSyncingStatus(false);
      setCreatingVersion(false);
    }
  }

  function demoPlaybackItem(demo: Demo) {
    const currentTrack = track;
    if (!currentTrack) return null;
    if (!isPlayableDemo(demo)) return null;
    const coverType: "image" | "gradient" = parentProject?.coverType === "IMAGE" ? "image" : "gradient";
    return {
      demoId: demo.id,
      src: `/api/audio-clips/${demo.id}/stream`,
      title: currentTrack.title,
      subtitle: `${parentProject?.title || "Без проекта"} • ${versionTypeLabels[demo.versionType]}`,
      linkHref: `/songs/${currentTrack.id}`,
      durationSec: demo.duration,
      trackId: currentTrack.id,
      projectId: parentProject?.id ?? null,
      versionType: demo.versionType,
      queueGroupType: "track" as const,
      queueGroupId: currentTrack.id,
      cover: {
        type: coverType,
        imageUrl: parentProject?.coverImageUrl ?? null,
        colorA: parentProject?.coverColorA ?? null,
        colorB: parentProject?.coverColorB ?? null
      },
      meta: {
        projectTitle: parentProject?.title ?? undefined,
        pathStageName: track.pathStage?.name ?? undefined
      }
    };
  }

  function playDemoInTrackQueue(demo: Demo, options?: { openPlayerWindow?: boolean; toggleIfActive?: boolean }) {
    const currentTrack = track;
    if (!currentTrack) return;
    const openPlayerWindow = options?.openPlayerWindow ?? false;
    const toggleIfActive = options?.toggleIfActive ?? true;
    const item = demoPlaybackItem(demo);
    if (!item) return;

    const queueIndex = songPlaybackQueue.findIndex((queueItem) => queueItem.demoId === demo.id);
    if (queueIndex >= 0) {
      if (playback.isActive(demo.id) && toggleIfActive) {
        playback.toggle(item);
      } else if (!playback.isActive(demo.id)) {
        playback.playQueue(songPlaybackQueue, queueIndex, {
          type: "track",
          trackId: currentTrack.id,
          projectId: parentProject?.id ?? undefined,
          title: currentTrack.title
        });
      }
      if (openPlayerWindow) {
        playback.openPlayerWindow();
      }
      return;
    }

    if (toggleIfActive) playback.toggle(item);
    else playback.play(item);
    if (openPlayerWindow) {
      playback.openPlayerWindow();
    }
  }

  function handleDemoPlay(demo: Demo) {
    playDemoInTrackQueue(demo, { openPlayerWindow: false, toggleIfActive: true });
  }

  function handleDemoOpenPlayer(demo: Demo) {
    playDemoInTrackQueue(demo, { openPlayerWindow: true, toggleIfActive: false });
  }

  async function setPrimaryDemo(nextPrimaryDemoId: string | null) {
    setSavingPrimaryDemoId(nextPrimaryDemoId || "__clear__");
    setPageError("");
    try {
      const response = await apiFetch(`/api/songs/${currentTrackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryDemoId: nextPrimaryDemoId })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось обновить основную версию.");
      }
      await refetch();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось обновить основную версию.");
    } finally {
      setSavingPrimaryDemoId("");
    }
  }

  async function reorderStepVersions(versionType: DemoVersionType, orderedDemoIds: string[]) {
    setReorderingStepVersionType(versionType);
    setPageError("");
    try {
      const response = await apiFetch(`/api/songs/${currentTrackId}/demos/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionType, orderedDemoIds })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось изменить порядок версий.");
      }
      await refetch();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось изменить порядок версий.");
    } finally {
      setReorderingStepVersionType("");
    }
  }

  function moveDemoWithinStep(versionType: DemoVersionType, stepDemos: Demo[], demoId: string, direction: -1 | 1) {
    const currentIndex = stepDemos.findIndex((demo) => demo.id === demoId);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= stepDemos.length) return;

    const reordered = [...stepDemos];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    void reorderStepVersions(versionType, reordered.map((demo) => demo.id));
  }

  async function deleteCurrentTrack() {
    setDeletingTrack(true);
    setPageError("");
    try {
      const response = await apiFetch(`/api/songs/${currentTrackId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить трек.");
      }
      router.push(backHref);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось удалить трек.");
    } finally {
      setDeletingTrack(false);
    }
  }

  function openLyricsFromMenu() {
    setShowTrackActionsMenu(false);
    setShowEditTrackModal(true);
    setShowLyrics(true);
  }

  function scrollToVersionsSection() {
    setShowTrackActionsMenu(false);
    document.getElementById("track-versions-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function moveCurrentTrackInProject() {
    if (!parentProject) {
      setShowTrackActionsMenu(false);
      return;
    }

    setShowTrackActionsMenu(false);
    setPageError("");
    try {
      const projectDetail = await apiFetchJson<ProjectTrackOrderPayload>(`/api/projects/${parentProject.id}`);
      const orderedTracks = projectDetail.tracks ?? [];
      const currentIndex = orderedTracks.findIndex((item) => item.id === currentTrackId);
      if (currentIndex < 0 || orderedTracks.length < 2) return;

      const rawPosition = window
        .prompt(`Позиция для «${currentTitle}» (1-${orderedTracks.length})`, String(currentIndex + 1))
        ?.trim();
      if (!rawPosition) return;

      const nextIndex = Number.parseInt(rawPosition, 10) - 1;
      if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= orderedTracks.length) {
        setPageError(`Введите номер позиции от 1 до ${orderedTracks.length}.`);
        return;
      }
      if (nextIndex === currentIndex) return;

      const orderedTrackIds = orderedTracks.map((item) => item.id);
      orderedTrackIds.splice(currentIndex, 1);
      orderedTrackIds.splice(nextIndex, 0, currentTrackId);

      const response = await apiFetch(`/api/projects/${parentProject.id}/tracks/reorder`, {
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
      setPageError(error instanceof Error ? error.message : "Не удалось переместить трек.");
    }
  }

  return (
    <div className="pb-40">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6">
        <div className="min-h-[calc(100vh-9rem)] overflow-hidden rounded-[30px] border border-brand-border bg-gradient-to-br from-[#edf4e4] via-[#e8f0de] to-[#e2ead7] px-4 py-5 text-brand-ink shadow-[0_20px_45px_rgba(61,84,46,0.14)] md:px-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={backHref}>
              <Button
                variant="secondary"
                className="h-10 w-10 border-brand-border bg-white/85 p-0 text-lg text-brand-ink hover:bg-white"
                aria-label="Назад"
                title="Назад"
              >
                ←
              </Button>
            </Link>
            <Button
              variant="secondary"
              className="h-10 w-10 border-brand-border bg-white/85 p-0 text-lg text-brand-ink hover:bg-white"
              onClick={() => refetch()}
              aria-label="Обновить"
              title="Обновить"
            >
              ↻
            </Button>
          </div>
          <div className="relative">
            <Button
              variant="secondary"
              className="h-10 w-10 border-brand-border bg-white/85 p-0 text-base tracking-tight text-brand-ink hover:bg-white"
              onClick={(event) => {
                event.stopPropagation();
                setShowTrackActionsMenu((prev) => !prev);
              }}
              aria-label="Действия трека"
              title="Действия трека"
            >
              •••
            </Button>
            {showTrackActionsMenu && (
              <div
                className="absolute right-0 top-12 z-20 min-w-[190px] rounded-2xl border border-brand-border bg-[#f7fbf2] p-2 shadow-[0_20px_40px_rgba(61,84,46,0.14)]"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                  onClick={scrollToVersionsSection}
                >
                  Версии
                </button>
                <button
                  type="button"
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5"
                  onClick={openLyricsFromMenu}
                >
                  Текст песни
                </button>
                {exportDemo ? (
                  <a
                    href={`/api/audio-clips/${exportDemo.id}/stream`}
                    download
                    className="block rounded-xl px-3 py-2 text-sm text-brand-ink hover:bg-black/5"
                    onClick={() => setShowTrackActionsMenu(false)}
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
                  disabled={!parentProject}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5 disabled:cursor-not-allowed disabled:text-brand-muted/60 disabled:hover:bg-transparent"
                  onClick={() => void moveCurrentTrackInProject()}
                >
                  Move
                </button>
                <div className="my-1 h-px bg-black/5" />
                <button
                  type="button"
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-[#ffe7e1]"
                  onClick={deleteCurrentTrack}
                >
                  Delete track
                </button>
              </div>
            )}
          </div>
        </div>

        {pageError && (
          <div className="mb-4 rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">
            {pageError}
          </div>
        )}

        <section className="mb-6 rounded-[28px] border border-brand-border bg-white/85 p-4 shadow-sm md:p-5">
          <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Song Path</p>
                <h1 className="text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">{track.title}</h1>
                <p className="mt-1 text-sm text-brand-muted">
                  {parentProject?.title || "Без проекта"} • {track.demos.length} верс. •{" "}
                  {latestVersion ? `последняя ${formatWhen(latestVersion.createdAt)}` : "без аудио-версий"}
                </p>
                <p className="mt-1 text-xs text-brand-muted">
                  Этап: {track.pathStage?.name || "Не выбран"}
                  {parentProject?.folder?.title ? ` • Папка: ${parentProject.folder.title}` : ""}
                </p>
              </div>

              {latestVersion && (
                <div className="rounded-2xl border border-brand-border bg-white/75 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${versionBadgeClass(
                          latestVersion.versionType
                        )}`}
                      >
                        {versionTypeLabels[latestVersion.versionType]}
                      </span>
                      <span className="text-xs text-brand-muted">{formatDate(latestVersion.createdAt)}</span>
                      <span className="text-xs text-brand-muted">{formatDuration(latestVersion.duration)}</span>
                    </div>
                    {latestVersion.audioUrl && (
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium hover:brightness-95"
                        style={projectPlayAccentStyle}
                        onClick={() => {
                          if (playback.isActive(latestVersion.id) && playback.isPlayingDemo(latestVersion.id)) {
                            playback.pause();
                            return;
                          }
                          handleDemoOpenPlayer(latestVersion);
                        }}
                        aria-label={playback.isPlayingDemo(latestVersion.id) ? "Пауза" : "Включить в плеере"}
                      >
                        <PlaybackIcon
                          type={playback.isPlayingDemo(latestVersion.id) ? "pause" : "play"}
                          className="h-4 w-4"
                        />
                        <span>{playback.isPlayingDemo(latestVersion.id) ? "Пауза" : "Play"}</span>
                      </button>
                    )}
                  </div>
                  {!latestVersion.audioUrl && <p className="mt-2 text-sm text-brand-muted">Последняя версия без аудио.</p>}
                </div>
              )}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-[24px] border border-brand-border bg-white/85 p-4 md:p-5">
              <div className="mb-3">
                <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Add Version</p>
                <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Добавить версию</h2>
                <p className="text-sm text-brand-muted">Откроется окно записи/загрузки версии, как отдельный шаг.</p>
              </div>
              {showAddVersionQuickActions ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="h-11 rounded-2xl border-brand-border bg-white text-brand-ink hover:bg-white"
                    onClick={() => openAddVersionModal("convert")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                        <rect x="1.75" y="3" width="9.5" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M11.5 6.25 14 4.75v6.5l-2.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Convert</span>
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11 rounded-2xl border-brand-border bg-white text-brand-ink hover:bg-white"
                    onClick={() => openAddVersionModal("import")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                        <path d="M3 9.5v1.25A2.25 2.25 0 0 0 5.25 13h5.5A2.25 2.25 0 0 0 13 10.75V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M8 2.5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="m5.75 7.25 2.25 2.25 2.25-2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Import</span>
                    </span>
                  </Button>
                  <Button
                    className="h-11 rounded-2xl"
                    style={projectPlayAccentStyle}
                    onClick={() => openAddVersionModal("record")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
                      <span>Record</span>
                    </span>
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex h-14 w-full items-center justify-center rounded-2xl border border-brand-border bg-[#eef4e6] text-base font-semibold text-brand-ink shadow-sm transition hover:bg-white"
                  onClick={() => setShowAddVersionQuickActions(true)}
                >
                  + Add versions
                </button>
              )}
            </section>
          </div>

          <section id="track-versions-section" className="min-w-0 rounded-[24px] border border-brand-border bg-white/85 p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Versions</p>
                <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Путь песни</h2>
                <p className="text-sm text-brand-muted">Таймлайн по этапам: от идеи до релиза.</p>
              </div>
              <div className="w-full min-w-0 xl:w-auto">
                <div className="max-w-full overflow-x-scroll overscroll-x-contain pb-1 touch-pan-x [scrollbar-width:thin] [scrollbar-color:#b7c7a8_transparent] [-webkit-overflow-scrolling:touch]">
                  <div className="inline-flex min-w-max snap-x snap-mandatory items-center gap-2 whitespace-nowrap pr-2">
                    {songPathSteps.map((step) => (
                      (() => {
                        const palette = pathStageBadgePalette(step.versionType);
                        return (
                      <span
                        key={step.versionType}
                        className={`inline-flex shrink-0 snap-start items-center whitespace-nowrap rounded-full border px-2 py-1 text-[11px] ${
                          step.demos.length
                            ? `${palette.border} ${palette.bg} ${palette.text}`
                            : `${palette.border} ${palette.bg} ${palette.text} opacity-55`
                        }`}
                      >
                        {step.demos.length} {step.label}
                      </span>
                        );
                      })()
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {!track.demos.length && (
              <div className="mb-4 rounded-2xl border border-dashed border-brand-border bg-white/70 px-4 py-8 text-center text-sm text-brand-muted">
                Пока нет демо. Добавь первую версию слева.
              </div>
            )}

            <div className="space-y-4">
              {songPathSteps.map((step, stepIndex) => {
                const hasVersions = step.demos.length > 0;
                const isLastStep = stepIndex === songPathSteps.length - 1;
                return (
                  <div
                    key={step.versionType}
                    className={`relative rounded-2xl border p-3 md:p-4 ${
                      hasVersions ? "border-brand-border bg-white/70" : "border-brand-border/70 bg-white/55"
                    }`}
                  >
                    <div className="grid gap-3 md:grid-cols-[100px_minmax(0,1fr)]">
                      <div className="relative">
                        {!isLastStep && <div className="absolute left-[18px] top-10 h-[calc(100%+12px)] w-px bg-white/10" />}
                        <div className="flex items-start gap-3 md:block">
                          <div
                            className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold ${
                              hasVersions
                                ? `${pathStageBadgePalette(step.versionType).border} ${pathStageBadgePalette(step.versionType).bg} ${pathStageBadgePalette(step.versionType).text}`
                                : `${pathStageBadgePalette(step.versionType).border} ${pathStageBadgePalette(step.versionType).bg} ${pathStageBadgePalette(step.versionType).text} opacity-65`
                            }`}
                          >
                            {stepIndex + 1}
                          </div>
                          <div className="md:mt-2">
                            <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">Step</p>
                            <p className="text-sm font-semibold text-brand-ink">{step.label}</p>
                            <p className="mt-1 text-xs text-brand-muted">{step.stageName || "Этап пути подберем позже"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 space-y-3">
                        {hasVersions ? (
                          step.demos.map((demo, demoIndex) => {
                            const isLatestDemo = latestVersion?.id === demo.id;
                            const isPrimaryDemo = track.primaryDemoId === demo.id;
                            const canMoveUp = demoIndex > 0;
                            const canMoveDown = demoIndex < step.demos.length - 1;
                            const isStepReordering = step.versionType !== "RELEASE" && reorderingStepVersionType === step.versionType;
                            return (
                            <div key={demo.id} className="min-w-0 rounded-2xl border border-brand-border bg-[#f7fbf2] p-3">
                              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-brand-muted">#{demoNumberById[demo.id] ?? "?"}</span>
                                    <span
                                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${versionBadgeClass(
                                        demo.versionType
                                      )}`}
                                    >
                                      {versionTypeLabels[demo.versionType]}
                                    </span>
                                    {isLatestDemo && (
                                      <span className="inline-flex items-center rounded-full border border-[#d8bf65] bg-[#f4e8b4] px-2.5 py-1 text-xs text-[#705b0f]">
                                        latest
                                      </span>
                                    )}
                                    {isPrimaryDemo && (
                                      <span className="inline-flex items-center rounded-full border border-[#a4cbb8] bg-[#e8f3ec] px-2.5 py-1 text-xs text-[#2e6855]">
                                        primary
                                      </span>
                                    )}
                                  </div>
                                  <p className="truncate text-sm text-brand-ink">
                                    {demo.audioUrl ? fileNameFromPath(demo.audioUrl) : "Текстовая версия"} • {formatDate(demo.createdAt)} •{" "}
                                    {formatDuration(demo.duration)}
                                  </p>
                                  <p className="mt-1 text-xs text-brand-muted">{formatWhen(demo.createdAt)}</p>
                                </div>

                                <div className="flex w-full max-w-full flex-wrap items-center gap-2 md:justify-end">
                                  {demo.audioUrl && (
                                    <button
                                      type="button"
                                      className={`grid h-9 w-9 place-items-center rounded-xl border text-sm ${
                                        playback.isActive(demo.id)
                                          ? "hover:brightness-95"
                                          : "hover:brightness-95"
                                      }`}
                                      style={projectPlayAccentStyle}
                                      onClick={() => handleDemoPlay(demo)}
                                      aria-label={playback.isPlayingDemo(demo.id) ? "Pause version" : "Play version"}
                                    >
                                      <PlaybackIcon
                                        type={playback.isPlayingDemo(demo.id) ? "pause" : "play"}
                                        className="h-4 w-4"
                                      />
                                    </button>
                                  )}
                                  {demo.audioUrl && (
                                    <a
                                      href={`/api/audio-clips/${demo.id}/stream`}
                                      download
                                      className="inline-flex h-9 max-w-full items-center rounded-xl border border-brand-border bg-white/85 px-3 text-sm text-brand-ink hover:bg-white"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      Скачать
                                    </a>
                                  )}
                                  {demo.audioUrl && (
                                    <Button
                                      variant="secondary"
                                      className="max-w-full border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                                      disabled={Boolean(savingPrimaryDemoId)}
                                      onClick={() => void setPrimaryDemo(isPrimaryDemo ? null : demo.id)}
                                    >
                                      {savingPrimaryDemoId === demo.id
                                        ? "..."
                                        : savingPrimaryDemoId === "__clear__" && isPrimaryDemo
                                          ? "..."
                                          : isPrimaryDemo
                                            ? "Снять основную"
                                            : "Сделать основной"}
                                    </Button>
                                  )}
                                  <button
                                    type="button"
                                    className="grid h-9 w-9 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                                    onClick={() => moveDemoWithinStep(step.versionType as DemoVersionType, step.demos, demo.id, -1)}
                                    disabled={!canMoveUp || isStepReordering}
                                    aria-label="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="grid h-9 w-9 place-items-center rounded-xl border border-brand-border bg-white/85 text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                                    onClick={() => moveDemoWithinStep(step.versionType as DemoVersionType, step.demos, demo.id, 1)}
                                    disabled={!canMoveDown || isStepReordering}
                                    aria-label="Move down"
                                  >
                                    ↓
                                  </button>
                                  <Button
                                    variant="secondary"
                                    className="max-w-full border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                                    disabled={updatingDemoId === demo.id || isStepReordering}
                                    onClick={async () => {
                                      setUpdatingDemoId(demo.id);
                                      setPageError("");
                                      const response = await apiFetch(`/api/audio-clips/${demo.id}`, { method: "DELETE" });
                                      if (!response.ok) {
                                        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                                        setPageError(payload?.error || "Не удалось удалить версию.");
                                        setUpdatingDemoId("");
                                        return;
                                      }
                                      if (playback.isActive(demo.id)) {
                                        playback.clear();
                                      }
                                      await refetch();
                                      setUpdatingDemoId("");
                                    }}
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              </div>

                              {demo.audioUrl ? (
                                <AudioWaveformPlayer
                                  src={`/api/audio-clips/${demo.id}/stream`}
                                  barCount={170}
                                  className="w-full min-w-0"
                                />
                              ) : (
                                <div className="rounded-xl border border-dashed border-brand-border bg-white/70 px-3 py-4 text-sm text-brand-muted">
                                  У этой версии нет аудио.
                                </div>
                              )}

                              <div className="mt-3 space-y-2">
                                {editingCommentId === demo.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={demoNotes[demo.id] ?? demo.textNote ?? ""}
                                      onChange={(event) =>
                                        setDemoNotes((prev) => ({
                                          ...prev,
                                          [demo.id]: event.target.value
                                        }))
                                      }
                                      placeholder="Комментарий к версии"
                                      rows={4}
                                      className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="secondary"
                                        className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                                        disabled={updatingDemoId === demo.id}
                                        onClick={async () => {
                                          setUpdatingDemoId(demo.id);
                                          const response = await apiFetch(`/api/audio-clips/${demo.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ textNote: (demoNotes[demo.id] ?? "").trim() || null })
                                          });
                                          if (response.ok) {
                                            await refetch();
                                            setEditingCommentId("");
                                          }
                                          setUpdatingDemoId("");
                                        }}
                                      >
                                        Сохранить
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                                        onClick={() => setEditingCommentId("")}
                                      >
                                        Отмена
                                      </Button>
                                    </div>
                                  </div>
                                ) : demo.textNote ? (
                                  <button
                                    type="button"
                                    className="w-full rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-left text-sm text-brand-ink"
                                    onClick={() => {
                                      setDemoNotes((prev) => ({ ...prev, [demo.id]: demo.textNote ?? "" }));
                                      setEditingCommentId(demo.id);
                                    }}
                                  >
                                    {demo.textNote}
                                  </button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                                    onClick={() => {
                                      setDemoNotes((prev) => ({ ...prev, [demo.id]: "" }));
                                      setEditingCommentId(demo.id);
                                    }}
                                  >
                                    Добавить комментарий
                                  </Button>
                                )}
                              </div>
                            </div>
                          );})
                        ) : (
                          <div className="rounded-2xl border border-dashed border-brand-border bg-white/60 px-3 py-4 text-sm text-brand-muted">
                            На этом шаге пока нет версий.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {showEditTrackModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm"
          onClick={() => setShowEditTrackModal(false)}
        >
          <div className="flex min-h-full items-end justify-center p-3 md:items-center md:p-6">
            <div
              className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_24px_60px_rgba(61,84,46,0.18)] md:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Track</p>
                  <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Метаданные песни</h2>
                  <p className="text-sm text-brand-muted">Название, этап и текст песни.</p>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white text-brand-ink hover:bg-white"
                  onClick={() => setShowEditTrackModal(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <Input
                  value={currentTitle}
                  onChange={(event) => setTitle(event.target.value)}
                  className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                />
                <Select
                  value={currentStage ? String(currentStage) : "NONE"}
                  onChange={(event) => setStageId(event.target.value)}
                  className="border-brand-border bg-white/90 text-brand-ink focus:ring-brand-border"
                >
                  <option value="NONE">Этап не выбран</option>
                  {visibleStages.map((stage) => (
                    <option key={stage.id} value={String(stage.id)}>
                      {stage.name}
                    </option>
                  ))}
                </Select>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={savingMeta || !currentTitle.trim()}
                    onClick={async () => {
                      setSavingMeta(true);
                      setPageError("");
                      try {
                        const response = await apiFetch(`/api/songs/${track.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: currentTitle.trim(),
                            pathStageId: currentStage ?? null
                          })
                        });
                        if (!response.ok) {
                          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                          throw new Error(payload?.error || "Не удалось сохранить трек.");
                        }
                        setTitle("");
                        setStageId("");
                        await refetch();
                        setShowEditTrackModal(false);
                      } catch (error) {
                        setPageError(error instanceof Error ? error.message : "Не удалось сохранить трек.");
                      } finally {
                        setSavingMeta(false);
                      }
                    }}
                  >
                    {savingMeta ? "Сохраняем..." : "Сохранить"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                    onClick={() => setShowLyrics((prev) => !prev)}
                  >
                    {showLyrics ? "Скрыть текст" : "Текст песни"}
                  </Button>
                </div>
                {syncingStatus && <p className="text-xs text-brand-muted">Синхронизация статуса...</p>}
              </div>

              {showLyrics && (
                <div className="mt-4 space-y-2 rounded-2xl border border-brand-border bg-white/70 p-3">
                  <Textarea
                    value={lyricsText}
                    onChange={(event) => setLyricsText(event.target.value)}
                    placeholder="Текст песни"
                    rows={8}
                    className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                  />
                  <Button
                    disabled={savingLyrics}
                    onClick={async () => {
                      setSavingLyrics(true);
                      setPageError("");
                      const response = await apiFetch(`/api/songs/${currentTrackId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lyricsText: lyricsText.trim() || null })
                      });
                      if (!response.ok) {
                        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                        setPageError(payload?.error || "Не удалось сохранить текст песни.");
                        setSavingLyrics(false);
                        return;
                      }
                      await refetch();
                      setSavingLyrics(false);
                    }}
                  >
                    {savingLyrics ? "Сохраняем..." : "Сохранить текст"}
                  </Button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-brand-border pt-4">
                <Button
                  variant="secondary"
                  className="border-red-300/70 bg-[#fff2ef] text-[#a4372a] hover:bg-[#ffe7e1] hover:text-[#8f2f25]"
                  disabled={deletingTrack}
                  onClick={deleteCurrentTrack}
                >
                  {deletingTrack ? "Удаляем..." : "Удалить песню"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddVersionModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm"
          onClick={() => setShowAddVersionModal(false)}
        >
          <div className="flex min-h-full items-end justify-center p-3 md:items-center md:p-6">
            <div
              className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_24px_60px_rgba(61,84,46,0.18)] md:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Add Version</p>
                  <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Новая версия</h2>
                  <p className="text-sm text-brand-muted">Добавь запись, файл или текстовый этап песни.</p>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white text-brand-ink hover:bg-white"
                  onClick={() => setShowAddVersionModal(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <Select
                  value={newVersionType}
                  onChange={(event) => setNewVersionType(event.target.value as DemoVersionType)}
                  className="border-brand-border bg-white/90 text-brand-ink focus:ring-brand-border"
                >
                  <option value="IDEA_TEXT">Идея (текст)</option>
                  <option value="DEMO">Демо</option>
                  <option value="ARRANGEMENT">Продакшн</option>
                  <option value="NO_MIX">Запись без сведения</option>
                  <option value="MIXED">С сведением</option>
                  <option value="MASTERED">С мастерингом</option>
                </Select>

                {newVersionType !== "IDEA_TEXT" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={newVersionMode === "upload" ? "primary" : "secondary"}
                      className={newVersionMode === "upload" ? "" : "border-brand-border bg-white/85 text-brand-ink hover:bg-white"}
                      onClick={() => {
                        setNewVersionMode("upload");
                        fileInputRef.current?.click();
                      }}
                    >
                      Загрузить файл
                    </Button>
                    {newVersionType === "DEMO" && (
                      <Button
                        variant={newVersionMode === "record" ? "primary" : "secondary"}
                        className={newVersionMode === "record" ? "" : "border-brand-border bg-white/85 text-brand-ink hover:bg-white"}
                        onClick={() => setNewVersionMode("record")}
                      >
                        Записать аудио
                      </Button>
                    )}
                  </div>
                )}

                {newVersionType === "IDEA_TEXT" && (
                  <p className="text-sm text-brand-muted">Для «Идея (текст)» добавляется только текст песни.</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => setNewVersionFile(event.target.files?.[0] ?? null)}
                />

                {newVersionMode === "upload" && newVersionFile && (
                  <div className="rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-sm text-brand-muted">
                    Выбран файл: {newVersionFile.name}
                  </div>
                )}

                {newVersionType === "DEMO" && newVersionMode === "record" && (
                  <div className="rounded-2xl border border-brand-border bg-white/70 p-3">
                    <MultiTrackRecorder
                      resetKey={recorderResetKey}
                      onError={setVersionError}
                      onReset={() => setRecordedMix(null)}
                      onReady={(payload) => {
                        setRecordedMix(payload);
                      }}
                    />
                  </div>
                )}

                {newVersionType === "IDEA_TEXT" && (
                  <Textarea
                    value={newVersionText}
                    onChange={(event) => setNewVersionText(event.target.value)}
                    placeholder="Текст песни"
                    rows={6}
                    className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                  />
                )}

                {newVersionType !== "IDEA_TEXT" && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-brand-ink">Комментарий к версии</p>
                    {editingNewVersionComment ? (
                      <div className="space-y-2">
                        <Textarea
                          value={newVersionComment}
                          onChange={(event) => setNewVersionComment(event.target.value)}
                          placeholder="Комментарий к версии"
                          rows={4}
                          className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                        />
                        <Button
                          variant="secondary"
                          className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                          onClick={() => setEditingNewVersionComment(false)}
                        >
                          Готово
                        </Button>
                      </div>
                    ) : newVersionComment.trim() ? (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-brand-border bg-white/75 px-3 py-2 text-left text-sm text-brand-ink"
                        onClick={() => setEditingNewVersionComment(true)}
                      >
                        {newVersionComment}
                      </button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                        onClick={() => setEditingNewVersionComment(true)}
                      >
                        Добавить комментарий
                      </Button>
                    )}
                  </div>
                )}

                {versionError && (
                  <div className="rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">
                    {versionError}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={creatingVersion}
                    onClick={createVersion}
                  >
                    {creatingVersion ? "Сохраняем..." : "Добавить версию"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                    onClick={resetNewVersionForm}
                  >
                    Очистить
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
