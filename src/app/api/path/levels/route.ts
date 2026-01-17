import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { pathLevelSchema } from "@/lib/validators";

export async function GET() {
  const levels = await prisma.pathLevel.findMany({
    orderBy: { order: "asc" }
  });
  return NextResponse.json(levels);
}

export async function POST(request: Request) {
  const body = pathLevelSchema.parse(await request.json());

  const level = await prisma.pathLevel.create({
    data: {
      order: body.order,
      name: body.name,
      description: body.description,
      criteria: body.criteria,
      checklistTemplate: body.checklistTemplate
    }
  });

  return NextResponse.json(level, { status: 201 });
}
