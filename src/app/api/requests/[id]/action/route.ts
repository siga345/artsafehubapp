import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import {
  canUserOperateAction,
  mapActionType,
  requestInclude,
  resolveNextStatus,
  type RequestActionInput,
  serializeRequest
} from "@/app/api/requests/request-utils";

const actionSchema = z.object({
  action: z.enum(["MARK_VIEWED", "ACCEPT", "DECLINE", "CANCEL", "ARCHIVE"]),
  comment: z.string().trim().max(1000).optional()
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, actionSchema);

  const existing = await prisma.inAppRequest.findFirst({
    where: {
      id: params.id,
      OR: [{ artistUserId: user.id }, { specialistUserId: user.id }]
    }
  });

  if (!existing) {
    throw apiError(404, "Заявка не найдена.");
  }

  const action = body.action as RequestActionInput;

  if (!canUserOperateAction(existing, user, action)) {
    throw apiError(403, "Недостаточно прав для этого действия.");
  }

  const nextStatus = resolveNextStatus(existing.status, action);
  if (!nextStatus) {
    throw apiError(409, "Переход статуса недоступен.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.inAppRequest.update({
      where: { id: existing.id },
      data: {
        status: nextStatus
      }
    });

    await tx.inAppRequestAction.create({
      data: {
        requestId: existing.id,
        actorUserId: user.id,
        action: mapActionType(action),
        comment: body.comment?.trim() || null
      }
    });

    return tx.inAppRequest.findUniqueOrThrow({
      where: { id: updatedRequest.id },
      include: requestInclude
    });
  });

  return NextResponse.json(serializeRequest(updated, user.id));
});
