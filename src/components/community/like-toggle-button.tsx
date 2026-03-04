"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

import type { CommunityLikeTargetType } from "@/contracts/community";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch, readApiErrorMessage } from "@/lib/client-fetch";

type LikeToggleButtonProps = {
  targetType: CommunityLikeTargetType;
  targetId: string;
  count: number;
  viewerHasLiked: boolean;
};

export function LikeToggleButton({ targetType, targetId, count, viewerHasLiked }: LikeToggleButtonProps) {
  const toast = useToast();
  const [liked, setLiked] = useState(viewerHasLiked);
  const [likesCount, setLikesCount] = useState(count);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setLiked(viewerHasLiked);
    setLikesCount(count);
  }, [count, viewerHasLiked]);

  return (
    <Button
      variant="ghost"
      className={`h-8 rounded-xl px-2.5 text-xs ${liked ? "bg-[#ffe9ec] text-[#9f1239] hover:bg-[#ffdce4]" : ""}`}
      disabled={pending}
      onClick={async () => {
        const nextLiked = !liked;
        setPending(true);
        setLiked(nextLiked);
        setLikesCount((current) => Math.max(0, current + (nextLiked ? 1 : -1)));

        try {
          const response = await apiFetch("/api/community/likes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetType, targetId })
          });
          if (!response.ok) {
            throw new Error(await readApiErrorMessage(response, "Не удалось поставить лайк."));
          }
          const payload = (await response.json()) as { count: number; viewerHasLiked: boolean };
          setLiked(payload.viewerHasLiked);
          setLikesCount(payload.count);
        } catch (error) {
          setLiked(!nextLiked);
          setLikesCount((current) => Math.max(0, current + (nextLiked ? -1 : 1)));
          toast.error(error instanceof Error ? error.message : "Не удалось поставить лайк.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
      {likesCount}
    </Button>
  );
}
