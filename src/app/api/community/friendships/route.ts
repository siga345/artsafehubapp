import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { createFriendRequest, createFriendRequestBySafeId } from "@/lib/community/service";

const createFriendshipSchema = z.union([
  z.object({
    targetUserId: z.string().min(1)
  }),
  z.object({
    safeId: z.string().trim().min(1)
  })
]);

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createFriendshipSchema);
  const state =
    "safeId" in body
      ? await createFriendRequestBySafeId(prisma, user.id, body.safeId)
      : await createFriendRequest(prisma, user.id, body.targetUserId);
  return NextResponse.json(state, { status: 201 });
});
