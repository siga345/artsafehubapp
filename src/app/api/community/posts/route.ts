import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import {
  createCreativeQuestionPost,
  createGeneralCommunityPost,
  createProgressCommunityPost
} from "@/lib/community/service";

const createPostSchema = z.union([
  z.object({
    kind: z.literal("GENERAL").optional(),
    text: z.string().trim().min(1).max(2800)
  }),
  z.object({
    kind: z.literal("PROGRESS"),
    title: z.string().trim().max(160).optional().nullable(),
    text: z.string().trim().min(1).max(2800),
    trackId: z.string().trim().min(1).optional().nullable(),
    demoId: z.string().trim().min(1).optional().nullable()
  }),
  z.object({
    kind: z.literal("CREATIVE_QUESTION"),
    title: z.string().trim().min(1).max(160),
    text: z.string().trim().min(1).max(2800),
    trackId: z.string().trim().min(1).optional().nullable(),
    demoId: z.string().trim().min(1).optional().nullable()
  })
]);

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createPostSchema);

  const created =
    body.kind === "PROGRESS"
      ? await createProgressCommunityPost(prisma, user.id, body)
      : body.kind === "CREATIVE_QUESTION"
        ? await createCreativeQuestionPost(prisma, user.id, body)
        : await createGeneralCommunityPost(prisma, user.id, body.text);
  return NextResponse.json(created, { status: 201 });
});
