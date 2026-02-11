import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ideaSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const idea = await prisma.idea.findUnique({
    where: { id: params.id },
    include: { audioClips: true }
  });

  if (!idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  return NextResponse.json(idea);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = ideaSchema.partial().parse(await request.json());

  const idea = await prisma.idea.update({
    where: { id: params.id },
    data: {
      title: body.title,
      text: body.text,
      tags: body.tags
    }
  });

  return NextResponse.json(idea);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.idea.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
