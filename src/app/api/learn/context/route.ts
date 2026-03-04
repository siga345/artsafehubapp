import { z } from "zod";
import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { getLearnContextBlock } from "@/lib/learn/context";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const surfaceSchema = z.enum(["TODAY", "GOALS", "SONGS"]);

export const GET = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  if (user.role !== "ARTIST") {
    throw apiError(403, "Forbidden");
  }

  const { searchParams } = new URL(request.url);
  const parsedSurface = surfaceSchema.safeParse(searchParams.get("surface"));
  if (!parsedSurface.success) {
    throw apiError(400, "Некорректная поверхность Learn.");
  }

  const rawLimit = Number(searchParams.get("limit"));
  const block = await getLearnContextBlock(prisma, user.id, {
    surface: parsedSurface.data,
    trackId: searchParams.get("trackId")?.trim() || undefined,
    goalId: searchParams.get("goalId")?.trim() || undefined,
    limit: Number.isFinite(rawLimit) ? rawLimit : undefined
  });

  return NextResponse.json(block);
});
