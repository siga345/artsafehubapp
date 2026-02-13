"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  updatedAt: string;
  folderId: string | null;
  pathStage?: { id: number; name: string } | null;
  _count?: { demos: number };
};

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
  const [selectedFolderId, setSelectedFolderId] = useState("ALL");
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackFolderId, setNewTrackFolderId] = useState("NONE");
  const [newTrackStageId, setNewTrackStageId] = useState("NONE");
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [creatingTrack, setCreatingTrack] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [showRecorder, setShowRecorder] = useState(false);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [recordTrackId, setRecordTrackId] = useState("NONE");
  const [recordNewTrackTitle, setRecordNewTrackTitle] = useState("");
  const [savingDemo, setSavingDemo] = useState(false);
  const [recorderError, setRecorderError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const filteredTracks = useMemo(() => {
    const list = tracks ?? [];
    return list.filter((track) => {
      const matchesQuery = !query || track.title.toLowerCase().includes(query.toLowerCase());
      const matchesFolder = selectedFolderId === "ALL" || track.folderId === selectedFolderId;
      return matchesQuery && matchesFolder;
    });
  }, [query, selectedFolderId, tracks]);

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

  function resetRecorder() {
    setRecordingState("idle");
    setRecordingSeconds(0);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl("");
    setRecordNote("");
    setRecordTrackId("NONE");
    setRecordNewTrackTitle("");
    setRecorderError("");
    chunksRef.current = [];
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
      setRecorderError("");
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
      setRecorderError(error instanceof Error ? error.message : "Не удалось получить доступ к микрофону.");
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

  async function saveDemo() {
    if (!recordedBlob) return;
    setSavingDemo(true);
    try {
      let targetTrackId = recordTrackId !== "NONE" ? recordTrackId : "";
      if (!targetTrackId) {
        if (!recordNewTrackTitle.trim()) {
          setRecorderError("Выбери трек или создай новый.");
          return;
        }
        const createdTrack = await apiFetchJson<Track>("/api/songs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: recordNewTrackTitle.trim(),
            folderId: null,
            pathStageId: null
          })
        });
        targetTrackId = createdTrack.id;
      }

      const formData = new FormData();
      formData.append("file", recordedBlob, `demo-${Date.now()}.webm`);
      formData.append("durationSec", String(recordingSeconds));
      formData.append("trackId", targetTrackId);
      formData.append("noteText", recordNote.trim());

      await apiFetch("/api/audio-clips", { method: "POST", body: formData });
      await refetchTracks();
      resetRecorder();
      setShowRecorder(false);
    } finally {
      setSavingDemo(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SONGS</CardTitle>
          <CardDescription>Демки, заметки и этапы трека в одном месте.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-4">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти трек..." />
          <Select value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)}>
            <option value="ALL">Все папки</option>
            {folders?.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.title}
              </option>
            ))}
          </Select>
          <Button variant="secondary" onClick={() => setShowRecorder((prev) => !prev)}>
            {showRecorder ? "Скрыть диктофон" : "Записать демо"}
          </Button>
          <Button variant="secondary" onClick={() => setSelectedFolderId("ALL")}>
            Сбросить фильтры
          </Button>
        </div>
      </Card>

      {showRecorder && (
        <Card>
          <CardHeader>
            <CardTitle>Запись демо</CardTitle>
            <CardDescription>Запись, пауза, продолжение и сохранение в трек.</CardDescription>
          </CardHeader>
          <div className="space-y-3">
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
                    resetRecorder();
                    startRecording();
                  }}
                >
                  Перезаписать
                </Button>
              )}
            </div>

            {recordedUrl && <audio controls src={recordedUrl} className="w-full" />}

            <Input
              value={recordNote}
              onChange={(event) => setRecordNote(event.target.value)}
              placeholder="Текст к демке (опционально)"
            />

            <Select value={recordTrackId} onChange={(event) => setRecordTrackId(event.target.value)}>
              <option value="NONE">Создать новый трек</option>
              {tracks?.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}
                </option>
              ))}
            </Select>

            {recordTrackId === "NONE" && (
              <Input
                value={recordNewTrackTitle}
                onChange={(event) => setRecordNewTrackTitle(event.target.value)}
                placeholder="Название нового трека"
              />
            )}

            {recorderError && <p className="text-sm text-red-600">{recorderError}</p>}

            <div className="flex flex-wrap gap-2">
              <Button disabled={!recordedBlob || savingDemo} onClick={saveDemo}>
                {savingDemo ? "Сохраняем..." : "Сохранить демо"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  stopTimer();
                  stopStream();
                  resetRecorder();
                  setShowRecorder(false);
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Папки (MVP-light)</CardTitle>
          <CardDescription>Создай папку и распределяй треки по проектам.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={newFolderTitle} onChange={(event) => setNewFolderTitle(event.target.value)} placeholder="Новая папка" />
          <Button
            disabled={!newFolderTitle.trim() || creatingFolder}
            onClick={async () => {
              setCreatingFolder(true);
              await apiFetch("/api/folders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newFolderTitle.trim() })
              });
              setNewFolderTitle("");
              await refetchFolders();
              setCreatingFolder(false);
            }}
          >
            Создать папку
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-brand-muted">
          {folders?.map((folder) => (
            <span key={folder.id} className="rounded-full border border-brand-border px-3 py-1">
              {folder.title} ({folder._count?.tracks ?? 0})
            </span>
          ))}
          {!folders?.length && <span>Папок пока нет.</span>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Создать трек</CardTitle>
          <CardDescription>Новый трек можно сразу привязать к папке и этапу PATH.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            value={newTrackTitle}
            onChange={(event) => setNewTrackTitle(event.target.value)}
            placeholder="Название трека"
          />
          <Select value={newTrackFolderId} onChange={(event) => setNewTrackFolderId(event.target.value)}>
            <option value="NONE">Без папки</option>
            {folders?.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.title}
              </option>
            ))}
          </Select>
          <Select value={newTrackStageId} onChange={(event) => setNewTrackStageId(event.target.value)}>
            <option value="NONE">Этап не выбран</option>
            {stages?.map((stage) => (
              <option key={stage.id} value={String(stage.id)}>
                {stage.name}
              </option>
            ))}
          </Select>
          <Button
            disabled={!newTrackTitle.trim() || creatingTrack}
            onClick={async () => {
              setCreatingTrack(true);
              await apiFetch("/api/songs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: newTrackTitle.trim(),
                  folderId: newTrackFolderId === "NONE" ? null : newTrackFolderId,
                  pathStageId: newTrackStageId === "NONE" ? null : Number(newTrackStageId)
                })
              });
              setNewTrackTitle("");
              setNewTrackFolderId("NONE");
              setNewTrackStageId("NONE");
              await refetchTracks();
              setCreatingTrack(false);
            }}
          >
            Создать трек
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredTracks.map((track) => (
          <Link key={track.id} href={`/songs/${track.id}`}>
            <Card className="h-full transition hover:border-brand-accent">
              <CardHeader>
                <CardTitle>{track.title}</CardTitle>
                <CardDescription>
                  Этап: {track.pathStage?.name ?? "Не выбран"} • Демо: {track._count?.demos ?? 0}
                </CardDescription>
              </CardHeader>
              <p className="text-xs text-brand-muted">Обновлено: {formatDate(track.updatedAt)}</p>
            </Card>
          </Link>
        ))}
        {!filteredTracks.length && (
          <p className="text-sm text-brand-muted">Запиши первую демку или создай первый трек.</p>
        )}
      </div>
    </div>
  );
}
