import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { canonicalizeSongStage } from "@/lib/song-stages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async () => {
  await requireUser();

  const stages = await prisma.pathStage.findMany({
    orderBy: { order: "asc" }
  });

  return NextResponse.json(stages.map((stage) => canonicalizeSongStage(stage)));
});
