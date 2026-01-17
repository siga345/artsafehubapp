import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const artists = await prisma.user.findMany({
    where: { artistProfile: { isNot: null } },
    include: { artistProfile: true }
  });

  return NextResponse.json(artists);
}
