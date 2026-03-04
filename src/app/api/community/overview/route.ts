import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { getCommunityOverview } from "@/lib/community/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const payload = await getCommunityOverview(prisma, user.id);
  return NextResponse.json(payload);
});
