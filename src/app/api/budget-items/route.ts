import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { budgetItemSchema } from "@/lib/validators";

export async function GET() {
  const items = await prisma.songBudgetItem.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = budgetItemSchema.parse(await request.json());

  const item = await prisma.songBudgetItem.create({
    data: {
      songId: body.songId,
      category: body.category as any,
      amount: body.amount,
      currency: body.currency,
      note: body.note
    }
  });

  return NextResponse.json(item, { status: 201 });
}
