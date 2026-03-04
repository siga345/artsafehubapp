"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Link2, Sparkles, UsersRound } from "lucide-react";

import type { ArtistSupportNeedType, CommunityProfileDto } from "@/contracts/community";
import { FriendshipActions } from "@/components/community/friendship-actions";
import { LikeToggleButton } from "@/components/community/like-toggle-button";
import {
  formatCommunityDateTime,
  renderFeedSubtitle,
  roleLabelByType,
  supportNeedLabelByType
} from "@/components/community/community-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineActionMessage } from "@/components/ui/inline-action-message";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { apiFetch, apiFetchJson, readApiErrorMessage } from "@/lib/client-fetch";

async function fetcher<T>(url: string): Promise<T> {
  return apiFetchJson<T>(url);
}

const supportNeedOptions: ArtistSupportNeedType[] = [
  "FEEDBACK",
  "ACCOUNTABILITY",
  "CREATIVE_DIRECTION",
  "COLLABORATION"
];

export function CommunityProfilePage({ safeId }: { safeId: string }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentFocusTitle, setCurrentFocusTitle] = useState("");
  const [currentFocusDetail, setCurrentFocusDetail] = useState("");
  const [seekingSupportDetail, setSeekingSupportDetail] = useState("");
  const [supportNeedTypes, setSupportNeedTypes] = useState<ArtistSupportNeedType[]>([]);
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["community-creator", safeId],
    queryFn: () => fetcher<CommunityProfileDto>(`/api/community/creators/${safeId}`)
  });

  const updateSupportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/community/profile/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentFocusTitle: currentFocusTitle.trim() || null,
          currentFocusDetail: currentFocusDetail.trim() || null,
          seekingSupportDetail: seekingSupportDetail.trim() || null,
          supportNeedTypes
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось сохранить support profile."));
      }
      return response.json();
    },
    onSuccess: async () => {
      toast.success("Support profile обновлён.");
      setIsEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["community-creator", safeId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить support profile.");
    }
  });

  if (query.isLoading) {
    return <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Загружаем профиль креатора...</Card>;
  }

  if (query.error || !query.data) {
    return (
      <InlineActionMessage
        message={query.error instanceof Error ? query.error.message : "Не удалось загрузить профиль."}
        onRetry={() => query.refetch()}
      />
    );
  }

  const profile = query.data;

  function openEditModal() {
    setCurrentFocusTitle(profile.supportProfile.currentFocusTitle ?? "");
    setCurrentFocusDetail(profile.supportProfile.currentFocusDetail ?? "");
    setSeekingSupportDetail(profile.supportProfile.seekingSupportDetail ?? "");
    setSupportNeedTypes(profile.supportProfile.supportNeedTypes);
    setIsEditOpen(true);
  }

  return (
    <div className="space-y-6 pb-8">
      <Link href="/community" className="inline-flex items-center gap-2 text-sm font-medium text-brand-ink hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Назад в community
      </Link>

      <Card className="relative overflow-hidden rounded-[30px] border-brand-border bg-[linear-gradient(140deg,#eef5e5_0%,#ffffff_46%,#edf2e7_100%)] p-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(217,249,157,0.36),transparent_34%),radial-gradient(circle_at_85%_88%,rgba(159,199,179,0.18),transparent_42%)]" />
        <div className="relative space-y-6 p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-brand-border bg-white/90 px-3 py-1 text-xs text-brand-muted">
                  {roleLabelByType[profile.role]}
                </span>
                {profile.pathStageName ? (
                  <span className="rounded-full border border-[#cde1bc] bg-[#eef7df] px-3 py-1 text-xs text-[#4b6440]">
                    {profile.pathStageName}
                  </span>
                ) : null}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-brand-ink md:text-5xl">{profile.nickname}</h1>
                <p className="mt-1 text-sm text-brand-muted">SAFE ID: {profile.safeId}</p>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-brand-muted">
                {profile.identityStatement ?? profile.mission ?? "Креатор сообщества ART SAFE PLACE."}
              </p>
            </div>

            <div className="w-full max-w-sm space-y-3 rounded-[24px] border border-brand-border bg-white/80 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Друзья</p>
                  <p className="mt-1 text-xl font-semibold text-brand-ink">{profile.stats.friendsCount}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Посты</p>
                  <p className="mt-1 text-xl font-semibold text-brand-ink">{profile.stats.postsCount}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Достижения</p>
                  <p className="mt-1 text-xl font-semibold text-brand-ink">{profile.stats.achievementsCount}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Открытые запросы</p>
                  <p className="mt-1 text-xl font-semibold text-brand-ink">{profile.openCommunityFeedbackCount}</p>
                </div>
              </div>
              <FriendshipActions targetUserId={profile.userId} safeId={profile.safeId} friendship={profile.friendship} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card className="rounded-[26px] border-brand-border bg-white/85 p-5 shadow-none">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-muted" />
                  <h2 className="text-lg font-semibold text-brand-ink">Current Focus</h2>
                </div>
                {profile.isViewer ? (
                  <Button variant="secondary" className="rounded-xl" onClick={openEditModal}>
                    Редактировать
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 space-y-4">
                {profile.supportProfile.currentFocusTitle ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Ручной фокус</p>
                    <p className="mt-1 text-sm font-medium text-brand-ink">{profile.supportProfile.currentFocusTitle}</p>
                    {profile.supportProfile.currentFocusDetail ? <p className="mt-1 text-sm text-brand-muted">{profile.supportProfile.currentFocusDetail}</p> : null}
                  </div>
                ) : null}
                {profile.supportProfile.supportNeedTypes.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Какая помощь нужна</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.supportProfile.supportNeedTypes.map((item) => (
                        <span key={item} className="rounded-full border border-brand-border bg-[#eef7df] px-3 py-1 text-xs text-brand-ink">
                          {supportNeedLabelByType[item]}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.supportProfile.seekingSupportDetail ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Что сейчас ищет</p>
                    <p className="mt-1 text-sm text-brand-muted">{profile.supportProfile.seekingSupportDetail}</p>
                  </div>
                ) : null}
                {profile.derivedFocus?.track ? (
                  <div className="rounded-2xl border border-brand-border bg-[#f7fbf2] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Derived from Songs</p>
                    <Link href={profile.derivedFocus.track.href} className="mt-1 inline-flex text-sm font-medium text-brand-ink underline-offset-4 hover:underline">
                      {profile.derivedFocus.track.title}
                    </Link>
                    <p className="mt-1 text-sm text-brand-muted">
                      {profile.derivedFocus.track.workbenchStateLabel ?? "В работе"}
                      {profile.derivedFocus.track.pathStageName ? ` • ${profile.derivedFocus.track.pathStageName}` : ""}
                    </p>
                    {profile.derivedFocus.nextStepTitle ? (
                      <p className="mt-2 text-sm text-brand-ink">
                        Следующий шаг: {profile.derivedFocus.nextStepTitle}
                        {profile.derivedFocus.nextStepDetail ? ` — ${profile.derivedFocus.nextStepDetail}` : ""}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-brand-muted">
                      Открытых пунктов фидбека: {profile.derivedFocus.unresolvedFeedbackCount}
                    </p>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="rounded-[26px] border-brand-border bg-white/85 p-5 shadow-none">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-brand-muted" />
                <h2 className="text-lg font-semibold text-brand-ink">Мир артиста</h2>
              </div>
              <div className="mt-4 space-y-4">
                {profile.identityStatement ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Кто он как артист</p>
                    <p className="mt-1 text-sm leading-6 text-brand-ink">{profile.identityStatement}</p>
                  </div>
                ) : null}
                {profile.mission ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Миссия</p>
                    <p className="mt-1 text-sm leading-6 text-brand-ink">{profile.mission}</p>
                  </div>
                ) : null}
                {profile.coreThemes.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Темы</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.coreThemes.map((item) => (
                        <span key={item} className="rounded-full border border-brand-border bg-[#f3f7ee] px-3 py-1 text-xs text-brand-ink">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.aestheticKeywords.length ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-brand-muted">Эстетика</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.aestheticKeywords.map((item) => (
                        <span key={item} className="rounded-full border border-brand-border bg-white px-3 py-1 text-xs text-brand-muted">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.links.bandlink ? (
                  <a href={profile.links.bandlink} target="_blank" rel="noreferrer" className="inline-flex text-sm text-brand-ink underline-offset-4 hover:underline">
                    Bandlink
                  </a>
                ) : (
                  <p className="text-sm text-brand-muted">Публичные ссылки пока не добавлены.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-brand-muted" />
          <h2 className="text-2xl font-semibold tracking-tight text-brand-ink">Публичная активность</h2>
        </div>

        {profile.recentActivity.length ? (
          <div className="space-y-4">
            {profile.recentActivity.map((item) => (
              <Card key={`${item.type}:${item.id}`} className="rounded-[28px] border-brand-border bg-white/90 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{renderFeedSubtitle(item)}</p>
                    <p className="mt-1 text-xs text-brand-muted">{formatCommunityDateTime(item.createdAt)}</p>
                  </div>
                  <LikeToggleButton
                    targetType={item.likeSummary.targetType}
                    targetId={item.likeSummary.targetId}
                    count={item.likeSummary.count}
                    viewerHasLiked={item.viewerHasLiked}
                  />
                </div>

                <div className="mt-3 text-sm leading-6 text-brand-ink">
                  {item.content.type === "POST" ? item.content.text : null}
                  {item.content.type === "ACHIEVEMENT" ? (
                    <div className="space-y-1">
                      <p className="font-semibold">{item.content.title}</p>
                      <p className="text-brand-muted">{item.content.body}</p>
                    </div>
                  ) : null}
                  {item.content.type === "EVENT" ? (
                    <div className="space-y-1">
                      <p className="font-semibold">{item.content.title}</p>
                      <p className="text-brand-muted">{item.content.description}</p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-[28px] p-5 text-sm text-brand-muted">Публичная активность пока не опубликована.</Card>
        )}
      </section>

      <Modal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Редактировать Current Focus"
        description="Настрой, над чем ты сейчас работаешь и какая помощь тебе нужна."
        widthClassName="max-w-2xl"
        actions={[
          { label: "Отмена", variant: "secondary", onClick: () => setIsEditOpen(false) },
          {
            label: updateSupportMutation.isPending ? "Сохраняем..." : "Сохранить",
            onClick: () => updateSupportMutation.mutate(),
            disabled: updateSupportMutation.isPending
          }
        ]}
      >
        <div className="space-y-3">
          <Input value={currentFocusTitle} onChange={(event) => setCurrentFocusTitle(event.target.value)} placeholder="Что сейчас в фокусе" className="bg-white" />
          <Textarea value={currentFocusDetail} onChange={(event) => setCurrentFocusDetail(event.target.value)} rows={4} placeholder="Коротко опиши текущую работу" className="bg-white" />
          <Textarea value={seekingSupportDetail} onChange={(event) => setSeekingSupportDetail(event.target.value)} rows={4} placeholder="Какой помощи ты ищешь" className="bg-white" />
          <div className="flex flex-wrap gap-2">
            {supportNeedOptions.map((item) => {
              const selected = supportNeedTypes.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-brand-ink bg-white text-brand-ink" : "border-brand-border bg-[#f3f7ee] text-brand-muted"}`}
                  onClick={() =>
                    setSupportNeedTypes((prev) => (prev.includes(item) ? prev.filter((value) => value !== item) : [...prev, item]))
                  }
                >
                  {supportNeedLabelByType[item]}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
