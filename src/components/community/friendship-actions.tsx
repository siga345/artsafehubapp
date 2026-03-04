"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { FriendshipStateDto } from "@/contracts/community";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch, readApiErrorMessage } from "@/lib/client-fetch";
import { getFriendshipPrimaryAction, getFriendshipSecondaryAction } from "@/components/community/community-utils";

type FriendshipActionsProps = {
  targetUserId: string;
  safeId?: string;
  friendship: FriendshipStateDto;
  compact?: boolean;
};

export function FriendshipActions({ targetUserId, safeId, friendship, compact = false }: FriendshipActionsProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const hasAnyAction =
    friendship.canSendRequest ||
    friendship.canAccept ||
    friendship.canDecline ||
    friendship.canCancel ||
    friendship.canRemove;

  const primaryAction = getFriendshipPrimaryAction(friendship);
  const secondaryAction = getFriendshipSecondaryAction(friendship);

  const mutation = useMutation({
    mutationFn: async (action: "send" | "accept" | "decline" | "cancel" | "remove") => {
      if (action === "send") {
        const response = await apiFetch("/api/community/friendships", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId })
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, "Не удалось отправить запрос в друзья."));
        }
        return response.json();
      }

      if (!friendship.friendshipId) {
        throw new Error("Не найден ID связи.");
      }

      const mappedAction =
        action === "accept"
          ? "ACCEPT"
          : action === "decline"
            ? "DECLINE"
            : action === "cancel"
              ? "CANCEL"
              : "REMOVE";

      const response = await apiFetch(`/api/community/friendships/${friendship.friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mappedAction })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, "Не удалось обновить статус дружбы."));
      }
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["community-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["community-friends"] }),
        queryClient.invalidateQueries({ queryKey: ["community-feed"] }),
        safeId ? queryClient.invalidateQueries({ queryKey: ["community-creator", safeId] }) : Promise.resolve()
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить дружбу.");
    }
  });

  if (!hasAnyAction) {
    return null;
  }

  return (
    <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-2`}>
      <Button
        variant={friendship.state === "NONE" || friendship.state === "INCOMING_PENDING" ? "primary" : "secondary"}
        className={compact ? "h-9 w-full rounded-xl px-3 text-xs" : "h-9 rounded-xl px-3 text-xs"}
        disabled={mutation.isPending || !primaryAction}
        onClick={() => mutation.mutate(primaryAction.action)}
      >
        {mutation.isPending ? "..." : primaryAction.label}
      </Button>
      {secondaryAction ? (
        <Button
          variant="ghost"
          className={compact ? "h-9 w-full rounded-xl px-3 text-xs" : "h-9 rounded-xl px-3 text-xs"}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(secondaryAction.action)}
        >
          {secondaryAction.label}
        </Button>
      ) : null}
    </div>
  );
}
