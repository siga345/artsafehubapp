import { prisma } from "@/lib/prisma";

export async function getDemoUser() {
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error("No users found. Run seed to create demo user.");
  }
  return user;
}
