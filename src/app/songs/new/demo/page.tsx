"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { MultiTrackRecorder, type MultiTrackRecorderHandle } from "@/components/audio/multi-track-recorder";
import {
  SongProjectPickerStep,
  type ProjectOption,
  type ProjectSelectionMode
} from "@/components/songs/song-project-picker-step";
import { Button } from "@/components/ui/button";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { clearNewSongFlowDraft, loadNewSongFlowDraft, type NewSongFlowDraft } from "@/lib/songs/new-song-flow-draft";
import { findDemoStage, isDemoSongStage, type SongStageLike } from "@/lib/songs-version-stage-map";

type PathStage = SongStageLike;

type DemoMixPayload = {
  blob: Blob;
  durationSec: number;
  filename: string;
};

type DemoAudioSource =
  | { kind: "upload"; file: File; durationSec: number }
  | { kind: "record"; mix: DemoMixPayload }
  | null;

function fileNameWithoutExtension(name: string) {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0) return trimmed || "demo";
  return trimmed.slice(0, lastDot);
}

function encodeWavFromBuffer(buffer: AudioBuffer): Blob {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const sampleCount = buffer.length;
  const bytesPerSample = 2;
  const dataLength = sampleCount * bytesPerSample;
  const out = new ArrayBuffer(44 + dataLength);
  const view = new DataView(out);

  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataLength, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 8 * bytesPerSample, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataLength, true);
  offset += 4;

  const mono = new Float32Array(sampleCount);
  for (let ch = 0; ch < channelCount; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < sampleCount; i += 1) {
      mono[i] += data[i] / channelCount;
    }
  }

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

async function decodeToWavFileFromAudioBufferLike(file: File): Promise<{ file: File; durationSec: number }> {
  const audioCtx = new window.AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = encodeWavFromBuffer(decoded);
    const wavFile = new File([wavBlob], `${fileNameWithoutExtension(file.name)}.wav`, { type: "audio/wav" });
    return { file: wavFile, durationSec: Math.max(0, Math.round(decoded.duration)) };
  } finally {
    await audioCtx.close().catch(() => null);
  }
}

async function extractVideoAudioToWavViaPlayback(file: File): Promise<{ file: File; durationSec: number }> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.src = objectUrl;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;

  const audioCtx = new window.AudioContext();
  let recorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Не удалось прочитать видеофайл."));
    });

    const mediaElementSource = audioCtx.createMediaElementSource(video);
    const streamDestination = audioCtx.createMediaStreamDestination();
    mediaElementSource.connect(streamDestination);

    const mimeType =
      (typeof MediaRecorder !== "undefined" &&
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type))) ||
      "";

    recorder = mimeType ? new MediaRecorder(streamDestination.stream, { mimeType }) : new MediaRecorder(streamDestination.stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType || "audio/webm" }));
      recorder!.onerror = () => reject(new Error("Не удалось извлечь аудио из видео."));
    });

    recorder.start();
    await audioCtx.resume().catch(() => null);
    await video.play();

    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error("Ошибка воспроизведения видео при конвертации."));
    });

    if (recorder.state !== "inactive") {
      recorder.stop();
    }

    const recordedAudioBlob = await stopped;
    const tempAudioFile = new File([recordedAudioBlob], `${fileNameWithoutExtension(file.name)}.webm`, {
      type: recordedAudioBlob.type || "audio/webm"
    });
    return await decodeToWavFileFromAudioBufferLike(tempAudioFile);
  } finally {
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {}
    }
    video.pause();
    video.src = "";
    URL.revokeObjectURL(objectUrl);
    await audioCtx.close().catch(() => null);
  }
}

async function convertVideoFileToWav(file: File): Promise<{ file: File; durationSec: number }> {
  try {
    return await decodeToWavFileFromAudioBufferLike(file);
  } catch {
    return await extractVideoAudioToWavViaPlayback(file);
  }
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

export default function NewDemoSongPage() {
  const router = useRouter();
  const recorderRef = useRef<MultiTrackRecorderHandle | null>(null);
  const beatInputRef = useRef<HTMLInputElement | null>(null);
  const demoFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["songs-projects"],
    queryFn: () => fetcher<ProjectOption[]>("/api/projects")
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["songs-track-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/songs/stages")
  });

  const [draft, setDraft] = useState<NewSongFlowDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [convertingVideo, setConvertingVideo] = useState(false);
  const [recorderResetKey, setRecorderResetKey] = useState(0);
  const [audioSource, setAudioSource] = useState<DemoAudioSource>(null);
  const [showProjectStep, setShowProjectStep] = useState(false);
  const [selectionMode, setSelectionMode] = useState<ProjectSelectionMode>("existing");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [projectStepError, setProjectStepError] = useState("");
  const [recorderError, setRecorderError] = useState("");

  useEffect(() => {
    const nextDraft = loadNewSongFlowDraft();
    if (!nextDraft) {
      setDraftError("Черновик новой демо-песни не найден. Начни заново из SONGS.");
      return;
    }
    setDraft(nextDraft);
    setNewProjectTitle(nextDraft.title);
  }, []);

  const demoStage = useMemo(() => findDemoStage(stages), [stages]);
  const fixedProject = draft?.sourceContext === "project-page" ? draft.targetProject ?? null : null;
  const returnHref = fixedProject ? `/songs/projects/${fixedProject.id}` : "/songs";
  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === (draft?.selectedStageId ?? -1)) ?? null,
    [draft?.selectedStageId, stages]
  );

  useEffect(() => {
    if (!draft) return;
    if (selectedStage && !isDemoSongStage(selectedStage.name)) {
      setDraftError("В demo-flow передан этап, который не является «Демо».");
    }
  }, [draft, selectedStage]);

  function closeAndReturnToSongs() {
    clearNewSongFlowDraft();
    router.push(returnHref);
  }

  async function createOrPickProjectId() {
    if (fixedProject?.id) {
      return fixedProject.id;
    }

    if (selectionMode === "existing") {
      if (!selectedProjectId || selectedProjectId === "NONE") {
        throw new Error("Выберите проект.");
      }
      return selectedProjectId;
    }

    if (!newProjectTitle.trim()) {
      throw new Error("Введите название нового проекта.");
    }

    const response = await apiFetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newProjectTitle.trim(),
        coverType: "GRADIENT",
        coverPresetKey: "lime-grove",
        coverColorA: "#D9F99D",
        coverColorB: "#65A30D"
      })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Не удалось создать проект.");
    }
    const created = (await response.json()) as { id: string };
    return created.id;
  }

  async function saveDemoToProject() {
    const currentDraft = draft;
    const source = audioSource;
    const stageId = selectedStage?.id ?? demoStage?.id ?? null;

    if (!currentDraft) {
      setProjectStepError("Черновик не найден.");
      return;
    }
    if (!stageId) {
      setProjectStepError("Не найден этап «Демо».");
      return;
    }
    if (!source) {
      setProjectStepError("Сначала загрузи готовое демо или сведи запись в рекордере.");
      return;
    }

    setSaving(true);
    setPageError("");
    setProjectStepError("");
    try {
      const projectId = await createOrPickProjectId();

      const trackResponse = await apiFetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentDraft.title.trim(),
          lyricsText: currentDraft.lyricsWasSkipped ? null : currentDraft.lyricsText.trim() || null,
          projectId,
          pathStageId: stageId
        })
      });
      if (!trackResponse.ok) {
        const payload = (await trackResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось создать трек.");
      }
      const createdTrack = (await trackResponse.json()) as { id: string };

      const formData = new FormData();
      if (source.kind === "upload") {
        formData.append("file", source.file, source.file.name);
        formData.append("durationSec", String(source.durationSec));
      } else {
        formData.append("file", source.mix.blob, source.mix.filename);
        formData.append("durationSec", String(source.mix.durationSec));
      }
      formData.append("trackId", createdTrack.id);
      formData.append("noteText", "");
      formData.append("versionType", "DEMO");

      const uploadResponse = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
      if (!uploadResponse.ok) {
        const payload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Трек создан, но не удалось загрузить аудио.");
      }

      clearNewSongFlowDraft();
      router.push(returnHref);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось сохранить демо.";
      setProjectStepError(message);
      setPageError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBeatFileSelected(file: File | null) {
    if (!file) return;
    setPageError("");
    setRecorderError("");
    try {
      await recorderRef.current?.importAudioLayerFromFile(file, { name: "Бит", volume: 0.9 });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось импортировать бит.");
    }
  }

  async function handleReadyDemoFileSelected(file: File | null) {
    if (!file) return;
    setPageError("");
    setProjectStepError("");
    try {
      const durationSec = await getAudioDurationSeconds(file);
      setAudioSource({ kind: "upload", file, durationSec });
      setShowProjectStep(true);
      setRecorderError("");
      setDraft((prev) => (prev ? { ...prev, branch: "DEMO_UPLOAD", demoReadyFileMeta: { name: file.name } } : prev));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось подготовить файл демо.");
    }
  }

  async function handleConvertVideoSelected(file: File | null) {
    if (!file) return;
    setPageError("");
    setProjectStepError("");
    setRecorderError("");
    setConvertingVideo(true);
    try {
      const converted = await convertVideoFileToWav(file);
      setAudioSource({ kind: "upload", file: converted.file, durationSec: converted.durationSec });
      setShowProjectStep(true);
      setDraft((prev) =>
        prev ? { ...prev, branch: "DEMO_UPLOAD", demoReadyFileMeta: { name: converted.file.name } } : prev
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Не удалось конвертировать видео в WAV. Попробуй другой файл или загрузи готовое демо."
      );
    } finally {
      setConvertingVideo(false);
    }
  }

  if (draftError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-brand-border bg-white/90 p-5 shadow-sm">
          <p className="text-sm text-[#a4372a]">{draftError}</p>
          <div className="mt-3">
            <Link href={returnHref}>
              <Button variant="secondary" className="border-brand-border bg-white text-brand-ink hover:bg-white">
                {fixedProject ? "Вернуться в проект" : "Вернуться в SONGS"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) {
    return <p className="px-4 py-8 text-sm text-brand-muted">Загрузка demo-flow...</p>;
  }

  const currentSourceLabel =
    audioSource?.kind === "upload"
      ? `Готовое демо: ${audioSource.file.name}`
      : audioSource?.kind === "record"
        ? `Сведённый микс: ${audioSource.mix.filename}`
        : "Источник аудио ещё не выбран";

  return (
    <div className="pb-24">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6">
        <div className="rounded-[28px] border border-brand-border bg-gradient-to-br from-[#edf4e4] via-[#e8f0de] to-[#e2ead7] p-4 shadow-[0_20px_45px_rgba(61,84,46,0.14)] md:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">New Song / Demo</p>
              <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">{draft.title}</h1>
              <p className="text-sm text-brand-muted">
                Этап: {selectedStage?.name || demoStage?.name || "Демо"} • {draft.lyricsWasSkipped ? "текст пропущен" : "текст сохранён в черновике"}
              </p>
              {fixedProject && <p className="text-xs text-brand-muted">Проект: {fixedProject.title}</p>}
            </div>
            <Button
              variant="secondary"
              className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
              onClick={closeAndReturnToSongs}
              disabled={saving}
            >
              Закрыть
            </Button>
          </div>

          {draft.lyricsText.trim() && !draft.lyricsWasSkipped && (
            <div className="mb-4 rounded-2xl border border-brand-border bg-white/80 p-3">
              <p className="mb-1 text-xs uppercase tracking-[0.16em] text-brand-muted">Текст песни</p>
              <p className="whitespace-pre-wrap text-sm text-brand-ink">{draft.lyricsText}</p>
            </div>
          )}

          {(pageError || recorderError) && (
            <div className="mb-4 rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">
              {pageError || recorderError}
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="border-brand-border bg-white text-brand-ink hover:bg-white"
              onClick={() => beatInputRef.current?.click()}
              disabled={saving}
            >
              Загрузить бит
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border-brand-border bg-white text-brand-ink hover:bg-white"
              onClick={() => demoFileInputRef.current?.click()}
              disabled={saving}
            >
              Загрузить готовое демо
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border-brand-border bg-white text-brand-ink hover:bg-white"
              onClick={() => videoFileInputRef.current?.click()}
              disabled={saving || convertingVideo}
            >
              {convertingVideo ? "Converting..." : "Convert video"}
            </Button>
            <span className="self-center text-xs text-brand-muted">{currentSourceLabel}</span>
          </div>

          <input
            ref={beatInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (event) => {
              await handleBeatFileSelected(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={demoFileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (event) => {
              await handleReadyDemoFileSelected(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={videoFileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={async (event) => {
              await handleConvertVideoSelected(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />

          <MultiTrackRecorder
            ref={recorderRef}
            resetKey={recorderResetKey}
            onError={setRecorderError}
            onReset={() => {
              setRecorderError("");
              setAudioSource((prev) => (prev?.kind === "record" ? null : prev));
            }}
            onReady={(payload) => {
              setRecorderError("");
              setPageError("");
              setAudioSource({ kind: "record", mix: payload });
              setShowProjectStep(true);
              setDraft((prev) => (prev ? { ...prev, branch: "DEMO_RECORD", demoReadyFileMeta: null } : prev));
            }}
          />

          {showProjectStep && !fixedProject && (
            <div className="mt-4 rounded-2xl border border-brand-border bg-white/85 p-4">
              <SongProjectPickerStep
                projects={projects}
                selectionMode={selectionMode}
                selectedProjectId={selectedProjectId}
                newProjectTitle={newProjectTitle}
                onSelectionModeChange={setSelectionMode}
                onSelectedProjectIdChange={setSelectedProjectId}
                onNewProjectTitleChange={setNewProjectTitle}
                onConfirm={() => void saveDemoToProject()}
                confirmLabel={audioSource?.kind === "record" ? "Сохранить demo (recorder)" : "Сохранить demo"}
                busy={saving}
                error={projectStepError}
                modeLabel={
                  audioSource?.kind === "record"
                    ? "Сохраним сведённый микс как демо-версию."
                    : "Сохраним загруженный файл как демо-версию."
                }
                onBack={() => setShowProjectStep(false)}
              />
            </div>
          )}

          {showProjectStep && fixedProject && (
            <div className="mt-4 rounded-2xl border border-brand-border bg-white/85 p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Проект</p>
                  <h3 className="text-lg font-semibold tracking-tight text-brand-ink">{fixedProject.title}</h3>
                  <p className="text-sm text-brand-muted">
                    {audioSource?.kind === "record"
                      ? "Сохраним сведённый микс как демо-версию в текущий проект."
                      : "Сохраним загруженный файл как демо-версию в текущий проект."}
                  </p>
                </div>
                {projectStepError && (
                  <div className="rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a]">
                    {projectStepError}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={saving} onClick={() => void saveDemoToProject()}>
                    {saving ? "Сохраняем..." : audioSource?.kind === "record" ? "Сохранить demo (recorder)" : "Сохранить demo"}
                  </Button>
                  <Button
                    variant="secondary"
                    className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                    onClick={() => setShowProjectStep(false)}
                    disabled={saving}
                  >
                    Назад
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
