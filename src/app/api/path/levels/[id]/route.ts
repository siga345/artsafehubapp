import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { pathLevelSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const level = await prisma.pathLevel.findUnique({ where: { id: Number(params.id) } });
  if (!level) {
    return NextResponse.json({ error: "Path level not found" }, { status: 404 });
  }
  return NextResponse.json(level);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = pathLevelSchema.partial().parse(await request.json());

  const level = await prisma.pathLevel.update({
    where: { id: Number(params.id) },
    data: {
      order: body.order,
      name: body.name,
      description: body.description,
      criteria: body.criteria,
      checklistTemplate: body.checklistTemplate
    }
  });

  return NextResponse.json(level);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.pathLevel.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
