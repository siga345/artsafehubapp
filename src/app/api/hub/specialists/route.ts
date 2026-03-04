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

const findCategories = [
  "PRODUCER",
  "AUDIO_ENGINEER",
  "RECORDING_STUDIO",
  "PROMO_CREW",
  "COVER_ARTIST",
  "COVER_PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "CLIP_PRODUCTION_TEAM",
  "DESIGNER"
] as const;
type FindCategory = (typeof findCategories)[number];
const allowedCategories = new Set<FindCategory>(findCategories);

const findServices = [
  "ARRANGEMENT_BEAT",
  "VOCAL_RECORDING",
  "MIXING",
  "MASTERING",
  "COVER_ART_OR_PHOTO",
  "PROMO_PLAN",
  "VIDEO_SNIPPETS",
  "RELEASE_VISUAL_IDENTITY",
  "MUSIC_VIDEO_CLIP"
] as const;
type FindService = (typeof findServices)[number];
const allowedServices = new Set<FindService>(findServices);

const serviceRules: Record<FindService, { categories: FindCategory[]; tokens: string[]; requireTokenMatch?: boolean }> = {
  ARRANGEMENT_BEAT: {
    categories: ["PRODUCER"],
    tokens: ["аранж", "бит", "продакшн", "arrangement", "beat", "producer"]
  },
  VOCAL_RECORDING: {
    categories: ["RECORDING_STUDIO"],
    tokens: ["запись вокал", "вокал", "recording", "studio session"]
  },
  MIXING: {
    categories: ["AUDIO_ENGINEER"],
    tokens: ["свед", "mix", "mixing"],
    requireTokenMatch: true
  },
  MASTERING: {
    categories: ["AUDIO_ENGINEER"],
    tokens: ["мастер", "master"],
    requireTokenMatch: true
  },
  COVER_ART_OR_PHOTO: {
    categories: ["COVER_ARTIST", "COVER_PHOTOGRAPHER", "DESIGNER"],
    tokens: ["облож", "иллюстр", "photo", "фото", "ретуш", "дизайн"]
  },
  PROMO_PLAN: {
    categories: ["PROMO_CREW"],
    tokens: ["промо", "релизн", "smm", "pr", "маркетинг", "контент-план"]
  },
  VIDEO_SNIPPETS: {
    categories: ["VIDEOGRAPHER"],
    tokens: ["снипп", "тизер", "reel", "short-form", "shorts", "snippet"]
  },
  RELEASE_VISUAL_IDENTITY: {
    categories: ["DESIGNER", "COVER_ARTIST", "COVER_PHOTOGRAPHER"],
    tokens: ["айдентик", "визуал", "дизайн", "бренд", "облож"]
  },
  MUSIC_VIDEO_CLIP: {
    categories: ["CLIP_PRODUCTION_TEAM"],
    tokens: ["клип", "music video", "video production", "раскадров", "съемоч"]
  }
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function matchesServiceFilter(
  profile:
    | {
        category?: string | null;
        services?: string[] | null;
        bio?: string | null;
      }
    | null
    | undefined,
  service: FindService
) {
  if (!profile) return false;

  const rule = serviceRules[service];
  const haystack = [...(profile.services ?? []), profile.bio ?? ""].map(normalizeText).join(" ");
  const matchesByToken = rule.tokens.some((token) => haystack.includes(token));
  if (matchesByToken) return true;
  if (rule.requireTokenMatch) return false;

  const category = profile.category as FindCategory | undefined;
  return Boolean(category && rule.categories.includes(category));
}

export const GET = withApiHandler(async (request: Request) => {
  await requireUser();
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q")?.trim() ?? "";
  const categoryRaw = searchParams.get("category")?.trim() ?? "";
  const serviceRaw = searchParams.get("service")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";
  const onlyAvailable = parseBoolean(searchParams.get("availableNow"));

  const category = allowedCategories.has(categoryRaw as FindCategory) ? (categoryRaw as FindCategory) : undefined;
  const service = allowedServices.has(serviceRaw as FindService) ? (serviceRaw as FindService) : undefined;

  const profileWhere: Record<string, unknown> = {};
  if (category) {
    profileWhere.category = category;
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
              { specialistProfile: { is: { bio: { contains: query, mode: "insensitive" } } } },
              { specialistProfile: { is: { metro: { contains: query, mode: "insensitive" } } } },
              { specialistProfile: { is: { services: { has: query } } } },
              { specialistProfile: { is: { credits: { has: query } } } }
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
          metro: true,
          isOnline: true,
          isAvailableNow: true,
          bio: true,
          budgetFrom: true,
          contactTelegram: true,
          contactUrl: true,
          portfolioLinks: true,
          services: true,
          credits: true
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  const filteredSpecialists = service
    ? specialists.filter((item) => matchesServiceFilter(item.specialistProfile, service))
    : specialists;

  return NextResponse.json(filteredSpecialists);
});
