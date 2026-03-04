import { NextResponse } from "next/server";

import { withApiHandler, apiError } from "@/lib/api";
import { getLearnCatalog } from "@/lib/learn/repository";
import type { LearnCatalogQuery } from "@/lib/learn/types";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseFeatured(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export const GET = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  if (user.role !== "ARTIST") {
    throw apiError(403, "Forbidden");
  }

  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type");

  const query: LearnCatalogQuery = {
    q: searchParams.get("q")?.trim() || undefined,
    tag: searchParams.get("tag")?.trim() || undefined,
    featured: parseFeatured(searchParams.get("featured"))
  };
  const rawStatus = searchParams.get("status");

  if (rawStatus === "OPEN" || rawStatus === "APPLIED" || rawStatus === "NOT_RELEVANT" || rawStatus === "LATER") {
    query.status = rawStatus;
  }

  if (rawType === "VIDEO" || rawType === "ARTICLE") {
    query.type = rawType;
  }

  const catalog = await getLearnCatalog(prisma, user.id, query);
  return NextResponse.json(catalog);
});
