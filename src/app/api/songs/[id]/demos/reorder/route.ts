import { NextResponse } from "next/server";
import { DemoVersionType } from "@prisma/client";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const reorderDemosSchema = z.object({
  versionType: z.nativeEnum(DemoVersionType),
  orderedDemoIds: z.array(z.string().min(1)).min(1)
}).superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const id of value.orderedDemoIds) {
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["orderedDemoIds"],
        message: "orderedDemoIds must be unique"
      });
      return;
    }
    seen.add(id);
  }
});

export const POST = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, reorderDemosSchema);

  const track = await prisma.track.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, projectId: true }
  });

  if (!track) {
    throw apiError(404, "Track not found");
  }

  const demosInStep = await prisma.demo.findMany({
    where: { trackId: track.id, versionType: body.versionType },
    select: { id: true, trackId: true, versionType: true }
  });

  const expectedIds = demosInStep.map((demo) => demo.id);
  const actualIds = body.orderedDemoIds;

  if (expectedIds.length !== actualIds.length) {
    throw apiError(400, "orderedDemoIds must include all demos of this versionType");
  }

  const expectedSet = new Set(expectedIds);
  for (const id of actualIds) {
    if (!expectedSet.has(id)) {
      throw apiError(400, "orderedDemoIds contains invalid demo for this track/versionType");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const [sortIndex, demoId] of actualIds.entries()) {
      await tx.demo.update({
        where: { id: demoId },
        data: { sortIndex }
      });
    }

    await tx.track.update({
      where: { id: track.id },
      data: { updatedAt: new Date() }
    });

    if (track.projectId) {
      await tx.project.update({
        where: { id: track.projectId },
        data: { updatedAt: new Date() }
      });
    }
  });

  return NextResponse.json({ ok: true });
});
