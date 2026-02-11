import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { bookingSchema } from "@/lib/validators";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = bookingSchema.partial().parse(await request.json());

  const booking = await prisma.booking.update({
    where: { id: params.id },
    data: {
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt ? new Date(body.endAt) : undefined,
      status: body.status as any,
      notes: body.notes
    }
  });

  return NextResponse.json(booking);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.booking.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
