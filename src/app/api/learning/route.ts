import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { learningItemSchema } from "@/lib/validators";

export async function GET() {
  const items = await prisma.learningItem.findMany();
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = learningItemSchema.parse(await request.json());

  const item = await prisma.learningItem.create({
    data: {
      type: body.type as any,
      title: body.title,
      description: body.description,
      url: body.url,
      tags: body.tags,
      pathLevelIds: body.pathLevelIds,
      songStatuses: body.songStatuses
    }
  });

  return NextResponse.json(item, { status: 201 });
}
