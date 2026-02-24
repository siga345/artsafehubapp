import { NextResponse } from "next/server";

import { aiNavigationInputSchema } from "@/contracts/ai-navigation";
import { parseJsonBody, apiError, withApiHandler } from "@/lib/api";
import { getAiRuntimeConfig } from "@/lib/ai/config";
import { suggestAiNavigation } from "@/lib/ai/navigation-service";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withApiHandler(async (request: Request) => {
  const actor = await requireUser();
  const config = getAiRuntimeConfig();
  if (!config.enabled) {
    throw apiError(403, "AI ASSIST is disabled");
  }

  const input = await parseJsonBody(request, aiNavigationInputSchema);
  const result = await suggestAiNavigation(input, actor);
  return NextResponse.json(result);
});

