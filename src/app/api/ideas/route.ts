import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ideaSchema } from "@/lib/validators";
import { getDemoUser } from "@/lib/demo";

export async function GET() {
  const ideas = await prisma.idea.findMany({
    include: { audioClips: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(ideas);
}

export async function POST(request: Request) {
  const body = ideaSchema.parse(await request.json());
  const user = await getDemoUser();

  const idea = await prisma.idea.create({
    data: {
      ownerId: user.id,
      title: body.title,
      text: body.text,
      tags: body.tags
    }
  });

  return NextResponse.json(idea, { status: 201 });
}
