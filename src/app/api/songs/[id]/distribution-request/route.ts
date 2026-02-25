import { NextResponse } from "next/server";
import {
  DemoVersionType,
  DistributionDistributor,
  DistributionRequestStatus,
  DistributionYesNo
} from "@prisma/client";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const createDistributionRequestSchema = z
  .object({
    masterDemoId: z.string().min(1),
    artistName: z.string().trim().min(1).max(200),
    releaseTitle: z.string().trim().min(1).max(200),
    releaseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "releaseDate must be YYYY-MM-DD")
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsed.getTime());
      }, "releaseDate must be a valid date"),
    genre: z.string().trim().min(1).max(120),
    explicitContent: z.nativeEnum(DistributionYesNo),
    usesAi: z.nativeEnum(DistributionYesNo),
    promoPitchText: z.string().max(10000).nullable().optional(),
    managerHelpRequested: z.boolean(),
    distributor: z.nativeEnum(DistributionDistributor),
    distributorOtherName: z.string().max(200).nullable().optional()
  })
  .superRefine((value, ctx) => {
    const promo = value.promoPitchText?.trim() ?? "";
    if (!value.managerHelpRequested && !promo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["promoPitchText"],
        message: "promoPitchText is required unless managerHelpRequested is true"
      });
    }

    const distributorOtherName = value.distributorOtherName?.trim() ?? "";
    if (value.distributor === DistributionDistributor.OTHER && !distributorOtherName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["distributorOtherName"],
        message: "distributorOtherName is required when distributor is OTHER"
      });
    }
  });

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function serializeDistributionRequest(
  request: {
    id: string;
    masterDemoId: string;
    artistName: string;
    releaseTitle: string;
    releaseDate: Date;
    genre: string;
    explicitContent: DistributionYesNo;
    usesAi: DistributionYesNo;
    promoPitchText: string | null;
    managerHelpRequested: boolean;
    distributor: DistributionDistributor;
    distributorOtherName: string | null;
    status: DistributionRequestStatus;
    submittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return {
    id: request.id,
    masterDemoId: request.masterDemoId,
    artistName: request.artistName,
    releaseTitle: request.releaseTitle,
    releaseDate: formatDateOnly(request.releaseDate),
    genre: request.genre,
    explicitContent: request.explicitContent,
    usesAi: request.usesAi,
    promoPitchText: request.promoPitchText,
    managerHelpRequested: request.managerHelpRequested,
    distributor: request.distributor,
    distributorOtherName: request.distributorOtherName,
    status: request.status,
    submittedAt: request.submittedAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

export const GET = withApiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const track = await prisma.track.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true }
  });
  if (!track) {
    throw apiError(404, "Track not found");
  }

  const request = await prisma.trackDistributionRequest.findUnique({
    where: { trackId: track.id }
  });

  return NextResponse.json(request ? serializeDistributionRequest(request) : null);
});

export const POST = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createDistributionRequestSchema);

  const track = await prisma.track.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, userId: true, projectId: true }
  });
  if (!track) {
    throw apiError(404, "Track not found");
  }

  const masterDemo = await prisma.demo.findFirst({
    where: {
      id: body.masterDemoId,
      trackId: track.id,
      versionType: DemoVersionType.MASTERED
    },
    select: { id: true }
  });
  if (!masterDemo) {
    throw apiError(400, "Выбранная мастер-версия больше недоступна.");
  }

  const releaseDate = new Date(`${body.releaseDate}T00:00:00.000Z`);
  if (Number.isNaN(releaseDate.getTime())) {
    throw apiError(400, "Invalid releaseDate");
  }

  const now = new Date();
  const saved = await prisma.$transaction(async (tx) => {
    const upserted = await tx.trackDistributionRequest.upsert({
      where: { trackId: track.id },
      create: {
        userId: user.id,
        trackId: track.id,
        masterDemoId: masterDemo.id,
        artistName: body.artistName.trim(),
        releaseTitle: body.releaseTitle.trim(),
        releaseDate,
        genre: body.genre.trim(),
        explicitContent: body.explicitContent,
        usesAi: body.usesAi,
        promoPitchText: body.promoPitchText?.trim() ? body.promoPitchText.trim() : null,
        managerHelpRequested: body.managerHelpRequested,
        distributor: body.distributor,
        distributorOtherName:
          body.distributor === DistributionDistributor.OTHER && body.distributorOtherName?.trim()
            ? body.distributorOtherName.trim()
            : null,
        status: DistributionRequestStatus.SUBMITTED,
        submittedAt: now
      },
      update: {
        masterDemoId: masterDemo.id,
        artistName: body.artistName.trim(),
        releaseTitle: body.releaseTitle.trim(),
        releaseDate,
        genre: body.genre.trim(),
        explicitContent: body.explicitContent,
        usesAi: body.usesAi,
        promoPitchText: body.promoPitchText?.trim() ? body.promoPitchText.trim() : null,
        managerHelpRequested: body.managerHelpRequested,
        distributor: body.distributor,
        distributorOtherName:
          body.distributor === DistributionDistributor.OTHER && body.distributorOtherName?.trim()
            ? body.distributorOtherName.trim()
            : null,
        status: DistributionRequestStatus.SUBMITTED,
        submittedAt: now
      }
    });

    const releaseStage = await tx.pathStage.findFirst({
      where: { order: 7 },
      select: { id: true }
    });

    await tx.track.update({
      where: { id: track.id },
      data: {
        updatedAt: new Date(),
        pathStageId: releaseStage?.id ?? undefined
      }
    });

    if (track.projectId) {
      await tx.project.update({
        where: { id: track.projectId },
        data: { updatedAt: new Date() }
      });
    }

    return upserted;
  });

  return NextResponse.json(serializeDistributionRequest(saved));
});
