"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, MessageCircleHeart, UserPlus, UsersRound } from "lucide-react";

import type {
  CommunityFeedFilter,
  CommunityFeedItemDto,
  CommunityFeedKind,
  CommunityFeedResponseDto,
  CommunityFriendsResponseDto,
  CommunityHelpfulActionType,
  CommunityOverviewDto,
  FeaturedCreatorCardDto
} from "@/contracts/community";
import type { IncomingFeedbackRequest, IncomingFeedbackRequestsList } from "@/contracts/feedback";
import { FriendshipActions } from "@/components/community/friendship-actions";
import { LikeToggleButton } from "@/components/community/like-toggle-button";
import {
  eventMeta,
  formatCommunityDateTime,
  helpfulActionLabelByType,
  postKindLabelByType,
  roleLabelByType,
  supportNeedLabelByType
} from "@/components/community/community-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

type ComposerKind = "GENERAL" | "PROGRESS" | "CREATIVE_QUESTION";

const composerKindOptions: Array<{ value: ComposerKind; label: string; description: string }> = [
  { value: "PROGRESS", label: "Прогресс", description: "Показать, что реально сдвинулось." },
  { value: "CREATIVE_QUESTION", label: "Творческий вопрос", description: "Спросить мнение по идее или направлению." },
  { value: "GENERAL", label: "Пост", description: "Обычный короткий пост в community." }
];

const replyActionOptions: CommunityHelpfulActionType[] = ["I_CAN_HELP", "I_RELATED", "KEEP_GOING"];

function FriendListCard({ friend }: { friend: FeaturedCreatorCardDto }) {
  return (
    <Card className="rounded-[24px] border-brand-border bg-white/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-brand-ink">{friend.nickname}</span>
            <span className="rounded-full border border-brand-border bg-[#f3f7ee] px-2 py-0.5 text-[11px] text-brand-muted">
              {roleLabelByType[friend.role]}
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-muted">{friend.pathStageName ?? "Путь формируется"}</p>
          <Link
            href={`/community/creators/${friend.safeId}`}
            className="mt-2 inline-flex text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
          >
            SAFE ID: {friend.safeId}
          </Link>
          {friend.identityStatement ? <p className="mt-2 text-sm leading-6 text-brand-muted">{friend.identityStatement}</p> : null}
        </div>
        <FriendshipActions targetUserId={friend.userId} safeId={friend.safeId} friendship={friend.friendship} compact />
      </div>
    </Card>
  );
}

function IncomingFeedbackRequestCard({
  request,
  onReply
}: {
  request: IncomingFeedbackRequest;
  onReply: (request: IncomingFeedbackRequest) => void;
}) {
  return (
    <Card className="rounded-[28px] border-brand-border bg-white/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-brand-ink">{request.requester.nickname}</span>
            <span className="rounded-full border border-brand-border bg-[#f3f7ee] px-2 py-0.5 text-[11px] text-brand-muted">
              SAFE ID: {request.requester.safeId}
            </span>
          </div>
          <p className="mt-2 text-base font-semibold text-brand-ink">{request.track.title}</p>
          <p className="mt-1 text-xs text-brand-muted">
            {request.typeLabel}
            {request.demoRef ? ` • ${request.demoRef.versionType}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-[#d9e8cb] bg-[#f4faea] px-3 py-1 text-xs font-medium text-[#4b6440]">
          {request.statusLabel}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-brand-border bg-[#f7fbf2] p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Что просит посмотреть</p>
        <p className="mt-2 text-sm leading-6 text-brand-muted">{request.requestMessage?.trim() || "Без комментария к запросу."}</p>
      </div>

      <div className="mt-4 flex justify-end">
        <Button className="rounded-xl" onClick={() => onReply(request)}>
          <MessageCircleHeart className="h-4 w-4" />
          Ответить
        </Button>
      </div>
    </Card>
  );
}

function FeedCard({
  item,
  onReply
}: {
  item: CommunityFeedItemDto;
  onReply: (item: CommunityFeedItemDto) => void;
}) {
  if (item.content.type === "EVENT") {
    return (
      <Card className="rounded-[28px] border-brand-border bg-white/90 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-brand-ink">{item.content.title}</p>
            <p className="text-sm leading-6 text-brand-muted">{item.content.description}</p>
            <p className="text-xs text-brand-muted">{eventMeta(item.content)}</p>
            <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">{item.content.hostLabel}</p>
          </div>
          <LikeToggleButton
            targetType={item.likeSummary.targetType}
            targetId={item.likeSummary.targetId}
            count={item.likeSummary.count}
            viewerHasLiked={item.viewerHasLiked}
          />
        </div>
      </Card>
    );
  }

  if (item.content.type === "ACHIEVEMENT") {
    return (
      <Card className="rounded-[28px] border-brand-border bg-white/90 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-brand-ink">{item.author.nickname}</span>
              <span className="rounded-full border border-brand-border bg-[#f3f7ee] px-2 py-0.5 text-[11px] text-brand-muted">
                {roleLabelByType[item.author.role]}
              </span>
              <span className="rounded-full border border-[#d6e7c8] bg-[#eff7e3] px-2 py-0.5 text-[11px] text-[#4b6440]">
                Достижение
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-muted">{formatCommunityDateTime(item.createdAt)}</p>
          </div>
          <LikeToggleButton
            targetType={item.likeSummary.targetType}
            targetId={item.likeSummary.targetId}
            count={item.likeSummary.count}
            viewerHasLiked={item.viewerHasLiked}
          />
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-base font-semibold text-brand-ink">{item.content.title}</p>
          <p className="text-sm leading-6 text-brand-muted">{item.content.body}</p>
        </div>
      </Card>
    );
  }

  const thread = item.content.feedbackRequestRef?.thread ?? null;
  const isFeedbackRequest = item.content.postKind === "FEEDBACK_REQUEST";

  return (
    <Card className="rounded-[28px] border-brand-border bg-white/90 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-brand-ink">{item.author.nickname}</span>
            <span className="rounded-full border border-brand-border bg-[#f3f7ee] px-2 py-0.5 text-[11px] text-brand-muted">
              {roleLabelByType[item.author.role]}
            </span>
            <span className="rounded-full border border-brand-border bg-white px-2 py-0.5 text-[11px] text-brand-muted">
              {postKindLabelByType[item.content.postKind]}
            </span>
            {item.isFriendAuthor ? (
              <span className="rounded-full border border-[#cde1bc] bg-[#eef7df] px-2 py-0.5 text-[11px] text-[#4b6440]">друг</span>
            ) : null}
          </div>
          <Link
            href={`/community/creators/${item.author.safeId}`}
            className="mt-2 inline-flex text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
          >
            SAFE ID: {item.author.safeId}
          </Link>
        </div>
        <div className="text-right">
          <p className="text-xs text-brand-muted">{formatCommunityDateTime(item.createdAt)}</p>
          <LikeToggleButton
            targetType={item.likeSummary.targetType}
            targetId={item.likeSummary.targetId}
            count={item.likeSummary.count}
            viewerHasLiked={item.viewerHasLiked}
          />
        </div>
      </div>

      {item.content.title ? <p className="mt-4 text-lg font-semibold text-brand-ink">{item.content.title}</p> : null}
      <p className="mt-2 text-sm leading-6 text-brand-muted">{item.content.text}</p>

      {item.content.trackRef ? (
        <div className="mt-4 rounded-2xl border border-brand-border bg-[#f7fbf2] p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Track</p>
          <Link href={item.content.trackRef.href} className="mt-1 inline-flex text-sm font-medium text-brand-ink underline-offset-4 hover:underline">
            {item.content.trackRef.title}
          </Link>
          <p className="mt-1 text-xs text-brand-muted">
            {item.content.trackRef.pathStageName ?? "Этап не выбран"}
            {item.content.trackRef.workbenchStateLabel ? ` • ${item.content.trackRef.workbenchStateLabel}` : ""}
          </p>
        </div>
      ) : null}

      {item.content.feedbackRequestRef ? (
        <div className="mt-4 rounded-2xl border border-[#d9e8cb] bg-[#f4faea] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-brand-ink">{item.content.feedbackRequestRef.typeLabel}</p>
              <p className="text-xs text-brand-muted">
                {item.content.feedbackRequestRef.statusLabel}
                {thread ? ` • ${thread.replyCount} ответов` : ""}
              </p>
            </div>
            {thread ? (
              <span className="rounded-full border border-brand-border bg-white px-2 py-0.5 text-[11px] text-brand-muted">
                {thread.status === "OPEN" ? "Открыт" : thread.status === "CLOSED" ? "Закрыт" : "Архив"}
              </span>
            ) : null}
          </div>
          {item.content.feedbackRequestRef.supportNeedTypes.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.content.feedbackRequestRef.supportNeedTypes.map((need) => (
                <span key={need} className="rounded-full border border-brand-border bg-white px-3 py-1 text-xs text-brand-ink">
                  {supportNeedLabelByType[need]}
                </span>
              ))}
            </div>
          ) : null}
          {item.content.feedbackRequestRef.helpfulActionPrompt ? (
            <p className="mt-2 text-sm text-brand-muted">{item.content.feedbackRequestRef.helpfulActionPrompt}</p>
          ) : null}
          {thread?.repliesPreview.length ? (
            <div className="mt-3 space-y-2">
              {thread.repliesPreview.map((reply) => (
                <div key={reply.id} className="rounded-xl border border-brand-border bg-white px-3 py-2">
                  <p className="text-xs font-medium text-brand-ink">
                    {reply.author.nickname} • {helpfulActionLabelByType[reply.helpfulActionType]}
                  </p>
                  {reply.comment ? <p className="mt-1 text-sm text-brand-muted">{reply.comment}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isFeedbackRequest && thread?.status === "OPEN" ? (
          <Button variant="secondary" className="rounded-xl" onClick={() => onReply(item)}>
            <MessageCircleHeart className="h-4 w-4" />
            Оставить фидбек
          </Button>
        ) : null}
        {item.content.trackRef ? (
          <Link href={item.content.trackRef.href}>
            <Button variant="secondary" className="rounded-xl">Открыть в Songs</Button>
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

export function CommunityPage() {
  const [filter, setFilter] = useState<CommunityFeedFilter>("forYou");
  const [kind, setKind] = useState<CommunityFeedKind>("all");
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [safeIdInput, setSafeIdInput] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<ComposerKind>("PROGRESS");
  const [composerTitle, setComposerTitle] = useState("");
  const [composerText, setComposerText] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommunityFeedItemDto | null>(null);
  const [replyAction, setReplyAction] = useState<CommunityHelpfulActionType>("I_CAN_HELP");
  const [replyComment, setReplyComment] = useState("");
  const [replyWhatWorks, setReplyWhatWorks] = useState("");
  const [replyNotReading, setReplyNotReading] = useState("");
  const [replySags, setReplySags] = useState("");
  const [replyWantToHearNext, setReplyWantToHearNext] = useState("");
  const [internalReplyTarget, setInternalReplyTarget] = useState<IncomingFeedbackRequest | null>(null);
  const [internalReplyWhatWorks, setInternalReplyWhatWorks] = useState("");
  const [internalReplyNotReading, setInternalReplyNotReading] = useState("");
  const [internalReplySags, setInternalReplySags] = useState("");
  const [internalReplyWantToHearNext, setInternalReplyWantToHearNext] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const resetCommunityReplyForm = () => {
    setReplyTarget(null);
    setReplyComment("");
    setReplyWhatWorks("");
    setReplyNotReading("");
    setReplySags("");
    setReplyWantToHearNext("");
  };

  const resetInternalReplyForm = () => {
    setInternalReplyTarget(null);
    setInternalReplyWhatWorks("");
    setInternalReplyNotReading("");
    setInternalReplySags("");
    setInternalReplyWantToHearNext("");
  };

  const overviewQuery = useQuery({
    queryKey: ["community-overview"],
    queryFn: () => fetcher<CommunityOverviewDto>("/api/community/overview")
  });

  const feedQuery = useInfiniteQuery({
    queryKey: ["community-feed", filter, kind],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: "10",
        filter,
        kind
      });
      if (pageParam) params.set("cursor", String(pageParam));
      return fetcher<CommunityFeedResponseDto>(`/api/community/feed?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.paging.nextCursor
  });

  const friendsQuery = useQuery({
    queryKey: ["community-friends"],
    queryFn: () => fetcher<CommunityFriendsResponseDto>("/api/community/friends"),
    enabled: isFriendsOpen
  });

  const incomingFeedbackQuery = useQuery({
    queryKey: ["community-incoming-feedback"],
    queryFn: () => fetcher<IncomingFeedbackRequestsList>("/api/community/feedback-requests/incoming")
  });

  const addFriendMutation = useMutation({
    mutationFn: async (safeId: string) => {
      const response = await apiFetch("/api/community/friendships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safeId })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось отправить запрос в друзья."));
      }
      return response.json();
    },
    onSuccess: async () => {
      toast.success("Запрос в друзья отправлен.");
      setSafeIdInput("");
      setIsAddFriendOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["community-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["community-friends"] }),
        queryClient.invalidateQueries({ queryKey: ["community-feed"] })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить друга.");
    }
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const payload =
        composerKind === "GENERAL"
          ? { text: composerText.trim() }
          : {
              kind: composerKind,
              title: composerTitle.trim() || undefined,
              text: composerText.trim()
            };

      const response = await apiFetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось опубликовать пост."));
      }
      return response.json();
    },
    onSuccess: async () => {
      toast.success("Пост опубликован.");
      setComposerTitle("");
      setComposerText("");
      setIsComposerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось опубликовать пост.");
    }
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const threadId = replyTarget?.content.type === "POST" ? replyTarget.content.feedbackRequestRef?.thread?.id : null;
      if (!threadId) {
        throw new Error("Тред фидбека не найден.");
      }
      const response = await apiFetch(`/api/community/feedback-threads/${threadId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          helpfulActionType: replyAction,
          comment: replyComment.trim() || null,
          sections: {
            whatWorks: replyWhatWorks.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
            notReading: replyNotReading.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
            sags: replySags.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
            wantToHearNext: replyWantToHearNext.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
          }
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось сохранить фидбек."));
      }
      return response.json();
    },
    onSuccess: async () => {
      toast.success("Фидбек отправлен.");
      resetCommunityReplyForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["community-feed"] }),
        queryClient.invalidateQueries({ queryKey: ["community-overview"] })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить фидбек.");
    }
  });

  const internalReplyMutation = useMutation({
    mutationFn: async () => {
      if (!internalReplyTarget) {
        throw new Error("Запрос для ответа не найден.");
      }

      const response = await apiFetch(
        `/api/songs/${internalReplyTarget.track.id}/feedback-requests/${internalReplyTarget.id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sections: {
              whatWorks: internalReplyWhatWorks.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
              notReading: internalReplyNotReading.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
              sags: internalReplySags.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
              wantToHearNext: internalReplyWantToHearNext.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось сохранить ответ."));
      }

      return response.json();
    },
    onSuccess: async () => {
      toast.success("Ответ отправлен.");
      resetInternalReplyForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["community-incoming-feedback"] }),
        queryClient.invalidateQueries({ queryKey: ["community-overview"] })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить ответ.");
    }
  });

  const feedItems = useMemo(() => feedQuery.data?.pages.flatMap((page) => page.items) ?? [], [feedQuery.data]);
  const friendItems = friendsQuery.data?.friends ?? [];
  const incomingFeedbackItems = incomingFeedbackQuery.data?.items ?? [];
  const normalizedSafeId = safeIdInput.trim();
  const hasInternalReplyLines = [
    internalReplyWhatWorks,
    internalReplyNotReading,
    internalReplySags,
    internalReplyWantToHearNext
  ].some((value) => value.trim().length > 0);

  return (
    <div className="space-y-6 pb-8">
      <Card className="relative overflow-hidden rounded-[30px] border-brand-border bg-[linear-gradient(140deg,#eef6df_0%,#f7fbf2_45%,#e7efe0_100%)] p-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,249,157,0.45),transparent_35%),radial-gradient(circle_at_85%_90%,rgba(159,199,179,0.2),transparent_38%)]" />
        <div className="relative space-y-5 p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">Support System</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-ink md:text-5xl">Community</h1>
              <p className="mt-3 text-sm leading-6 text-brand-muted md:text-base">
                Здесь community помогает двигать треки: видеть прогресс, отвечать на запросы фидбека и возвращать артистов обратно в работу.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="h-11 rounded-2xl px-4" onClick={() => setIsFriendsOpen(true)}>
                  <UsersRound className="h-4 w-4" />
                  Мои друзья
                </Button>
                <Button variant="secondary" className="h-11 rounded-2xl px-4" onClick={() => setIsAddFriendOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Добавить друга
                </Button>
                <Button className="h-11 rounded-2xl px-4" onClick={() => setIsComposerOpen(true)}>
                  Новый пост
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Card className="rounded-[22px] bg-white/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Друзья</p>
              <p className="mt-2 text-2xl font-semibold text-brand-ink">{overviewQuery.data?.counts.friends ?? 0}</p>
            </Card>
            <Card className="rounded-[22px] bg-white/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Мои открытые запросы</p>
              <p className="mt-2 text-2xl font-semibold text-brand-ink">{overviewQuery.data?.counts.openFeedbackRequests ?? 0}</p>
            </Card>
            <Card className="rounded-[22px] bg-white/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Где нужен мой взгляд</p>
              <p className="mt-2 text-2xl font-semibold text-brand-ink">{overviewQuery.data?.counts.feedbackRequestsNeedingYourHelp ?? 0}</p>
            </Card>
            <Card className="rounded-[22px] bg-white/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Полученные ответы</p>
              <p className="mt-2 text-2xl font-semibold text-brand-ink">{overviewQuery.data?.counts.receivedHelpfulReplies ?? 0}</p>
            </Card>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Внутренние запросы</h2>
          <p className="mt-1 text-sm text-brand-muted">Здесь лежат запросы на фидбек, отправленные тебе внутри продукта.</p>
        </div>

        {incomingFeedbackQuery.isLoading ? (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Проверяем, где сейчас нужен твой взгляд...</Card>
        ) : incomingFeedbackQuery.error ? (
          <InlineActionMessage
            message={
              incomingFeedbackQuery.error instanceof Error
                ? incomingFeedbackQuery.error.message
                : "Не удалось загрузить внутренние запросы."
            }
            onRetry={() => incomingFeedbackQuery.refetch()}
          />
        ) : incomingFeedbackItems.length ? (
          <div className="space-y-4">
            {incomingFeedbackItems.map((request) => (
              <IncomingFeedbackRequestCard key={request.id} request={request} onReply={setInternalReplyTarget} />
            ))}
          </div>
        ) : (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Сейчас нет внутренних запросов, которые ждут твоего ответа.</Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "forYou" ? "primary" : "secondary"} onClick={() => setFilter("forYou")}>
            Для тебя
          </Button>
          <Button variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
            Все
          </Button>
          <Select value={kind} onChange={(event) => setKind(event.target.value as CommunityFeedKind)} className="w-auto min-w-[180px]">
            <option value="all">Все форматы</option>
            <option value="feedback">Запросы фидбека</option>
            <option value="progress">Прогресс</option>
            <option value="question">Творческие вопросы</option>
            <option value="general">Посты</option>
          </Select>
        </div>

        {feedQuery.isLoading ? (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Собираем community feed...</Card>
        ) : feedQuery.error ? (
          <InlineActionMessage
            message={feedQuery.error instanceof Error ? feedQuery.error.message : "Не удалось загрузить ленту."}
            onRetry={() => feedQuery.refetch()}
          />
        ) : feedItems.length ? (
          <div className="space-y-4">
            {feedItems.map((item) => (
              <FeedCard key={`${item.type}:${item.id}`} item={item} onReply={setReplyTarget} />
            ))}
            {feedQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button variant="secondary" className="rounded-2xl" disabled={feedQuery.isFetchingNextPage} onClick={() => feedQuery.fetchNextPage()}>
                  {feedQuery.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Показать ещё
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Лента пока пустая. Создай первый пост или зайди позже.</Card>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Ивенты</h2>
        </div>
        {overviewQuery.isLoading ? (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Загружаем ивенты...</Card>
        ) : overviewQuery.data?.events.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {overviewQuery.data.events.map((event) => (
              <FeedCard
                key={event.id}
                item={{
                  id: event.id,
                  type: "EVENT",
                  createdAt: event.startsAt,
                  author: { userId: `event:${event.id}`, safeId: `EVENT:${event.slug}`, nickname: event.hostLabel, avatarUrl: null, role: "ADMIN", pathStageName: null },
                  isFriendAuthor: false,
                  likeSummary: event.likeSummary,
                  viewerHasLiked: event.viewerHasLiked,
                  content: {
                    type: "EVENT",
                    title: event.title,
                    description: event.description,
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                    city: event.city,
                    isOnline: event.isOnline,
                    hostLabel: event.hostLabel,
                    slug: event.slug,
                    coverImageUrl: event.coverImageUrl
                  }
                }}
                onReply={setReplyTarget}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Скоро появятся новые события.</Card>
        )}
      </section>

      <Modal open={isFriendsOpen} title="Мои друзья" description="Список друзей, которых ты добавил по SAFE ID." onClose={() => setIsFriendsOpen(false)} widthClassName="max-w-2xl">
        <div className="space-y-3">
          {friendsQuery.isLoading ? (
            <Card className="rounded-[24px] p-4 text-sm text-brand-muted">Загружаем список друзей...</Card>
          ) : friendsQuery.error ? (
            <InlineActionMessage
              message={friendsQuery.error instanceof Error ? friendsQuery.error.message : "Не удалось загрузить друзей."}
              onRetry={() => friendsQuery.refetch()}
            />
          ) : friendItems.length ? (
            friendItems.map((friend) => <FriendListCard key={friend.userId} friend={friend} />)
          ) : (
            <Card className="rounded-[24px] p-4 text-sm leading-6 text-brand-muted">У тебя пока нет друзей в сообществе. Добавь первого по SAFE ID.</Card>
          )}
        </div>
      </Modal>

      <Modal
        open={isAddFriendOpen}
        title="Добавить друга"
        description="Введи SAFE ID друга."
        onClose={() => setIsAddFriendOpen(false)}
        actions={[
          { label: "Отмена", variant: "secondary", onClick: () => setIsAddFriendOpen(false) },
          {
            label: addFriendMutation.isPending ? "Отправляем..." : "Отправить",
            onClick: () => normalizedSafeId && addFriendMutation.mutate(normalizedSafeId),
            disabled: addFriendMutation.isPending || !normalizedSafeId
          }
        ]}
      >
        <Input value={safeIdInput} onChange={(event) => setSafeIdInput(event.target.value)} placeholder="SAFE ID" className="bg-white" />
      </Modal>

      <Modal
        open={isComposerOpen}
        title="Новый пост"
        description="Выбери формат и опубликуй апдейт в community."
        onClose={() => setIsComposerOpen(false)}
        widthClassName="max-w-2xl"
        actions={[
          { label: "Отмена", variant: "secondary", onClick: () => setIsComposerOpen(false) },
          {
            label: createPostMutation.isPending ? "Публикуем..." : "Опубликовать",
            onClick: () => createPostMutation.mutate(),
            disabled: createPostMutation.isPending || !composerText.trim() || (composerKind === "CREATIVE_QUESTION" && !composerTitle.trim())
          }
        ]}
      >
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            {composerKindOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-2xl border p-3 text-left ${composerKind === option.value ? "border-brand-ink bg-white" : "border-brand-border bg-[#f7fbf2]"}`}
                onClick={() => setComposerKind(option.value)}
              >
                <p className="text-sm font-semibold text-brand-ink">{option.label}</p>
                <p className="mt-1 text-xs text-brand-muted">{option.description}</p>
              </button>
            ))}
          </div>
          {composerKind !== "GENERAL" ? (
            <Input value={composerTitle} onChange={(event) => setComposerTitle(event.target.value)} placeholder="Заголовок" className="bg-white" />
          ) : null}
          <Textarea value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder="Что ты хочешь показать или спросить?" rows={5} className="bg-white" />
        </div>
      </Modal>

      <Modal
        open={Boolean(replyTarget)}
        title="Оставить фидбек"
        description="Один тезис на строку. Ответ попадёт в Community и сразу отразится внутри Songs."
        onClose={resetCommunityReplyForm}
        widthClassName="max-w-3xl"
        actions={[
          { label: "Отмена", variant: "secondary", onClick: resetCommunityReplyForm },
          {
            label: replyMutation.isPending ? "Сохраняем..." : "Отправить",
            onClick: () => replyMutation.mutate(),
            disabled: replyMutation.isPending
          }
        ]}
      >
        <div className="space-y-3">
          <Select value={replyAction} onChange={(event) => setReplyAction(event.target.value as CommunityHelpfulActionType)} className="bg-white">
            {replyActionOptions.map((option) => (
              <option key={option} value={option}>
                {helpfulActionLabelByType[option]}
              </option>
            ))}
          </Select>
          <Textarea value={replyComment} onChange={(event) => setReplyComment(event.target.value)} rows={3} placeholder="Короткий комментарий" className="bg-white" />
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea value={replyWhatWorks} onChange={(event) => setReplyWhatWorks(event.target.value)} rows={5} placeholder="Что работает" className="bg-white" />
            <Textarea value={replyNotReading} onChange={(event) => setReplyNotReading(event.target.value)} rows={5} placeholder="Что не считывается" className="bg-white" />
            <Textarea value={replySags} onChange={(event) => setReplySags(event.target.value)} rows={5} placeholder="Где проседает" className="bg-white" />
            <Textarea value={replyWantToHearNext} onChange={(event) => setReplyWantToHearNext(event.target.value)} rows={5} placeholder="Что хочется услышать дальше" className="bg-white" />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(internalReplyTarget)}
        title="Ответить внутри продукта"
        description="Один тезис на строку. Ответ сразу попадёт в трек автора в Songs."
        onClose={resetInternalReplyForm}
        widthClassName="max-w-3xl"
        actions={[
          { label: "Отмена", variant: "secondary", onClick: resetInternalReplyForm },
          {
            label: internalReplyMutation.isPending ? "Сохраняем..." : "Отправить",
            onClick: () => internalReplyMutation.mutate(),
            disabled: internalReplyMutation.isPending || !hasInternalReplyLines
          }
        ]}
      >
        <div className="space-y-3">
          {internalReplyTarget ? (
            <div className="rounded-2xl border border-brand-border bg-[#fbfdf7] p-3">
              <p className="text-sm font-semibold text-brand-ink">{internalReplyTarget.track.title}</p>
              <p className="mt-1 text-xs text-brand-muted">
                {internalReplyTarget.requester.nickname} • SAFE ID: {internalReplyTarget.requester.safeId}
              </p>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                {internalReplyTarget.requestMessage?.trim() || "Запрос без дополнительного комментария."}
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea
              value={internalReplyWhatWorks}
              onChange={(event) => setInternalReplyWhatWorks(event.target.value)}
              rows={5}
              placeholder="Что работает"
              className="bg-white"
            />
            <Textarea
              value={internalReplyNotReading}
              onChange={(event) => setInternalReplyNotReading(event.target.value)}
              rows={5}
              placeholder="Что не считывается"
              className="bg-white"
            />
            <Textarea
              value={internalReplySags}
              onChange={(event) => setInternalReplySags(event.target.value)}
              rows={5}
              placeholder="Где проседает"
              className="bg-white"
            />
            <Textarea
              value={internalReplyWantToHearNext}
              onChange={(event) => setInternalReplyWantToHearNext(event.target.value)}
              rows={5}
              placeholder="Что хочется услышать дальше"
              className="bg-white"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
