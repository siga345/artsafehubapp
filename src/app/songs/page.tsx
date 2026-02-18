"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";

type Folder = {
  id: string;
  title: string;
  _count?: { tracks: number };
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
  pathStageId: number | null;
  pathStage?: { id: number; name: string } | null;
  _count?: { demos: number };
};

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED";

function normalizeStageName(name: string) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isPromoStage(name: string) {
  return normalizeStageName(name).includes("промо");
}

function findStageIdByVersionType(stages: PathStage[] | undefined, versionType: DemoVersionType): number | null {
  if (!stages?.length) return null;
  const checks: Record<DemoVersionType, (stageName: string) => boolean> = {
    IDEA_TEXT: (name) => name.includes("идея"),
    DEMO: (name) => name.includes("демо"),
    ARRANGEMENT: (name) => name.includes("продакшн") || name.includes("аранж"),
    NO_MIX: (name) => name.includes("запис"),
    MIXED: (name) => name.includes("свед"),
    MASTERED: (name) => name.includes("мастер")
  };
  const match = stages.find((stage) => checks[versionType](normalizeStageName(stage.name)));
  return match?.id ?? null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDuration(seconds: number) {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
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
  const { data: tracks, refetch: refetchTracks } = useQuery({
    queryKey: ["songs-tracks"],
    queryFn: () => fetcher<Track[]>("/api/songs")
  });
  const { data: folders, refetch: refetchFolders } = useQuery({
    queryKey: ["songs-folders"],
    queryFn: () => fetcher<Folder[]>("/api/folders")
  });
  const { data: stages } = useQuery({
    queryKey: ["songs-path-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/path/stages")
  });

  const [query, setQuery] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("ALL");

  const [folderAssignTrackId, setFolderAssignTrackId] = useState("");
  const [folderAssignFolderId, setFolderAssignFolderId] = useState("NONE");
  const [folderAssignNewTitle, setFolderAssignNewTitle] = useState("");
  const [assigningFolder, setAssigningFolder] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState("");
  const [folderActionError, setFolderActionError] = useState("");

  const [showDemoComposer, setShowDemoComposer] = useState(false);
  const [demoMode, setDemoMode] = useState<"record" | "upload">("upload");
  const [demoNewTrackTitle, setDemoNewTrackTitle] = useState("");
  const [demoStageId, setDemoStageId] = useState("NONE");
  const [demoText, setDemoText] = useState("");
  const [demoVersionComment, setDemoVersionComment] = useState("");
  const [editingDemoVersionComment, setEditingDemoVersionComment] = useState(false);
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const [demoVersionType, setDemoVersionType] = useState<DemoVersionType>("IDEA_TEXT");
  const [savingDemo, setSavingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");

  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredTracks = useMemo(() => {
    const list = tracks ?? [];
    return list.filter((track) => {
      const matchesQuery = !query || track.title.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = selectedStageId === "ALL" || String(track.pathStageId ?? "NONE") === selectedStageId;
      return matchesQuery && matchesStatus;
    });
  }, [query, selectedStageId, tracks]);

  const visibleStages = useMemo(() => (stages ?? []).filter((stage) => !isPromoStage(stage.name)), [stages]);

  const tracksWithoutFolder = useMemo(() => filteredTracks.filter((track) => !track.folderId), [filteredTracks]);

  const foldersWithTracks = useMemo(() => {
    const byId = new Map<string, Track[]>();
    filteredTracks.forEach((track) => {
      if (!track.folderId) return;
      const list = byId.get(track.folderId) ?? [];
      list.push(track);
      byId.set(track.folderId, list);
    });

    return (folders ?? [])
      .map((folder) => ({
        folder,
        tracks: byId.get(folder.id) ?? []
      }));
  }, [filteredTracks, folders]);

  useEffect(
    () => () => {
      stopTimer();
      stopStream();
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    },
    [recordedUrl]
  );

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

  function resetRecording() {
    setRecordingState("idle");
    setRecordingSeconds(0);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl("");
    chunksRef.current = [];
  }

  function resetDemoComposer() {
    resetRecording();
    setDemoMode("upload");
    setDemoNewTrackTitle("");
    setDemoStageId("NONE");
    setDemoText("");
    setDemoVersionComment("");
    setEditingDemoVersionComment(false);
    setDemoFile(null);
    setDemoVersionType("IDEA_TEXT");
    setDemoError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    try {
      setDemoError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingSeconds(0);
      setRecordedBlob(null);

      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
        setRecordedUrl("");
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setRecordingState("stopped");
        stopStream();
      };

      recorder.start();
      setRecordingState("recording");
      startTimer();
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Не удалось получить доступ к микрофону.");
    }
  }

  function pauseRecording() {
    if (!recorderRef.current || recordingState !== "recording") return;
    recorderRef.current.pause();
    setRecordingState("paused");
    stopTimer();
  }

  function resumeRecording() {
    if (!recorderRef.current || recordingState !== "paused") return;
    recorderRef.current.resume();
    setRecordingState("recording");
    startTimer();
  }

  function stopRecording() {
    if (!recorderRef.current || (recordingState !== "recording" && recordingState !== "paused")) return;
    recorderRef.current.stop();
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

      await Promise.all([refetchTracks(), refetchFolders()]);
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

  async function deleteFolder(folder: Folder) {
    const hasTracks = (folder._count?.tracks ?? 0) > 0;
    if (hasTracks) {
      const confirmed = window.confirm(
        "Папка не пустая. Уверены, что хотите удалить папку? Все треки в этой папке тоже будут удалены."
      );
      if (!confirmed) {
        return;
      }
    }

    setDeletingFolderId(folder.id);
    setFolderActionError("");
    try {
      const response = await apiFetch(`/api/folders/${folder.id}${hasTracks ? "?force=1" : ""}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось удалить папку.");
      }
      await Promise.all([refetchFolders(), refetchTracks()]);
    } catch (error) {
      setFolderActionError(error instanceof Error ? error.message : "Не удалось удалить папку.");
    } finally {
      setDeletingFolderId("");
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
        await Promise.all([refetchTracks(), refetchFolders()]);
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
        if (!recordedBlob) {
          setDemoError("Сначала запиши демо.");
          return;
        }
        fileToUpload = recordedBlob;
        durationSec = recordingSeconds;
      }

      if (!fileToUpload) {
        setDemoError("Не удалось подготовить аудио.");
        return;
      }

      const formData = new FormData();
      formData.append("file", fileToUpload, filename);
      formData.append("durationSec", String(durationSec));
      formData.append("trackId", targetTrackId);
      formData.append("noteText", demoVersionComment.trim());
      formData.append("versionType", demoVersionType);

      const uploadResponse = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
      if (!uploadResponse.ok) {
        const payload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось добавить файл к треку.");
      }

      await Promise.all([refetchTracks(), refetchFolders()]);
      resetDemoComposer();
      setShowDemoComposer(false);
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Не удалось сохранить новую песню.");
    } finally {
      setSavingDemo(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SONGS</CardTitle>
          <CardDescription>Поиск, фильтр по статусу трека и организация демо по папкам.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию..." />
          <Select value={selectedStageId} onChange={(event) => setSelectedStageId(event.target.value)}>
            <option value="ALL">Все статусы</option>
            <option value="NONE">Без статуса</option>
            {visibleStages.map((stage) => (
              <option key={stage.id} value={String(stage.id)}>
                {stage.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="space-y-2">
        <Button
          variant="secondary"
          onClick={() => {
            setShowCreateFolder((prev) => !prev);
            if (showCreateFolder) {
              setNewFolderTitle("");
            }
          }}
        >
          {showCreateFolder ? "Скрыть создание папки" : "Создать папку"}
        </Button>
        {showCreateFolder && (
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
        )}
        {folderActionError && <p className="text-sm text-red-600">{folderActionError}</p>}
      </div>

      <div className="space-y-4">
        {foldersWithTracks.map(({ folder, tracks: folderTracks }) => (
          <Card key={folder.id}>
            <CardHeader className="flex items-start justify-between gap-3 md:flex-row md:items-center">
              <div>
                <CardTitle>{folder.title}</CardTitle>
                <CardDescription>
                  В папке: {folder._count?.tracks ?? 0} • По фильтру: {folderTracks.length}
                </CardDescription>
              </div>
              <Button
                variant="secondary"
                disabled={deletingFolderId === folder.id}
                onClick={() => deleteFolder(folder)}
              >
                {deletingFolderId === folder.id ? "Удаляем..." : "Удалить папку"}
              </Button>
            </CardHeader>
            <div className="grid gap-3 md:grid-cols-2">
              {folderTracks.map((track) => (
                <Link key={track.id} href={`/songs/${track.id}`}>
                  <div className="rounded-lg border border-brand-border bg-brand-surface p-3 transition hover:border-brand-accent">
                    <p className="font-medium">{track.title}</p>
                    <p className="text-xs text-brand-muted">
                      Статус: {track.pathStage?.name ?? "Не выбран"} • Демо: {track._count?.demos ?? 0}
                    </p>
                    <p className="text-xs text-brand-muted">Обновлено: {formatDate(track.updatedAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
            {!folderTracks.length && (
              <p className="mt-3 text-sm text-brand-muted">В этой папке нет треков по текущему фильтру.</p>
            )}
          </Card>
        ))}
        {!foldersWithTracks.length && (
          <p className="text-sm text-brand-muted">Папок пока нет. Создай первую папку выше.</p>
        )}
      </div>

      <div className="space-y-3">
        {tracksWithoutFolder.map((track) => (
          <div key={track.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Link href={`/songs/${track.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{track.title}</p>
                <p className="text-xs text-brand-muted">
                  Статус: {track.pathStage?.name ?? "Не выбран"} • Демо: {track._count?.demos ?? 0}
                </p>
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
                Добавить в папку
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

        {!tracksWithoutFolder.length && (
          <p className="text-sm text-brand-muted">Треков по текущему фильтру сейчас нет.</p>
        )}
      </div>

      <div className="pt-2">
        <Button
          className="w-full"
          onClick={() => {
            setShowDemoComposer((prev) => !prev);
            if (!showDemoComposer) {
              resetDemoComposer();
            }
          }}
        >
          {showDemoComposer ? "Скрыть окно новой песни" : "Новая песня"}
        </Button>
      </div>

      {showDemoComposer && (
        <Card>
          <CardHeader>
            <CardTitle>Новая песня</CardTitle>
            <CardDescription>Создай новый трек, укажи статус и добавь первое демо.</CardDescription>
          </CardHeader>

          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={demoNewTrackTitle}
                onChange={(event) => setDemoNewTrackTitle(event.target.value)}
                placeholder="Название нового трека"
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
            {demoVersionType === "IDEA_TEXT" && (
              <p className="text-sm text-brand-muted">Для «Идея (текст)» текст песни обязателен.</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => setDemoFile(event.target.files?.[0] ?? null)}
            />
            {demoMode === "upload" && demoFile && (
              <p className="text-sm text-brand-muted">Выбран файл: {demoFile.name}</p>
            )}

            {demoVersionType === "DEMO" && demoMode === "record" && (
              <div className="space-y-3 rounded-lg border border-brand-border bg-brand-surface p-3">
                <p className="text-sm text-brand-muted">Таймер: {formatDuration(recordingSeconds)}</p>
                <div className="flex flex-wrap gap-2">
                  {recordingState === "idle" && <Button onClick={startRecording}>Старт</Button>}
                  {recordingState === "recording" && (
                    <>
                      <Button variant="secondary" onClick={pauseRecording}>
                        Пауза
                      </Button>
                      <Button onClick={stopRecording}>Стоп</Button>
                    </>
                  )}
                  {recordingState === "paused" && (
                    <>
                      <Button variant="secondary" onClick={resumeRecording}>
                        Продолжить
                      </Button>
                      <Button onClick={stopRecording}>Стоп</Button>
                    </>
                  )}
                  {recordingState === "stopped" && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        resetRecording();
                        startRecording();
                      }}
                    >
                      Перезаписать
                    </Button>
                  )}
                </div>

                {recordedUrl && <audio controls src={recordedUrl} className="w-full" />}
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium">Текст песни</p>
              <Textarea
                value={demoText}
                onChange={(event) => setDemoText(event.target.value)}
                placeholder="Текст песни"
                rows={6}
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
                    className="w-full rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-left text-sm"
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

            {demoError && <p className="text-sm text-red-600">{demoError}</p>}

            <div className="flex flex-wrap gap-2">
              <Button disabled={savingDemo} onClick={saveDemo}>
                {savingDemo ? "Сохраняем..." : "Добавить демо"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  stopTimer();
                  stopStream();
                  resetDemoComposer();
                  setShowDemoComposer(false);
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
