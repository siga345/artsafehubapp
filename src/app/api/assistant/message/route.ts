import { NextResponse } from "next/server";

import { aiProvider } from "@/lib/ai";
import { assistantMessageSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = assistantMessageSchema.parse(await request.json());

  const response = await aiProvider.sendMessage({
    message: body.message,
    songStatus: body.songStatus as any,
    taskCount: body.taskCount ?? undefined,
    pathLevelName: body.pathLevelName ?? undefined
  });

  return NextResponse.json(response, { status: 201 });
}
