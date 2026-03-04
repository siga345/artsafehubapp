import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { getCommunityEvents } from "@/lib/community/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "8", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 24) : 8;
  const cursor = searchParams.get("cursor");

  const payload = await getCommunityEvents(prisma, user.id, limit, cursor);
  return NextResponse.json(payload);
});
