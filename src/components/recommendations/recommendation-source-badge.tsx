"use client";

import { Badge } from "@/components/ui/badge";
import type { RecommendationSource } from "@/contracts/recommendations";
import { getRecommendationSourceLabel } from "@/lib/recommendations";

type Props = {
  source: RecommendationSource;
};

export function RecommendationSourceBadge({ source }: Props) {
  return <Badge className="border-brand-border bg-white text-brand-muted">{getRecommendationSourceLabel(source)}</Badge>;
}
