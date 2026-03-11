import { NextResponse } from "next/server";
import { z } from "zod";
import { ArtistWorldBackgroundMode, ArtistWorldThemePreset } from "@prisma/client";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import {
  artistWorldBlockIds,
  ensureArtistWorldVisualBoards,
  normalizeArtistWorldPayload,
  serializeArtistWorld
} from "@/lib/artist-growth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { apiError } from "@/lib/api";

const artistWorldSchema = z.object({
  identityStatement: z.string().max(240).optional().nullable(),
  mission: z.string().max(240).optional().nullable(),
  philosophy: z.string().max(600).optional().nullable(),
  coreThemes: z.array(z.string().min(1).max(80)).max(12).optional(),
  aestheticKeywords: z.array(z.string().min(1).max(80)).max(12).optional(),
  visualDirection: z.string().max(240).optional().nullable(),
  audienceCore: z.string().max(240).optional().nullable(),
  differentiator: z.string().max(240).optional().nullable(),
  fashionSignals: z.array(z.string().min(1).max(80)).max(12).optional()
});

const avatarUrlSchema = z
  .string()
  .max(500)
  .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), "Avatar URL must be absolute or local")
  .optional()
  .nullable();

const localOrRemoteImageSchema = z
  .string()
  .max(500)
  .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), "Image URL must be absolute or local")
  .optional()
  .nullable();

const optionalUrlInputSchema = z.string().max(500).optional().nullable();

const artistWorldProjectSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).optional().nullable(),
  subtitle: z.string().max(160).optional().nullable(),
  description: z.string().max(600).optional().nullable(),
  linkUrl: optionalUrlInputSchema,
  coverImageUrl: localOrRemoteImageSchema
});

const artistWorldReferenceSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(120).optional().nullable(),
  creator: z.string().max(120).optional().nullable(),
  note: z.string().max(600).optional().nullable(),
  linkUrl: optionalUrlInputSchema,
  imageUrl: localOrRemoteImageSchema
});

const artistWorldBlockIdSchema = z.enum([
  "mission",
  "identity",
  "themes_audience",
  "aesthetics",
  "fashion",
  "playlist"
]);

const visualBoardImageSchema = z.object({
  id: z.string().optional(),
  imageUrl: z.string().min(1).max(500)
});

const visualBoardSchema = z.object({
  id: z.string().optional(),
  slug: z.enum(["aesthetics", "fashion"]),
  name: z.string().min(1).max(120),
  sourceUrl: optionalUrlInputSchema,
  images: z.array(visualBoardImageSchema).max(20).optional()
});

const idUpdateSchema = z.object({
  nickname: z.string().min(1).max(80).optional(),
  avatarUrl: avatarUrlSchema.optional(),
  bandlink: optionalUrlInputSchema,
  notificationsEnabled: z.boolean().optional(),
  demosPrivate: z.boolean().optional(),
  artistWorld: artistWorldSchema
    .extend({
      values: z.array(z.string().min(1).max(80)).max(12).optional(),
      themePreset: z.nativeEnum(ArtistWorldThemePreset).optional().nullable(),
      backgroundMode: z.nativeEnum(ArtistWorldBackgroundMode).optional().nullable(),
      backgroundColorA: z.string().max(32).optional().nullable(),
      backgroundColorB: z.string().max(32).optional().nullable(),
      backgroundImageUrl: localOrRemoteImageSchema.optional(),
      blockOrder: z.array(artistWorldBlockIdSchema).max(artistWorldBlockIds.length).optional(),
      hiddenBlocks: z.array(artistWorldBlockIdSchema).max(artistWorldBlockIds.length).optional(),
      references: z.array(artistWorldReferenceSchema).max(8).optional(),
      projects: z.array(artistWorldProjectSchema).max(6).optional(),
      artistName: z.string().max(120).optional().nullable(),
      artistAge: z.number().int().min(10).max(100).optional().nullable(),
      artistCity: z.string().max(120).optional().nullable(),
      favoriteArtists: z.array(z.string().min(1).max(120)).max(3).optional(),
      lifeValues: z.string().max(600).optional().nullable(),
      teamPreference: z.enum(["solo", "team", "both"]).optional().nullable(),
      playlistUrl: optionalUrlInputSchema,
      visualBoards: z.array(visualBoardSchema).max(2).optional()
    })
    .optional()
});

function parseStoredBandlink(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }

  const value = raw as Record<string, unknown>;
  if (typeof value.bandlink === "string" && value.bandlink.trim()) return value.bandlink.trim();
  if (typeof value.website === "string" && value.website.trim()) return value.website.trim();
  return "";
}

function normalizeOptionalHttpUrl(value: string | null | undefined, fieldLabel: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    throw apiError(400, `${fieldLabel}: укажи корректную ссылку.`);
  }
}

const profileSelect = {
  id: true,
  safeId: true,
  nickname: true,
  avatarUrl: true,
  links: true,
  notificationsEnabled: true,
  demosPrivate: true,
  identityProfile: true,
  artistWorldProjects: {
    orderBy: [{ sortIndex: "asc" as const }, { createdAt: "asc" as const }]
  },
  artistWorldReferences: {
    orderBy: [{ sortIndex: "asc" as const }, { createdAt: "asc" as const }]
  },
  artistWorldVisualBoards: {
    orderBy: [{ sortIndex: "asc" as const }],
    include: {
      images: {
        orderBy: [{ sortIndex: "asc" as const }, { createdAt: "asc" as const }]
      }
    }
  }
};

type ProfileWithRelations = {
  identityProfile?: Record<string, unknown> | null;
  artistWorldReferences?: Array<Record<string, unknown>>;
  artistWorldProjects?: Array<Record<string, unknown>>;
  artistWorldVisualBoards?: Array<{
    id: string;
    slug: string;
    name: string;
    sourceUrl: string | null;
    images: Array<{ id: string; imageUrl: string }>;
  }>;
  [key: string]: unknown;
};

function buildResponse(profile: ProfileWithRelations) {
  return {
    ...profile,
    artistWorld: {
      ...serializeArtistWorld({
        ...(profile.identityProfile ?? {}),
        references: profile.artistWorldReferences ?? [],
        projects: profile.artistWorldProjects ?? []
      }),
      visualBoards: ensureArtistWorldVisualBoards(profile.artistWorldVisualBoards ?? []).map((board) => ({
        id: board.id ?? board.slug,
        slug: board.slug,
        name: board.name,
        sourceUrl: board.sourceUrl,
        images: board.images.map((img) => ({
          id: img.id ?? `${board.slug}-${img.imageUrl}`,
          imageUrl: img.imageUrl
        }))
      }))
    }
  };
}

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: profileSelect
  });

  if (!profile) return NextResponse.json(null);

  return NextResponse.json(buildResponse(profile));
});

export const PATCH = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, idUpdateSchema);
  const normalizedBandlink = normalizeOptionalHttpUrl(body.bandlink, "Bandlink");
  const normalizedPlaylistUrl = body.artistWorld?.playlistUrl !== undefined
    ? normalizeOptionalHttpUrl(body.artistWorld.playlistUrl, "Плейлист")
    : undefined;
  const normalizedArtistWorld =
    body.artistWorld
      ? {
          ...body.artistWorld,
          playlistUrl: normalizedPlaylistUrl !== undefined ? normalizedPlaylistUrl : body.artistWorld.playlistUrl,
          references: body.artistWorld.references?.map((item) => ({
            ...item,
            linkUrl: normalizeOptionalHttpUrl(item.linkUrl, "Референс")
          })),
          projects: body.artistWorld.projects?.map((item) => ({
            ...item,
            linkUrl: normalizeOptionalHttpUrl(item.linkUrl, "Проект")
          })),
          visualBoards: body.artistWorld.visualBoards?.map((item) => ({
            ...item,
            sourceUrl: normalizeOptionalHttpUrl(item.sourceUrl, `${item.name}: moodboard`)
          }))
        }
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        links: true,
        notificationsEnabled: true,
        demosPrivate: true,
        identityProfile: true,
        artistWorldProjects: {
          orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }]
        },
        artistWorldReferences: {
          orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    const mergedArtistWorldInput = normalizedArtistWorld
      ? {
          ...(existing.identityProfile ?? {}),
          ...normalizedArtistWorld,
          worldCreated: true,
          worldThemePreset: normalizedArtistWorld.themePreset ?? existing.identityProfile?.worldThemePreset ?? undefined,
          worldBackgroundMode:
            normalizedArtistWorld.backgroundMode ?? existing.identityProfile?.worldBackgroundMode ?? undefined,
          worldBackgroundColorA:
            normalizedArtistWorld.backgroundColorA ?? existing.identityProfile?.worldBackgroundColorA ?? undefined,
          worldBackgroundColorB:
            normalizedArtistWorld.backgroundColorB ?? existing.identityProfile?.worldBackgroundColorB ?? undefined,
          worldBackgroundImageUrl:
            normalizedArtistWorld.backgroundImageUrl ?? existing.identityProfile?.worldBackgroundImageUrl ?? undefined,
          worldBlockOrder: normalizedArtistWorld.blockOrder ?? existing.identityProfile?.worldBlockOrder ?? undefined,
          worldHiddenBlocks: normalizedArtistWorld.hiddenBlocks ?? existing.identityProfile?.worldHiddenBlocks ?? undefined,
          references:
            normalizedArtistWorld.references ??
            existing.artistWorldReferences.map((item) => ({
              id: item.id,
              title: item.title,
              creator: item.creator,
              note: item.note,
              linkUrl: item.linkUrl,
              imageUrl: item.imageUrl
            })),
          projects:
            normalizedArtistWorld.projects ??
            existing.artistWorldProjects.map((item) => ({
              id: item.id,
              title: item.title,
              subtitle: item.subtitle,
              description: item.description,
              linkUrl: item.linkUrl,
              coverImageUrl: item.coverImageUrl
            }))
        }
      : null;

    const artistWorld = mergedArtistWorldInput ? normalizeArtistWorldPayload(mergedArtistWorldInput) : null;

    await tx.user.update({
      where: { id: user.id },
      data: {
        ...(body.nickname !== undefined ? { nickname: body.nickname.trim() } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl ?? null } : {}),
        ...(body.bandlink !== undefined
          ? {
              links: {
                bandlink: normalizedBandlink ?? ""
              }
            }
          : existing.links
            ? { links: { bandlink: parseStoredBandlink(existing.links) } }
            : {}),
        ...(body.notificationsEnabled !== undefined ? { notificationsEnabled: body.notificationsEnabled } : {}),
        ...(body.demosPrivate !== undefined ? { demosPrivate: body.demosPrivate } : {})
      }
    });

    if (artistWorld) {
      const { references, projects, visualBoards, ...identityProfileData } = artistWorld;

      await tx.artistIdentityProfile.upsert({
        where: { userId: user.id },
        update: identityProfileData,
        create: {
          userId: user.id,
          ...identityProfileData
        }
      });

      if (normalizedArtistWorld?.projects) {
        await tx.artistWorldProject.deleteMany({ where: { userId: user.id } });
        if (projects.length) {
          await tx.artistWorldProject.createMany({
            data: projects
              .filter((item) => item.title)
              .map((item, index) => ({
                userId: user.id,
                title: item.title ?? "",
                subtitle: item.subtitle ?? null,
                description: item.description ?? null,
                linkUrl: item.linkUrl ?? null,
                coverImageUrl: item.coverImageUrl ?? null,
                sortIndex: index
              }))
          });
        }
      }

      if (normalizedArtistWorld?.references) {
        await tx.artistWorldReference.deleteMany({ where: { userId: user.id } });
        if (references.length) {
          await tx.artistWorldReference.createMany({
            data: references
              .filter((item) => item.title)
              .map((item, index) => ({
                userId: user.id,
                title: item.title ?? "",
                creator: item.creator ?? null,
                note: item.note ?? null,
                linkUrl: item.linkUrl ?? null,
                imageUrl: item.imageUrl ?? null,
                sortIndex: index
              }))
          });
        }
      }

      if (normalizedArtistWorld?.visualBoards) {
        // Delete all existing board images, then boards, then recreate
        const existingBoards = await tx.artistWorldVisualBoard.findMany({
          where: { userId: user.id },
          select: { id: true }
        });
        if (existingBoards.length > 0) {
          await tx.artistWorldVisualBoardImage.deleteMany({
            where: { boardId: { in: existingBoards.map((b) => b.id) } }
          });
          await tx.artistWorldVisualBoard.deleteMany({ where: { userId: user.id } });
        }

        for (let boardIndex = 0; boardIndex < visualBoards.length; boardIndex++) {
          const boardInput = visualBoards[boardIndex];
          const board = await tx.artistWorldVisualBoard.create({
            data: {
              userId: user.id,
              slug: boardInput.slug,
              name: boardInput.name,
              sourceUrl: boardInput.sourceUrl ?? null,
              sortIndex: boardIndex
            }
          });

          if (boardInput.images.length > 0) {
            await tx.artistWorldVisualBoardImage.createMany({
              data: boardInput.images.map((img, imgIndex) => ({
                boardId: board.id,
                imageUrl: img.imageUrl,
                sortIndex: imgIndex
              }))
            });
          }
        }
      }
    }

    return tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: profileSelect
    });
  });

  return NextResponse.json(buildResponse(updated));
});
