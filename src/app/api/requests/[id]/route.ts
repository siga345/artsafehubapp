import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { requestInclude, serializeRequest } from "@/app/api/requests/request-utils";

export const GET = withApiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const requestRecord = await prisma.inAppRequest.findFirst({
    where: {
      id: params.id,
      OR: [{ artistUserId: user.id }, { specialistUserId: user.id }]
    },
    include: requestInclude
  });

  if (!requestRecord) {
    throw apiError(404, "Заявка не найдена.");
  }

  return NextResponse.json(serializeRequest(requestRecord, user.id));
});
