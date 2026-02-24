import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { findTestProfiles } from "./test-find-profiles";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const firstStage = await prisma.pathStage.findFirst({
    orderBy: { order: "asc" },
    select: { id: true }
  });

  if (!firstStage) {
    throw new Error("PathStage table is empty. Run migrations/seed for PATH stages first.");
  }

  let createdUsers = 0;
  let updatedUsers = 0;

  for (const profile of findTestProfiles) {
    const existingUser = await prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true }
    });

    const user = existingUser
      ? await prisma.user.update({
          where: { email: profile.email },
          data: {
            nickname: profile.nickname,
            role: profile.role,
            pathStageId: firstStage.id,
            passwordHash
          }
        })
      : await prisma.user.create({
          data: {
            email: profile.email,
            passwordHash,
            nickname: profile.nickname,
            safeId: profile.safeId,
            role: profile.role,
            pathStageId: firstStage.id
          }
        });

    if (existingUser) {
      updatedUsers += 1;
    } else {
      createdUsers += 1;
    }

    await prisma.specialistProfile.upsert({
      where: { userId: user.id },
      update: {
        category: profile.category,
        city: profile.city,
        metro: profile.metro,
        isOnline: profile.isOnline,
        isAvailableNow: profile.isAvailableNow,
        bio: profile.bio,
        portfolioLinks: profile.portfolioLinks,
        services: profile.services,
        credits: profile.credits,
        budgetFrom: profile.budgetFrom,
        contactTelegram: profile.contactTelegram,
        contactUrl: profile.contactUrl
      },
      create: {
        userId: user.id,
        category: profile.category,
        city: profile.city,
        metro: profile.metro,
        isOnline: profile.isOnline,
        isAvailableNow: profile.isAvailableNow,
        bio: profile.bio,
        portfolioLinks: profile.portfolioLinks,
        services: profile.services,
        credits: profile.credits,
        budgetFrom: profile.budgetFrom,
        contactTelegram: profile.contactTelegram,
        contactUrl: profile.contactUrl
      }
    });
  }

  console.log("Find test data applied", {
    totalProfiles: findTestProfiles.length,
    createdUsers,
    updatedUsers
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
