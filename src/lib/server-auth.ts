import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw apiError(401, "Unauthorized");
  }

  return {
    id: userId,
    role: session.user.role
  };
}
