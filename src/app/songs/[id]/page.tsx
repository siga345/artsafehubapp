"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AudioLines, FolderOpen, MoreHorizontal, PlusCircle, RefreshCw, Sparkles } from "lucide-react";

import { AudioWaveformPlayer } from "@/components/audio/audio-waveform-player";
import { MultiTrackRecorder } from "@/components/audio/multi-track-recorder";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { PlaybackIcon } from "@/components/songs/playback-icon";
import { SongAnalysisBadges } from "@/components/songs/song-analysis-badges";
import { useSongsPlayback } from "@/components/songs/songs-playback-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  distributionDistributorOptions,
  distributionRequestStatusLabel,
  distributionYesNoOptions,
  type DistributionDistributorValue,
  type DistributionYesNoValue,
  type TrackDistributionRequestDto,
  type TrackDistributionRequestPayload
} from "@/lib/distribution-request";
import type { RecommendationSource } from "@/contracts/recommendations";
import { apiFetch, apiFetchJson } from "@/lib/client-fetch";
import { appendAudioAnalysisToFormData, detectAudioAnalysisMvp } from "@/lib/audio/upload-analysis-client";
import { buildRecommendationCard } from "@/lib/recommendations";
import { buildProjectCoverStyle } from "@/lib/project-cover-style";
import { isPlayableDemo, pickPreferredPlaybackDemo, playbackAccentButtonStyle } from "@/lib/songs-playback-helpers";
import type { IdentityBridgeStatus, TrackIdentityBridge } from "@/lib/id-integration";

type PathStage = {
  id: number;
  name: string;
};

type DemoVersionType = "IDEA_TEXT" | "DEMO" | "ARRANGEMENT" | "NO_MIX" | "MIXED" | "MASTERED" | "RELEASE";
type AddVersionQuickAction = "convert" | "import" | "record";

type Demo = {
  id: string;
  audioUrl: string | null;
  textNote: string | null;
  duration: number;
  createdAt: string;
  versionType: DemoVersionType;
  releaseDate?: string | null;
  detectedBpm?: number | null;
  detectedKeyRoot?: string | null;
  detectedKeyMode?: string | null;
  sortIndex?: number;
  versionReflection?: {
    whyMade: string | null;
    whatChanged: string | null;
    whatNotWorking: string | null;
    legacyNote: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
};

type FolderRef = {
  id: string;
  title: string;
};

type ProjectRef = {
  id: string;
  title: string;
  artistLabel: string | null;
  releaseKind?: "SINGLE" | "ALBUM";
  coverType: "GRADIENT" | "IMAGE";
  coverImageUrl: string | null;
  coverPresetKey?: string | null;
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
  displayBpm?: number | null;
  displayKeyRoot?: string | null;
  displayKeyMode?: string | null;
  folder?: FolderRef | null;
  projectId?: string | null;
  project?: ProjectRef | null;
  primaryDemoId?: string | null;
  primaryDemo?: Demo | null;
  pathStageId: number | null;
  pathStage?: PathStage | null;
  workbenchState: "IN_PROGRESS" | "STUCK" | "NEEDS_FEEDBACK" | "DEFERRED" | "READY_FOR_NEXT_STEP";
  workbenchStateLabel: string;
  trackIntent?: {
    summary: string;
    whyNow: string | null;
  } | null;
  activeNextStep?: {
    id: string;
    text: string;
    reason: string | null;
    status: "ACTIVE" | "DONE" | "CANCELED";
    source: RecommendationSource;
    origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
  } | null;
  nextSteps: Array<{
    id: string;
    text: string;
    reason: string | null;
    status: "ACTIVE" | "DONE" | "CANCELED";
    source: RecommendationSource;
    origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
    completedAt: string | null;
    canceledAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  latestWrapUp?: {
    id: string;
    trackId: string;
    endState: string;
    endStateLabel: string;
    whatChanged: string;
    whatNotWorking: string | null;
    nextStep?: {
      id: string;
      text: string;
      reason: string | null;
      status: string;
      source: RecommendationSource;
      origin: "SONG_DETAIL" | "MORNING_FOCUS" | "WRAP_UP";
    } | null;
  } | null;
  feedbackSummary: TrackFeedbackSummary;
  identityBridge: TrackIdentityBridge;
  demos: Demo[];
};

type ReflectionDraft = {
  whyMade: string;
  whatChanged: string;
  whatNotWorking: string;
};

type SongPathStepType = DemoVersionType | "RELEASE";

type SongPathStepView = {
  versionType: SongPathStepType;
  label: string;
  stageName: string | null;
  demos: Demo[];
};

type DistributionFormState = TrackDistributionRequestPayload;
type FeedbackRequestType = "TEXT" | "DEMO" | "ARRANGEMENT" | "GENERAL_IMPRESSION";
type FeedbackRequestStatus = "PENDING" | "RECEIVED" | "REVIEWED";
type FeedbackRecipientMode = "INTERNAL_USER" | "EXTERNAL_CONTACT" | "COMMUNITY";
type FeedbackItemCategory = "WHAT_WORKS" | "NOT_READING" | "SAGS" | "WANT_TO_HEAR_NEXT";
type FeedbackResolutionStatus = "ACCEPTED" | "REJECTED" | "NEXT_VERSION";
type ArtistSupportNeedType = "FEEDBACK" | "ACCOUNTABILITY" | "CREATIVE_DIRECTION" | "COLLABORATION";

type TrackFeedbackSummary = {
  latestStatus: FeedbackRequestStatus | null;
  latestStatusLabel: string | null;
  openRequestCount: number;
  pendingRequestCount: number;
  unresolvedItemsCount: number;
  nextVersionItemsCount: number;
  latestReceivedAt: string | null;
  latestReviewedAt: string | null;
};

type FeedbackDemoRef = {
  id: string;
  versionType: DemoVersionType;
  createdAt: string;
  releaseDate: string | null;
};

type FeedbackResolution = {
  id: string;
  status: FeedbackResolutionStatus;
  statusLabel: string;
  note: string | null;
  resolvedAt: string;
  createdAt: string;
  updatedAt: string;
  targetDemo: FeedbackDemoRef | null;
};

type FeedbackItem = {
  id: string;
  category: FeedbackItemCategory;
  categoryLabel: string;
  body: string;
  source: string;
  author?: {
    userId: string;
    safeId: string;
    nickname: string;
  } | null;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
  resolution: FeedbackResolution | null;
};

type FeedbackRequest = {
  id: string;
  trackId: string;
  demoId: string | null;
  type: FeedbackRequestType;
  typeLabel: string;
  status: FeedbackRequestStatus;
  statusLabel: string;
  recipient: {
    mode: FeedbackRecipientMode;
    label: string;
    safeId: string | null;
    nickname: string | null;
    channel: string | null;
    contact: string | null;
  };
  requestMessage: string | null;
  lyricsSnapshot: string | null;
  sentAt: string;
  receivedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  demoRef: FeedbackDemoRef | null;
  community?: {
    postId: string;
    threadId: string;
    postKind: "FEEDBACK_REQUEST";
    title: string | null;
    helpfulActionPrompt: string | null;
    supportNeedTypes: ArtistSupportNeedType[];
    status: "OPEN" | "CLOSED" | "ARCHIVED";
    replyCount: number;
  } | null;
  items: FeedbackItem[];
  counts: {
    totalItems: number;
    resolvedItems: number;
    nextVersionItems: number;
  };
};

type FeedbackResponseDraft = {
  whatWorks: string;
  notReading: string;
  sags: string;
  wantToHearNext: string;
};

const versionTypeLabels: Record<DemoVersionType, string> = {
  IDEA_TEXT: "Идея",
  DEMO: "Демо",
  ARRANGEMENT: "Продакшн",
  NO_MIX: "Запись без сведения",
  MIXED: "С сведением",
  MASTERED: "С мастерингом",
  RELEASE: "Релиз"
};

const pathVersionOrder: DemoVersionType[] = ["IDEA_TEXT", "DEMO", "ARRANGEMENT", "NO_MIX", "MIXED", "MASTERED"];
const feedbackTypeOptions: Array<{ value: FeedbackRequestType; label: string }> = [
  { value: "TEXT", label: "По тексту" },
  { value: "DEMO", label: "По демо" },
  { value: "ARRANGEMENT", label: "По аранжировке" },
  { value: "GENERAL_IMPRESSION", label: "По общему впечатлению" }
];
const feedbackCategoryOrder: FeedbackItemCategory[] = [
  "WHAT_WORKS",
  "NOT_READING",
  "SAGS",
  "WANT_TO_HEAR_NEXT"
];
const supportNeedTypeLabels: Record<ArtistSupportNeedType, string> = {
  FEEDBACK: "Нужен фидбек",
  ACCOUNTABILITY: "Нужна поддержка",
  CREATIVE_DIRECTION: "Нужен direction",
  COLLABORATION: "Ищу коллаб"
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

function workbenchBadgeClass(state: Track["workbenchState"]) {
  switch (state) {
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

function feedbackStatusBadgeClass(status: FeedbackRequestStatus) {
  switch (status) {
    case "PENDING":
      return "border-sky-300/70 bg-sky-50 text-sky-900";
    case "RECEIVED":
      return "border-amber-300/70 bg-amber-50 text-amber-900";
    case "REVIEWED":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
    default:
      return "border-brand-border bg-white text-brand-ink";
  }
}

function feedbackResolutionBadgeClass(status: FeedbackResolutionStatus) {
  switch (status) {
    case "ACCEPTED":
      return "border-emerald-300/70 bg-emerald-50 text-emerald-900";
    case "REJECTED":
      return "border-stone-300/70 bg-stone-100 text-stone-700";
    case "NEXT_VERSION":
      return "border-sky-300/70 bg-sky-50 text-sky-900";
    default:
      return "border-brand-border bg-white text-brand-ink";
  }
}

function identityBridgeBadgeClass(status: IdentityBridgeStatus) {
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

function identityBridgeLabel(status: IdentityBridgeStatus) {
  switch (status) {
    case "STRONG":
      return "Сильная связь";
    case "PARTIAL":
      return "Частичная связь";
    case "WEAK":
      return "Слабая связь";
    default:
      return "Связь не собрана";
  }
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

function emptyDistributionForm(): DistributionFormState {
  return {
    masterDemoId: "",
    artistName: "",
    releaseTitle: "",
    releaseDate: "",
    genre: "",
    explicitContent: "NO",
    usesAi: "NO",
    promoPitchText: "",
    managerHelpRequested: false,
    distributor: "ONE_RPM",
    distributorOtherName: ""
  };
}

function emptyFeedbackResponseDraft(): FeedbackResponseDraft {
  return {
    whatWorks: "",
    notReading: "",
    sags: "",
    wantToHearNext: ""
  };
}

function splitFeedbackLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function SongDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const { data: track, refetch } = useQuery({
    queryKey: ["song-track", params.id],
    queryFn: () => fetcher<Track>(`/api/songs/${params.id}`)
  });
  const { data: distributionRequest, refetch: refetchDistributionRequest } = useQuery({
    queryKey: ["song-distribution-request", params.id],
    queryFn: () => fetcher<TrackDistributionRequestDto | null>(`/api/songs/${params.id}/distribution-request`)
  });
  const { data: feedbackData, refetch: refetchFeedback } = useQuery({
    queryKey: ["song-track-feedback", params.id],
    queryFn: () => fetcher<{ items: FeedbackRequest[] }>(`/api/songs/${params.id}/feedback-requests`)
  });
  const { data: stages } = useQuery({
    queryKey: ["song-track-stages"],
    queryFn: () => fetcher<PathStage[]>("/api/songs/stages")
  });
  const visibleStages = useMemo(() => (stages ?? []).filter((stage) => !isPromoStage(stage.name)), [stages]);

  const [title, setTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [workbenchState, setWorkbenchState] = useState<Track["workbenchState"]>("IN_PROGRESS");
  const [intentSummary, setIntentSummary] = useState("");
  const [intentWhyNow, setIntentWhyNow] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [deletingTrack, setDeletingTrack] = useState(false);
  const [pageError, setPageError] = useState("");
  const [showTrackActionsMenu, setShowTrackActionsMenu] = useState(false);
  const [showEditTrackModal, setShowEditTrackModal] = useState(false);
  const [showAddVersionModal, setShowAddVersionModal] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [showCreateFeedbackModal, setShowCreateFeedbackModal] = useState(false);
  const [showAddVersionQuickActions, setShowAddVersionQuickActions] = useState(false);
  const [distributionForm, setDistributionForm] = useState<DistributionFormState>(() => emptyDistributionForm());
  const [distributionError, setDistributionError] = useState("");
  const [submittingDistribution, setSubmittingDistribution] = useState(false);
  const [feedbackRequestType, setFeedbackRequestType] = useState<FeedbackRequestType>("DEMO");
  const [feedbackRecipientMode, setFeedbackRecipientMode] = useState<FeedbackRecipientMode>("EXTERNAL_CONTACT");
  const [feedbackRecipientSafeId, setFeedbackRecipientSafeId] = useState("");
  const [feedbackRecipientLabel, setFeedbackRecipientLabel] = useState("");
  const [feedbackRecipientChannel, setFeedbackRecipientChannel] = useState("");
  const [feedbackRecipientContact, setFeedbackRecipientContact] = useState("");
  const [feedbackCommunityTitle, setFeedbackCommunityTitle] = useState("");
  const [feedbackCommunityHelpfulActionPrompt, setFeedbackCommunityHelpfulActionPrompt] = useState("");
  const [feedbackSupportNeedTypes, setFeedbackSupportNeedTypes] = useState<ArtistSupportNeedType[]>(["FEEDBACK"]);
  const [feedbackRequestMessage, setFeedbackRequestMessage] = useState("");
  const [feedbackRequestDemoId, setFeedbackRequestDemoId] = useState("");
  const [creatingFeedbackRequest, setCreatingFeedbackRequest] = useState(false);
  const [feedbackRequestError, setFeedbackRequestError] = useState("");
  const [expandedFeedbackRequests, setExpandedFeedbackRequests] = useState<Record<string, boolean>>({});
  const [responseModalRequestId, setResponseModalRequestId] = useState("");
  const [feedbackResponseDrafts, setFeedbackResponseDrafts] = useState<Record<string, FeedbackResponseDraft>>({});
  const [submittingFeedbackResponseId, setSubmittingFeedbackResponseId] = useState("");
  const [feedbackResolutionNotes, setFeedbackResolutionNotes] = useState<Record<string, string>>({});
  const [resolvingFeedbackItemId, setResolvingFeedbackItemId] = useState("");

  const [newVersionType, setNewVersionType] = useState<DemoVersionType>("DEMO");
  const [newVersionMode, setNewVersionMode] = useState<"upload" | "record">("upload");
  const [newVersionText, setNewVersionText] = useState("");
  const [newVersionWhyMade, setNewVersionWhyMade] = useState("");
  const [newVersionWhatChanged, setNewVersionWhatChanged] = useState("");
  const [newVersionWhatNotWorking, setNewVersionWhatNotWorking] = useState("");
  const [selectedFeedbackItemIdsForVersion, setSelectedFeedbackItemIdsForVersion] = useState<string[]>([]);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newReleaseDate, setNewReleaseDate] = useState("");
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsText, setLyricsText] = useState("");
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [syncingStatus, setSyncingStatus] = useState(false);
  const [recordedMix, setRecordedMix] = useState<{ blob: Blob; durationSec: number; filename: string } | null>(null);
  const [recorderResetKey, setRecorderResetKey] = useState(0);

  const [updatingDemoId, setUpdatingDemoId] = useState("");
  const [demoReflectionDrafts, setDemoReflectionDrafts] = useState<Record<string, ReflectionDraft>>({});
  const [editingReflectionId, setEditingReflectionId] = useState("");
  const [savingPrimaryDemoId, setSavingPrimaryDemoId] = useState("");
  const [reorderingStepVersionType, setReorderingStepVersionType] = useState<DemoVersionType | "">("");
  const [moveTrackPrompt, setMoveTrackPrompt] = useState<{ total: number; currentIndex: number; value: string } | null>(null);
  const [movingTrackInProject, setMovingTrackInProject] = useState(false);
  const [nextStepTitle, setNextStepTitle] = useState("");
  const [nextStepDetail, setNextStepDetail] = useState("");
  const [savingNextStep, setSavingNextStep] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const playback = useSongsPlayback();

  function buildTrackNextStepRecommendation(step: NonNullable<Track["activeNextStep"]>) {
    return buildRecommendationCard({
      key: `songs:next-step:${step.id}`,
      surface: "SONGS",
      kind: "NEXT_STEP",
      source: step.source,
      title: "Следующий шаг",
      text: step.text,
      reason: step.reason,
      primaryAction: null,
      secondaryActions: [],
      entityRef: {
        type: "track_next_step",
        id: step.id
      },
      futureAiSlotKey: step.id
    });
  }

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
    setWorkbenchState(track?.workbenchState ?? "IN_PROGRESS");
    setIntentSummary(track?.trackIntent?.summary ?? "");
    setIntentWhyNow(track?.trackIntent?.whyNow ?? "");
    setNextStepTitle(track?.activeNextStep?.text ?? "");
    setNextStepDetail(track?.activeNextStep?.reason ?? "");
  }, [track?.activeNextStep?.reason, track?.activeNextStep?.text, track?.trackIntent?.summary, track?.trackIntent?.whyNow, track?.workbenchState]);

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
    if (!showEditTrackModal && !showAddVersionModal && !showDistributionModal) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowEditTrackModal(false);
        setShowAddVersionModal(false);
        setShowDistributionModal(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddVersionModal, showDistributionModal, showEditTrackModal]);

  useEffect(() => {
    if (!showAddVersionModal) return;
    if (newVersionType !== "RELEASE") return;
    setNewReleaseDate((prev) => prev || distributionRequest?.releaseDate || "");
  }, [distributionRequest?.releaseDate, newVersionType, showAddVersionModal]);

  const trackDemos = useMemo(() => track?.demos ?? [], [track?.demos]);
  const feedbackRequests = useMemo(() => feedbackData?.items ?? [], [feedbackData?.items]);
  const parentProject = track?.project ?? null;
  const isSingleProject = parentProject?.releaseKind === "SINGLE";
  const backHref = parentProject
    ? parentProject.releaseKind === "SINGLE"
      ? parentProject.folderId
        ? `/songs/folders/${parentProject.folderId}`
        : "/songs"
      : `/songs/projects/${parentProject.id}`
    : "/songs";
  const latestVersion = trackDemos[0] ?? null;
  const latestMasteredDemo = useMemo(
    () => trackDemos.find((demo) => demo.versionType === "MASTERED") ?? null,
    [trackDemos]
  );
  const existingReleaseDemo = useMemo(
    () => trackDemos.find((demo) => demo.versionType === "RELEASE") ?? null,
    [trackDemos]
  );
  const hasReleaseDemo = Boolean(existingReleaseDemo);
  const hasMasteredVersion = Boolean(latestMasteredDemo);
  const feedbackSelectableDemos = useMemo(
    () => trackDemos.filter((demo) => demo.versionType !== "IDEA_TEXT"),
    [trackDemos]
  );
  useEffect(() => {
    if (feedbackRequestType === "TEXT") {
      setFeedbackRequestDemoId("");
      return;
    }

    if (feedbackSelectableDemos.some((demo) => demo.id === feedbackRequestDemoId)) return;
    setFeedbackRequestDemoId(feedbackSelectableDemos[0]?.id ?? "");
  }, [feedbackRequestDemoId, feedbackRequestType, feedbackSelectableDemos]);
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
      visibleStages.find((stage) => {
        const stageName = normalizeStageName(stage.name);
        return (
          stageName.includes("релиз") ||
          stageName.includes("дистр") ||
          stageName.includes("наслед") ||
          stageName.includes("культурн") ||
          stageName.includes("влияни")
        );
      })?.name ?? "Релиз / дистрибуция";
    return [
      ...versionsByPathStep,
      {
        versionType: "RELEASE",
        label: "Релиз",
        stageName: releaseStage,
        demos: trackDemos
          .filter((demo) => demo.versionType === "RELEASE")
          .sort((a, b) => {
            const aSort = typeof a.sortIndex === "number" ? a.sortIndex : Number.MAX_SAFE_INTEGER;
            const bSort = typeof b.sortIndex === "number" ? b.sortIndex : Number.MAX_SAFE_INTEGER;
            if (aSort !== bSort) return aSort - bSort;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
      }
    ];
  }, [trackDemos, versionsByPathStep, visibleStages]);
  const responseModalRequest = useMemo(
    () => feedbackRequests.find((item) => item.id === responseModalRequestId) ?? null,
    [feedbackRequests, responseModalRequestId]
  );
  const pendingNextVersionItems = useMemo(
    () =>
      feedbackRequests.flatMap((request) =>
        request.items
          .filter((item) => item.resolution?.status === "NEXT_VERSION" && !item.resolution.targetDemo)
          .map((item) => ({
            requestId: request.id,
            requestStatus: request.status,
            requestTypeLabel: request.typeLabel,
            item
          }))
      ),
    [feedbackRequests]
  );
  const demoPlaybackItem = useCallback(
    (demo: Demo) => {
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
    },
    [parentProject, track]
  );
  const songPlaybackQueue = useMemo(() => {
    if (!track) return [] as NonNullable<ReturnType<typeof demoPlaybackItem>>[];
    const items: NonNullable<ReturnType<typeof demoPlaybackItem>>[] = [];
    for (const demo of versionsByPathStep.flatMap((step) => step.demos)) {
      const item = demoPlaybackItem(demo);
      if (item) items.push(item);
    }
    return items;
  }, [demoPlaybackItem, track, versionsByPathStep]);

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
    setNewVersionWhyMade("");
    setNewVersionWhatChanged("");
    setNewVersionWhatNotWorking("");
    setSelectedFeedbackItemIdsForVersion([]);
    setNewVersionFile(null);
    setNewReleaseDate("");
    setVersionError("");
    setRecordedMix(null);
    setRecorderResetKey((prev) => prev + 1);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetFeedbackRequestForm() {
    setFeedbackRequestType("DEMO");
    setFeedbackRecipientMode("EXTERNAL_CONTACT");
    setFeedbackRecipientSafeId("");
    setFeedbackRecipientLabel("");
    setFeedbackRecipientChannel("");
    setFeedbackRecipientContact("");
    setFeedbackCommunityTitle("");
    setFeedbackCommunityHelpfulActionPrompt("");
    setFeedbackSupportNeedTypes(["FEEDBACK"]);
    setFeedbackRequestMessage("");
    setFeedbackRequestDemoId("");
    setFeedbackRequestError("");
  }

  function openCreateFeedbackModal(options?: { type?: FeedbackRequestType; demoId?: string }) {
    resetFeedbackRequestForm();

    if (options?.type === "TEXT") {
      setFeedbackRequestType("TEXT");
      setFeedbackRequestDemoId("");
    } else {
      setFeedbackRequestType(options?.type ?? "DEMO");
      setFeedbackRequestDemoId(options?.demoId ?? "");
    }

    setShowCreateFeedbackModal(true);
  }

  function getReflectionDraft(demo: Demo): ReflectionDraft {
    return (
      demoReflectionDrafts[demo.id] ?? {
        whyMade: demo.versionReflection?.whyMade ?? "",
        whatChanged: demo.versionReflection?.whatChanged ?? "",
        whatNotWorking: demo.versionReflection?.whatNotWorking ?? ""
      }
    );
  }

  function getFeedbackResponseDraft(requestId: string): FeedbackResponseDraft {
    return feedbackResponseDrafts[requestId] ?? emptyFeedbackResponseDraft();
  }

  function openFeedbackResponseModal(requestId: string) {
    setFeedbackResponseDrafts((prev) => ({
      ...prev,
      [requestId]: prev[requestId] ?? emptyFeedbackResponseDraft()
    }));
    setResponseModalRequestId(requestId);
  }

  async function submitFeedbackRequest() {
    setCreatingFeedbackRequest(true);
    setFeedbackRequestError("");
    try {
      const payload = {
        type: feedbackRequestType,
        demoId: feedbackRequestType === "TEXT" ? undefined : feedbackRequestDemoId || undefined,
        recipientMode: feedbackRecipientMode,
        recipientSafeId: feedbackRecipientMode === "INTERNAL_USER" ? feedbackRecipientSafeId.trim() || undefined : undefined,
        recipientLabel: feedbackRecipientMode === "EXTERNAL_CONTACT" ? feedbackRecipientLabel.trim() || undefined : undefined,
        recipientChannel: feedbackRecipientMode === "EXTERNAL_CONTACT" ? feedbackRecipientChannel.trim() || null : null,
        recipientContact: feedbackRecipientMode === "EXTERNAL_CONTACT" ? feedbackRecipientContact.trim() || null : null,
        requestMessage: feedbackRequestMessage.trim() || null,
        communityTitle: feedbackRecipientMode === "COMMUNITY" ? feedbackCommunityTitle.trim() || undefined : undefined,
        communityHelpfulActionPrompt:
          feedbackRecipientMode === "COMMUNITY" ? feedbackCommunityHelpfulActionPrompt.trim() || null : null,
        supportNeedTypes: feedbackRecipientMode === "COMMUNITY" ? feedbackSupportNeedTypes : undefined
      };

      const response = await apiFetch(`/api/songs/${currentTrackId}/feedback-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось создать запрос на фидбек.");
      }

      await Promise.all([refetch(), refetchFeedback()]);
      resetFeedbackRequestForm();
      setShowCreateFeedbackModal(false);
      toast.success("Запрос на фидбек сохранён.");
    } catch (error) {
      setFeedbackRequestError(error instanceof Error ? error.message : "Не удалось создать запрос на фидбек.");
    } finally {
      setCreatingFeedbackRequest(false);
    }
  }

  async function submitFeedbackResponse(requestId: string) {
    const draft = getFeedbackResponseDraft(requestId);

    setSubmittingFeedbackResponseId(requestId);
    setPageError("");
    try {
      const response = await apiFetch(`/api/songs/${currentTrackId}/feedback-requests/${requestId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: {
            whatWorks: splitFeedbackLines(draft.whatWorks),
            notReading: splitFeedbackLines(draft.notReading),
            sags: splitFeedbackLines(draft.sags),
            wantToHearNext: splitFeedbackLines(draft.wantToHearNext)
          }
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось сохранить ответ на фидбек.");
      }

      await Promise.all([refetch(), refetchFeedback()]);
      setFeedbackResponseDrafts((prev) => ({ ...prev, [requestId]: emptyFeedbackResponseDraft() }));
      setExpandedFeedbackRequests((prev) => ({ ...prev, [requestId]: true }));
      setResponseModalRequestId("");
      toast.success("Ответ на фидбек сохранён.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось сохранить ответ на фидбек.");
    } finally {
      setSubmittingFeedbackResponseId("");
    }
  }

  async function resolveFeedbackItem(itemId: string, status: FeedbackResolutionStatus) {
    setResolvingFeedbackItemId(itemId);
    setPageError("");
    try {
      const note = feedbackResolutionNotes[itemId]?.trim() || null;
      const response = await apiFetch(`/api/songs/${currentTrackId}/feedback-items/${itemId}/resolution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note,
          targetDemoId: null
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось сохранить решение по фидбеку.");
      }

      await Promise.all([refetch(), refetchFeedback()]);
      toast.success("Решение по фидбеку сохранено.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось сохранить решение по фидбеку.");
    } finally {
      setResolvingFeedbackItemId("");
    }
  }

  async function saveTrackNextStep() {
    const trimmedTitle = nextStepTitle.trim();
    if (!trimmedTitle) {
      setPageError("Укажи следующий шаг по треку.");
      return;
    }

    setSavingNextStep(true);
    setPageError("");
    try {
      const response = await apiFetch(`/api/songs/${currentTrackId}/next-steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmedTitle,
          reason: nextStepDetail.trim() || null,
          replaceCurrent: true
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось сохранить следующий шаг.");
      }
      await refetch();
      toast.success("Следующий шаг обновлён.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось сохранить следующий шаг.");
    } finally {
      setSavingNextStep(false);
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

  function openDistributionModal() {
    if (!latestMasteredDemo) {
      setPageError("Сначала загрузи хотя бы одну версию с мастерингом.");
      return;
    }

    setPageError("");
    setDistributionError("");
    setDistributionForm({
      masterDemoId: latestMasteredDemo.id,
      artistName: distributionRequest?.artistName ?? parentProject?.artistLabel ?? "",
      releaseTitle: distributionRequest?.releaseTitle ?? track?.title ?? "",
      releaseDate: distributionRequest?.releaseDate ?? "",
      genre: distributionRequest?.genre ?? "",
      explicitContent: (distributionRequest?.explicitContent ?? "NO") as DistributionYesNoValue,
      usesAi: (distributionRequest?.usesAi ?? "NO") as DistributionYesNoValue,
      promoPitchText: distributionRequest?.promoPitchText ?? "",
      managerHelpRequested: distributionRequest?.managerHelpRequested ?? false,
      distributor: (distributionRequest?.distributor ?? "ONE_RPM") as DistributionDistributorValue,
      distributorOtherName: distributionRequest?.distributorOtherName ?? ""
    });
    setShowDistributionModal(true);
  }

  async function submitDistributionRequest() {
    if (!latestMasteredDemo) {
      setDistributionError("Выбранная мастер-версия больше недоступна.");
      return;
    }

    const artistName = distributionForm.artistName.trim();
    const releaseTitle = distributionForm.releaseTitle.trim();
    const releaseDate = distributionForm.releaseDate.trim();
    const genre = distributionForm.genre.trim();
    const promoPitchText = distributionForm.promoPitchText?.trim() ?? "";
    const distributorOtherName = distributionForm.distributorOtherName?.trim() ?? "";

    if (!artistName) {
      setDistributionError("Укажи псевдоним артиста.");
      return;
    }
    if (!releaseTitle) {
      setDistributionError("Укажи название релиза.");
      return;
    }
    if (!releaseDate) {
      setDistributionError("Укажи желаемую дату релиза.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) || Number.isNaN(new Date(`${releaseDate}T00:00:00.000Z`).getTime())) {
      setDistributionError("Дата релиза должна быть в формате ГГГГ-ММ-ДД.");
      return;
    }
    if (!genre) {
      setDistributionError("Укажи жанр.");
      return;
    }
    if (!distributionForm.managerHelpRequested && !promoPitchText) {
      setDistributionError("Добавь промо-текст для питчинга или попроси помощи менеджера.");
      return;
    }
    if (distributionForm.distributor === "OTHER" && !distributorOtherName) {
      setDistributionError("Укажи название дистрибьютора.");
      return;
    }

    setSubmittingDistribution(true);
    setDistributionError("");
    try {
      const payload: TrackDistributionRequestPayload = {
        masterDemoId: latestMasteredDemo.id,
        artistName,
        releaseTitle,
        releaseDate,
        genre,
        explicitContent: distributionForm.explicitContent,
        usesAi: distributionForm.usesAi,
        promoPitchText: promoPitchText || null,
        managerHelpRequested: distributionForm.managerHelpRequested,
        distributor: distributionForm.distributor,
        distributorOtherName: distributionForm.distributor === "OTHER" ? distributorOtherName || null : null
      };

      const response = await apiFetch(`/api/songs/${currentTrackId}/distribution-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Не удалось отправить заявку на дистрибьюцию.");
      }

      await Promise.all([refetch(), refetchDistributionRequest()]);
      setShowDistributionModal(false);
    } catch (error) {
      setDistributionError(error instanceof Error ? error.message : "Не удалось отправить заявку на дистрибьюцию.");
    } finally {
      setSubmittingDistribution(false);
    }
  }

  async function createVersion() {
    setCreatingVersion(true);
    setVersionError("");
    try {
      if (newVersionType === "RELEASE") {
        if (hasReleaseDemo) {
          setVersionError("Для этого трека уже добавлена релизная версия.");
          return;
        }
        if (!newReleaseDate.trim()) {
          setVersionError("Для релизной версии укажи дату релиза.");
          return;
        }
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(newReleaseDate.trim()) ||
          Number.isNaN(new Date(`${newReleaseDate.trim()}T00:00:00.000Z`).getTime())
        ) {
          setVersionError("Дата релиза должна быть в формате ГГГГ-ММ-ДД.");
          return;
        }
      }

      const mappedStageId = findStageIdByVersionType(visibleStages, newVersionType);
      if (newVersionType !== "RELEASE" && mappedStageId !== null && mappedStageId !== currentTrackStageId) {
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
          setVersionError("Для типа «Идея» добавь текст песни.");
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

      const analysis = await detectAudioAnalysisMvp(fileToUpload);
      const formData = new FormData();
      formData.append("file", fileToUpload, filename);
      formData.append("durationSec", String(durationSec));
      formData.append("trackId", currentTrackId);
      formData.append("noteText", newVersionWhatChanged.trim());
      formData.append("reflectionWhyMade", newVersionWhyMade.trim());
      formData.append("reflectionWhatChanged", newVersionWhatChanged.trim());
      formData.append("reflectionWhatNotWorking", newVersionWhatNotWorking.trim());
      formData.append("versionType", newVersionType);
      for (const feedbackItemId of selectedFeedbackItemIdsForVersion) {
        formData.append("feedbackItemIds", feedbackItemId);
      }
      if (newVersionType === "RELEASE") {
        formData.append("releaseDate", newReleaseDate.trim());
      }
      appendAudioAnalysisToFormData(formData, analysis);

      const uploadResponse = await apiFetch("/api/audio-clips", { method: "POST", body: formData });
      if (!uploadResponse.ok) {
        const payload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось добавить файл к треку.");
      }
      await Promise.all([refetch(), refetchFeedback()]);
      resetNewVersionForm();
      setShowAddVersionModal(false);
    } catch (error) {
      setVersionError(error instanceof Error ? error.message : "Не удалось добавить версию.");
    } finally {
      setSyncingStatus(false);
      setCreatingVersion(false);
    }
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
    if (parentProject.releaseKind === "SINGLE") {
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
      setMoveTrackPrompt({
        total: orderedTracks.length,
        currentIndex,
        value: String(currentIndex + 1)
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось переместить трек.");
    }
  }

  async function submitMoveCurrentTrackInProject() {
    if (!parentProject || !moveTrackPrompt) return;
    const rawPosition = moveTrackPrompt.value.trim();
    const nextIndex = Number.parseInt(rawPosition, 10) - 1;
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= moveTrackPrompt.total) {
      setPageError(`Введите номер позиции от 1 до ${moveTrackPrompt.total}.`);
      return;
    }
    if (nextIndex === moveTrackPrompt.currentIndex) {
      setMoveTrackPrompt(null);
      return;
    }

    setMovingTrackInProject(true);
    setPageError("");
    try {
      const projectDetail = await apiFetchJson<ProjectTrackOrderPayload>(`/api/projects/${parentProject.id}`);
      const orderedTracks = projectDetail.tracks ?? [];
      const currentIndex = orderedTracks.findIndex((item) => item.id === currentTrackId);
      if (currentIndex < 0 || orderedTracks.length < 2) {
        setMoveTrackPrompt(null);
        return;
      }

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
      setMoveTrackPrompt(null);
      toast.success("Позиция трека обновлена.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Не удалось переместить трек.");
    } finally {
      setMovingTrackInProject(false);
    }
  }

  const hasOpenOverlay =
    showEditTrackModal ||
    showAddVersionModal ||
    showDistributionModal ||
    showCreateFeedbackModal ||
    Boolean(responseModalRequestId);

  return (
    <div className="relative pb-40">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(217,249,157,0.14),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.06),transparent_45%)]" />
      <div className={`relative ${hasOpenOverlay ? "z-[90]" : "z-10"} mx-auto w-full max-w-7xl px-4 py-5 md:px-6`}>
        <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden rounded-[30px] border border-brand-border bg-gradient-to-br from-[#edf4e4] via-[#e8f0de] to-[#e2ead7] p-4 text-brand-ink shadow-[0_24px_55px_rgba(61,84,46,0.16)] md:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.45),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(255,255,255,0.18),transparent_45%)]" />
          <div className="pointer-events-none absolute -right-20 top-10 h-44 w-44 rounded-full bg-[#a4c286]/25 blur-3xl" />

          <div className="relative mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href={backHref}>
                <Button
                  variant="secondary"
                  className="h-11 w-11 rounded-2xl border-brand-border bg-white/85 p-0 text-brand-ink shadow-sm hover:bg-white"
                  aria-label="Назад"
                  title="Назад"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="secondary"
                className="h-11 w-11 rounded-2xl border-brand-border bg-white/85 p-0 text-brand-ink shadow-sm hover:bg-white"
                onClick={() => refetch()}
                aria-label="Обновить"
                title="Обновить"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Button
                variant="secondary"
                className="h-11 w-11 rounded-2xl border-brand-border bg-white/85 p-0 text-brand-ink shadow-sm hover:bg-white"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowTrackActionsMenu((prev) => !prev);
                }}
                aria-label="Действия трека"
                title="Действия трека"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {showTrackActionsMenu && (
                <div
                  className="absolute right-0 top-12 z-20 min-w-[200px] rounded-2xl border border-brand-border bg-[#f7fbf2] p-2 shadow-[0_20px_40px_rgba(61,84,46,0.14)]"
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
                      Экспорт аудио
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="block w-full cursor-not-allowed rounded-xl px-3 py-2 text-left text-sm text-brand-muted/60"
                    >
                      Экспорт аудио
                    </button>
                  )}
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-brand-ink hover:bg-black/5 disabled:cursor-not-allowed disabled:text-brand-muted/60 disabled:hover:bg-transparent"
                    title={isSingleProject ? "Недоступно для сингла" : undefined}
                    onClick={() => void moveCurrentTrackInProject()}
                    disabled={!parentProject || isSingleProject}
                  >
                    Переместить
                  </button>
                  <div className="my-1 h-px bg-black/5" />
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-[#ffe7e1]"
                    onClick={deleteCurrentTrack}
                  >
                    Удалить трек
                  </button>
                </div>
              )}
            </div>
          </div>

          {pageError && (
            <div className="relative mb-4 rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a] shadow-sm">
              {pageError}
            </div>
          )}

          <section className={`relative mb-6 overflow-hidden rounded-[28px] border border-brand-border p-4 shadow-sm md:p-5 ${isSingleProject ? "bg-white/90" : "bg-white/82"}`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(217,249,157,0.2),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.05),transparent_42%)]" />
            <div className="relative grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="bg-white">
                      <Sparkles className="mr-1 h-3 w-3" />
                      {isSingleProject ? "Версии сингла" : "Путь песни"}
                    </Badge>
                    {isSingleProject ? <Badge className="bg-white">Сингл</Badge> : null}
                    <Badge className="bg-white">
                      <AudioLines className="mr-1 h-3 w-3" />
                      {track.demos.length} верс.
                    </Badge>
                    {parentProject?.folder?.title ? (
                      <Badge className="bg-white">
                        <FolderOpen className="mr-1 h-3 w-3" />
                        {parentProject.folder.title}
                      </Badge>
                    ) : null}
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">{track.title}</h1>
                  <p className="mt-1 text-sm text-brand-muted">
                    {parentProject?.title || "Без проекта"} • {latestVersion ? `последняя ${formatWhen(latestVersion.createdAt)}` : "без аудио-версий"}
                  </p>
                  {isSingleProject && parentProject ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[112px_1fr]">
                      <div
                        className="h-28 w-28 overflow-hidden rounded-2xl border border-brand-border shadow-sm"
                        style={buildProjectCoverStyle({
                          releaseKind: "SINGLE",
                          coverType: parentProject.coverType,
                          coverImageUrl: parentProject.coverImageUrl,
                          coverPresetKey: parentProject.coverPresetKey,
                          coverColorA: parentProject.coverColorA,
                          coverColorB: parentProject.coverColorB
                        })}
                      />
                      <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Обложка сингла</p>
                        <p className="mt-1 text-sm font-medium text-brand-ink">{parentProject.title}</p>
                        <p className="mt-1 text-xs text-brand-muted">
                          Этот экран открыт в режиме сингла и ведет напрямую к версиям трека.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${workbenchBadgeClass(track.workbenchState)}`}>
                      {track.workbenchStateLabel}
                    </span>
                    {track.feedbackSummary.latestStatus && track.feedbackSummary.latestStatusLabel ? (
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${feedbackStatusBadgeClass(
                          track.feedbackSummary.latestStatus
                        )}`}
                      >
                        {track.feedbackSummary.latestStatusLabel}
                      </span>
                    ) : null}
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${identityBridgeBadgeClass(track.identityBridge.status)}`}>
                      {identityBridgeLabel(track.identityBridge.status)}
                    </span>
                    <span className="inline-flex rounded-full border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-muted">
                      PATH: {track.pathStage?.name || "Не выбран"}
                    </span>
                  </div>
                  {track.trackIntent?.summary ? (
                    <div className="mt-3 rounded-2xl border border-brand-border bg-white/80 p-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Intent</p>
                      <p className="mt-1 text-sm font-medium text-brand-ink">{track.trackIntent.summary}</p>
                      {track.trackIntent.whyNow ? <p className="mt-1 text-sm text-brand-muted">{track.trackIntent.whyNow}</p> : null}
                    </div>
                  ) : null}
                  {track.activeNextStep ? (
                    <RecommendationCard
                      className="mt-3 bg-[#f7fbf2]"
                      recommendation={buildTrackNextStepRecommendation(track.activeNextStep)}
                    />
                  ) : null}
                  <div className="mt-3 rounded-2xl border border-brand-border bg-[#eef5fb] p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Связь с миром артиста</p>
                      <Badge className={identityBridgeBadgeClass(track.identityBridge.status)}>
                        {identityBridgeLabel(track.identityBridge.status)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-brand-ink">{track.identityBridge.summary}</p>
                    {track.identityBridge.supports.find((item) => item.kind === "mission") ? (
                      <p className="mt-2 text-sm text-brand-muted">
                        Миссия: {track.identityBridge.supports.find((item) => item.kind === "mission")?.value}
                      </p>
                    ) : null}
                    {track.identityBridge.matches.coreThemes.length ? (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Темы</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {track.identityBridge.matches.coreThemes.map((item) => (
                            <Badge key={`theme:${item}`} className="border-brand-border bg-white text-brand-ink">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {track.identityBridge.matches.aestheticKeywords.length ? (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Эстетика</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {track.identityBridge.matches.aestheticKeywords.map((item) => (
                            <Badge key={`aesthetic:${item}`} className="border-brand-border bg-white text-brand-ink">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {track.identityBridge.matches.fashionSignals.length ? (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Fashion signals</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {track.identityBridge.matches.fashionSignals.map((item) => (
                            <Badge key={`fashion:${item}`} className="border-brand-border bg-white text-brand-ink">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {track.identityBridge.linkedGoals.length ? (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Связанные цели</p>
                        <div className="mt-2 space-y-2">
                          {track.identityBridge.linkedGoals.map((item) => (
                            <div key={item.taskId} className="rounded-2xl border border-brand-border bg-white/80 px-3 py-2 text-sm">
                              <p className="font-medium text-brand-ink">{item.goalTitle}</p>
                              <p className="mt-1 text-brand-muted">
                                {item.taskTitle}
                                {item.isPrimary ? " • primary goal" : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {track.identityBridge.warnings.length ? (
                      <div className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <p className="font-medium">{track.identityBridge.warnings[0].title}</p>
                        <p className="mt-1 text-amber-800">{track.identityBridge.warnings[0].message}</p>
                      </div>
                    ) : null}
                  </div>
                  <SongAnalysisBadges
                    bpm={track.displayBpm}
                    keyRoot={track.displayKeyRoot}
                    keyMode={track.displayKeyMode}
                    className="mt-2"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Проект</p>
                    <p className="mt-1 truncate text-sm font-medium text-brand-ink">{parentProject?.title || "Без проекта"}</p>
                  </div>
                  <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Workbench</p>
                    <p className="mt-1 truncate text-sm font-medium text-brand-ink">{track.workbenchStateLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Feedback</p>
                    <p className="mt-1 truncate text-sm font-medium text-brand-ink">
                      {track.feedbackSummary.latestStatusLabel ?? "Не запрошен"}
                    </p>
                    <p className="mt-1 text-xs text-brand-muted">
                      {track.feedbackSummary.unresolvedItemsCount > 0
                        ? `${track.feedbackSummary.unresolvedItemsCount} пунктов ждут разбора`
                        : "Без открытых пунктов"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Последняя активность</p>
                    <p className="mt-1 truncate text-sm font-medium text-brand-ink">
                      {latestVersion ? formatDate(latestVersion.createdAt) : "Нет версий"}
                    </p>
                  </div>
                </div>
              </div>

              {latestVersion ? (
                <div className={`relative overflow-hidden rounded-2xl border border-brand-border p-4 shadow-sm ${isSingleProject ? "bg-white" : "bg-white/78"}`}>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d9f99d] via-[#c8e2ab] to-transparent" />
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-brand-ink">Последняя версия</p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${versionBadgeClass(
                        latestVersion.versionType
                      )}`}
                    >
                      {versionTypeLabels[latestVersion.versionType]}
                    </span>
                  </div>
                  <p className="text-sm text-brand-ink">
                    {latestVersion.audioUrl ? fileNameFromPath(latestVersion.audioUrl) : "Текстовая версия"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                    <span>{formatDate(latestVersion.createdAt)}</span>
                    <span>•</span>
                    <span>{formatDuration(latestVersion.duration)}</span>
                  </div>
                  <SongAnalysisBadges
                    bpm={latestVersion.detectedBpm ?? track.displayBpm}
                    keyRoot={latestVersion.detectedKeyRoot ?? track.displayKeyRoot}
                    keyMode={latestVersion.detectedKeyMode ?? track.displayKeyMode}
                    compact
                    className="mt-2"
                  />
                  {latestVersion.audioUrl ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium shadow-sm hover:brightness-95"
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
                      <span>{playback.isPlayingDemo(latestVersion.id) ? "Пауза" : "Play latest"}</span>
                    </button>
                  ) : (
                    <p className="mt-3 text-sm text-brand-muted">Последняя версия без аудио.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-brand-border bg-white/70 p-4 text-sm text-brand-muted shadow-sm">
                  У трека пока нет версий. Начни с кнопки добавления версии ниже.
                </div>
              )}
	            </div>
	          </section>

	          <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
            <div className="min-w-0 space-y-6">
              {hasMasteredVersion && (
                <section className="relative overflow-hidden rounded-[24px] border border-brand-border bg-white/85 p-4 shadow-sm md:p-5">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.45),transparent_38%)]" />
                  <div className="relative space-y-3">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                        <Sparkles className="h-3.5 w-3.5 text-brand-ink" />
                        Distribution
                      </div>
                      <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Дистрибьюция</h2>
                      <p className="text-sm text-brand-muted">Финальная информация и промо для отправки релиза.</p>
                    </div>

                    <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Статус заявки</p>
                      <p className="mt-1 text-sm font-medium text-brand-ink">
                        {distributionRequest ? distributionRequestStatusLabel[distributionRequest.status] : "Не отправлено"}
                      </p>
                      {distributionRequest?.submittedAt ? (
                        <p className="mt-1 text-xs text-brand-muted">{formatDate(distributionRequest.submittedAt)}</p>
                      ) : null}
                    </div>

                    <Button className="w-full" onClick={openDistributionModal}>
                      Дистрибьюция
                    </Button>
                  </div>
                </section>
              )}

              <section className="relative overflow-hidden rounded-[24px] border border-brand-border bg-white/85 p-4 shadow-sm md:p-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.45),transparent_38%)]" />
                <div className="relative mb-3">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                    <PlusCircle className="h-3.5 w-3.5 text-brand-ink" />
                    Добавить версию
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Добавить версию</h2>
                  <p className="text-sm text-brand-muted">Запись, импорт или текстовый этап в одном месте.</p>
                </div>
                {showAddVersionQuickActions ? (
                  <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="h-11 rounded-2xl border-brand-border bg-white text-brand-ink shadow-sm hover:bg-white"
                    onClick={() => openAddVersionModal("convert")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                        <rect x="1.75" y="3" width="9.5" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M11.5 6.25 14 4.75v6.5l-2.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>Конвертировать</span>
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-11 rounded-2xl border-brand-border bg-white text-brand-ink shadow-sm hover:bg-white"
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
                    className="h-11 rounded-2xl shadow-sm"
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

	          <section id="track-versions-section" className={`relative min-w-0 overflow-hidden rounded-[24px] border border-brand-border p-4 shadow-sm md:p-5 ${isSingleProject ? "bg-white/92" : "bg-white/85"}`}>
	            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(217,249,157,0.2),transparent_35%),radial-gradient(circle_at_100%_100%,rgba(42,52,44,0.05),transparent_42%)]" />
	            <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
	              <div>
	                <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Versions</p>
	                <h2 className="text-xl font-semibold tracking-tight text-brand-ink">
                    {isSingleProject ? "Версии сингла" : "Путь песни"}
                  </h2>
	                <p className="text-sm text-brand-muted">
                    {isSingleProject ? "Все версии трека в режиме сингла с обложкой релиза." : "Таймлайн по этапам: от идеи до релиза."}
                  </p>
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
	                        className={`inline-flex shrink-0 snap-start items-center whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[11px] font-medium shadow-sm ${
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

	            <div className="relative space-y-4">
	              {songPathSteps.map((step, stepIndex) => {
	                const hasVersions = step.demos.length > 0;
	                const isLastStep = stepIndex === songPathSteps.length - 1;
	                return (
	                  <div
	                    key={step.versionType}
	                    className={`relative overflow-hidden rounded-2xl border p-3 shadow-sm md:p-4 ${
	                      hasVersions
	                        ? "border-brand-border bg-gradient-to-br from-white/90 to-[#f7fbf2]"
	                        : "border-brand-border/70 bg-white/60"
	                    }`}
	                  >
	                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d9f99d] via-[#c8e2ab] to-transparent" />
	                    <div className="grid gap-3 md:grid-cols-[100px_minmax(0,1fr)]">
	                      <div className="relative">
	                        {!isLastStep && <div className="absolute left-5 top-12 hidden h-[calc(100%+12px)] w-px bg-brand-border/80 md:block" />}
	                        <div className="flex items-start gap-3 md:block">
	                          <div
	                            className={`relative z-10 grid h-10 w-10 place-items-center rounded-2xl border text-xs font-semibold shadow-sm ${
	                              hasVersions
	                                ? `${pathStageBadgePalette(step.versionType).border} ${pathStageBadgePalette(step.versionType).bg} ${pathStageBadgePalette(step.versionType).text}`
	                                : `${pathStageBadgePalette(step.versionType).border} ${pathStageBadgePalette(step.versionType).bg} ${pathStageBadgePalette(step.versionType).text} opacity-65`
	                            }`}
	                          >
	                            {stepIndex + 1}
	                          </div>
	                          <div className="md:mt-2 md:rounded-xl md:border md:border-brand-border md:bg-white/75 md:p-2">
	                            <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">Step</p>
	                            <p className="text-sm font-semibold text-brand-ink">{step.label}</p>
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
                            const isStepReordering = reorderingStepVersionType === step.versionType;
                            return (
	                            <div key={demo.id} className="relative min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-white/90 p-3 shadow-sm">
	                              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#edf4e5] via-[#dcebc9] to-transparent" />
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
	                                  <p className="truncate text-sm font-medium text-brand-ink">
	                                    {demo.audioUrl ? fileNameFromPath(demo.audioUrl) : "Текстовая версия"} • {formatDate(demo.createdAt)} •{" "}
	                                    {formatDuration(demo.duration)}
	                                  </p>
                                  <SongAnalysisBadges
                                    bpm={demo.detectedBpm}
                                    keyRoot={demo.detectedKeyRoot}
                                    keyMode={demo.detectedKeyMode}
                                    className="mt-1"
                                    compact
                                  />
                                  <p className="mt-1 text-xs text-brand-muted">{formatWhen(demo.createdAt)}</p>
                                </div>

	                                <div className="flex w-full max-w-full flex-wrap items-center gap-2 rounded-xl border border-brand-border bg-[#f7fbf2]/80 p-2 md:justify-end">
	                                  {demo.audioUrl && (
	                                    <button
	                                      type="button"
                                      className={`grid h-9 w-9 place-items-center rounded-full border text-sm ${
                                        playback.isActive(demo.id)
                                          ? "hover:brightness-95"
                                          : "hover:brightness-95"
                                      }`}
                                      style={projectPlayAccentStyle}
                                      onClick={() => handleDemoPlay(demo)}
                                      aria-label={playback.isPlayingDemo(demo.id) ? "Пауза версии" : "Воспроизвести версию"}
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
	                                      className="inline-flex h-9 max-w-full items-center rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-ink hover:bg-white"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      Скачать
                                    </a>
                                  )}
                                  {demo.audioUrl && (
                                    <Button
                                      variant="secondary"
	                                      className="max-w-full border-brand-border bg-white text-brand-ink hover:bg-white"
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
                                  <Button
                                    variant="secondary"
	                                  className="max-w-full border-brand-border bg-white text-brand-ink hover:bg-white"
                                    onClick={() => openCreateFeedbackModal({ demoId: demo.id })}
                                  >
                                    Запросить фидбек
                                  </Button>
                                  <button
                                    type="button"
	                                    className="grid h-9 w-9 place-items-center rounded-xl border border-brand-border bg-white text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                                    onClick={() => moveDemoWithinStep(step.versionType, step.demos, demo.id, -1)}
                                    disabled={!canMoveUp || isStepReordering}
                                    aria-label="Переместить выше"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
	                                    className="grid h-9 w-9 place-items-center rounded-xl border border-brand-border bg-white text-brand-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                                    onClick={() => moveDemoWithinStep(step.versionType, step.demos, demo.id, 1)}
                                    disabled={!canMoveDown || isStepReordering}
                                    aria-label="Переместить ниже"
                                  >
                                    ↓
                                  </button>
                                  <Button
                                    variant="secondary"
	                                    className="max-w-full border-brand-border bg-white text-brand-ink hover:bg-white"
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
	                                <div className="rounded-xl border border-dashed border-brand-border bg-[#fbfdf7] px-3 py-4 text-sm text-brand-muted">
	                                  У этой версии нет аудио.
	                                </div>
	                              )}

                              <div className="mt-3 space-y-2">
                                {editingReflectionId === demo.id ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={getReflectionDraft(demo).whyMade}
                                      onChange={(event) =>
                                        setDemoReflectionDrafts((prev) => ({
                                          ...prev,
                                          [demo.id]: {
                                            ...getReflectionDraft(demo),
                                            whyMade: event.target.value
                                          }
                                        }))
                                      }
                                      placeholder="Зачем делал эту версию"
                                      rows={3}
                                      className="border-brand-border bg-white text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                                    />
                                    <Textarea
                                      value={getReflectionDraft(demo).whatChanged}
                                      onChange={(event) =>
                                        setDemoReflectionDrafts((prev) => ({
                                          ...prev,
                                          [demo.id]: {
                                            ...getReflectionDraft(demo),
                                            whatChanged: event.target.value
                                          }
                                        }))
                                      }
                                      placeholder="Что изменил"
                                      rows={3}
                                      className="border-brand-border bg-white text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                                    />
                                    <Textarea
                                      value={getReflectionDraft(demo).whatNotWorking}
                                      onChange={(event) =>
                                        setDemoReflectionDrafts((prev) => ({
                                          ...prev,
                                          [demo.id]: {
                                            ...getReflectionDraft(demo),
                                            whatNotWorking: event.target.value
                                          }
                                        }))
                                      }
                                      placeholder="Что не устроило"
                                      rows={3}
                                      className="border-brand-border bg-white text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="secondary"
                                        className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                        disabled={updatingDemoId === demo.id}
                                        onClick={async () => {
                                          const draft = getReflectionDraft(demo);
                                          setUpdatingDemoId(demo.id);
                                          const response = await apiFetch(`/api/audio-clips/${demo.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              versionReflection: {
                                                whyMade: draft.whyMade.trim() || null,
                                                whatChanged: draft.whatChanged.trim() || null,
                                                whatNotWorking: draft.whatNotWorking.trim() || null
                                              }
                                            })
                                          });
                                          if (response.ok) {
                                            await refetch();
                                            setEditingReflectionId("");
                                          }
                                          setUpdatingDemoId("");
                                        }}
                                      >
                                        Сохранить
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                        onClick={() => setEditingReflectionId("")}
                                      >
                                        Отмена
                                      </Button>
                                    </div>
                                  </div>
                                ) : demo.versionReflection?.whyMade || demo.versionReflection?.whatChanged || demo.versionReflection?.whatNotWorking || demo.versionReflection?.legacyNote ? (
                                  <button
                                    type="button"
                                    className="w-full rounded-xl border border-brand-border bg-[#f7fbf2] px-3 py-3 text-left text-sm text-brand-ink shadow-sm"
                                    onClick={() => {
                                      setDemoReflectionDrafts((prev) => ({
                                        ...prev,
                                        [demo.id]: getReflectionDraft(demo)
                                      }));
                                      setEditingReflectionId(demo.id);
                                    }}
                                  >
                                    <div className="space-y-2">
                                      {demo.versionReflection?.whyMade ? (
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Зачем делал</p>
                                          <p className="mt-1">{demo.versionReflection.whyMade}</p>
                                        </div>
                                      ) : null}
                                      {demo.versionReflection?.whatChanged ? (
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Что изменил</p>
                                          <p className="mt-1">{demo.versionReflection.whatChanged}</p>
                                        </div>
                                      ) : null}
                                      {demo.versionReflection?.whatNotWorking ? (
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Что не устроило</p>
                                          <p className="mt-1">{demo.versionReflection.whatNotWorking}</p>
                                        </div>
                                      ) : null}
                                      {!demo.versionReflection?.whyMade &&
                                      !demo.versionReflection?.whatChanged &&
                                      !demo.versionReflection?.whatNotWorking &&
                                      demo.versionReflection?.legacyNote ? (
                                        <div>
                                          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Старый комментарий</p>
                                          <p className="mt-1">{demo.versionReflection.legacyNote}</p>
                                        </div>
                                      ) : null}
                                    </div>
                                  </button>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                    onClick={() => {
                                      setDemoReflectionDrafts((prev) => ({
                                        ...prev,
                                        [demo.id]: getReflectionDraft(demo)
                                      }));
                                      setEditingReflectionId(demo.id);
                                    }}
                                  >
                                    Добавить рефлексию версии
                                  </Button>
                                )}
                              </div>
                            </div>
                          );})
		                        ) : step.versionType === "IDEA_TEXT" ? (
		                          <div className="rounded-2xl border border-brand-border bg-[#fbfdf7] px-3 py-4">
		                            {track.lyricsText?.trim() ? (
		                              <div className="space-y-3">
		                                <div className="flex flex-wrap items-start justify-between gap-2">
		                                  <div>
		                                    <p className="text-xs uppercase tracking-[0.12em] text-brand-muted">Текст песни</p>
		                                    <p className="mt-1 text-sm text-brand-muted">Снапшот текста можно сразу отправить на отзыв.</p>
		                                  </div>
		                                  <Button
		                                    variant="secondary"
		                                    className="border-brand-border bg-white text-brand-ink hover:bg-white"
		                                    onClick={() => openCreateFeedbackModal({ type: "TEXT" })}
		                                  >
		                                    Запросить фидбек
		                                  </Button>
		                                </div>
		                                <p className="whitespace-pre-wrap text-sm text-brand-ink">{track.lyricsText}</p>
		                              </div>
		                            ) : (
		                              <p className="text-sm text-brand-muted">Текст песни пока не добавлен.</p>
		                            )}
		                          </div>
		                        ) : (
		                          <div className="rounded-2xl border border-dashed border-brand-border bg-[#fbfdf7] px-3 py-5 text-sm text-brand-muted">
		                            На этом шаге пока нет версий.
		                          </div>
		                        )}
	                      </div>
                    </div>
                  </div>
                );
	              })}
	                </div>

                  <div className="mt-5 border-t border-brand-border pt-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">Feedback</p>
                        <h3 className="text-lg font-semibold tracking-tight text-brand-ink">Отзывы по версиям</h3>
                        <p className="text-sm text-brand-muted">Запрашивай фидбек из карточки версии, а ответы и решения хранятся здесь.</p>
                      </div>
                      <span className="inline-flex rounded-full border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-muted">
                        {feedbackRequests.length}
                      </span>
                    </div>

                    <div className="mb-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Текущий статус</p>
                        <p className="mt-1 text-sm font-medium text-brand-ink">
                          {track.feedbackSummary.latestStatusLabel ?? "Ещё не запрашивали"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Открытые пункты</p>
                        <p className="mt-1 text-sm font-medium text-brand-ink">{track.feedbackSummary.unresolvedItemsCount}</p>
                      </div>
                      <div className="rounded-2xl border border-brand-border bg-white/85 p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Следующая версия</p>
                        <p className="mt-1 text-sm font-medium text-brand-ink">
                          {track.feedbackSummary.nextVersionItemsCount > 0
                            ? `${track.feedbackSummary.nextVersionItemsCount} ждут проверки`
                            : "Пока пусто"}
                        </p>
                      </div>
                    </div>

                    {feedbackRequests.length ? (
                      <div className="space-y-3">
                        {feedbackRequests.map((feedbackRequest) => {
                          const isExpanded = Boolean(expandedFeedbackRequests[feedbackRequest.id]);
                          return (
                            <article
                              key={feedbackRequest.id}
                              className="rounded-2xl border border-brand-border bg-white/90 p-3 shadow-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-brand-ink">{feedbackRequest.typeLabel}</span>
                                    <span
                                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${feedbackStatusBadgeClass(
                                        feedbackRequest.status
                                      )}`}
                                    >
                                      {feedbackRequest.statusLabel}
                                    </span>
                                    {feedbackRequest.community ? (
                                      <span className="inline-flex rounded-full border border-[#cde1bc] bg-[#eef7df] px-2.5 py-1 text-xs text-[#4b6440]">
                                        Опубликовано в community
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm text-brand-muted">
                                    {feedbackRequest.recipient.label}
                                    {feedbackRequest.recipient.safeId ? ` • SAFE ID ${feedbackRequest.recipient.safeId}` : ""}
                                    {feedbackRequest.recipient.channel ? ` • ${feedbackRequest.recipient.channel}` : ""}
                                  </p>
                                  {feedbackRequest.community ? (
                                    <p className="mt-1 text-xs text-brand-muted">
                                      {feedbackRequest.community.title ?? "Community thread"} • {feedbackRequest.community.replyCount} ответов •{" "}
                                      {feedbackRequest.community.status === "OPEN"
                                        ? "открыт"
                                        : feedbackRequest.community.status === "CLOSED"
                                          ? "закрыт"
                                          : "в архиве"}
                                    </p>
                                  ) : null}
                                  <p className="mt-1 text-xs text-brand-muted">
                                    {feedbackRequest.demoRef
                                      ? `${versionTypeLabels[feedbackRequest.demoRef.versionType]} • ${formatDate(feedbackRequest.demoRef.createdAt)}`
                                      : feedbackRequest.lyricsSnapshot
                                        ? "Snapshot текста"
                                        : "Без версии"}
                                  </p>
                                  {feedbackRequest.requestMessage ? (
                                    <p className="mt-2 text-sm text-brand-ink">{feedbackRequest.requestMessage}</p>
                                  ) : null}
                                </div>

                                <div className="min-w-[180px] space-y-2 text-xs text-brand-muted">
                                  <p>{feedbackRequest.counts.totalItems} тезисов</p>
                                  <p>{feedbackRequest.counts.resolvedItems} разобрано</p>
                                  <p>{feedbackRequest.counts.nextVersionItems} ждут следующую версию</p>
                                  <p>Отправлено: {formatDate(feedbackRequest.sentAt)}</p>
                                  {feedbackRequest.receivedAt ? <p>Получено: {formatDate(feedbackRequest.receivedAt)}</p> : null}
                                  {feedbackRequest.reviewedAt ? <p>Разобрано: {formatDate(feedbackRequest.reviewedAt)}</p> : null}
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                  onClick={() => openFeedbackResponseModal(feedbackRequest.id)}
                                >
                                  Добавить ответ
                                </Button>
                                {feedbackRequest.community ? (
                                  <Link href={`/community#${feedbackRequest.community.postId}`}>
                                    <Button variant="secondary" className="border-brand-border bg-white text-brand-ink hover:bg-white">
                                      Открыть в Community
                                    </Button>
                                  </Link>
                                ) : null}
                                <Button
                                  variant="secondary"
                                  className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                  onClick={() =>
                                    setExpandedFeedbackRequests((prev) => ({
                                      ...prev,
                                      [feedbackRequest.id]: true
                                    }))
                                  }
                                >
                                  Разобрать
                                </Button>
                                <Button
                                  variant="secondary"
                                  className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                  onClick={() =>
                                    setExpandedFeedbackRequests((prev) => ({
                                      ...prev,
                                      [feedbackRequest.id]: !prev[feedbackRequest.id]
                                    }))
                                  }
                                >
                                  {isExpanded ? "Свернуть" : "Развернуть"}
                                </Button>
                              </div>

                              {isExpanded ? (
                                <div className="mt-3 space-y-3 border-t border-brand-border pt-3">
                                  {feedbackRequest.lyricsSnapshot ? (
                                    <div className="rounded-2xl border border-brand-border bg-[#fbfdf7] p-3">
                                      <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Snapshot текста</p>
                                      <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink">{feedbackRequest.lyricsSnapshot}</p>
                                    </div>
                                  ) : null}

                                  {feedbackRequest.items.length ? (
                                    feedbackCategoryOrder.map((category) => {
                                      const items = feedbackRequest.items.filter((item) => item.category === category);
                                      if (!items.length) return null;

                                      return (
                                        <section key={`${feedbackRequest.id}:${category}`} className="space-y-2">
                                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                                            {items[0]?.categoryLabel}
                                          </p>
                                          {items.map((item) => (
                                            <div key={item.id} className="rounded-2xl border border-brand-border bg-[#f9fbf6] p-3">
                                              <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="flex-1">
                                                  <p className="text-sm text-brand-ink">{item.body}</p>
                                                  {item.source === "COMMUNITY_REPLY" ? (
                                                    <p className="mt-1 text-xs text-brand-muted">
                                                      Из community
                                                      {item.author?.nickname ? ` • ${item.author.nickname}` : ""}
                                                    </p>
                                                  ) : item.source === "INTERNAL_USER_REPLY" ? (
                                                    <p className="mt-1 text-xs text-brand-muted">
                                                      Внутри продукта
                                                      {item.author?.nickname ? ` • ${item.author.nickname}` : ""}
                                                    </p>
                                                  ) : null}
                                                </div>
                                                {item.resolution ? (
                                                  <span
                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${feedbackResolutionBadgeClass(
                                                      item.resolution.status
                                                    )}`}
                                                  >
                                                    {item.resolution.statusLabel}
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex rounded-full border border-brand-border bg-white px-2.5 py-1 text-xs text-brand-muted">
                                                    Не разобрано
                                                  </span>
                                                )}
                                              </div>

                                              {item.resolution?.targetDemo ? (
                                                <p className="mt-2 text-xs text-brand-muted">
                                                  Связано с версией {versionTypeLabels[item.resolution.targetDemo.versionType]} •{" "}
                                                  {formatDate(item.resolution.targetDemo.createdAt)}
                                                </p>
                                              ) : null}

                                              <div className="mt-3 space-y-2">
                                                <Textarea
                                                  value={feedbackResolutionNotes[item.id] ?? item.resolution?.note ?? ""}
                                                  onChange={(event) =>
                                                    setFeedbackResolutionNotes((prev) => ({
                                                      ...prev,
                                                      [item.id]: event.target.value
                                                    }))
                                                  }
                                                  placeholder="Комментарий к решению"
                                                  rows={2}
                                                  className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                  <Button
                                                    variant="secondary"
                                                    className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                                    disabled={resolvingFeedbackItemId === item.id}
                                                    onClick={() => void resolveFeedbackItem(item.id, "ACCEPTED")}
                                                  >
                                                    Принять
                                                  </Button>
                                                  <Button
                                                    variant="secondary"
                                                    className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                                    disabled={resolvingFeedbackItemId === item.id}
                                                    onClick={() => void resolveFeedbackItem(item.id, "REJECTED")}
                                                  >
                                                    Отклонить
                                                  </Button>
                                                  <Button
                                                    variant="secondary"
                                                    className="border-brand-border bg-white text-brand-ink hover:bg-white"
                                                    disabled={resolvingFeedbackItemId === item.id}
                                                    onClick={() => void resolveFeedbackItem(item.id, "NEXT_VERSION")}
                                                  >
                                                    Проверить в следующей версии
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </section>
                                      );
                                    })
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-brand-border bg-[#fbfdf7] px-3 py-4 text-sm text-brand-muted">
                                      Ответ пока не занесён. Добавь его из продукта, когда получишь feedback.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-brand-border bg-[#fbfdf7] px-3 py-5 text-sm text-brand-muted">
                        Пока нет запросов на фидбек. Запрашивай его прямо из нужной версии песни.
                      </div>
                    )}
                  </div>
	              </section>
            </div>
      </div>

      {showEditTrackModal && (
        <div
          className="fixed inset-0 z-[80] bg-[#182019]/45 backdrop-blur-md"
          onClick={() => setShowEditTrackModal(false)}
        >
          <div className="flex min-h-full items-start justify-center p-3 pt-16 md:items-center md:p-6">
            <div
              className="relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_28px_70px_rgba(61,84,46,0.24)] md:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.55),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(217,249,157,0.12),transparent_45%)]" />
              <div className="relative">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                    <Sparkles className="h-3.5 w-3.5 text-brand-ink" />
                    Track
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Метаданные песни</h2>
                  <p className="text-sm text-brand-muted">Название, этап и текст песни.</p>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/90 text-brand-ink shadow-sm hover:bg-white"
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
                <Select
                  value={workbenchState}
                  onChange={(event) => setWorkbenchState(event.target.value as Track["workbenchState"])}
                  className="border-brand-border bg-white/90 text-brand-ink focus:ring-brand-border"
                >
                  <option value="IN_PROGRESS">В работе</option>
                  <option value="STUCK">Застрял</option>
                  <option value="NEEDS_FEEDBACK">Нужен фидбек</option>
                  <option value="DEFERRED">Отложен</option>
                  <option value="READY_FOR_NEXT_STEP">Готов к следующему шагу</option>
                </Select>
                <Input
                  value={intentSummary}
                  onChange={(event) => setIntentSummary(event.target.value)}
                  placeholder="Intent трека: что именно ты сейчас строишь"
                  className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                />
                <Textarea
                  value={intentWhyNow}
                  onChange={(event) => setIntentWhyNow(event.target.value)}
                  placeholder="Почему этот трек важен именно сейчас"
                  rows={3}
                  className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                />
                <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">Следующий шаг по треку</p>
                      <p className="text-xs text-brand-muted">Один активный шаг, который ведёт трек дальше.</p>
                    </div>
                    {track.activeNextStep ? (
                      <span className="inline-flex rounded-full border border-brand-border bg-white px-2.5 py-1 text-[11px] text-brand-muted">
                        active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    <Input
                      value={nextStepTitle}
                      onChange={(event) => setNextStepTitle(event.target.value)}
                      placeholder="Название следующего шага"
                      className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                    />
                    <Textarea
                      value={nextStepDetail}
                      onChange={(event) => setNextStepDetail(event.target.value)}
                      placeholder="Деталь шага"
                      rows={3}
                      className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                    />
                    <Button
                      variant="secondary"
                      className="border-brand-border bg-white/90 text-brand-ink hover:bg-white"
                      disabled={savingNextStep || !nextStepTitle.trim()}
                      onClick={() => void saveTrackNextStep()}
                    >
                      {savingNextStep ? "Сохраняем шаг..." : track.activeNextStep ? "Заменить следующий шаг" : "Сохранить следующий шаг"}
                    </Button>
                  </div>
                </div>

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
                            pathStageId: currentStage ?? null,
                            workbenchState,
                            trackIntent: intentSummary.trim() || intentWhyNow.trim()
                              ? {
                                  summary: intentSummary.trim() || currentTitle.trim(),
                                  whyNow: intentWhyNow.trim() || null
                                }
                              : null
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
                <div className="mt-4 space-y-2 rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
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
        </div>
      )}

      {showAddVersionModal && (
        <div
          className="fixed inset-0 z-[80] bg-[#182019]/45 backdrop-blur-md"
          onClick={() => setShowAddVersionModal(false)}
        >
          <div className="flex min-h-full items-start justify-center p-3 pt-16 md:items-center md:p-6">
            <div
              className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_28px_70px_rgba(61,84,46,0.24)] md:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.55),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(217,249,157,0.12),transparent_45%)]" />
              <div className="relative">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                    <PlusCircle className="h-3.5 w-3.5 text-brand-ink" />
                    Добавить версию
                  </div>
                  <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Новая версия</h2>
                  <p className="text-sm text-brand-muted">Добавь запись, файл или текстовый этап песни.</p>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/90 text-brand-ink shadow-sm hover:bg-white"
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
                  <option value="IDEA_TEXT">Идея</option>
                  <option value="DEMO">Демо</option>
                  <option value="ARRANGEMENT">Продакшн</option>
                  <option value="NO_MIX">Запись без сведения</option>
                  <option value="MIXED">С сведением</option>
                  <option value="MASTERED">С мастерингом</option>
                  <option value="RELEASE">Релиз</option>
                </Select>

                {newVersionType === "RELEASE" && (
                  <div className="space-y-2">
                    {hasReleaseDemo && (
                      <div className="rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Релизная версия уже добавлена. Повторно добавить `RELEASE` нельзя.
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-brand-ink">Дата релиза</p>
                      <Input
                        type="date"
                        value={newReleaseDate}
                        onChange={(event) => setNewReleaseDate(event.target.value)}
                        className="border-brand-border bg-white/90 text-brand-ink"
                      />
                      <p className="text-xs text-brand-muted">
                        Обязательно для ручного добавления релизной версии.
                      </p>
                    </div>
                  </div>
                )}

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
                  <p className="text-sm text-brand-muted">Для «Идеи» добавляется только текст песни.</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => setNewVersionFile(event.target.files?.[0] ?? null)}
                />

                {newVersionMode === "upload" && newVersionFile && (
                  <div className="rounded-xl border border-brand-border bg-white/80 px-3 py-2 text-sm text-brand-muted shadow-sm">
                    Выбран файл: {newVersionFile.name}
                  </div>
                )}

                {newVersionType === "DEMO" && newVersionMode === "record" && (
                  <div className="rounded-2xl border border-brand-border bg-white/75 p-3 shadow-sm">
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
                    <p className="text-sm font-medium text-brand-ink">Контекст версии</p>
                    <Textarea
                      value={newVersionWhyMade}
                      onChange={(event) => setNewVersionWhyMade(event.target.value)}
                      placeholder="Зачем делал эту версию"
                      rows={3}
                      className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                    />
                    <Textarea
                      value={newVersionWhatChanged}
                      onChange={(event) => setNewVersionWhatChanged(event.target.value)}
                      placeholder="Что изменил в этой версии"
                      rows={3}
                      className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                    />
                    <Textarea
                      value={newVersionWhatNotWorking}
                      onChange={(event) => setNewVersionWhatNotWorking(event.target.value)}
                      placeholder="Что не устроило или осталось нерешённым"
                      rows={3}
                      className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted focus:ring-brand-border"
                    />
                  </div>
                )}

                {newVersionType !== "IDEA_TEXT" && pendingNextVersionItems.length ? (
                  <div className="space-y-2 rounded-2xl border border-brand-border bg-[#eef5fb] p-3 shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-brand-ink">Проверить в этой версии</p>
                      <p className="mt-1 text-xs text-brand-muted">
                        Выбери пункты фидбека со статусом «Проверить в следующей версии», которые закрываешь этим апдейтом.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {pendingNextVersionItems.map((entry) => (
                        <label
                          key={entry.item.id}
                          className="flex items-start gap-3 rounded-2xl border border-brand-border bg-white/90 px-3 py-3 text-sm text-brand-ink"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-brand-border"
                            checked={selectedFeedbackItemIdsForVersion.includes(entry.item.id)}
                            onChange={(event) =>
                              setSelectedFeedbackItemIdsForVersion((prev) =>
                                event.target.checked ? [...prev, entry.item.id] : prev.filter((id) => id !== entry.item.id)
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-xs uppercase tracking-[0.12em] text-brand-muted">
                              {entry.requestTypeLabel} • {entry.item.categoryLabel}
                            </span>
                            <span className="mt-1 block">{entry.item.body}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {versionError && (
                  <div className="rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a] shadow-sm">
                    {versionError}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={creatingVersion || (newVersionType === "RELEASE" && hasReleaseDemo)}
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
        </div>
      )}

      {showDistributionModal && (
        <div
          className="fixed inset-0 z-[80] bg-[#182019]/45 backdrop-blur-md"
          onClick={() => setShowDistributionModal(false)}
        >
          <div className="flex min-h-full items-start justify-center p-3 pt-16 md:items-center md:p-6">
            <div
              className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_28px_70px_rgba(61,84,46,0.24)] md:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.55),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(217,249,157,0.12),transparent_45%)]" />
              <div className="relative">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                      <Sparkles className="h-3.5 w-3.5 text-brand-ink" />
                      Distribution
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-brand-ink">Дистрибьюция</h2>
                    <p className="text-sm text-brand-muted">Финальная информация и промо для отправки релиза.</p>
                  </div>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-xl border border-brand-border bg-white/90 text-brand-ink shadow-sm hover:bg-white"
                    onClick={() => setShowDistributionModal(false)}
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <section className="rounded-2xl border border-brand-border bg-white/80 p-3 shadow-sm">
                    <p className="text-sm font-semibold text-brand-ink">Информация о треке</p>
                    <p className="mt-1 text-xs text-brand-muted">
                      Источник аудио для релиза:{" "}
                      {latestMasteredDemo?.audioUrl ? fileNameFromPath(latestMasteredDemo.audioUrl) : "мастер-версия недоступна"}
                    </p>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-ink">Псевдоним артиста</p>
                        <Input
                          value={distributionForm.artistName}
                          onChange={(event) =>
                            setDistributionForm((prev) => ({ ...prev, artistName: event.target.value }))
                          }
                          placeholder="Имя артиста"
                          className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-ink">Название релиза</p>
                        <Input
                          value={distributionForm.releaseTitle}
                          onChange={(event) =>
                            setDistributionForm((prev) => ({ ...prev, releaseTitle: event.target.value }))
                          }
                          placeholder="Название релиза"
                          className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-ink">Желаемая дата релиза</p>
                        <Input
                          type="date"
                          value={distributionForm.releaseDate}
                          onChange={(event) =>
                            setDistributionForm((prev) => ({ ...prev, releaseDate: event.target.value }))
                          }
                          className="border-brand-border bg-white/90 text-brand-ink"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-ink">Жанр</p>
                        <Input
                          value={distributionForm.genre}
                          onChange={(event) =>
                            setDistributionForm((prev) => ({ ...prev, genre: event.target.value }))
                          }
                          placeholder="Например: Pop Rap"
                          className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-ink">Есть мат?</p>
                        <Select
                          value={distributionForm.explicitContent}
                          onChange={(event) =>
                            setDistributionForm((prev) => ({
                              ...prev,
                              explicitContent: event.target.value as DistributionYesNoValue
                            }))
                          }
                          className="border-brand-border bg-white/90 text-brand-ink"
                        >
                          {distributionYesNoOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-ink">Использование AI?</p>
                        <Select
                          value={distributionForm.usesAi}
                          onChange={(event) =>
                            setDistributionForm((prev) => ({
                              ...prev,
                              usesAi: event.target.value as DistributionYesNoValue
                            }))
                          }
                          className="border-brand-border bg-white/90 text-brand-ink"
                        >
                          {distributionYesNoOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-brand-border bg-white/80 p-3 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-brand-ink">Промо для питчинга</p>
                        <p className="mt-1 text-xs text-brand-muted">
                          Напиши короткий промо-релиз о песне для отправки в дистрибуцию.
                        </p>
                      </div>
                      <Button
                        variant={distributionForm.managerHelpRequested ? "primary" : "secondary"}
                        className={
                          distributionForm.managerHelpRequested
                            ? ""
                            : "border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                        }
                        onClick={() =>
                          setDistributionForm((prev) => ({
                            ...prev,
                            managerHelpRequested: !prev.managerHelpRequested
                          }))
                        }
                      >
                        {distributionForm.managerHelpRequested ? "Помощь менеджера запрошена" : "Попросить помощи менеджера"}
                      </Button>
                    </div>

                    {distributionForm.managerHelpRequested && (
                      <p className="mt-2 rounded-xl border border-brand-border bg-[#f4f8ef] px-3 py-2 text-xs text-brand-muted">
                        Можно отправить заявку без промо-текста — менеджер поможет с текстом для питчинга.
                      </p>
                    )}

                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-medium text-brand-ink">Промо-релиз / текст для питчинга</p>
                      <Textarea
                        value={distributionForm.promoPitchText ?? ""}
                        onChange={(event) =>
                          setDistributionForm((prev) => ({ ...prev, promoPitchText: event.target.value }))
                        }
                        placeholder="О чем трек, настроение, история, интересные детали для редакторов"
                        rows={6}
                        className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted"
                      />
                    </div>
                  </section>

                  <section className="rounded-2xl border border-brand-border bg-white/80 p-3 shadow-sm">
                    <p className="text-sm font-semibold text-brand-ink">Выбор дистрибьютора</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-brand-ink">Дистрибьютор</p>
                        <Select
                          value={distributionForm.distributor}
                          onChange={(event) =>
                            setDistributionForm((prev) => ({
                              ...prev,
                              distributor: event.target.value as DistributionDistributorValue
                            }))
                          }
                          className="border-brand-border bg-white/90 text-brand-ink"
                        >
                          {distributionDistributorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {distributionForm.distributor === "OTHER" && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-brand-ink">Название дистрибьютора</p>
                          <Input
                            value={distributionForm.distributorOtherName ?? ""}
                            onChange={(event) =>
                              setDistributionForm((prev) => ({
                                ...prev,
                                distributorOtherName: event.target.value
                              }))
                            }
                            placeholder="Укажи название"
                            className="border-brand-border bg-white/90 text-brand-ink placeholder:text-brand-muted"
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  {distributionError && (
                    <div className="rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a] shadow-sm">
                      {distributionError}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={submittingDistribution} onClick={() => void submitDistributionRequest()}>
                      {submittingDistribution ? "Отправляем..." : "Отправить"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="border-brand-border bg-white/85 text-brand-ink hover:bg-white"
                      onClick={() => setShowDistributionModal(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={showCreateFeedbackModal}
        onClose={() => setShowCreateFeedbackModal(false)}
        title="Запросить фидбек"
        description="Зафиксируй получателя, контекст и то, что именно хочешь проверить."
        widthClassName="max-w-2xl"
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setShowCreateFeedbackModal(false),
            disabled: creatingFeedbackRequest
          },
          {
            label: creatingFeedbackRequest ? "Сохраняем..." : "Создать запрос",
            onClick: () => void submitFeedbackRequest(),
            disabled:
              creatingFeedbackRequest ||
              (feedbackRequestType !== "TEXT" && !feedbackRequestDemoId) ||
              (feedbackRecipientMode === "INTERNAL_USER" && !feedbackRecipientSafeId.trim()) ||
              (feedbackRecipientMode === "EXTERNAL_CONTACT" && !feedbackRecipientLabel.trim()) ||
              (feedbackRecipientMode === "COMMUNITY" &&
                (!feedbackCommunityTitle.trim() || !feedbackRequestMessage.trim() || feedbackSupportNeedTypes.length === 0))
          }
        ]}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-brand-ink">Тип фидбека</p>
            <Select
              value={feedbackRequestType}
              onChange={(event) => setFeedbackRequestType(event.target.value as FeedbackRequestType)}
              className="bg-white"
            >
              {feedbackTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {feedbackRequestType === "TEXT" ? (
            <div className="rounded-2xl border border-brand-border bg-[#fbfdf7] p-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-muted">Snapshot текста</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink">
                {track.lyricsText?.trim() || "Текст песни пока не добавлен."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-brand-ink">Версия для запроса</p>
              <Select
                value={feedbackRequestDemoId}
                onChange={(event) => setFeedbackRequestDemoId(event.target.value)}
                className="bg-white"
              >
                {feedbackSelectableDemos.map((demo) => (
                  <option key={demo.id} value={demo.id}>
                    {versionTypeLabels[demo.versionType]} • {formatDate(demo.createdAt)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium text-brand-ink">Куда отправляешь</p>
            <Select
              value={feedbackRecipientMode}
              onChange={(event) => setFeedbackRecipientMode(event.target.value as FeedbackRecipientMode)}
              className="bg-white"
            >
              <option value="EXTERNAL_CONTACT">Внешний контакт</option>
              <option value="INTERNAL_USER">Внутри продукта</option>
              <option value="COMMUNITY">В community</option>
            </Select>
          </div>

          {feedbackRecipientMode === "INTERNAL_USER" ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-brand-ink">SAFE ID</p>
              <Input
                value={feedbackRecipientSafeId}
                onChange={(event) => setFeedbackRecipientSafeId(event.target.value)}
                placeholder="SAFE ID получателя"
                className="bg-white"
              />
            </div>
          ) : feedbackRecipientMode === "COMMUNITY" ? (
            <div className="space-y-3 rounded-2xl border border-brand-border bg-[#f7fbf2] p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Заголовок карточки в community</p>
                <Input
                  value={feedbackCommunityTitle}
                  onChange={(event) => setFeedbackCommunityTitle(event.target.value)}
                  placeholder="Например: нужен взгляд на припев и динамику второго куплета"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Какая реакция будет полезной</p>
                <Input
                  value={feedbackCommunityHelpfulActionPrompt}
                  onChange={(event) => setFeedbackCommunityHelpfulActionPrompt(event.target.value)}
                  placeholder="Например: особенно нужен взгляд на считываемость припева"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-ink">Какой тип помощи нужен</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(supportNeedTypeLabels).map(([value, label]) => {
                    const typedValue = value as ArtistSupportNeedType;
                    const selected = feedbackSupportNeedTypes.includes(typedValue);
                    return (
                      <button
                        key={typedValue}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs ${
                          selected ? "border-brand-ink bg-white text-brand-ink" : "border-brand-border bg-[#eef4e6] text-brand-muted"
                        }`}
                        onClick={() =>
                          setFeedbackSupportNeedTypes((prev) =>
                            prev.includes(typedValue) ? prev.filter((item) => item !== typedValue) : [...prev, typedValue]
                          )
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Имя</p>
                <Input
                  value={feedbackRecipientLabel}
                  onChange={(event) => setFeedbackRecipientLabel(event.target.value)}
                  placeholder="Кому отправляешь"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Канал</p>
                <Input
                  value={feedbackRecipientChannel}
                  onChange={(event) => setFeedbackRecipientChannel(event.target.value)}
                  placeholder="Telegram / чат / почта"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Контакт</p>
                <Input
                  value={feedbackRecipientContact}
                  onChange={(event) => setFeedbackRecipientContact(event.target.value)}
                  placeholder="@username / email / ссылка"
                  className="bg-white"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium text-brand-ink">Что именно хочешь проверить</p>
            <Textarea
              value={feedbackRequestMessage}
              onChange={(event) => setFeedbackRequestMessage(event.target.value)}
              placeholder="Например: считывается ли припев и не проседает ли второй куплет"
              rows={4}
              className="bg-white"
            />
          </div>

          {feedbackRequestError ? (
            <div className="rounded-xl border border-red-300/70 bg-[#fff2ef] px-3 py-2 text-sm text-[#a4372a] shadow-sm">
              {feedbackRequestError}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(responseModalRequest)}
        onClose={() => setResponseModalRequestId("")}
        title={responseModalRequest ? `Ответ на запрос: ${responseModalRequest.typeLabel}` : "Ответ на запрос"}
        description="Один тезис на строку. Продукт разложит ответ на отдельные пункты."
        widthClassName="max-w-3xl"
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setResponseModalRequestId(""),
            disabled: Boolean(submittingFeedbackResponseId)
          },
          {
            label: submittingFeedbackResponseId ? "Сохраняем..." : "Сохранить ответ",
            onClick: () => (responseModalRequest ? void submitFeedbackResponse(responseModalRequest.id) : undefined),
            disabled: Boolean(submittingFeedbackResponseId) || !responseModalRequest
          }
        ]}
      >
        {responseModalRequest ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-brand-border bg-[#fbfdf7] p-3 text-sm text-brand-muted">
              <p className="font-medium text-brand-ink">{responseModalRequest.recipient.label}</p>
              <p className="mt-1">
                {responseModalRequest.demoRef
                  ? `${versionTypeLabels[responseModalRequest.demoRef.versionType]} • ${formatDate(responseModalRequest.demoRef.createdAt)}`
                  : "Snapshot текста"}
              </p>
              {responseModalRequest.requestMessage ? (
                <p className="mt-2 text-brand-ink">{responseModalRequest.requestMessage}</p>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Что работает</p>
                <Textarea
                  value={getFeedbackResponseDraft(responseModalRequest.id).whatWorks}
                  onChange={(event) =>
                    setFeedbackResponseDrafts((prev) => ({
                      ...prev,
                      [responseModalRequest.id]: {
                        ...getFeedbackResponseDraft(responseModalRequest.id),
                        whatWorks: event.target.value
                      }
                    }))
                  }
                  rows={6}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Что не считывается</p>
                <Textarea
                  value={getFeedbackResponseDraft(responseModalRequest.id).notReading}
                  onChange={(event) =>
                    setFeedbackResponseDrafts((prev) => ({
                      ...prev,
                      [responseModalRequest.id]: {
                        ...getFeedbackResponseDraft(responseModalRequest.id),
                        notReading: event.target.value
                      }
                    }))
                  }
                  rows={6}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Где проседает</p>
                <Textarea
                  value={getFeedbackResponseDraft(responseModalRequest.id).sags}
                  onChange={(event) =>
                    setFeedbackResponseDrafts((prev) => ({
                      ...prev,
                      [responseModalRequest.id]: {
                        ...getFeedbackResponseDraft(responseModalRequest.id),
                        sags: event.target.value
                      }
                    }))
                  }
                  rows={6}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-brand-ink">Что хочется услышать дальше</p>
                <Textarea
                  value={getFeedbackResponseDraft(responseModalRequest.id).wantToHearNext}
                  onChange={(event) =>
                    setFeedbackResponseDrafts((prev) => ({
                      ...prev,
                      [responseModalRequest.id]: {
                        ...getFeedbackResponseDraft(responseModalRequest.id),
                        wantToHearNext: event.target.value
                      }
                    }))
                  }
                  rows={6}
                  className="bg-white"
                />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(moveTrackPrompt)}
        onClose={() => setMoveTrackPrompt(null)}
        title="Переместить трек"
        description={
          moveTrackPrompt
            ? `Укажи новую позицию для «${currentTitle}» (1-${moveTrackPrompt.total}).`
            : undefined
        }
        actions={[
          {
            label: "Отмена",
            variant: "secondary",
            onClick: () => setMoveTrackPrompt(null),
            disabled: movingTrackInProject
          },
          {
            label: movingTrackInProject ? "Сохраняем..." : "Сохранить",
            onClick: () => void submitMoveCurrentTrackInProject(),
            disabled: movingTrackInProject
          }
        ]}
      >
        <Input
          value={moveTrackPrompt?.value ?? ""}
          onChange={(event) =>
            setMoveTrackPrompt((prev) => (prev ? { ...prev, value: event.target.value } : prev))
          }
          inputMode="numeric"
          placeholder="Позиция"
          className="bg-white"
        />
      </Modal>
      </div>
    </div>
  );
}
