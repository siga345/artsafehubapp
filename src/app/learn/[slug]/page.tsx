import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";

import { LearnDetailPage } from "@/components/learn/learn-detail-page";
import { authOptions } from "@/lib/auth";
import { getLearnMaterialBySlug } from "@/lib/learn/repository";
import { prisma } from "@/lib/prisma";

async function requireArtistPageAccess(callbackPath: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  if (session.user.role !== "ARTIST") {
    redirect("/today");
  }

  return session.user.id;
}

export default async function LearnMaterialPage({ params }: { params: { slug: string } }) {
  const userId = await requireArtistPageAccess(`/learn/${params.slug}`);

  const material = await getLearnMaterialBySlug(prisma, userId, params.slug);
  if (!material) {
    notFound();
  }

  return <LearnDetailPage material={material} />;
}
