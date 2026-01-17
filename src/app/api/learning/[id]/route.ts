import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { learningItemSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const item = await prisma.learningItem.findUnique({ where: { id: params.id } });
  if (!item) {
    return NextResponse.json({ error: "Learning item not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = learningItemSchema.partial().parse(await request.json());

  const item = await prisma.learningItem.update({
    where: { id: params.id },
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

  return NextResponse.json(item);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.learningItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
