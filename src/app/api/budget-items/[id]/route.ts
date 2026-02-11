import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { budgetItemSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const item = await prisma.songBudgetItem.findUnique({ where: { id: params.id } });
  if (!item) {
    return NextResponse.json({ error: "Budget item not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = budgetItemSchema.partial().parse(await request.json());

  const item = await prisma.songBudgetItem.update({
    where: { id: params.id },
    data: {
      songId: body.songId,
      category: body.category as any,
      amount: body.amount,
      currency: body.currency,
      note: body.note
    }
  });

  return NextResponse.json(item);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.songBudgetItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
