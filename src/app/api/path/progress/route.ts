import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { pathLogSchema } from "@/lib/validators";
import { getDemoUser } from "@/lib/demo";

export async function GET() {
  const logs = await prisma.pathProgressLog.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  const body = pathLogSchema.parse(await request.json());
  const user = await getDemoUser();

  const log = await prisma.pathProgressLog.create({
    data: {
      userId: user.id,
      type: body.type as any,
      text: body.text
    }
  });

  return NextResponse.json(log, { status: 201 });
}
