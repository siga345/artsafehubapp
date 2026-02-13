import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const idUpdateSchema = z.object({
  nickname: z.string().min(1).max(80),
  avatarUrl: z.string().url().optional().nullable(),
  telegram: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  youtube: z.string().url().optional().nullable(),
  notificationsEnabled: z.boolean(),
  demosPrivate: z.boolean()
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      safeId: true,
      nickname: true,
      avatarUrl: true,
      links: true,
      notificationsEnabled: true,
      demosPrivate: true
    }
  });

  return NextResponse.json(profile);
});

export const PATCH = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, idUpdateSchema);

  const links = {
    telegram: body.telegram ?? "",
    website: body.website ?? "",
    youtube: body.youtube ?? ""
  };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      nickname: body.nickname.trim(),
      avatarUrl: body.avatarUrl ?? null,
      links,
      notificationsEnabled: body.notificationsEnabled,
      demosPrivate: body.demosPrivate
    },
    select: {
      id: true,
      safeId: true,
      nickname: true,
      avatarUrl: true,
      links: true,
      notificationsEnabled: true,
      demosPrivate: true
    }
  });

  return NextResponse.json(updated);
});
