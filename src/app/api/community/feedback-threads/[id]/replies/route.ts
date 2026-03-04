import { CommunityHelpfulActionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { createCommunityFeedbackReply } from "@/lib/community/service";

const createCommunityFeedbackReplySchema = z.object({
  helpfulActionType: z.nativeEnum(CommunityHelpfulActionType),
  comment: z.string().max(1000).optional().nullable(),
  sections: z.object({
    whatWorks: z.array(z.string().max(1000)).default([]),
    notReading: z.array(z.string().max(1000)).default([]),
    sags: z.array(z.string().max(1000)).default([]),
    wantToHearNext: z.array(z.string().max(1000)).default([])
  })
});

export const POST = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createCommunityFeedbackReplySchema);

  const created = await createCommunityFeedbackReply(prisma, user.id, params.id, body);

  return NextResponse.json(
    {
      id: created.reply.id,
      itemsCount: created.reply.items.length
    },
    { status: 201 }
  );
});
