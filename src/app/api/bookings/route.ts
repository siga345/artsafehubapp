import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { bookingSchema } from "@/lib/validators";
import { getDemoUser } from "@/lib/demo";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    orderBy: { startAt: "asc" }
  });

  return NextResponse.json(bookings);
}

export async function POST(request: Request) {
  const body = bookingSchema.parse(await request.json());
  const user = await getDemoUser();

  const booking = await prisma.booking.create({
    data: {
      userId: user.id,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      status: body.status as any,
      notes: body.notes
    }
  });

  return NextResponse.json(booking, { status: 201 });
}
