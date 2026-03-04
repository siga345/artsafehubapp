import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { LearnCatalogPage } from "@/components/learn/learn-catalog-page";
import { authOptions } from "@/lib/auth";

async function requireArtistPageAccess(callbackPath: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  if (session.user.role !== "ARTIST") {
    redirect("/today");
  }
}

export default async function LearnPage() {
  await requireArtistPageAccess("/learn");
  return <LearnCatalogPage />;
}

