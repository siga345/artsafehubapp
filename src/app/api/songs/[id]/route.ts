import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { songSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const song = await prisma.song.findUnique({
    where: { id: params.id },
    include: {
      tasks: true,
      budgetItems: true,
      members: { include: { user: true } },
      audioClips: true
    }
  });

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  return NextResponse.json(song);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = songSchema.partial().parse(await request.json());

  const song = await prisma.song.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description,
      status: body.status as any,
      bpm: body.bpm ?? undefined,
      key: body.key ?? undefined
    }
  });

  return NextResponse.json(song);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.song.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
