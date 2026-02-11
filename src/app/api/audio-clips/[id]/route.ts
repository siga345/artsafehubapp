import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const clip = await prisma.audioClip.findUnique({ where: { id: params.id } });
  if (!clip) {
    return NextResponse.json({ error: "Audio clip not found" }, { status: 404 });
  }

  return NextResponse.json(clip);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.audioClip.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
