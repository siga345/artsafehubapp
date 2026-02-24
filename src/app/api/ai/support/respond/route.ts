import { NextResponse } from "next/server";

import { aiSupportInputSchema } from "@/contracts/ai-support";
import { parseJsonBody, apiError, withApiHandler } from "@/lib/api";
import { getAiRuntimeConfig } from "@/lib/ai/config";
import { respondAiSupport } from "@/lib/ai/support-service";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withApiHandler(async (request: Request) => {
  const actor = await requireUser();
  const config = getAiRuntimeConfig();
  if (!config.enabled) {
    throw apiError(403, "AI ASSIST is disabled");
  }

  const input = await parseJsonBody(request, aiSupportInputSchema);
  const result = await respondAiSupport(input, actor);
  return NextResponse.json(result);
});
