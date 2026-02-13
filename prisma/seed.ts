import { PrismaClient, type FindCategory, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
type SpecialistSeedUser = {
  email: string;
  nickname: string;
  safeId: string;
  role: UserRole;
  category: FindCategory;
  city: string;
  isOnline: boolean;
  isAvailableNow: boolean;
  budgetFrom: number;
  contactTelegram?: string;
  contactUrl?: string;
};

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
        name: "Идея",
        iconKey: "spark",
        description: "Зафиксируй ядро трека: тема, эмоция и хук."
      },
      {
        order: 2,
        name: "Демо",
        iconKey: "mic",
        description: "Собери первые демки и черновой вайб песни."
      },
      {
        order: 3,
        name: "Производство",
        iconKey: "knobs",
        description: "Подготовь аранжировку и продакшн-направление."
      },
      {
        order: 4,
        name: "Запись",
        iconKey: "record",
        description: "Запиши вокал и ключевые дорожки."
      },
      {
        order: 5,
        name: "Сведение",
        iconKey: "sliders",
        description: "Собери цельный микс с нужным балансом."
      },
      {
        order: 6,
        name: "Мастеринг",
        iconKey: "wave",
        description: "Подготовь финальный мастер для площадок."
      },
      {
        order: 7,
        name: "Релиз",
        iconKey: "rocket",
        description: "Выпусти трек и опубликуй на площадках."
      },
      {
        order: 8,
        name: "Промо-съёмка",
        iconKey: "camera",
        description: "Сними и подготовь промо-контент."
      },
      {
        order: 9,
        name: "Выпуск промо",
        iconKey: "megaphone",
        description: "Запусти промо и поддержи релиз активностями."
      }
    ]
  });

  const stages = await prisma.pathStage.findMany({ orderBy: { order: "asc" } });
  const ideaStage = stages.find((stage: { order: number }) => stage.order === 1);
  const demoStage = stages.find((stage: { order: number }) => stage.order === 2);
  const productionStage = stages.find((stage: { order: number }) => stage.order === 3);
  if (!ideaStage || !demoStage || !productionStage) {
    throw new Error("Required PATH stages are missing after seed setup.");
  }

  const user = await prisma.user.create({
    data: {
      email: "demo@artsafehub.app",
      passwordHash,
      nickname: "Demo Artist",
      safeId: "SAFE-DEMO-001",
      role: "ARTIST",
      pathStageId: ideaStage.id,
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
      pathStageId: demoStage.id
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
      pathStageId: productionStage.id,
      text: "Собери 3 референса для аранжировки.",
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

  const specialistUsers: SpecialistSeedUser[] = [
    {
      email: "producer@artsafehub.app",
      nickname: "Misha Prod",
      safeId: "SAFE-SP-001",
      role: "SPECIALIST",
      category: "PRODUCER",
      city: "Москва",
      isOnline: true,
      isAvailableNow: true,
      budgetFrom: 15000,
      contactTelegram: "https://t.me/misha_prod"
    },
    {
      email: "engineer@artsafehub.app",
      nickname: "Lena Mix",
      safeId: "SAFE-SP-002",
      role: "SPECIALIST",
      category: "AUDIO_ENGINEER",
      city: "Санкт-Петербург",
      isOnline: true,
      isAvailableNow: false,
      budgetFrom: 12000,
      contactTelegram: "https://t.me/lena_mix"
    },
    {
      email: "studio@artsafehub.app",
      nickname: "Frame Studio",
      safeId: "SAFE-ST-001",
      role: "STUDIO",
      category: "RECORDING_STUDIO",
      city: "Алматы",
      isOnline: false,
      isAvailableNow: true,
      budgetFrom: 8000,
      contactUrl: "https://framestudio.example"
    }
  ];

  for (const specialist of specialistUsers) {
    const createdUser = await prisma.user.create({
      data: {
        email: specialist.email,
        passwordHash,
        nickname: specialist.nickname,
        safeId: specialist.safeId,
        role: specialist.role,
        pathStageId: ideaStage.id
      }
    });

    await prisma.specialistProfile.create({
      data: {
        userId: createdUser.id,
        category: specialist.category,
        city: specialist.city,
        isOnline: specialist.isOnline,
        isAvailableNow: specialist.isAvailableNow,
        bio: "Работаю с артистами на этапах от демо до релиза.",
        portfolioLinks: ["https://example.com/portfolio"],
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
    specialists: specialistUsers.length
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
