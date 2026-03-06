import {
  LearnApplicationTargetType,
  LearnContextSurface
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recommendationContextSchema } from "@/contracts/recommendations";
import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { getLearnMaterialRecordBySlug } from "@/lib/learn/repository";
import { applyLearnProgressMutation } from "@/lib/learn/progress";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const progressMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("OPEN"),
    surface: z.nativeEnum(LearnContextSurface),
    recommendationContext: recommendationContextSchema.optional()
  }),
  z.object({
    action: z.literal("APPLY"),
    surface: z.nativeEnum(LearnContextSurface),
    targetType: z.nativeEnum(LearnApplicationTargetType),
    targetId: z.string().trim().min(1),
    recommendationContext: recommendationContextSchema.optional()
  }),
  z.object({
    action: z.literal("LATER"),
    surface: z.nativeEnum(LearnContextSurface),
    recommendationContext: recommendationContextSchema.optional()
  }),
  z.object({
    action: z.literal("NOT_RELEVANT"),
    surface: z.nativeEnum(LearnContextSurface),
    recommendationContext: recommendationContextSchema.optional()
  })
]);

export const POST = withApiHandler(async (request: Request, context: { params: { slug: string } }) => {
  const user = await requireUser();
  if (user.role !== "ARTIST") {
    throw apiError(403, "Forbidden");
  }

  const material = await getLearnMaterialRecordBySlug(prisma, context.params.slug);
  if (!material) {
    throw apiError(404, "Resource not found");
  }

  const body = await parseJsonBody(request, progressMutationSchema);
  const result = await applyLearnProgressMutation(prisma, user.id, material.id, body);

  return NextResponse.json(result);
});
