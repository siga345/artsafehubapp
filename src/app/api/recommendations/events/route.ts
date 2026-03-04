import { NextResponse } from "next/server";

import { recommendationEventInputSchema } from "@/contracts/recommendations";
import { parseJsonBody, withApiHandler } from "@/lib/api";
import { createRecommendationEvent } from "@/lib/recommendation-logging";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, recommendationEventInputSchema);

  await createRecommendationEvent(prisma, {
    userId: user.id,
    recommendationKey: body.recommendationKey,
    surface: body.surface,
    kind: body.kind,
    eventType: body.eventType,
    source: body.source,
    entityType: body.entityType,
    entityId: body.entityId,
    trackId: body.trackId,
    goalId: body.goalId,
    materialKey: body.materialKey,
    payload: body.payload
  });

  return new NextResponse(null, { status: 204 });
});
