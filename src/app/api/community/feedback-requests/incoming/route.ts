import { FeedbackRecipientMode, FeedbackRequestStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { withApiHandler } from "@/lib/api";
import { feedbackRequestInclude, serializeIncomingFeedbackRequest } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const requests = await prisma.feedbackRequest.findMany({
    where: {
      recipientMode: FeedbackRecipientMode.INTERNAL_USER,
      recipientUserId: user.id,
      status: FeedbackRequestStatus.PENDING
    },
    include: feedbackRequestInclude,
    orderBy: [{ updatedAt: "desc" }]
  });

  return NextResponse.json({
    items: requests.map((request) => serializeIncomingFeedbackRequest(request))
  });
});
