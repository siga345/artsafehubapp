import { NextResponse } from "next/server";

import { communityFeedFilterSchema, communityFeedKindSchema } from "@/contracts/community";
import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { getCommunityFeed } from "@/lib/community/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "12", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 40) : 12;
  const cursor = searchParams.get("cursor");
  const filter = communityFeedFilterSchema.catch("forYou").parse(searchParams.get("filter") ?? "forYou");
  const kind = communityFeedKindSchema.catch("all").parse(searchParams.get("kind") ?? "all");

  const payload = await getCommunityFeed(prisma, user.id, filter, limit, cursor, kind);
  return NextResponse.json(payload);
});
