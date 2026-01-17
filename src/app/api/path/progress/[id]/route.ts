import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { pathLogSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const log = await prisma.pathProgressLog.findUnique({ where: { id: params.id } });
  if (!log) {
    return NextResponse.json({ error: "Progress log not found" }, { status: 404 });
  }
  return NextResponse.json(log);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = pathLogSchema.partial().parse(await request.json());

  const log = await prisma.pathProgressLog.update({
    where: { id: params.id },
    data: {
      type: body.type as any,
      text: body.text
    }
  });

  return NextResponse.json(log);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.pathProgressLog.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
