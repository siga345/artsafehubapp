import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const specialists = await prisma.user.findMany({
    where: { specialistProfile: { isNot: null } },
    include: { specialistProfile: true }
  });

  return NextResponse.json(specialists);
}
