import { NextResponse } from "next/server";

import { aiProvider } from "@/lib/ai";
import { assistantNextStepSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = assistantNextStepSchema.parse(await request.json());

  const response = await aiProvider.nextStep({
    songStatus: body.songStatus as any,
    taskCount: body.taskCount ?? undefined,
    pathLevelName: body.pathLevelName ?? undefined
  });

  return NextResponse.json(response, { status: 201 });
}
