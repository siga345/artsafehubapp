import { CommunityFeedbackThreadStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { updateCommunityFeedbackThreadStatus } from "@/lib/community/service";

const updateCommunityFeedbackThreadSchema = z.object({
  status: z.nativeEnum(CommunityFeedbackThreadStatus)
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateCommunityFeedbackThreadSchema);
  const updated = await updateCommunityFeedbackThreadStatus(prisma, user.id, params.id, body.status);
  return NextResponse.json({ id: updated.id, status: updated.status });
});
