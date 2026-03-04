import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { updateCommunitySupportProfile } from "@/lib/community/service";

const updateCommunitySupportProfileSchema = z.object({
  currentFocusTitle: z.string().max(160).optional().nullable(),
  currentFocusDetail: z.string().max(1000).optional().nullable(),
  seekingSupportDetail: z.string().max(1000).optional().nullable(),
  supportNeedTypes: z.array(z.enum(["FEEDBACK", "ACCOUNTABILITY", "CREATIVE_DIRECTION", "COLLABORATION"])).max(4)
});

export const PATCH = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateCommunitySupportProfileSchema);
  const profile = await updateCommunitySupportProfile(prisma, user.id, body);
  return NextResponse.json({
    currentFocusTitle: profile.currentFocusTitle,
    currentFocusDetail: profile.currentFocusDetail,
    seekingSupportDetail: profile.seekingSupportDetail,
    supportNeedTypes: profile.supportNeedTypes
  });
});
