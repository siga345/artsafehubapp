import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { ensureArtistWorldVisualBoards } from "@/lib/artist-growth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const optionalUrlInputSchema = z.string().max(500).optional().nullable();

const visualBoardImageSchema = z.object({
  imageUrl: z.string().min(1).max(500)
});

const visualBoardSchema = z.object({
  slug: z.enum(["aesthetics", "fashion"]),
  name: z.string().min(1).max(120),
  images: z.array(visualBoardImageSchema).max(20).optional()
});

const onboardingSchema = z.object({
  artistName: z.string().min(1).max(120),
  artistAge: z.number().int().min(10).max(100),
  nickname: z.string().min(1).max(80),
  artistCity: z.string().min(1).max(120),
  favoriteArtists: z.array(z.string().min(1).max(120)).length(3),
  lifeValues: z.string().min(1).max(600),
  musicAspirations: z.string().min(1).max(600),
  teamPreference: z.enum(["solo", "team", "both"]),
  playlistUrl: optionalUrlInputSchema,
  visualBoards: z.array(visualBoardSchema).max(2).optional()
});

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

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, onboardingSchema);
  const playlistUrl = normalizeOptionalHttpUrl(body.playlistUrl, "Плейлист");
  const visualBoards = ensureArtistWorldVisualBoards(body.visualBoards);

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { nickname: body.nickname.trim() }
    });

    await tx.artistIdentityProfile.upsert({
      where: { userId: user.id },
      update: {
        worldCreated: true,
        artistName: body.artistName.trim(),
        artistAge: body.artistAge,
        artistCity: body.artistCity.trim(),
        favoriteArtists: body.favoriteArtists.map((a) => a.trim()).filter(Boolean),
        lifeValues: body.lifeValues.trim(),
        mission: body.musicAspirations.trim(),
        teamPreference: body.teamPreference,
        playlistUrl
      },
      create: {
        userId: user.id,
        worldCreated: true,
        artistName: body.artistName.trim(),
        artistAge: body.artistAge,
        artistCity: body.artistCity.trim(),
        favoriteArtists: body.favoriteArtists.map((a) => a.trim()).filter(Boolean),
        lifeValues: body.lifeValues.trim(),
        mission: body.musicAspirations.trim(),
        teamPreference: body.teamPreference,
        playlistUrl
      }
    });

    const existingBoards = await tx.artistWorldVisualBoard.findMany({
      where: { userId: user.id },
      select: { id: true }
    });

    if (existingBoards.length > 0) {
      await tx.artistWorldVisualBoardImage.deleteMany({
        where: { boardId: { in: existingBoards.map((board) => board.id) } }
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
          sortIndex: boardIndex
        }
      });

      if (boardInput.images.length > 0) {
        await tx.artistWorldVisualBoardImage.createMany({
          data: boardInput.images.map((image, imageIndex) => ({
            boardId: board.id,
            imageUrl: image.imageUrl,
            sortIndex: imageIndex
          }))
        });
      }
    }

    return tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, nickname: true }
    });
  });

  return NextResponse.json(result);
});
