import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { findTestProfiles } from "./test-find-profiles";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  await prisma.demo.deleteMany();
  await prisma.track.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.dailyCheckIn.deleteMany();
  await prisma.dailyMicroStep.deleteMany();
  await prisma.weeklyActivity.deleteMany();
  await prisma.specialistProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pathStage.deleteMany();

  await prisma.pathStage.createMany({
    data: [
      {
        order: 1,
        name: "Искра",
        iconKey: "spark",
        description: "Творческий порыв"
      },
      {
        order: 2,
        name: "Формирование",
        iconKey: "mic",
        description: "Становление бренда"
      },
      {
        order: 3,
        name: "Выход в свет",
        iconKey: "knobs",
        description: "Первые успехи"
      },
      {
        order: 4,
        name: "Прорыв",
        iconKey: "record",
        description: "Закрепление влияния"
      },
      {
        order: 5,
        name: "Признание",
        iconKey: "sliders",
        description: "Стабильная аудитория"
      },
      {
        order: 6,
        name: "Широкая известность",
        iconKey: "wave",
        description: "Медийный масштаб"
      },
      {
        order: 7,
        name: "Наследие",
        iconKey: "rocket",
        description: "Культурное влияние"
      }
    ]
  });

  const stages = await prisma.pathStage.findMany({ orderBy: { order: "asc" } });
  const sparkStage = stages.find((stage: { order: number }) => stage.order === 1);
  const formationStage = stages.find((stage: { order: number }) => stage.order === 2);
  const firstSuccessStage = stages.find((stage: { order: number }) => stage.order === 3);
  const breakthroughStage = stages.find((stage: { order: number }) => stage.order === 4);
  if (!sparkStage || !formationStage || !firstSuccessStage || !breakthroughStage) {
    throw new Error("Required PATH stages are missing after seed setup.");
  }

  const user = await prisma.user.create({
    data: {
      email: "demo@artsafehub.app",
      passwordHash,
      nickname: "Demo Artist",
      safeId: "SAFE-DEMO-001",
      role: "ARTIST",
      pathStageId: breakthroughStage.id,
      links: {
        telegram: "https://t.me/demo_artist",
        youtube: "https://youtube.com/@demoartist"
      }
    }
  });

  const folder = await prisma.folder.create({
    data: {
      userId: user.id,
      title: "Новый релиз"
    }
  });

  const track = await prisma.track.create({
    data: {
      userId: user.id,
      folderId: folder.id,
      title: "Night Ride",
      pathStageId: formationStage.id
    }
  });

  await prisma.demo.createMany({
    data: [
      {
        trackId: track.id,
        audioUrl: "uploads/2026/02/12/demo-night-ride-v1.webm",
        textNote: "Черновой хук + ритм слога.",
        duration: 34
      },
      {
        trackId: track.id,
        audioUrl: "uploads/2026/02/12/demo-night-ride-v2.webm",
        textNote: "Вариант припева с другой мелодией.",
        duration: 41
      }
    ]
  });

  const today = new Date();
  const dateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dayOfWeek = dateOnly.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(dateOnly);
  weekStartDate.setUTCDate(dateOnly.getUTCDate() + mondayOffset);

  await prisma.dailyCheckIn.create({
    data: {
      userId: user.id,
      date: dateOnly,
      mood: "NORMAL",
      note: "Двигаюсь мягко, но стабильно."
    }
  });

  await prisma.dailyMicroStep.create({
    data: {
      userId: user.id,
      date: dateOnly,
      pathStageId: firstSuccessStage.id,
      text: "Собери 3 референса для продакшна.",
      isCompleted: false
    }
  });

  await prisma.weeklyActivity.create({
    data: {
      userId: user.id,
      weekStartDate,
      activeDays: 3
    }
  });

  for (const specialist of findTestProfiles) {
    const createdUser = await prisma.user.create({
      data: {
        email: specialist.email,
        passwordHash,
        nickname: specialist.nickname,
        safeId: specialist.safeId,
        role: specialist.role,
        pathStageId: sparkStage.id
      }
    });

    await prisma.specialistProfile.create({
      data: {
        userId: createdUser.id,
        category: specialist.category,
        city: specialist.city,
        metro: specialist.metro,
        isOnline: specialist.isOnline,
        isAvailableNow: specialist.isAvailableNow,
        bio: specialist.bio,
        portfolioLinks: specialist.portfolioLinks,
        services: specialist.services,
        credits: specialist.credits,
        budgetFrom: specialist.budgetFrom,
        contactTelegram: specialist.contactTelegram,
        contactUrl: specialist.contactUrl
      }
    });
  }

  console.log("Seed data created", {
    pathStages: stages.length,
    artist: user.email,
    tracks: 1,
    demos: 2,
    specialists: findTestProfiles.length
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
