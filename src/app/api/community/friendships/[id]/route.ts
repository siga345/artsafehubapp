import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { updateFriendship } from "@/lib/community/service";

const updateFriendshipSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE", "CANCEL", "REMOVE"])
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateFriendshipSchema);
  const state = await updateFriendship(prisma, user.id, params.id, body.action);
  return NextResponse.json(state);
});
