import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const onboardingSchema = z.object({
  action: z.enum(["DISMISS", "RESTORE"])
});

export const PATCH = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, onboardingSchema);

  const updated = await prisma.userOnboardingState.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      dismissedAt: body.action === "DISMISS" ? new Date() : null
    },
    update: {
      dismissedAt: body.action === "DISMISS" ? new Date() : null
    }
  });

  return NextResponse.json({
    dismissedAt: updated.dismissedAt ? updated.dismissedAt.toISOString() : null
  });
});
