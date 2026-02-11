import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = taskSchema.partial().parse(await request.json());

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description,
      status: body.status as any,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      songId: body.songId ?? undefined,
      pathLevelId: body.pathLevelId ?? undefined
    }
  });

  return NextResponse.json(task);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
