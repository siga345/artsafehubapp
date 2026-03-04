import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { getCommunityProfile } from "@/lib/community/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async (_request: Request, { params }: { params: { safeId: string } }) => {
  const user = await requireUser();
  const payload = await getCommunityProfile(prisma, user.id, params.safeId);
  return NextResponse.json(payload);
});
