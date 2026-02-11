import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validators";
import { getDemoUser } from "@/lib/demo";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const body = taskSchema.parse(await request.json());
  const user = await getDemoUser();

  const task = await prisma.task.create({
    data: {
      ownerId: user.id,
      title: body.title,
      description: body.description,
      status: body.status as any,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      songId: body.songId ?? null,
      pathLevelId: body.pathLevelId ?? null
    }
  });

  return NextResponse.json(task, { status: 201 });
}
