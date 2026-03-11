import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { attendCommunityEvent, leaveCommunityEvent } from "@/lib/community/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withApiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const payload = await attendCommunityEvent(prisma, user.id, params.id);
  return NextResponse.json(payload, { status: 201 });
});

export const DELETE = withApiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const payload = await leaveCommunityEvent(prisma, user.id, params.id);
  return NextResponse.json(payload);
});
