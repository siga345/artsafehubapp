import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseBoolean(value: string | null) {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

const findCategories = ["PRODUCER", "AUDIO_ENGINEER", "RECORDING_STUDIO", "PROMO_CREW"] as const;
type FindCategory = (typeof findCategories)[number];
const allowedCategories = new Set<FindCategory>(findCategories);

export const GET = withApiHandler(async (request: Request) => {
  await requireUser();
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q")?.trim() ?? "";
  const categoryRaw = searchParams.get("category")?.trim() ?? "";
  const mode = (searchParams.get("mode")?.trim().toUpperCase() ?? "ALL") as "ALL" | "ONLINE" | "CITY";
  const city = searchParams.get("city")?.trim() ?? "";
  const onlyAvailable = parseBoolean(searchParams.get("availableNow"));

  const category = allowedCategories.has(categoryRaw as FindCategory) ? (categoryRaw as FindCategory) : undefined;

  const profileWhere: Record<string, unknown> = {};
  if (category) {
    profileWhere.category = category;
  }
  if (mode === "ONLINE") {
    profileWhere.isOnline = true;
  }
  if (mode === "CITY") {
    profileWhere.isOnline = false;
  }
  if (city) {
    profileWhere.city = { contains: city, mode: "insensitive" };
  }
  if (onlyAvailable) {
    profileWhere.isAvailableNow = true;
  }

  const specialists = await prisma.user.findMany({
    where: {
      AND: [
        { specialistProfile: { isNot: null } },
        { specialistProfile: { is: profileWhere } }
      ],
      ...(query
        ? {
            OR: [
              { nickname: { contains: query, mode: "insensitive" } },
              { specialistProfile: { is: { bio: { contains: query, mode: "insensitive" } } } }
            ]
          }
        : {})
    },
    select: {
      id: true,
      safeId: true,
      nickname: true,
      specialistProfile: {
        select: {
          category: true,
          city: true,
          isOnline: true,
          isAvailableNow: true,
          bio: true,
          budgetFrom: true,
          contactTelegram: true,
          contactUrl: true,
          portfolioLinks: true
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  return NextResponse.json(specialists);
});
