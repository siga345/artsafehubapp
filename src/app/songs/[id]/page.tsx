"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";

type PathStage = {
  id: number;
  name: string;
};

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED";

type Demo = {
  id: string;
  audioUrl: string;
  textNote: string | null;
  duration: number;
  createdAt: string;
  versionType: DemoVersionType;
};

type Track = {
  id: string;
  title: string;
  lyricsText: string | null;
  folderId: string | null;
  pathStageId: number | null;
  pathStage?: PathStage | null;
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
  const { data: track, refetch } = useQuery({
    queryKey: ["song-track", params.id],
    queryFn: () => fetcher<Track>(`/api/songs/${params.id}`)
  });
  const { data: stages } = useQuery({
    queryKey: ["song-path-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/path/stages")
  });
  const visibleStages = useMemo(() => (stages ?? []).filter((stage) => !isPromoStage(stage.name)), [stages]);

  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [pageError, setPageError] = useState("");

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

  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState("");

  const [updatingDemoId, setUpdatingDemoId] = useState("");
  const [demoNotes, setDemoNotes] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (newVersionType !== "DEMO" && newVersionMode === "record") {
      setNewVersionMode("upload");
    }
  }, [newVersionMode, newVersionType]);

  useEffect(() => {
    if (stageId === "") return;
    const selected = visibleStages.find((stage) => String(stage.id) === stageId);
    if (!selected) return;
    const stageName = normalizeStageName(selected.name);
    if (stageName.includes("идея") && newVersionType !== "IDEA_TEXT") {
      setNewVersionType("IDEA_TEXT");
      return;
    }
    if (!stageName.includes("идея") && newVersionType === "IDEA_TEXT") {
      setNewVersionType("DEMO");
    }
  }, [stageId, newVersionType, visibleStages]);

  useEffect(() => {
    setLyricsText(track?.lyricsText ?? "");
  }, [track?.lyricsText]);

  if (!track) {
    return <p className="text-sm text-brand-muted">Загрузка трека...</p>;
  }

  const currentTitle = title || track.title;
  const currentStage = stageId === "" ? track.pathStageId : stageId === "NONE" ? null : Number(stageId);
  const currentTrackId = track.id;
  const currentTrackStageId = track.pathStageId;

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

  function resetNewVersionForm() {
    setNewVersionType("DEMO");
    setNewVersionMode("upload");
    setNewVersionText("");
    setNewVersionComment("");
    setEditingNewVersionComment(false);
    setNewVersionFile(null);
    setVersionError("");
    resetRecording();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function startRecording() {
    try {
      setVersionError("");
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
      setVersionError(error instanceof Error ? error.message : "Не удалось получить доступ к микрофону.");
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
        if (!recordedBlob) {
          setVersionError("Сначала запиши демо.");
          return;
        }
        fileToUpload = recordedBlob;
        durationSec = recordingSeconds;
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
    } catch (error) {
      setVersionError(error instanceof Error ? error.message : "Не удалось добавить версию.");
    } finally {
      setSyncingStatus(false);
      setCreatingVersion(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Трек</CardTitle>
          <CardDescription>Название и этап по PATH.</CardDescription>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={currentTitle} onChange={(event) => setTitle(event.target.value)} />
          <Select
            value={currentStage ? String(currentStage) : "NONE"}
            onChange={(event) => setStageId(event.target.value)}
          >
            <option value="NONE">Этап не выбран</option>
            {visibleStages.map((stage) => (
              <option key={stage.id} value={String(stage.id)}>
                {stage.name}
              </option>
            ))}
          </Select>
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
              } catch (error) {
                setPageError(error instanceof Error ? error.message : "Не удалось сохранить трек.");
              } finally {
                setSavingMeta(false);
              }
            }}
          >
            {savingMeta ? "Сохраняем..." : "Сохранить"}
          </Button>
          {syncingStatus && <p className="text-xs text-brand-muted">Синхронизация статуса...</p>}
        </div>
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setShowLyrics((prev) => !prev)}>
            {showLyrics ? "Скрыть текст песни" : "Текст песни"}
          </Button>
          {showLyrics && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={lyricsText}
                onChange={(event) => setLyricsText(event.target.value)}
                placeholder="Текст песни"
                rows={6}
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
        </div>
        {pageError && <p className="mt-2 text-sm text-red-600">{pageError}</p>}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Добавить версию</CardTitle>
          <CardDescription>Новая версия песни на выбранном этапе.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <Select value={newVersionType} onChange={(event) => setNewVersionType(event.target.value as DemoVersionType)}>
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
                onClick={() => {
                  setNewVersionMode("upload");
                  fileInputRef.current?.click();
                }}
              >
                Загрузить файл
              </Button>
              {newVersionType === "DEMO" && (
                <Button variant={newVersionMode === "record" ? "primary" : "secondary"} onClick={() => setNewVersionMode("record")}>
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
            <p className="text-sm text-brand-muted">Выбран файл: {newVersionFile.name}</p>
          )}

          {newVersionType === "DEMO" && newVersionMode === "record" && (
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

          {newVersionType === "IDEA_TEXT" && (
            <Textarea
              value={newVersionText}
              onChange={(event) => setNewVersionText(event.target.value)}
              placeholder="Текст песни"
              rows={6}
            />
          )}

          {newVersionType !== "IDEA_TEXT" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Комментарий к версии</p>
              {editingNewVersionComment ? (
                <div className="space-y-2">
                  <Textarea
                    value={newVersionComment}
                    onChange={(event) => setNewVersionComment(event.target.value)}
                    placeholder="Комментарий к версии"
                    rows={4}
                  />
                  <Button variant="secondary" onClick={() => setEditingNewVersionComment(false)}>
                    Готово
                  </Button>
                </div>
              ) : newVersionComment.trim() ? (
                <button
                  type="button"
                  className="w-full rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-left text-sm"
                  onClick={() => setEditingNewVersionComment(true)}
                >
                  {newVersionComment}
                </button>
              ) : (
                <Button variant="secondary" onClick={() => setEditingNewVersionComment(true)}>
                  Добавить комментарий
                </Button>
              )}
            </div>
          )}

          {versionError && <p className="text-sm text-red-600">{versionError}</p>}

          <div className="flex flex-wrap gap-2">
            <Button disabled={creatingVersion} onClick={createVersion}>
              {creatingVersion ? "Сохраняем..." : "Добавить версию"}
            </Button>
            <Button variant="secondary" onClick={resetNewVersionForm}>
              Очистить
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Демо и версии</CardTitle>
          <CardDescription>Аудио, тип версии и текст.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          {track.demos.map((demo) => (
            <div key={demo.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
              <audio controls src={`/api/audio-clips/${demo.id}/stream`} className="w-full" />
              <p className="mt-2 text-xs text-brand-muted">
                {versionTypeLabels[demo.versionType]} • {fileNameFromPath(demo.audioUrl)} • {formatDate(demo.createdAt)} • {formatDuration(demo.duration)}
              </p>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  disabled={updatingDemoId === demo.id}
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
                    await refetch();
                    setUpdatingDemoId("");
                  }}
                >
                  Удалить
                </Button>
              </div>
              <div className="mt-2 space-y-2">
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
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
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
                      <Button variant="secondary" onClick={() => setEditingCommentId("")}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : demo.textNote ? (
                  <button
                    type="button"
                    className="w-full rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-left text-sm"
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
          ))}
          {!track.demos.length && <p className="text-sm text-brand-muted">Пока нет демо. Добавь первую версию выше.</p>}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => router.push("/songs")}>
          Назад в SONGS
        </Button>
        <Button
          variant="secondary"
          onClick={async () => {
            setPageError("");
            const response = await apiFetch(`/api/songs/${currentTrackId}`, { method: "DELETE" });
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;
              setPageError(payload?.error || "Не удалось удалить трек.");
              return;
            }
            router.push("/songs");
          }}
        >
          Удалить трек
        </Button>
      </div>
    </div>
  );
}
