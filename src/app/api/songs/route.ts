import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { songSchema } from "@/lib/validators";
import { getDemoUser } from "@/lib/demo";

export async function GET() {
  const songs = await prisma.song.findMany({
    include: {
      tasks: true,
      budgetItems: true,
      members: true,
      audioClips: true
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(songs);
}

export async function POST(request: Request) {
  const body = songSchema.parse(await request.json());
  const user = await getDemoUser();

  const song = await prisma.song.create({
    data: {
      ownerId: user.id,
      title: body.title,
      description: body.description,
      status: body.status as any,
      bpm: body.bpm ?? null,
      key: body.key ?? null
    }
  });

  return NextResponse.json(song, { status: 201 });
}
