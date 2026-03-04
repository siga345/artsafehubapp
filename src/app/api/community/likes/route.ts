import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { toggleCommunityLike } from "@/lib/community/service";

const toggleLikeSchema = z.object({
  targetType: z.enum(["POST", "ACHIEVEMENT", "EVENT"]),
  targetId: z.string().min(1)
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, toggleLikeSchema);
  const payload = await toggleCommunityLike(prisma, user.id, body.targetType, body.targetId);
  return NextResponse.json(payload);
});
