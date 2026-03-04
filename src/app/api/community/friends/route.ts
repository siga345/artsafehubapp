import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { getCommunityFriends } from "@/lib/community/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const payload = await getCommunityFriends(prisma, user.id);
  return NextResponse.json(payload);
});
