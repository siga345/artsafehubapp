"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarDays, Loader2, Sparkles, UserPlus, UsersRound } from "lucide-react";

import type {
  CommunityEventCardDto,
  CommunityFeedItemDto,
  CommunityFeedResponseDto,
  CommunityFriendsResponseDto,
  CommunityOverviewDto,
  FeaturedCreatorCardDto
} from "@/contracts/community";
import { FriendshipActions } from "@/components/community/friendship-actions";
import { LikeToggleButton } from "@/components/community/like-toggle-button";
import { eventMeta, formatCommunityDateTime, roleLabelByType } from "@/components/community/community-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

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

function EventCard({
  event,
  onToggleAttendance,
  isPending
}: {
  event: CommunityEventCardDto;
  onToggleAttendance: (event: CommunityEventCardDto) => void;
  isPending: boolean;
}) {
  return (
    <Card className="rounded-[28px] border-brand-border bg-white/90 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-brand-border bg-[#f4faea] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[#4b6440]">
              {event.isOnline ? "Онлайн" : event.city ?? "Оффлайн"}
            </span>
            {event.viewerIsAttending ? (
              <span className="rounded-full border border-brand-border bg-white px-3 py-1 text-[11px] text-brand-ink">
                Ты идёшь
              </span>
            ) : null}
          </div>
          <div>
            <p className="text-lg font-semibold text-brand-ink">{event.title}</p>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{event.description}</p>
          </div>
          <div className="space-y-1 text-xs text-brand-muted">
            <p>{eventMeta(event)}</p>
            <p>
              {event.hostLabel} • {event.attendeeCount} записались
            </p>
          </div>
        </div>

        <LikeToggleButton
          targetType={event.likeSummary.targetType}
          targetId={event.likeSummary.targetId}
          count={event.likeSummary.count}
          viewerHasLiked={event.viewerHasLiked}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={event.viewerIsAttending ? "secondary" : "primary"} className="rounded-xl" disabled={isPending} onClick={() => onToggleAttendance(event)}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
          {event.viewerIsAttending ? "Отменить запись" : "Записаться"}
        </Button>
      </div>
    </Card>
  );
}

function FriendAchievementCard({ item }: { item: CommunityFeedItemDto }) {
  if (item.content.type !== "ACHIEVEMENT") return null;

  return (
    <Card className="rounded-[28px] border-brand-border bg-white/90 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-brand-ink">{item.author.nickname}</span>
            <span className="rounded-full border border-brand-border bg-[#f3f7ee] px-2 py-0.5 text-[11px] text-brand-muted">
              {roleLabelByType[item.author.role]}
            </span>
            {item.author.pathStageName ? (
              <span className="rounded-full border border-[#d6e7c8] bg-[#eff7e3] px-2 py-0.5 text-[11px] text-[#4b6440]">
                {item.author.pathStageName}
              </span>
            ) : null}
          </div>
          <Link
            href={`/community/creators/${item.author.safeId}`}
            className="mt-2 inline-flex text-xs font-medium text-brand-ink underline-offset-4 hover:underline"
          >
            SAFE ID: {item.author.safeId}
          </Link>
          <p className="mt-2 text-xs text-brand-muted">{formatCommunityDateTime(item.createdAt)}</p>
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

export function CommunityPage() {
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [safeIdInput, setSafeIdInput] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["community-overview"],
    queryFn: () => fetcher<CommunityOverviewDto>("/api/community/overview")
  });

  const eventsQuery = useQuery({
    queryKey: ["community-events"],
    queryFn: () => fetcher<{ items: CommunityEventCardDto[] }>("/api/community/events?limit=6")
  });

  const achievementsQuery = useInfiniteQuery({
    queryKey: ["community-friend-achievements"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "8" });
      if (pageParam) params.set("cursor", String(pageParam));
      return fetcher<CommunityFeedResponseDto>(`/api/community/friend-achievements?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.paging.nextCursor
  });

  const friendsQuery = useQuery({
    queryKey: ["community-friends"],
    queryFn: () => fetcher<CommunityFriendsResponseDto>("/api/community/friends"),
    enabled: isFriendsOpen
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
        queryClient.invalidateQueries({ queryKey: ["community-friend-achievements"] })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить друга.");
    }
  });

  const attendanceMutation = useMutation({
    mutationFn: async (event: CommunityEventCardDto) => {
      const response = await apiFetch(`/api/community/events/${event.id}/attendance`, {
        method: event.viewerIsAttending ? "DELETE" : "POST"
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить запись на ивент."));
      }
      return { nextEvent: (await response.json()) as CommunityEventCardDto, wasAttending: event.viewerIsAttending };
    },
    onSuccess: async ({ wasAttending }) => {
      toast.success(wasAttending ? "Запись на ивент отменена." : "Ты записан на ивент.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["community-events"] }),
        queryClient.invalidateQueries({ queryKey: ["community-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["community-creator"] })
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить запись на ивент.");
    }
  });

  const achievementItems = useMemo(
    () => achievementsQuery.data?.pages.flatMap((page) => page.items).filter((item) => item.content.type === "ACHIEVEMENT") ?? [],
    [achievementsQuery.data]
  );
  const friendItems = friendsQuery.data?.friends ?? [];
  const eventItems = eventsQuery.data?.items ?? [];
  const normalizedSafeId = safeIdInput.trim();
  const emptyFeedBecauseNoFriends = (overviewQuery.data?.counts.friends ?? 0) === 0;

  return (
    <div className="space-y-6 pb-8">
      <Card className="relative overflow-hidden rounded-[30px] border-brand-border bg-[linear-gradient(140deg,#eef6df_0%,#f7fbf2_45%,#e7efe0_100%)] p-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,249,157,0.45),transparent_35%),radial-gradient(circle_at_85%_90%,rgba(159,199,179,0.2),transparent_38%)]" />
        <div className="relative space-y-5 p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">Community</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-ink md:text-5xl">Events + Friends Wins</h1>
              <p className="mt-3 text-sm leading-6 text-brand-muted md:text-base">
                Здесь люди собираются в одно: идут на наши онлайн и оффлайн ивенты, видят рост друзей и не сходят со своего пути.
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
              </div>
            </div>
          </div>

        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-brand-muted" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Ивенты ART SAFE PLACE</h2>
            <p className="mt-1 text-sm text-brand-muted">Онлайн и оффлайн точки сборки сообщества. Запись прямо внутри приложения.</p>
          </div>
        </div>

        {eventsQuery.isLoading ? (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Загружаем ивенты...</Card>
        ) : eventsQuery.error ? (
          <InlineActionMessage
            message={eventsQuery.error instanceof Error ? eventsQuery.error.message : "Не удалось загрузить ивенты."}
            onRetry={() => eventsQuery.refetch()}
          />
        ) : eventItems.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {eventItems.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isPending={attendanceMutation.isPending && attendanceMutation.variables?.id === event.id}
                onToggleAttendance={(target) => attendanceMutation.mutate(target)}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Скоро появятся новые события.</Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-muted" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Рост друзей</h2>
            <p className="mt-1 text-sm text-brand-muted">Лента достижений друзей, которая держит в движении и напоминает, что путь реально идёт.</p>
          </div>
        </div>

        {achievementsQuery.isLoading ? (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Собираем достижения друзей...</Card>
        ) : achievementsQuery.error ? (
          <InlineActionMessage
            message={achievementsQuery.error instanceof Error ? achievementsQuery.error.message : "Не удалось загрузить ленту достижений."}
            onRetry={() => achievementsQuery.refetch()}
          />
        ) : achievementItems.length ? (
          <div className="space-y-4">
            {achievementItems.map((item) => (
              <FriendAchievementCard key={`${item.type}:${item.id}`} item={item} />
            ))}
            {achievementsQuery.hasNextPage ? (
              <div className="flex justify-center">
                <Button
                  variant="secondary"
                  className="rounded-2xl"
                  disabled={achievementsQuery.isFetchingNextPage}
                  onClick={() => achievementsQuery.fetchNextPage()}
                >
                  {achievementsQuery.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Показать ещё
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <Card className="rounded-[28px] border-brand-border bg-white/90 p-6">
            <div className="max-w-2xl space-y-3">
              <p className="text-lg font-semibold text-brand-ink">
                {emptyFeedBecauseNoFriends ? "Собери свой круг в Community" : "У друзей пока нет новых milestones"}
              </p>
              <p className="text-sm leading-6 text-brand-muted">
                {emptyFeedBecauseNoFriends
                  ? "Добавь друзей по SAFE ID, чтобы видеть их реальные сдвиги и держаться в общем росте."
                  : "Как только у друзей появятся новые этапы пути, демо или релизные сдвиги, они появятся здесь."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button className="rounded-xl" onClick={() => setIsAddFriendOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Добавить друга по SAFE ID
                </Button>
                <Button variant="secondary" className="rounded-xl" onClick={() => setIsFriendsOpen(true)}>
                  <UsersRound className="h-4 w-4" />
                  Открыть друзей
                </Button>
              </div>
            </div>
          </Card>
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
    </div>
  );
}
