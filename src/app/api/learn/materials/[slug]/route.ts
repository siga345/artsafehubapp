import { NextResponse } from "next/server";

import { withApiHandler, apiError } from "@/lib/api";
import { getLearnMaterialBySlug } from "@/lib/learn/repository";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async (_request: Request, context: { params: { slug: string } }) => {
  const user = await requireUser();
  if (user.role !== "ARTIST") {
    throw apiError(403, "Forbidden");
  }

  const material = await getLearnMaterialBySlug(prisma, user.id, context.params.slug);
  if (!material) {
    throw apiError(404, "Resource not found");
  }

  return NextResponse.json(material);
});
