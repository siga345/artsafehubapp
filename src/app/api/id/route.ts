import { NextResponse } from "next/server";
import { z } from "zod";
import { ArtistWorldBackgroundMode, ArtistWorldThemePreset } from "@prisma/client";

import { parseJsonBody, withApiHandler } from "@/lib/api";
import { normalizeArtistWorldPayload, serializeArtistWorld } from "@/lib/artist-growth";
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
  "hero",
  "mission",
  "values",
  "philosophy",
  "themes",
  "visual",
  "audience",
  "references",
  "projects"
]);

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
      blockOrder: z.array(artistWorldBlockIdSchema).max(9).optional(),
      hiddenBlocks: z.array(artistWorldBlockIdSchema).max(9).optional(),
      references: z.array(artistWorldReferenceSchema).max(8).optional(),
      projects: z.array(artistWorldProjectSchema).max(6).optional()
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

  return NextResponse.json(
    profile
      ? {
          ...profile,
          artistWorld: serializeArtistWorld({
            ...(profile.identityProfile ?? {}),
            references: profile.artistWorldReferences,
            projects: profile.artistWorldProjects
          })
        }
      : null
  );
});

export const PATCH = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, idUpdateSchema);
  const normalizedBandlink = normalizeOptionalHttpUrl(body.bandlink, "Bandlink");
  const normalizedArtistWorld =
    body.artistWorld
      ? {
          ...body.artistWorld,
          references: body.artistWorld.references?.map((item) => ({
            ...item,
            linkUrl: normalizeOptionalHttpUrl(item.linkUrl, "Референс")
          })),
          projects: body.artistWorld.projects?.map((item) => ({
            ...item,
            linkUrl: normalizeOptionalHttpUrl(item.linkUrl, "Проект")
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
      const { references, projects, ...identityProfileData } = artistWorld;

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
    }

    return tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        safeId: true,
        nickname: true,
        avatarUrl: true,
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
  });

  return NextResponse.json({
    ...updated,
    artistWorld: serializeArtistWorld({
      ...(updated.identityProfile ?? {}),
      references: updated.artistWorldReferences,
      projects: updated.artistWorldProjects
    })
  });
});
